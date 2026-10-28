export type FlashcardTypeStyle = { icon: string; label: string; from: string; to: string };

export const FLASHCARD_TYPES: Record<string, FlashcardTypeStyle> = {
  definition: { icon: "\u{1F4D6}", label: "Definition", from: "#667eea", to: "#764ba2" },
  concept: { icon: "\u{1F4A1}", label: "Concept", from: "#0ea5e9", to: "#2563eb" },
  process: { icon: "\u2699\uFE0F", label: "Process", from: "#10b981", to: "#0d9488" },
  fact: { icon: "\u26A1", label: "Key Fact", from: "#f59e0b", to: "#ef4444" },
  diagram: { icon: "\u{1F5BC}\uFE0F", label: "Diagram", from: "#ec4899", to: "#8b5cf6" },
};

export function flashcardType(t: unknown): FlashcardTypeStyle {
  return (typeof t === "string" && Object.prototype.hasOwnProperty.call(FLASHCARD_TYPES, t) && FLASHCARD_TYPES[t]) || FLASHCARD_TYPES.concept;
}

export const FLASHCARD_COLORS = {
  white: "#ffffff",
  pill: "rgba(255,255,255,0.2)",
  dim: "rgba(255,255,255,0.6)",
  dot: "rgba(255,255,255,0.5)",
  skeleton: ["#e0e7ff", "#c7d2fe"] as const,
  progress: ["#10b981", "#3b82f6"] as const,
  mastered: "#10b981",
  masteredBg: "#d1fae5",
  masteredText: "#047857",
  dotLight: "#d1d5db",
  dotDark: "rgba(255,255,255,0.2)",
  error: "#e11d48",
};
