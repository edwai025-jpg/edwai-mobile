import type { NativePushAdapter, NativePushMessage } from "./nativeSupportPush";
import type { SupportOwner, SupportPointer } from "./supportApi";
import { parseSupportReply } from "./supportNotification";

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};
type DeviceBinding = {
  ownerKey: string | null;
  conversationId: number | null;
  optIn: boolean;
  pendingInvalidation: boolean;
  token?: string;
  retiredToken?: string;
};
type Session = {
  identity: string;
  ownerKey: string;
  owner: SupportOwner;
  pointer: SupportPointer | null;
};
export type SupportPushState = {
  identity: string | null;
  status: "off" | "unavailable" | "busy" | "enabled" | "error" | "blocked";
  optedIn: boolean;
  message: string | null;
  notice: string | null;
  openVersion: number;
  replyVersion: number;
};
type Dependencies = {
  enabled: boolean;
  native: NativePushAdapter;
  storage: Storage;
  storageKey: string;
  ownerKey: (identity: string) => string;
  loadPointer: (identity: string) => Promise<SupportPointer | null>;
  platform: "android" | "ios";
  register: (owner: SupportOwner, pointer: SupportPointer, token: string, platform: "android" | "ios", signal: AbortSignal) => Promise<void>;
  authorize: (data: unknown, owner: SupportOwner, pointer: SupportPointer | null, signal: AbortSignal) => Promise<{ kind: string }>;
};
const emptyBinding = (): DeviceBinding => ({
  ownerKey: null, conversationId: null, optIn: false, pendingInvalidation: false,
});

/**
 * One queue owns SDK token operations and backend registration. Auth changes
 * invalidate requests synchronously; the next identity waits for token cleanup.
 * Tokens/cleanup markers are persisted only through the secure storage adapter.
 */
export class SupportPushManager {
  private state: SupportPushState = {
    identity: null, status: "off", optedIn: false, message: null,
    notice: null, openVersion: 0, replyVersion: 0,
  };
  private subscribers = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private binding: DeviceBinding | null = null;
  private session: Session | null = null;
  private ready = false;
  private generation = 0;
  private controller: AbortController | null = null;
  private stopListeners: (() => void) | null = null;
  private chatVisible = false;
  private lastTap: { id: string; at: number } | null = null;
  private openRequest: { generation: number; version: number; identity: string; target: number | null } | null = null;

