import type { SessionInfo } from "./api";

// Match backend enforcement even when org_id has not been populated.
export function isEducationManaged(user: { orgRole?: string | null } | null) {
  return user?.orgRole === "student";
}

export function sessionDate(value?: string | null): Date | null {
  if (!value) return null;
  const withTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
  const date = new Date(withTimezone);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function sessionLastUsed(value?: string | null, now = Date.now()): string {
  const date = sessionDate(value);
  if (!date) return "Last used: Unknown";
  const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000));
  if (minutes < 1) return "Last used: Just now";
  if (minutes < 60) return `Last used: ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last used: ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `Last used: ${days} day${days === 1 ? "" : "s"} ago`;
}

export function sessionDevice(hint: string): { label: string; mobile: boolean } {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(hint);
  const os = /Android/i.test(hint) ? "Android"
    : /iPhone|iPad/i.test(hint) ? "iOS"
      : /Windows/i.test(hint) ? "Windows"
        : /Mac/i.test(hint) ? "macOS"
          : /Linux/i.test(hint) ? "Linux" : "";
  const browser = /Edg\//i.test(hint) ? "Edge"
    : /Firefox\//i.test(hint) ? "Firefox"
      : /Chrome\/|CriOS\//i.test(hint) ? "Chrome"
        : /Safari\//i.test(hint) ? "Safari" : "";
  return { label: [browser, os].filter(Boolean).join(" · ") || hint || "Unknown device", mobile };
}

export function currentSessionsFirst(sessions: SessionInfo[]): SessionInfo[] {
  return [...sessions].sort((a, b) => Number(b.is_current) - Number(a.is_current));
}
