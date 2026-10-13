import { validateName, validatePhone } from "./onboarding";

export { validateName, validatePhone };

/** Mirrors the profile handoff, not a different signup/mailbox validator. */
export function validateAccountEmail(raw: string): string {
  const email = raw.trim();
  if (!email) return "Email is required.";
  if (email.length < 5 || email.length > 254) return "Email must contain 5–254 characters.";
  const parts = email.split("@");
  if (parts.length !== 2) return "Email must contain exactly one @.";
  const [local, domain] = parts;
  if (!local || local.length > 64 || /\s/.test(email)) return "Enter a valid email address without spaces.";
  if (!/^[A-Za-z0-9_\u00c0-\u024f\u0900-\u097f]/.test(local)) return "Enter a valid email address.";
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")
    || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")
    || domain.includes("..") || domain.split(".").at(-1)!.length < 2) {
    return "Enter a valid email address.";
  }
  return "";
}

export function validateAccountPassword(password: string, confirmation: string): string {
  if (!password && !confirmation) return "";
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)
    || !/[^A-Za-z0-9\s]/.test(password)) {
    return "Password must have at least 8 characters, an ASCII letter, a digit, and a special character.";
  }
  return password === confirmation ? "" : "Passwords do not match.";
}
