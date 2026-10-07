import { SupportOwner, SupportPointer, supportApi } from "./supportApi";

// SDK-independent payload validation shared by the native listener and tests.
// Notification text is never inserted into history.
export function parseSupportReply(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as Record<string, unknown>;
  if (payload.type !== "support_reply"
    || typeof payload.conversation_id !== "string"
    || !/^[1-9]\d*$/.test(payload.conversation_id)) return null;
  const id = Number(payload.conversation_id);
  return Number.isSafeInteger(id) ? id : null;
}

/**
 * The caller must load `savedPointer` ONLY from the active identity's secure,
 * API-environment-scoped namespace, after auth restoration has completed.
 * Never search another user's or a guest's namespace to satisfy a push ID.
 * Fetch only on an explicit notification tap, not to compute unread counts.
 * Before showing the result, the caller must recheck its session generation.
 */
export async function authorizeSupportReply(
  data: unknown, owner: SupportOwner, savedPointer: SupportPointer | null,
  signal?: AbortSignal,
) {
  const id = parseSupportReply(data);
  if (id === null) return { kind: "ignored" as const };
  if (!savedPointer || savedPointer.conversationId !== id
    || (owner.kind === "guest" && !savedPointer.anonymousToken?.trim())
    || (owner.kind === "authenticated" && savedPointer.anonymousToken !== undefined)) {
    return { kind: "recovery" as const };
  }
  // A local pointer is not authorization. Let the existing API authorize it.
  const thread = await supportApi.fetch(owner, savedPointer, 0, signal);
  return { kind: "authorized" as const, thread };
}
