const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, globals) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: false },
  }).outputText;
  vm.runInNewContext(code, { exports, TextDecoder, setTimeout, clearTimeout, process: { env: {} }, ...globals });
  return exports;
}

for (const platform of ["ios", "android"]) {
  test(`${platform}: shadow migration leaves native styling unchanged`, () => {
    const { platformShadow } = load("../constants/shadow.ts", {
      require: () => ({ Platform: { OS: platform }, processColor: () => { throw Error("Native color must stay unchanged"); } }),
    });
    assert.deepEqual(JSON.parse(JSON.stringify(platformShadow("#123456", 0, -4, 0.3, 12))), {
      shadowColor: "#123456", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 12,
    });
  });
}

test("web: boxShadow matches the previous color, opacity, offset and blur", () => {
  const { platformShadow } = load("../constants/shadow.ts", {
    require: () => ({ Platform: { OS: "web" }, processColor: () => 0xff123456 }),
  });
  assert.deepEqual(JSON.parse(JSON.stringify(platformShadow("#123456", 0, -4, 0.3, 12))), {
    boxShadow: "0px -4px 12px rgba(18,52,86,0.30)",
  });
});

function fixtureResponse(text, streaming) {
  if (!streaming) return { ok: true, status: 200, body: undefined, text: async () => text };
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({
    start(controller) {
      // Deliberately split multibyte Telugu characters across reader chunks.
      for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
      controller.close();
    },
  }));
}

for (const streaming of [true, false]) {
  for (const phase of [1, 2]) {
    test(`phase ${phase}: ${streaming ? "SDK 57 reader" : "buffered fallback"} retains answer language and cancellation`, async () => {
      const answer = "తెలుగు సమాధానం";
      const metadata = { answer, language: "te", answer_language: "telugu", sources: [] };
      const text = phase === 1
        ? `data: ${JSON.stringify({ chunk: answer })}\n\ndata: ${JSON.stringify(metadata)}\n\ndata: [DONE]\n`
        : `data: ${JSON.stringify({ type: "token", content: answer })}\n\ndata: ${JSON.stringify({ type: "done", ...metadata })}\n`;
      const signal = new AbortController().signal;
      const api = load("../services/api.ts", {
        require: name => name === "react-native" ? { Platform: { OS: "ios" } } : {},
        fetch: async (_url, options) => {
          assert.equal(options.headers.Authorization, "Bearer fictional-sdk-test");
          assert.equal(options.headers.Accept, "text/event-stream");
          assert.equal(options.signal, signal);
          return fixtureResponse(text, streaming);
        },
      });
      const chunks = [];
      const result = phase === 1
        ? await api.streamQuery("/api/query", { question: "fixture" }, "fictional-sdk-test", chunk => chunks.push(chunk), signal)
        : await api.streamQueryPhase2(123, { question: "fixture", mode: "explain" }, "fictional-sdk-test", chunk => chunks.push(chunk), signal);
      assert.equal(result.answer, answer);
      assert.equal(result.language, "te");
      assert.equal(result.answer_language, "telugu");
      assert.equal(chunks.join(""), answer);
    });
  }
}

test("Own Books JSON fallback keeps answer-language metadata", async () => {
  const api = load("../services/api.ts", {
    require: name => name === "react-native" ? { Platform: { OS: "ios" } } : {},
    fetch: async () => fixtureResponse(JSON.stringify({
      answer: "తెలుగు సమాధానం", language: "te", answer_language: "telugu", cache_used: true,
    }), false),
  });
  const result = await api.streamQueryPhase2(123, { question: "fixture", mode: "explain" }, "fictional-sdk-test", () => {});
  assert.equal(result.language, "te");
  assert.equal(result.answer_language, "telugu");
  assert.equal(result.cached, true);
});
