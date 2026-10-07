import { SUPPORT_API_BASE, SupportPointer } from "./supportApi";

export function supportStorageKey(identity: string): string {
  return `support.${encodeURIComponent(SUPPORT_API_BASE).replace(/[^a-zA-Z0-9._-]/g, "_")}.${identity}`;
}

export function parseSavedSupportPointer(value: string | null, guest: boolean): SupportPointer | null {
  if (!value) return null;
  const pointer = JSON.parse(value) as SupportPointer;
  if (!Number.isSafeInteger(pointer.conversationId) || pointer.conversationId <= 0
    || (guest && !pointer.anonymousToken?.trim())
    || (!guest && pointer.anonymousToken !== undefined)) {
    throw new Error("Invalid saved support conversation.");
  }
  return pointer;
}
