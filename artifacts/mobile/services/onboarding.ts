/** UI validation mirrors the supplied completion contract, not the login flow. */
export function validateName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return "Name is required.";
  if (name.length < 2) return "Name must contain at least 2 characters.";
  if (name.length > 100) return "Name must be 100 characters or fewer.";
  if (!/^[\p{L} '\-]+$/u.test(name)) return "Name can contain only letters, spaces, apostrophes, and hyphens.";
  if (!/\p{L}/u.test(name)) return "Name must contain letters.";
  return "";
}

export function normalizePhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Normalize complete Indian-number paste BEFORE any length limit. Leave
  // malformed/foreign prefixes invalid instead of truncating to another number.
  if (digits.length === 12 && digits.startsWith("91")
      && (!raw.trim().startsWith("+") || raw.trim().startsWith("+91"))) {
    return digits.slice(2);
  }
  if (raw.trim().startsWith("+")) return `+${digits}`;
  return digits;
}

export function validatePhone(phone: string): string {
  if (!phone) return "";
  if (!/^\d{10}$/.test(phone)) return "Phone number must be exactly 10 digits";
  if (!/^[6-9]/.test(phone)) return "Indian mobile numbers start with 6, 7, 8, or 9";
  return "";
}

export function mutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// Approved EDUwAI frontend host from the supplied handoff, never a Replit URL.
const configuredOrigin = process.env.EXPO_PUBLIC_EDUWAI_WEB_ORIGIN;
function webOrigin(): string {
  if (!configuredOrigin) return "https://eduwai.in";
  try {
    const url = new URL(configuredOrigin);
    if (url.protocol === "https:") return url.origin;
  } catch { /* Invalid configuration must not become an executable URL. */ }
  return "https://eduwai.in";
}
export const legalUrls = {
  home: webOrigin(),
  terms: `${webOrigin()}/terms`,
  privacy: `${webOrigin()}/privacy-policy`,
};
