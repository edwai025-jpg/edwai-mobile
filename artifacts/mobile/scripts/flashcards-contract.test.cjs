const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
class ApiError extends Error {
  constructor(message, statusCode) { super(message); this.statusCode = statusCode; }
}
function load(file, scope) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: false },
  }).outputText;
  vm.runInNewContext(js, { exports, Error, TypeError, AbortController, setTimeout, clearTimeout, ...scope });
  return exports;
}
function client(fetch, scope = {}) {
  return load("services/studyResources.ts", {
    fetch, require: () => ({ ApiError, resolveUrl: route => `https://fixture.invalid${route}` }), ...scope,
  }).studyResources;
}
const deck = types => types.map((type, i) => ({ front: `Question ${i + 1}`, back: `Answer ${i + 1}`, type }));
const ctx = { id: "answer-1", question: "What is evaporation?", answer: "**Water** becomes vapour.\n\nతెలుగు $x$ remains intact.", language: "telugu", bookTitle: "Book", pageNumber: 2 };

for (const [words, types] of [
  [99, ["concept", "concept", "fact", "definition"]],
  [100, ["diagram", "concept", "process", "fact", "definition", "fact", "concept"]],
  [441, ["process", "concept", "concept", "definition"]],
  [1100, Array(10).fill("concept")],
]) {
  test(`${words} words: renders the entire server deck, not a client-computed target`, async () => {
    const cards = deck(types);
    const api = client(async () => Response.json({ flashcards: cards, count: cards.length }));
    const result = await api.flashcards("fixture", { ...ctx, answer: Array(words).fill("word").join(" ") });
    assert.deepEqual(JSON.parse(JSON.stringify(result)), cards);
  });
}

test("only question/answer are sent verbatim, including a long Unicode/Markdown answer", async () => {
  const answer = `${ctx.answer}${" A".repeat(9000)}`;
  const api = client(async (url, options) => {
    assert.equal(new URL(url).pathname, "/api/flashcards");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer fixture");
    assert.equal(options.headers.Accept, "application/json");
    assert.equal(options.headers["X-Org-Subdomain"], undefined);
    assert.deepEqual(JSON.parse(options.body), { question: ctx.question, answer });
    return Response.json({ flashcards: deck(["definition", "concept"]), count: 2 });
  });
  await api.flashcards("fixture", { ...ctx, answer });
  assert.equal(ctx.answer.includes("**Water**"), true);
});

test("established institute context is a header, never a user/document/count body selector", async () => {
  const api = client(async (_, options) => {
    assert.equal(options.headers["X-Org-Subdomain"], "fixture-school");
    assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(), ["answer", "question"]);
    return Response.json({ flashcards: deck(["process", "fact"]), count: 2 });
  });
  await api.flashcards("fixture", { ...ctx, orgSubdomain: "fixture-school" });
});

test("unknown/missing types normalize to Concept without dropping or reordering cards", async () => {
  const cards = deck(["concept", "concept", "fact", "definition", "fact", "diagram", "process", "unknown", undefined]);
  const result = await client(async () => Response.json({ flashcards: cards, count: cards.length })).flashcards("fixture", ctx);
  assert.equal(result.length, cards.length);
  assert.deepEqual(Array.from(result, c => c.front), cards.map(c => c.front));
  assert.deepEqual(Array.from(result, c => c.type), ["concept", "concept", "fact", "definition", "fact", "diagram", "process", "concept", "concept"]);
});

for (const body of [
  {}, { flashcards: [], count: 0 }, { flashcards: deck(["concept"]), count: 1 },
  { flashcards: deck(["concept", "fact"]), count: 3 },
  { flashcards: deck(["concept", "fact"]), count: "2" },
  { flashcards: deck(["concept", "fact"]) },
  { flashcards: [{ front: " ", back: "B" }, { front: "F", back: "B" }], count: 2 },
  { flashcards: [{ front: "F", back: null }, { front: "F2", back: "B" }], count: 2 },
  { flashcards: deck(Array(11).fill("concept")), count: 11 },
]) {
  test(`invalid envelope fails without inventing or truncating cards: ${JSON.stringify(body).slice(0, 65)}`, async () => {
    await assert.rejects(client(async () => Response.json(body)).flashcards("fixture", ctx), /No valid flashcards/);
  });
}