  constructor(private deps: Dependencies) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.subscribers.add(listener);
    return () => { this.subscribers.delete(listener); };
  };
  private publish(update: Partial<SupportPushState>) {
    this.state = { ...this.state, identity: this.session?.identity ?? null, ...update };
    for (const listener of this.subscribers) listener();
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }
  private invalidate() {
    this.generation++;
    this.openRequest = null;
    this.controller?.abort();
    this.controller = null;
  }
  private current(generation: number) {
    return generation === this.generation && !!this.session && this.ready;
  }
  private async readBinding() {
    if (this.binding) return;
    const stored = await this.deps.storage.getItem(this.deps.storageKey);
    if (!stored) { this.binding = emptyBinding(); return; }
    const data = JSON.parse(stored) as DeviceBinding;
    if (typeof data.optIn !== "boolean" || typeof data.pendingInvalidation !== "boolean"
      || (data.ownerKey !== null && typeof data.ownerKey !== "string")
      || (data.token !== undefined && typeof data.token !== "string")
      || (data.retiredToken !== undefined && typeof data.retiredToken !== "string")
      || (data.conversationId !== null && (!Number.isSafeInteger(data.conversationId) || data.conversationId <= 0))) {
      throw new Error("Invalid notification cleanup state.");
    }
    this.binding = data;
  }
  private async saveBinding() {
    await this.deps.storage.setItem(this.deps.storageKey, JSON.stringify(this.binding));
  }
  private async cleanup() {
    await this.readBinding();
    const binding = this.binding!;
    if (!binding.optIn && !binding.token && !binding.pendingInvalidation) return;
    binding.optIn = false;
    binding.pendingInvalidation = true;
    // Persist before the SDK call: a crash/offline logout must not bypass cleanup.
    await this.saveBinding();
    if (!this.deps.native.available()) throw new Error("Native cleanup unavailable.");
    await this.deps.native.invalidateToken();
    binding.retiredToken = binding.token || binding.retiredToken;
    delete binding.token;
    binding.pendingInvalidation = false;
    binding.ownerKey = null;
    binding.conversationId = null;
    await this.saveBinding();
  }
  private unavailableMessage() {
    return !this.deps.enabled
      ? "Push is disabled pending native-build and device privacy checks. Foreground chat still works."
      : "Notifications need an installed Firebase build on a physical phone. Web and Expo Go support foreground chat.";
  }
  private async listen() {
    if (this.stopListeners || !this.deps.enabled || !this.deps.native.available()) return;
    const session = this.session;
    const valid = () => this.session === session && this.ready;
    this.stopListeners = await this.deps.native.listen({
      tap: message => { if (valid()) void this.tap(message); },
      message: message => { if (valid()) void this.foreground(message); },
      token: () => { if (valid()) void this.retry(); },
      resume: () => { if (valid()) void this.resume(); },
      canPresent: data => valid() && this.canPresent(data),
    });
    if (!valid()) { this.stopListeners(); this.stopListeners = null; }
  }

  setIdentity(identity: string, owner: SupportOwner): Promise<void> {
    if (this.session?.identity === identity && this.ready) {
      this.session.owner = owner;
      return Promise.resolve();
    }
    this.invalidate();
    this.stopListeners?.(); this.stopListeners = null;
    this.chatVisible = false;
    this.ready = false;
    this.session = { identity, owner, ownerKey: this.deps.ownerKey(identity), pointer: null };
    const generation = this.generation;
    this.publish({ status: "busy", optedIn: false, message: null, notice: null });
    return this.enqueue(async () => {
      try {
        await this.readBinding();
        if (generation !== this.generation || !this.session) return;
        const session = this.session;
        session.pointer = await this.deps.loadPointer(identity);
        if (generation !== this.generation) return;
        if (this.binding!.pendingInvalidation
          || (this.binding!.optIn && (!this.deps.enabled
            || this.binding!.ownerKey !== session.ownerKey
            || this.binding!.conversationId !== session.pointer?.conversationId))) {
          await this.cleanup();
        }
        if (generation !== this.generation) return;
        this.ready = true;
        if (!this.deps.enabled || !this.deps.native.available()) {
          this.publish({ status: "unavailable", optedIn: false, message: this.unavailableMessage() });
          return;
        }
        await this.listen();
        if (generation !== this.generation) {
          this.stopListeners?.(); this.stopListeners = null;
          return;
        }
        this.publish({ status: "off", optedIn: this.binding!.optIn, message: null });
        if (this.binding!.optIn) await this.register(generation, false);
      } catch {
        if (generation === this.generation) this.publish({
          status: "blocked", optedIn: false,
          message: "Notification setup or previous-device cleanup could not be completed. Chat still works; retry cleanup before enabling push.",
        });
      }
    });
  }

  /** Called before auth credentials change, not after a React effect. */
  suspendIdentity() {
    this.invalidate();
    this.ready = false;
    this.session = null;
    this.chatVisible = false;
    this.stopListeners?.(); this.stopListeners = null;
    this.publish({ status: "busy", optedIn: false, notice: null });
    // Don't block ordinary logout on an offline native SDK. The queue and marker
    // block subsequent token registration until this cleanup finishes.
    void this.enqueue(async () => {
      try { await this.cleanup(); }
      catch { this.publish({ status: "blocked", message: "Device cleanup is pending. Notifications remain blocked." }); }
    });
  }

  setConversation(identity: string, pointer: SupportPointer | null) {
    if (this.session?.identity !== identity) return;
    // Initialization reads the same saved pointer after auth restoration.
    if (!this.ready) return;
    if (this.session.pointer?.conversationId === pointer?.conversationId) return;
    this.invalidate();
    this.session.pointer = pointer;
    const generation = this.generation;
    this.publish({ status: "busy", optedIn: false, notice: null });
    void this.enqueue(async () => {
      try {
        await this.cleanup();
        if (generation !== this.generation) return;
        await this.listen();
        this.publish({
          status: this.deps.enabled && this.deps.native.available() ? "off" : "unavailable",
          optedIn: false, message: this.deps.enabled ? "Enable notifications for this conversation when you're ready." : this.unavailableMessage(),
        });
      } catch {
        if (generation === this.generation) this.publish({
          status: "blocked", message: "Previous conversation's device cleanup is pending. Retry cleanup before enabling notifications.",
        });
      }
    });
  }
  setChatVisible(identity: string, visible: boolean) {
    if (this.session?.identity !== identity) return;
    this.chatVisible = visible;
    if (visible && this.deps.enabled && this.deps.native.available()) {
      void this.deps.native.clearBadge().catch(() => {});
    }
  }
  clearNotice() { this.publish({ notice: null }); }
  canOpen(identity: string, version: number) {
    const request = this.openRequest;
    return !!request && this.current(request.generation)
      && request.identity === identity && request.version === version
      && (request.target === null || this.session?.pointer?.conversationId === request.target);
  }

  enable(): Promise<void> {
    const generation = this.generation;
    return this.enqueue(() => this.register(generation, true));
  }
  retry(): Promise<void> {
    const generation = this.generation;
    return this.enqueue(async () => {
      if (this.current(generation) && this.binding?.optIn && !this.binding.pendingInvalidation) {
        await this.register(generation, false);
      }
    });
  }
  private async register(generation: number, requestPermission: boolean) {
    if (!this.current(generation)) return;
    if (!this.deps.enabled || !this.deps.native.available()) {
      this.publish({ status: "unavailable", message: this.unavailableMessage() });
      return;
    }
    if (!this.session!.pointer) {
      this.publish({ status: "off", message: "Start or restore a support conversation first." });
      return;
    }
    const session = this.session!;
    this.publish({ status: "busy", message: null });
    try {
      await this.readBinding();
      if (this.binding!.pendingInvalidation) throw new Error("Cleanup is pending.");
      await this.listen();
      if (!this.current(generation)) return;
      const allowed = requestPermission
        ? await this.deps.native.requestPermission() : await this.deps.native.hasPermission();
      if (!this.current(generation)) return;
      if (!allowed) {
        await this.cleanup();
        this.publish({ status: "off", optedIn: false, message: "Notification permission is off. Chat still works. You can change permission in Settings." });
        return;
      }
      this.binding!.ownerKey = session.ownerKey;
      this.binding!.conversationId = session.pointer!.conversationId;
      this.binding!.optIn = true;
      this.binding!.pendingInvalidation = true;
      await this.saveBinding();
      const token = await this.deps.native.getToken();
      this.binding!.token = token;
      await this.saveBinding();
      if (!this.current(generation)) return; // queued identity cleanup will invalidate it
      if (token === this.binding!.retiredToken) throw new Error("Retired token was reused.");
      this.binding!.pendingInvalidation = false;
      await this.saveBinding();
      if (!this.current(generation)) return;
      const controller = new AbortController();
      this.controller = controller;
      await this.deps.register(session.owner, session.pointer!, token, this.deps.platform, controller.signal);
      if (!this.current(generation) || controller.signal.aborted) return;
      this.publish({ status: "enabled", optedIn: true, message: "Device registration confirmed. Notification delivery still depends on native/provider setup." });
    } catch {
      if (!this.current(generation)) return;
      if (this.binding?.pendingInvalidation) {
        this.publish({ status: "blocked", optedIn: false, message: "Notification token cleanup is required. Retry cleanup; foreground chat still works." });
      } else {
        this.publish({ status: "error", optedIn: !!this.binding?.optIn, message: "Could not confirm notifications. Retry registration or turn them off. Chat still works." });
      }
    } finally {
      if (generation === this.generation) this.controller = null;
    }
  }
  disable(): Promise<void> {
    this.invalidate();
    const generation = this.generation;
    this.publish({ status: "busy", optedIn: false });
    return this.enqueue(async () => {
      try {
        await this.cleanup();
        if (generation === this.generation) this.publish({ status: "off", optedIn: false, message: "Support notifications are off." });
      } catch {
        if (generation === this.generation) this.publish({ status: "blocked", message: "Device cleanup is pending. Keep notifications off and retry when connected." });
      }
    });
  }
  async recover() {
    await this.disable();
    if (this.binding?.pendingInvalidation || this.state.status === "blocked") return;
    if (this.session && !this.ready) {
      const { identity, owner } = this.session;
      await this.setIdentity(identity, owner);
    }
  }
  private async resume() {
    const generation = this.generation;
    if (this.binding?.pendingInvalidation) { await this.disable(); return; }
    if (this.binding?.optIn) {
      try {
        const allowed = await this.deps.native.hasPermission();
        if (!this.current(generation)) return;
        if (!allowed) { await this.disable(); return; }
        await this.retry();
      } catch {
        if (this.current(generation)) this.publish({ status: "error", message: "Could not check notification permission. Chat still works." });
      }
    }
  }
  private matches(data: unknown) {
    const id = parseSupportReply(data);
    return id !== null && this.ready && id === this.session?.pointer?.conversationId;
  }
  private canPresent(data: unknown) {
    return !!this.binding?.optIn && !this.binding.pendingInvalidation
      && this.matches(data) && !this.chatVisible;
  }
  private foreground(message: NativePushMessage): Promise<void> {
    const generation = this.generation;
    return this.enqueue(async () => {
      if (!this.current(generation) || !this.binding?.optIn || !this.matches(message.data)) return;
      this.publish({ replyVersion: this.state.replyVersion + 1 });
      if (!this.chatVisible) {
        const id = parseSupportReply(message.data)!;
        await this.deps.native.notify({ type: "support_reply", conversation_id: String(id) }, message.id);
      }
    }).catch(() => { this.publish({ message: "A foreground alert could not be shown. Open chat to see replies." }); });
  }
  private tap(message: NativePushMessage): Promise<void> {
    if (parseSupportReply(message.data) === null) return Promise.resolve();
    if (message.id && this.lastTap?.id === message.id && Date.now() - this.lastTap.at < 3000) return Promise.resolve();
    if (message.id) this.lastTap = { id: message.id, at: Date.now() };
    const generation = this.generation;
    return this.enqueue(async () => {
      if (!this.current(generation)) return;
      const session = this.session!;
      const controller = new AbortController();
      this.controller = controller;
      try {
        const result = await this.deps.authorize(message.data, session.owner, session.pointer, controller.signal);
        if (!this.current(generation) || controller.signal.aborted) return;
        this.openRequest = {
          generation, version: this.state.openVersion + 1, identity: session.identity,
          target: result.kind === "authorized" ? session.pointer!.conversationId : null,
        };
        this.publish({
          openVersion: this.state.openVersion + 1,
          notice: result.kind === "authorized" ? null
            : "This reply's conversation is not available for your current identity. No new ticket was created.",
        });
      } catch {
        if (!this.current(generation) || controller.signal.aborted) return;
        this.openRequest = { generation, version: this.state.openVersion + 1, identity: session.identity, target: null };
        this.publish({
          openVersion: this.state.openVersion + 1,
          notice: "This support reply could not be opened. Check your connection or sign in again; no new ticket was created.",
        });
      } finally {
        if (generation === this.generation) this.controller = null;
      }
    });
  }
}
