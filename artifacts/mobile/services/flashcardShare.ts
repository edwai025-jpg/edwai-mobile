import type { Flashcard } from "./api";

/** App name and link added at the bottom of every shared deck. */
export const SHARE_APP_NAME = "EDUwAI";
export const SHARE_LINK = "https://eduwai.in";
/** Keep WhatsApp/SMS messages readable; the rest is mentioned with a count. */
export const SHARE_MAX_CARDS = 20;

/** Markdown/LaTeX → plain text that reads well in WhatsApp and SMS. */
export function plainText(value: string): string {
  return value
    .replace(/\$\$([\s\S]*?)\$\$/g, "$1")
    .replace(/\$([^$\n]+)\$/g, "$1")
    .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/\\(?:text|mathrm|mathbf)\{([^}]*)\}/g, "$1")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)")
    .replace(/\\times/g, "×").replace(/\\div/g, "÷").replace(/\\cdot/g, "·")
    .replace(/\\rightarrow|\\to/g, "→").replace(/\\leftarrow/g, "←")
    .replace(/\^\{?2\}?/g, "²").replace(/\^\{?3\}?/g, "³")
    .replace(/_\{?2\}?/g, "₂").replace(/_\{?6\}?/g, "₆")
    .replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

/** Builds the message shared to WhatsApp / SMS / any app from the phone's share menu. */
export function buildFlashcardShareText(cards: Flashcard[], topic: { question?: string; bookTitle?: string }): string {
  const title = plainText(topic.question ?? "").slice(0, 80) || "Flashcards";
  const book = plainText(topic.bookTitle ?? "");
  const shown = cards.slice(0, SHARE_MAX_CARDS);
  const lines: string[] = [];
  lines.push(`📚 *${SHARE_APP_NAME} Flashcards* — ${title}`);
  if (book) lines.push(`📖 ${book}`);
  lines.push("");
  shown.forEach((card, i) => {
    lines.push(`${i + 1}. *Q:* ${plainText(card.front)}`);
    lines.push(`    *A:* ${plainText(card.back)}`);
    lines.push("");
  });
  if (cards.length > shown.length) lines.push(`…and ${cards.length - shown.length} more cards on ${SHARE_APP_NAME}`, "");
  lines.push(`✨ Made with ${SHARE_APP_NAME} — AI study help from your own textbooks`);
  lines.push(`👉 Practise more & see plans: ${SHARE_LINK}`);
  return lines.join("\n");
}