for (const [status, detail] of [
  [401, "Could not validate credentials"], [422, "A question of at most 1,000 characters is required."],
  [502, "Could not create a complete flashcard deck. Please try again."],
  [504, "Flashcard generation took too long. Please try again."],
]) {
  test(`HTTP ${status} preserves the server detail and does not replay generation`, async () => {
    let calls = 0;
    const api = client(async () => { calls++; return Response.json({ detail }, { status }); });
    await assert.rejects(api.flashcards("fixture", ctx), e => e instanceof ApiError && e.statusCode === status && e.message === detail);
    assert.equal(calls, 1);
  });
}

test("framework 422 arrays become readable validation text", async () => {
  const api = client(async () => Response.json({ detail: [{ msg: "Field required" }, { msg: "Invalid string" }] }, { status: 422 }));
  await assert.rejects(api.flashcards("fixture", ctx), /Field required; Invalid string/);
});

test("non-JSON success, gateway failure and transport interruption are safe actionable errors", async () => {
  await assert.rejects(client(async () => new Response("<html>oops</html>")).flashcards("fixture", ctx), /response could not be read/);
  await assert.rejects(client(async () => new Response("<html>bad gateway</html>", { status: 502 })).flashcards("fixture", ctx), /temporarily unavailable/);
  let calls = 0;
  await assert.rejects(client(async () => { calls++; throw new TypeError("Network failed"); }).flashcards("fixture", ctx), /interrupted by the server or gateway/);
  assert.equal(calls, 1);
});

test("the existing 90-second allowance covers the 65-second application deadline without claiming server cancellation", async () => {
  let expire;
  let cleared = false;
  const api = client(async (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }), {
    setTimeout: (fn, ms) => { assert.equal(ms, 90000); expire = fn; return 1; },
    clearTimeout: () => { cleared = true; },
  });
  const pending = api.flashcards("fixture", ctx);
  expire();
  await assert.rejects(pending, /server may still be working/);
  assert.equal(cleared, true);
});

test("preview proxy preserves an established institute header alongside authentication", async () => {
  let handler;
  load("../api-server/src/routes/proxy.ts", {
    require: () => ({ default: { raw: () => (_req, _res, next) => next() }, Router: () => ({ all: (_route, _middleware, fn) => { handler = fn; } }) }),
    fetch: async (_, options) => {
      assert.equal(options.headers["x-org-subdomain"], "fixture-school");
      assert.equal(options.headers.authorization, "Bearer fixture");
      return Response.json({ flashcards: deck(["concept", "fact"]), count: 2 });
    },
  });
  await handler({ params: { 0: "flashcards" }, originalUrl: "/api/edwai/flashcards", method: "POST",
    headers: { authorization: "Bearer fixture", "x-org-subdomain": "fixture-school" }, body: { question: "Q", answer: "A" } },
  { status: () => {}, set: () => {}, json: () => {}, send: () => {} });
});

test("exact palettes, icons and coherent unknown-type fallback are independent of position/mastery", () => {
  const { flashcardType } = load("constants/flashcardPalette.ts", {});
  for (const [type, label, icon, from, to] of [
    ["definition", "Definition", "📖", "#667eea", "#764ba2"],
    ["concept", "Concept", "💡", "#0ea5e9", "#2563eb"],
    ["process", "Process", "⚙️", "#10b981", "#0d9488"],
    ["fact", "Key Fact", "⚡", "#f59e0b", "#ef4444"],
    ["diagram", "Diagram", "🖼️", "#ec4899", "#8b5cf6"],
  ]) assert.deepEqual(JSON.parse(JSON.stringify(flashcardType(type))), { icon, label, from, to });
  for (const type of [undefined, null, "unknown", "__proto__", "constructor", []]) {
    assert.equal(flashcardType(type), flashcardType("concept"));
  }
});
