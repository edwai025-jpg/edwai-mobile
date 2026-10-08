const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");
class ApiError extends Error {
  constructor(message, statusCode, data) { super(message); this.statusCode = statusCode; this.data = data; }
}
function load(file, globals) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: false },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Uint8Array, AbortController, atob, setTimeout, clearTimeout, ...globals,
  });
  return exports;
}
function client(fetch) {
  return load("../services/studyResources.ts", {
    require: () => ({ ApiError, resolveUrl: url => `https://fixture.invalid${url}` }), fetch,
  });
}

test("language precedence and speech stripping keep original display text separate", () => {
  const c = client();
  assert.equal(c.resolveStudyLanguage("te-IN", "Hindi", "Hello"), "telugu");
  assert.equal(c.resolveStudyLanguage(undefined, "Marathi Medium", "Hello"), "marathi");
  assert.equal(c.resolveStudyLanguage(undefined, undefined, "தமிழ்"), "tamil");
  assert.equal(c.resolveStudyLanguage(undefined, undefined, "Hello"), "english");
  const text = "**Sets** [reference](https://example.invalid) $A-B$ \\(x=3\\) ![diagram](image.png)";
  assert.equal(c.plainStudyText(text), "Sets reference");
  assert.ok(text.includes("$A-B$"));
});

test("binary MP3/WAV and base64 UTF-8 transcript are decoded without corrupting bytes", async () => {
  const transcript = "తెలుగులో వివరణ — हिंदी";
  for (const mime of ["audio/mpeg", "audio/wav"]) {
    const calls = [];
    const c = client(async (url, options) => {
      calls.push({ url, options });
      return new Response(Uint8Array.from([255, 251, 0, 128]), {
        headers: { "content-type": mime, "x-explain-text": Buffer.from(transcript).toString("base64") },
      });
    });
    const result = await c.studyResources.audio("test-token", "tutor", "**Answer** $x$", "telugu");
    assert.equal(result.mime, mime);
    assert.deepEqual(Array.from(result.bytes), [255, 251, 0, 128]);
    assert.equal(result.transcript, transcript);
    assert.deepEqual(JSON.parse(calls[0].options.body), { text: "Answer", language: "telugu" });
    await c.studyResources.audio("test-token", "read", "Answer", "hindi");
    assert.deepEqual(JSON.parse(calls[1].options.body), { text: "Answer", language_code: "hi-IN" });
    assert.ok(!calls[0].url.includes("test-token"));
  }
});

test("structured binary-route quota error retains its details, and is not automatically retried", async () => {
  let calls = 0;
  const c = client(async () => {
    calls++;
    return new Response(JSON.stringify({ detail: { quota_exceeded: true, explain_limit: 10, explains_used: 10, message: "Voice limit reached" } }), { status: 429 });
  });
  await assert.rejects(c.withStudyAuth("test", async () => { throw new Error("must not refresh"); },
    token => c.studyResources.audio(token, "tutor", "Answer", "english")), error =>
    error.statusCode === 429 && error.data.detail.quota_exceeded && error.message === "Voice limit reached");
  assert.equal(calls, 1);
});

test("only a definitive 401 refreshes credentials once", async () => {
  let calls = 0;
  const c = client(async (_url, options) => {
    calls++;
    return options.headers.Authorization === "Bearer fresh"
      ? Response.json({ allowed: true, used: 3, limit: 50, remaining: 47 })
      : new Response("Unauthorized", { status: 401 });
  });
  const quota = await c.withStudyAuth("old", async () => "fresh", token => c.studyResources.quota(token));
  assert.equal(quota.remaining, 47);
  assert.equal(calls, 2);
});

test("quiz validates actual array and zero-based bounds instead of assuming six questions", () => {
  const c = client();
  assert.equal(c.validateQuiz({ questions: [{ question: "Q", options: ["A", "B"], correct: 0 }] }).length, 1);
  for (const correct of [-1, 2, "A", undefined]) {
    assert.throws(() => c.validateQuiz({ questions: [{ question: "Q", options: ["A", "B"], correct }] }));
  }
  assert.throws(() => c.validateQuiz({ questions: [] }));
});

test("flashcards keep original answer and question; report truncates context and confirms success", async () => {
  const sent = [];
  const c = client(async (url, options) => {
    sent.push({ url, body: JSON.parse(options.body) });
    return url.endsWith("/flashcards")
      ? Response.json({ flashcards: [{ front: "F", back: "B", type: "diagram" }] })
      : Response.json({ ok: true });
  });
  const context = Object.freeze({ id: "answer1", question: "original", answer: "**Answer** $x$", language: "english", bookTitle: "Book", pageNumber: 52 });
  assert.equal((await c.studyResources.flashcards("test", context)).length, 1);
  assert.deepEqual(sent[0].body, { question: "original", answer: "**Answer** $x$" });
  await c.studyResources.report("test", { book_title: "Book", page_number: 52, question: context.question, ai_response: "a".repeat(600), issue_type: "wrong_source", description: "  details  " });
  assert.equal(sent[1].body.ai_response.length, 500);
  assert.equal(sent[1].body.description, "details");
  assert.equal(sent[1].body.issue_type, "wrong_source");
  assert.ok(!("student_id" in sent[1].body));
  await assert.rejects(c.studyResources.report("test", { issue_type: "Incorrect answer" }));
  const failed = client(async () => Response.json({ ok: false }));
  await assert.rejects(failed.studyResources.report("test", { issue_type: "other", ai_response: "Answer" }));
});

test("requests allow 90 seconds and an answer-change AbortSignal cancels them", async () => {
  const abort = new AbortController();
  let deadline;
  const c = load("../services/studyResources.ts", {
    require: () => ({ ApiError, resolveUrl: p => p }),
    setTimeout: (_callback, duration) => { deadline = duration; return 1; },
    clearTimeout: () => {},
    fetch: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }),
  });
  const pending = c.studyResources.flashcards("test", { question: "Q", answer: "A" }, abort.signal);
  abort.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(deadline, 90000);
});

test("preview transport forwards audio bytes and explanation header privately", async () => {
  let handler;
  const data = Buffer.from([255, 251, 0, 128]);
  const transcript = Buffer.from("తెలుగు").toString("base64");
  load("../../api-server/src/routes/proxy.ts", {
    Buffer,
    require: () => ({ default: { raw: () => (_req, _res, next) => next() }, Router: () => ({ all: (_pattern, _middleware, fn) => { handler = fn; } }) }),
    fetch: async () => new Response(data, { headers: { "content-type": "audio/mpeg", "x-explain-text": transcript } }),
  });
  const headers = {};
  let bytes;
  await handler({ params: { 0: "explain" }, originalUrl: "/api/edwai/explain", headers: {}, method: "POST", body: { text: "Answer" } }, {
    status: s => assert.equal(s, 200), set: (key, value) => { headers[key] = value; }, send: value => { bytes = value; },
  });
  assert.deepEqual(bytes, data);
  assert.equal(headers["x-explain-text"], transcript);
  assert.equal(headers["cache-control"], "private, no-store");
});
