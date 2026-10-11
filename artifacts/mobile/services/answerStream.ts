import type { QueryResponse } from "./api";

// Preserve Unicode decoder state, SSE line boundaries, backslashes, and every token's whitespace.
export async function readAnswerStream(res: Response, onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<QueryResponse> {
  let raw = "", pending = "", accumulated = "", sawSse = false, complete = false;
  const metadata: Partial<QueryResponse> = {};
  const acceptLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    sawSse = true;
    const payload = line.slice(5).trim();
    if (!payload) return;
    if (payload === "[DONE]") { complete = true; return; }
    let event: Record<string, unknown>;
    try { event = JSON.parse(payload); } catch { return; }
    if (!event || typeof event !== "object") return;
    if (event.type === "error") {
      metadata.answer = `Error: ${String(event.content ?? "Could not retrieve the answer.")}`;
      metadata.sources = []; complete = true; return;
    }
    const token = typeof event.chunk === "string" ? event.chunk : event.type === "token" && typeof event.content === "string" ? event.content : null;
    if (token !== null) { accumulated += token; onChunk(token); }
    else {
      Object.assign(metadata, event);
      if (typeof event.cache_used === "boolean") metadata.cached = event.cache_used;
      if (event.type === "done") complete = true;
    }
  };
  const ingest = (text: string) => {
    raw += text; pending += text;
    let newline: number;
    while (!complete && (newline = pending.indexOf("\n")) !== -1) {
      const line = pending.slice(0, newline).replace(/\r$/, "");
      pending = pending.slice(newline + 1); acceptLine(line);
    }
  };
  const checkAbort = () => {
    if (signal?.aborted) { const error = new Error("Answer request cancelled"); error.name = "AbortError"; throw error; }
  };
  const reader = res.body?.getReader?.();
  if (reader) {
    const decoder = new TextDecoder();
    try {
      // A done event can precede the backend's history write. Let the response
      // close normally instead of cancelling the server while it is persisting.
      while (true) {
        checkAbort();
        const { done, value } = await reader.read();
        checkAbort();
        if (done) { ingest(decoder.decode()); break; }
        ingest(decoder.decode(value, { stream: true }));
      }
    } finally {
      if (signal?.aborted) await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  } else { checkAbort(); ingest(await res.text()); checkAbort(); }
  if (!complete && pending) acceptLine(pending.replace(/\r$/, ""));
  if (sawSse) return { ...metadata, answer: typeof metadata.answer === "string" && metadata.answer ? metadata.answer : accumulated } as QueryResponse;
  const result = JSON.parse(raw) as QueryResponse & { cache_used?: boolean };
  if (typeof result.answer !== "string") throw new Error("The API returned an unexpected answer response.");
  if (result.answer) onChunk(result.answer);
  return { ...result, cached: result.cached ?? result.cache_used, answerTransport: "json" };
}
