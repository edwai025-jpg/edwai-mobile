export type InputMode = "normal" | "transliterate" | "keyboard" | "voice";
export const INPUT_LANGUAGES = [
  { code: "hi", label: "हिंदी - Hindi" }, { code: "te", label: "తెలుగు - Telugu" },
  { code: "ta", label: "தமிழ் - Tamil" }, { code: "kn", label: "ಕನ್ನಡ - Kannada" },
  { code: "ml", label: "മലയാളം - Malayalam" }, { code: "mr", label: "मराठी - Marathi" },
  { code: "bn", label: "বাংলা - Bengali" }, { code: "gu", label: "ગુજરાતી - Gujarati" },
  { code: "pa", label: "ਪੰਜਾਬੀ - Punjabi" }, { code: "or", label: "ଓଡ଼ିଆ - Odia" },
] as const;
export type WordRange = { start: number; end: number; word: string };
export function caretWord(text: string, caret: number): WordRange | null {
  const end = Math.max(0, Math.min(text.length, caret));
  let start = end;
  while (start > 0 && !/[\s.!?,;:\-/]/.test(text[start - 1])) start--;
  const word = text.slice(start, end);
  return /^[a-zA-Z]+$/.test(word) ? { start, end, word } : null;
}
export function replaceWord(text: string, range: WordRange, candidate: string, space = true) {
  const insertion = candidate + (space ? " " : "");
  return { text: text.slice(0, range.start) + insertion + text.slice(range.end), caret: range.start + insertion.length };
}
export type VoiceQuestionUsage = { used: number; limit: number; remaining: number; allowed: boolean; period_end?: string | null };
export type VoiceQuestionResult = { transcript: string; detected_language: string; voice_question_usage: VoiceQuestionUsage };
export const MAX_VOICE_BYTES = 10 * 1024 * 1024;
export function voiceDuration(seconds: number) { return Math.min(60, Math.max(1, Math.ceil(seconds))); }
export function voicePeriodEnd(value?: string | null): string | null {
  if (!value) return null;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}
