import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useAuth } from "@/context/auth";
import { credentialStorage } from "@/services/credentialStorage";
import {
  SUPPORT_API_BASE, SupportConversation, SupportError, SupportMessage,
  SupportOwner, SupportPointer, supportApi,
} from "@/services/supportApi";

export type GuestIntroduction = { name: string; email: string; phone: string; initialMessage: string };
type Pending = { text: string; status: "sending" | "sent" | "uncertain"; afterId: number };
const drafts = new Map<string, string>();

export function supportStorageKey(identity: string): string {
  return `support.${encodeURIComponent(SUPPORT_API_BASE).replace(/[^a-zA-Z0-9._-]/g, "_")}.${identity}`;
}
export async function clearSupportSession(identity: string) {
  const key = supportStorageKey(identity);
  drafts.delete(key);
  await credentialStorage.removeItem(key);
}

export function useSupportChat(visible: boolean) {
  const auth = useAuth();
  const isAuthenticated = auth.isLoggedIn;
  const identity = isAuthenticated ? `user.${auth.user?.id ?? "missing"}` : "guest";
  const key = supportStorageKey(identity);
  const [restoring, setRestoring] = useState(true);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [validatingSaved, setValidatingSaved] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [draft, updateDraft] = useState(drafts.get(key) || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "loading" | "connected" | "reconnecting">("idle");
  const [appState, setAppState] = useState(AppState.currentState);
  const pointer = useRef<SupportPointer | null>(null);
  const messageMap = useRef(new Map<number, SupportMessage>());
  const cursor = useRef(0);
  const resolved = useRef(false);
  const pendingRef = useRef<Pending | null>(null);
  const busyRef = useRef(false);
  const blockedRef = useRef(false);
  const alive = useRef(true);
  const active = useRef(false);
  const ready = useRef(false);
  const readController = useRef<AbortController | null>(null);
  const syncPromise = useRef<Promise<boolean> | null>(null);
  const failures = useRef(0);
  const generation = useRef(0);
  const authRef = useRef(auth);
  const tokenRef = useRef(auth.accessToken);
  authRef.current = auth;
  tokenRef.current = auth.accessToken;
  active.current = visible && appState === "active";

  const owner = useRef<SupportOwner>({
    kind: isAuthenticated ? "authenticated" : "guest",
    getToken: () => tokenRef.current,
    refreshToken: async () => {
      const token = await authRef.current.refreshAccessToken();
      tokenRef.current = token;
      return token;
    },
  }).current;

  const setDraft = useCallback((text: string) => {
    drafts.set(key, text);
    updateDraft(text);
  }, [key]);
  const putPending = useCallback((value: Pending | null) => {
    pendingRef.current = value;
    setPending(value);
  }, []);

  useEffect(() => {
    alive.current = true;
    const sub = AppState.addEventListener("change", setAppState);
    return () => {
      alive.current = false;
      generation.current += 1;
      readController.current?.abort();
      sub.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    credentialStorage.getItem(key).then((stored) => {
      if (cancelled) return;
      if (stored) {
        const data = JSON.parse(stored) as SupportPointer;
        if (!Number.isInteger(data.conversationId) || data.conversationId <= 0
          || (!isAuthenticated && typeof data.anonymousToken !== "string")) {
          throw new Error("Invalid saved conversation.");
        }
        pointer.current = data;
        setValidatingSaved(true);
      }
      if (isAuthenticated && !authRef.current.user?.id) {
        blockedRef.current = true;
        setBlocked(true);
        setNeedsSignIn(true);
        setError("Please sign in again to open support.");
      }
    }).catch(() => {
      if (!cancelled) {
        blockedRef.current = true;
        setBlocked(true);
        setError("Your saved conversation could not be restored. Start a new conversation to continue.");
      }
    }).finally(() => {
      if (!cancelled) {
        ready.current = true;
        setRestoring(false);
      }
    });
    return () => { cancelled = true; };
  }, [key, isAuthenticated]);

  const synchronize = useCallback((): Promise<boolean> => {
    if (syncPromise.current) return syncPromise.current;
    if (!pointer.current || !active.current || !ready.current || blockedRef.current) return Promise.resolve(false);
    const target = pointer.current;
    const currentGeneration = generation.current;
    const controller = new AbortController();
    readController.current = controller;
    const promise = (async () => {
      if (cursor.current === 0) setSyncState("loading");
      try {
        let count: number;
        do {
          const page = await supportApi.fetch(owner, target, cursor.current, controller.signal);
          if (!alive.current || currentGeneration !== generation.current || controller.signal.aborted) return false;
          setConversation(page.conversation);
          setValidatingSaved(false);
          resolved.current = page.conversation.status === "resolved";
          for (const message of page.messages) messageMap.current.set(message.id, message);
          const nextCursor = page.messages.reduce((max, m) => Math.max(max, m.id), cursor.current);
          count = page.messages.length;
          if (count === 100 && nextCursor <= cursor.current) throw new SupportError("Support history could not be loaded completely.");
          cursor.current = nextCursor;
          const merged = [...messageMap.current.values()].sort((a, b) => a.id - b.id);
          setMessages(merged);
          const outgoing = pendingRef.current;
          if (outgoing && outgoing.status !== "sending"
            && merged.some(m => m.id > outgoing.afterId && m.sender === "student" && m.text === outgoing.text)) {
            putPending(null);
            if (drafts.get(key)?.trim() === outgoing.text) setDraft("");
          }
        } while (count === 100 && active.current);
        failures.current = 0;
        setSyncState("connected");
        setError(null);
        return true;
      } catch (e) {
        if (!alive.current || controller.signal.aborted || currentGeneration !== generation.current) return false;
        const failure = e instanceof SupportError ? e : new SupportError("Could not load support messages.");
        failures.current += 1;
        setError(failure.message);
        setSyncState("reconnecting");
        if ([401, 403, 404].includes(failure.status)) {
          blockedRef.current = true;
          setBlocked(true);
          setValidatingSaved(false);
          setNeedsSignIn(failure.status === 401);
          if (failure.status !== 401) {
            pointer.current = null;
            await credentialStorage.removeItem(key).catch(() => {});
          }
        }
        return false;
      } finally {
        if (readController.current === controller) readController.current = null;
      }
    })();
    syncPromise.current = promise;
    promise.finally(() => {
      if (syncPromise.current === promise) syncPromise.current = null;
    }).catch(() => {});
    return promise;
  }, [key, owner, putPending, setDraft]);

  useEffect(() => {
    let wasConnected: boolean | null = null;
    return NetInfo.addEventListener((state) => {
      const connected = state.isConnected === true && state.isInternetReachable !== false;
      if (connected && wasConnected === false && active.current) {
        failures.current = 0;
        readController.current?.abort();
        const flight = syncPromise.current;
        if (flight) void flight.then(() => synchronize());
        else void synchronize();
      }
      wasConnected = connected;
    });
  }, [synchronize]);

  useEffect(() => {
    if (!visible || appState !== "active" || restoring || blocked) {
      readController.current?.abort();
      setSyncState("idle");
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await synchronize();
      if (!cancelled) timer = setTimeout(poll, Math.min(30_000, 4000 * 2 ** Math.min(failures.current, 3)));
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      readController.current?.abort();
    };
  }, [visible, appState, restoring, blocked, synchronize]);

  const submit = useCallback(async (text: string, guest?: GuestIntroduction) => {
    if (busyRef.current || pendingRef.current || blockedRef.current || !ready.current) return;
      if (!guest && !text.trim()) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const runGeneration = generation.current;
    let afterId = cursor.current;
    try {
      // Read current status and establish the echo boundary before writing.
      if (pointer.current) {
        if (!await synchronize()) return;
        if (blockedRef.current) return;
        if (resolved.current) {
          setError("This conversation is resolved. Please start a new conversation.");
          return;
        }
      }
      afterId = cursor.current;
      const outgoing = text.trim();
      if (outgoing) putPending({ text: outgoing, status: "sending", afterId });
      if (!pointer.current) {
        const created = await supportApi.create(owner, outgoing, guest);
        // Store even if the screen closed while POST was in progress; never repeat creation.
        if (!alive.current || runGeneration !== generation.current) return;
        pointer.current = created;
        setConversation({ id: created.conversationId, status: "open" });
        try { await credentialStorage.setItem(key, JSON.stringify(created)); } catch {
          setError("Chat is open, but this device could not save it for later.");
        }
      } else {
        await supportApi.send(owner, pointer.current, outgoing);
      }
      if (!alive.current || runGeneration !== generation.current) return;
      if (outgoing) {
        putPending({ text: outgoing, status: "sent", afterId });
        if (drafts.get(key)?.trim() === outgoing) setDraft("");
      }
      await synchronize();
    } catch (e) {
      if (!alive.current || runGeneration !== generation.current) return;
      const failure = e instanceof SupportError ? e : new SupportError("Unable to save this message.", 0, true);
      setError(failure.message);
      if (failure.uncertain) {
        putPending({ text: text.trim(), status: "uncertain", afterId });
        if (text.trim()) setDraft(text);
      } else {
        putPending(null);
        if (failure.status === 400) await synchronize();
        if ([401, 403, 404].includes(failure.status)) {
          blockedRef.current = true;
          setBlocked(true);
          setNeedsSignIn(failure.status === 401);
          if (failure.status !== 401) {
            pointer.current = null;
            await credentialStorage.removeItem(key).catch(() => {});
          }
        }
      }
    } finally {
      busyRef.current = false;
      if (alive.current && runGeneration === generation.current) setBusy(false);
    }
  }, [key, owner, putPending, setDraft, synchronize]);

  const send = useCallback(() => submit(drafts.get(key) || ""), [key, submit]);
  const startGuest = useCallback(async (intro: GuestIntroduction) => {
    if (isAuthenticated) return;
    if (!intro.name.trim()) { setError("Please enter your name."); return; }
    const email = intro.email.trim();
    const phone = intro.phone.replace(/\D/g, "");
    if (!email && !phone) { setError("Please enter an email address or phone number."); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError("Please enter a valid email address."); return;
    }
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      setError("Please enter a valid 10-digit Indian phone number."); return;
    }
    setDraft(intro.initialMessage);
    await submit(intro.initialMessage, { ...intro, email, phone });
  }, [isAuthenticated, setDraft, submit]);

  const newConversation = useCallback(async () => {
    if (busyRef.current) return;
    if (needsSignIn) {
      setError("Please sign in again before starting another conversation.");
      return;
    }
    readController.current?.abort();
    generation.current += 1;
    try {
      await credentialStorage.removeItem(key);
      pointer.current = null;
      cursor.current = 0;
      resolved.current = false;
      messageMap.current.clear();
      putPending(null);
      setConversation(null);
      setValidatingSaved(false);
      setMessages([]);
      setDraft("");
      setError(null);
      blockedRef.current = false;
      setBlocked(false);
      setNeedsSignIn(false);
      failures.current = 0;
      setSyncState("idle");
    } catch {
      setError("Could not reset the saved conversation. Please try again.");
    }
  }, [key, needsSignIn, putPending, setDraft]);

  const refresh = useCallback(async () => { await synchronize(); }, [synchronize]);
  const allowRetry = useCallback(async () => {
    if (busyRef.current) return;
    const outgoing = pendingRef.current;
    if (!outgoing) return;
    if (pointer.current) {
      if (!await synchronize() || !pendingRef.current) return;
    }
    // Only invoked after explicit duplicate-risk confirmation in the UI.
    setDraft(outgoing.text);
    putPending(null);
    setError(null);
  }, [putPending, setDraft, synchronize]);

  const signInAgain = useCallback(async () => {
    await authRef.current.logout();
  }, []);

  return {
    isAuthenticated, restoring: restoring || validatingSaved, conversation, messages, pending, draft, setDraft, busy, error,
    syncState, blocked, uncertain: pending?.status === "uncertain",
    send, startGuest, newConversation, refresh, allowRetry,
    needsSignIn, signInAgain,
  };
}