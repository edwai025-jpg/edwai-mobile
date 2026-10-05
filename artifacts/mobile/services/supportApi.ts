export const SUPPORT_API_BASE = (
  process.env.EXPO_PUBLIC_SUPPORT_API_URL || "https://api.eduwai.in/api"
).replace(/\/+$/, "");

export type SupportMessage = {
  id: number;
  sender: "student" | "admin";
  sender_name?: string;
  text: string;
  created_at: string;
};
export type SupportConversation = { id: number; status: "open" | "resolved" };
export type SupportPointer = { conversationId: number; anonymousToken?: string };
export type SupportOwner = {
  kind: "guest" | "authenticated";
  getToken?: () => string | null;
  refreshToken?: () => Promise<string>;
};
type Creation = { conversation_id: number; anonymous_token: string | null };
type Thread = { conversation: SupportConversation; messages: SupportMessage[] };

export class SupportError extends Error {
  constructor(message: string, public status = 0, public uncertain = false) {
    super(message);
  }
}

function detailMessage(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => typeof d?.msg === "string" ? d.msg : "Invalid request").join(". ");
  }
  return null;
}

async function request<T>(
  path: string, owner: SupportOwner, body?: unknown, signal?: AbortSignal, refreshed = false,
): Promise<T> {
  if (!SUPPORT_API_BASE.startsWith("https://")) throw new SupportError("Support requires a secure HTTPS API.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort);
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, 20_000);
  const token = owner.kind === "authenticated" ? owner.getToken?.() : null;
  if (owner.kind === "authenticated" && !token) {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    throw new SupportError("Please sign in again to contact support.", 401);
  }
  let response: Response;
  let text: string;
  try {
    response = await fetch(`${SUPPORT_API_BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    text = await response.text();
  } catch {
    throw new SupportError(
      body === undefined ? "Cannot connect to support. We will try again while this chat is open."
        : "Connection interrupted. Your message may have been saved. Check delivery before retrying.",
      0, body !== undefined,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
  if (response.status === 401 && owner.kind === "authenticated" && !refreshed && owner.refreshToken) {
    try {
      await owner.refreshToken();
    } catch {
      throw new SupportError("Your session expired. Please sign in again.", 401);
    }
    return request<T>(path, owner, body, signal, true);
  }
  let data: unknown;
  try { data = JSON.parse(text); } catch {
    throw new SupportError("Support returned an unexpected response. Please check your connection.", response.status, body !== undefined);
  }
  if (!response.ok) {
    const defaultMessage = response.status === 401 ? "Please sign in again."
      : response.status === 403 || response.status === 404 ? "This conversation is no longer accessible. You can start a new one."
      : "Support is temporarily unavailable. Please try again.";
    throw new SupportError(detailMessage((data as { detail?: unknown })?.detail) || defaultMessage,
      response.status, body !== undefined && response.status >= 500);
  }
  return data as T;
}

export const supportApi = {
  async create(owner: SupportOwner, text: string, guest?: { name: string; email: string; phone: string }): Promise<SupportPointer> {
    const result = await request<Creation>(
      owner.kind === "authenticated" ? "/support/conversation/auth" : "/support/conversation",
      owner,
      {
        type: "support", context: null, initial_message: text.trim() || null,
        ...(owner.kind === "guest" ? {
          guest_name: guest?.name.trim(), guest_email: guest?.email.trim() || null,
          guest_phone: guest?.phone || null,
        } : {}),
      },
    );
    if (!Number.isInteger(result.conversation_id) || result.conversation_id <= 0
      || (owner.kind === "guest" && !result.anonymous_token)) {
      throw new SupportError("Support did not return conversation credentials. The conversation may have been created.", 0, true);
    }
    return { conversationId: result.conversation_id, ...(result.anonymous_token ? { anonymousToken: result.anonymous_token } : {}) };
  },
  async fetch(owner: SupportOwner, pointer: SupportPointer, cursor: number, signal?: AbortSignal): Promise<Thread> {
    const params = new URLSearchParams({ since_id: String(cursor) });
    if (owner.kind === "guest") params.set("anonymous_token", pointer.anonymousToken || "");
    const result = await request<Thread>(
      `/support/conversation/${owner.kind === "authenticated" ? "auth/" : ""}${pointer.conversationId}?${params}`,
      owner, undefined, signal,
    );
    if (!result.conversation || !Array.isArray(result.messages)
      || result.conversation.id !== pointer.conversationId
      || !["open", "resolved"].includes(result.conversation.status)
      || result.messages.some(m => !Number.isInteger(m.id) || m.id <= 0 || typeof m.text !== "string"
        || !["student", "admin"].includes(m.sender))) {
      throw new SupportError("Support returned an invalid conversation response.");
    }
    return result;
  },
  async send(owner: SupportOwner, pointer: SupportPointer, text: string): Promise<void> {
    const result = await request<{ success: boolean }>(
      `/support/conversation/${owner.kind === "authenticated" ? "auth/" : ""}${pointer.conversationId}/message`,
      owner, { text, ...(owner.kind === "guest" ? { guest_token: pointer.anonymousToken } : {}) },
    );
    if (result.success !== true) throw new SupportError("Message confirmation was missing. Please check delivery.", 0, true);
  },
};