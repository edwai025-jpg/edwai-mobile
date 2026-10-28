import { ApiError, resolveUrl, type Flashcard } from "./api";

export type StudyAnswerContext = {
  id: string; question: string; answer: string; language: string;
  bookTitle: string; pageNumber: number | null;
  orgSubdomain?: string | null;
};
export type ExplainQuota = { allowed: boolean; used: number; limit: number; remaining: number };
export type QuizQuestion = {
  question: string; options: string[]; correct: number; difficulty?: string; explanation?: string;
};
export type ReportPayload = {
  book_title: string; page_number: number | null; question: string; ai_response: string;
  issue_type: string; description: string | null;
};
export type StudyAudio = { bytes: Uint8Array; mime: string; transcript: string };

const languages: Record<string, string> = {
  english: "en-IN", hindi: "hi-IN", telugu: "te-IN", tamil: "ta-IN",
  kannada: "kn-IN", malayalam: "ml-IN", marathi: "mr-IN", gujarati: "gu-IN",
  bengali: "bn-IN", punjabi: "pa-IN", urdu: "ur-IN", odia: "or-IN",
};
export function resolveStudyLanguage(answerLanguage?: string, medium?: string, text = ""): string {
  for (const input of [answerLanguage, medium]) {
    const name = input?.trim().toLowerCase().replace(/\s+medium$/, "");
    if (name && name in languages) return name;
    const code = Object.entries(languages).find(([, code]) => code.toLowerCase() === name || code.slice(0, 2) === name);
    if (code) return code[0];
  }
  const scripts: [RegExp, string][] = [
    [/[\u0c00-\u0c7f]/, "telugu"], [/[\u0b80-\u0bff]/, "tamil"],
    [/[\u0c80-\u0cff]/, "kannada"], [/[\u0d00-\u0d7f]/, "malayalam"],
    [/[\u0900-\u097f]/, "hindi"], [/[\u0980-\u09ff]/, "bengali"],
    [/[\u0a00-\u0a7f]/, "punjabi"], [/[\u0a80-\u0aff]/, "gujarati"],
    [/[\u0b00-\u0b7f]/, "odia"], [/[\u0600-\u06ff]/, "urdu"],
  ];
  return scripts.find(([script]) => script.test(text))?.[1] ?? "english";
}
export function plainStudyText(text: string): string {
  return text.replace(/\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$[^$\n]*\$/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, " ").replace(/[`*_~#>|]/g, "").replace(/\s+/g, " ").trim();
}
export function decodeExplainText(header: string | null): string {
  if (!header) return "";
  try {
    const bytes = atob(header);
    return decodeURIComponent(Array.from(bytes, c => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
  } catch { throw new Error("The explanation transcript could not be decoded. Please try again."); }
}
export function validateQuiz(value: unknown): QuizQuestion[] {
  const rows = (value as { questions?: unknown })?.questions;
  if (!Array.isArray(rows) || !rows.length || !rows.every(q =>
    q && typeof q.question === "string" && q.question.trim()
    && Array.isArray(q.options) && q.options.length >= 2
    && q.options.every((option: unknown) => typeof option === "string" && option.trim())
    && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length
    && (q.explanation === undefined || typeof q.explanation === "string")
    && (q.difficulty === undefined || typeof q.difficulty === "string")
  )) throw new Error("The quiz contains invalid questions. Please regenerate it.");
  return rows;
}

// A definitive 401 can safely refresh once. Never retry ambiguous generation/report failures.
export async function withStudyAuth<T>(
  token: string, refreshAccessToken: () => Promise<string>, operation: (token: string) => Promise<T>
): Promise<T> {
  try { return await operation(token); }
  catch (error) {
    if (!(error instanceof ApiError) || error.statusCode !== 401) throw error;
    return operation(await refreshAccessToken());
  }
}

async function resourceRequest(
  token: string, path: string, body?: unknown, signal?: AbortSignal, binary = false,
  contextHeaders: Record<string, string> = {},
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort);
  const timeout = setTimeout(abort, 90_000);
  try {
    const response = await fetch(resolveUrl(path), {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...contextHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch {
        data = { detail: path === "/api/flashcards" ? undefined : text };
      }
      const detail = (data as { detail?: unknown })?.detail;
      const message = typeof detail === "string" && detail.trim() ? detail
        : Array.isArray(detail)
          ? detail.map(item => typeof item?.msg === "string" ? item.msg : "").filter(Boolean).join("; ")
            || `Request failed (HTTP ${response.status}).`
          : (detail as { message?: string })?.message ?? (path === "/api/flashcards"
            ? "Flashcard generation is temporarily unavailable. Please try again."
            : `Request failed (HTTP ${response.status}).`);
      throw new ApiError(message, response.status, data);
    }
    if (!binary) {
      try { return await response.json(); }
      catch {
        throw new Error(path === "/api/flashcards"
          ? "The flashcard response could not be read. Please try again."
          : "The service response could not be read. Please try again.");
      }
    }
    const mime = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"].includes(mime)) {
      throw new Error("The audio service returned an unsupported file format.");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) throw new Error("The audio service returned an empty file.");
    return { bytes, mime, transcript: decodeExplainText(response.headers.get("x-explain-text")) } as StudyAudio;
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      const message = path === "/api/support/report-answer"
        ? "The report timed out and may already be saved. Check before submitting it again."
        : path === "/api/explain"
          ? "The explanation timed out and may have consumed voice allowance. Check your quota before generating again."
          : path === "/api/flashcards"
            ? "Flashcard generation timed out. The server may still be working; retry only when you choose."
            : "Generation timed out. Please try again.";
      throw new Error(message);
    }
    if (path === "/api/flashcards" && !signal?.aborted && error instanceof TypeError) {
      throw new Error("Flashcard generation was interrupted by the server or gateway. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export const studyResources = {
  quota: async (token: string, signal?: AbortSignal): Promise<ExplainQuota> => {
    const q = await resourceRequest(token, "/api/student/explain-quota", undefined, signal);
    if (typeof q?.allowed !== "boolean" || ![q.used, q.limit, q.remaining].every(v => typeof v === "number" && Number.isFinite(v) && v >= 0)) {
      throw new Error("Voice allowance is unavailable.");
    }
    return q;
  },
  audio: async (token: string, kind: "read" | "tutor", text: string, language: string, signal?: AbortSignal): Promise<StudyAudio> =>
    resourceRequest(token, kind === "read" ? "/api/tts" : "/api/explain",
      kind === "read" ? { text: plainStudyText(text), language_code: languages[language] ?? "en-IN" }
        : { text: plainStudyText(text), language }, signal, true),
  quiz: async (token: string, text: string, language: string, signal?: AbortSignal): Promise<QuizQuestion[]> =>
    validateQuiz(await resourceRequest(token, "/api/mcq", { text: plainStudyText(text), language }, signal)),
  flashcards: async (token: string, context: StudyAnswerContext, signal?: AbortSignal): Promise<Flashcard[]> => {
    const value = await resourceRequest(token, "/api/flashcards", { question: context.question, answer: context.answer }, signal, false, {
      Accept: "application/json",
      ...(context.orgSubdomain ? { "X-Org-Subdomain": context.orgSubdomain } : {}),
    });
    const cards = value?.flashcards;
    if (!Array.isArray(cards) || cards.length < 2 || cards.length > 10
      || !Number.isInteger(value?.count) || value.count !== cards.length
      || !cards.every(c => c && typeof c.front === "string" && c.front.trim()
        && typeof c.back === "string" && c.back.trim())) {
      throw new Error("No valid flashcards were returned. Please try again.");
    }
    // Count, order and content belong to the backend, not a native word-count
    // heuristic. Unknown types get the same coherent Concept fallback as web.
    return cards.map(c => ({
      front: c.front, back: c.back,
      type: ["definition", "concept", "process", "fact", "diagram"].includes(c.type) ? c.type : "concept",
    }));
  },
  report: async (token: string, payload: ReportPayload, signal?: AbortSignal): Promise<{ ok: true }> => {
    if (!["incorrect", "too_short", "too_long", "irrelevant", "missing_concepts", "wrong_source", "other"].includes(payload.issue_type)) {
      throw new Error("Please select an issue.");
    }
    const result = await resourceRequest(token, "/api/support/report-answer", {
      ...payload, ai_response: payload.ai_response.slice(0, 500), description: payload.description?.trim() || null,
    }, signal);
    if (result?.ok !== true) throw new Error("The report was not confirmed. Please check before submitting again.");
    return { ok: true };
  },
};
