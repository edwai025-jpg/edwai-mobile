const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, extra = {}) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../services", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, { exports, AbortController, console, ...extra });
  return exports;
}
const { fetchStudyPages, streamedAnswerForDisplay, attachStudyPages } = load("studyPages.ts");
const plain = value => JSON.parse(JSON.stringify(value));
const answer = { answer: "Answer unchanged", document_id: 42, image_source_pages: [20, 18, 21], image_primary_pages: [18], sources: [{ page: 999 }] };
const data = "data:image/png;base64,fixture";

test("generated pages use backend physical IDs and stable direct-first ordering", async () => {
  const requested = [];
  const images = await fetchStudyPages(answer, "edwai_generated", new AbortController().signal, {
    generated: async (id, filename) => { requested.push([id, filename]); return data; },
    standard: async () => { throw new Error("Forbidden original fallback"); },
  });
  assert.deepEqual(plain(requested), [[42, "page_020.png"], [42, "page_018.png"], [42, "page_021.png"]]);
  assert.deepEqual(plain(images.citation_images.map(item => [item.page, item.image_role])), [[18, "direct_match"], [20, "nearby_context"], [21, "nearby_context"]]);
  assert.deepEqual(plain(images.diagram_images), []);
  const merged = attachStudyPages(answer, images, "edwai_generated");
  assert.equal(merged.answer, answer.answer);
  assert.equal(merged.sources[0].page, 999);
  assert.equal(merged.sources[0].base64_images.length, 3);
});

test("generated missing/rejected images are omitted without any fallback", async () => {
  let standardCalls = 0;
  const images = await fetchStudyPages(answer, "edwai_generated", new AbortController().signal, {
    generated: async (_id, filename) => { if (filename !== "page_018.png") throw new Error("404 unpublished"); return data; },
    standard: async () => { standardCalls++; return {}; },
  });
  assert.equal(standardCalls, 0);
  assert.deepEqual(plain(images.citation_images.map(item => item.page)), [18]);
  const empty = await fetchStudyPages(answer, "edwai_generated", new AbortController().signal, {
    generated: async () => { throw new Error("403"); }, standard: async () => { standardCalls++; },
  });
  assert.deepEqual(plain(empty.citation_images), []);
  assert.equal(attachStudyPages(answer, empty, "edwai_generated").answer, answer.answer);
  assert.equal(standardCalls, 0);
});

test("five-request frontend bound never truncates four-digit physical IDs", async () => {
  const filenames = [];
  await fetchStudyPages({ ...answer, image_source_pages: [1, 1000, 3, 4, 5, 6] }, "edwai_generated", new AbortController().signal, {
    generated: async (_id, filename) => { filenames.push(filename); return data; },
  });
  assert.deepEqual(filenames, ["page_001.png", "page_1000.png", "page_003.png", "page_004.png", "page_005.png"]);
});

test("unsupported/no-page/no-document answers never fetch", async () => {
  for (const value of [{ ...answer, answer_not_found: true }, { ...answer, image_source_pages: [] }, { ...answer, document_id: undefined }]) {
    const result = await fetchStudyPages(value, "edwai_generated", new AbortController().signal, {
      generated: async () => assert.fail("Unexpected GET"), standard: async () => assert.fail("Unexpected POST"),
    });
    assert.equal(result, null);
  }
});

test("aborted images cannot be applied to another answer", async () => {
  const ctrl = new AbortController();
  let complete;
  const request = fetchStudyPages({ ...answer, image_source_pages: [18] }, "edwai_generated", ctrl.signal, {
    generated: () => new Promise(resolve => { complete = resolve; }),
  });
  ctrl.abort(); complete(data);
  assert.equal(await request, null);
});

test("original/embedded preserve the exact standard request contract", async () => {
  for (const mode of ["original", "embedded"]) {
    let body;
    const result = await fetchStudyPages({ ...answer, is_visual_question: true }, mode, new AbortController().signal, {
      generated: () => assert.fail("Unexpected generated GET"),
      standard: async request => { body = request; return { citation_images: [], diagram_images: [] }; },
    });
    assert.deepEqual(plain(body), { document_id: 42, pages: [20, 18, 21], primary_pages: [18], include_diagrams: true });
    assert.ok(result);
  }
});

test("cached streaming generated/unsupported answers discard original image presentation", () => {
  const cached = { ...answer, sources: [{ page: 999, base64_images: [{ page: 4, data: "original" }] }], diagram_images: [{ page: 4, data: "diagram" }], phase1_citations: [{ page: 4, data: "old" }] };
  for (const value of [cached, { ...cached, answer_not_found: true }]) {
    const result = streamedAnswerForDisplay(value, "edwai_generated");
    assert.equal(result.answer, cached.answer);
    assert.equal(result.sources[0].page, 999);
    assert.equal(result.sources[0].base64_images, undefined);
    assert.deepEqual(plain(result.diagram_images), []);
  }
  assert.equal(attachStudyPages({ ...answer, sources: [] }, { citation_images: [{ page: 18, data }], diagram_images: [] }, "edwai_generated").sources.length, 0);
});

test("non-streaming JSON consumes inline pages without refetching", async () => {
  const inline = { ...answer, answerTransport: "json", sources: [{ page: 999, base64_images: [{ page: 18, pdf_page: 20, data }] }], diagram_images: [{ page: 1, data: "original" }] };
  const rendered = streamedAnswerForDisplay(inline, "edwai_generated");
  assert.equal(rendered.sources[0].base64_images[0].data, data);
  assert.deepEqual(plain(rendered.diagram_images), []);
  assert.equal(await fetchStudyPages(rendered, "edwai_generated", new AbortController().signal, { generated: () => assert.fail("Unexpected fetch") }), null);
});

function client(fetch, FileReader) {
  return load("api.ts", {
    process: { env: { EXPO_PUBLIC_DOMAIN: "fixture.replit.dev" } }, fetch, FileReader, FormData,
    require: () => ({ Platform: { OS: "web" } }),
  });
}

test("binary image API uses existing origin, auth header, signal and unchanged PNG bytes", async () => {
  const calls = [];
  class Reader {
    readAsDataURL(blob) { blob.arrayBuffer().then(buffer => { this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`; this.onload(); }); }
  }
  const api = client(async (url, options) => { calls.push({ url, options }); return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "Content-Type": "image/png" } }); }, Reader).default;
  const signal = new AbortController().signal;
  assert.equal(await api.study.fetchAiPage("fixture", 42, "page_018.png", signal), "data:image/png;base64,iVBORw==");
  assert.equal(calls[0].url, "https://fixture.replit.dev/api/edwai/ai-images/42/page_018.png");
  assert.equal(calls[0].options.headers.Authorization, "Bearer fixture");
  assert.equal(calls[0].options.signal, signal);
  assert.equal(calls[0].options.body, undefined);
});

test("binary rejection preserves status for the existing 401-refresh helper", async () => {
  for (const status of [400, 401, 403, 404]) {
    const { default: api, ApiError } = client(async () => new Response("missing", { status }));
    await assert.rejects(api.study.fetchAiPage("fixture", 42, "page_018.png"), error => error instanceof ApiError && error.statusCode === status);
  }
});

test("standard image POST forwards primary pages and the answer cancellation signal", async () => {
  let call;
  const api = client(async (url, options) => { call = { url, options }; return new Response(JSON.stringify({ citation_images: [], diagram_images: [] })); }).default;
  const signal = new AbortController().signal;
  await api.study.fetchQueryImages("fixture", { document_id: 42, pages: [18], primary_pages: [18], include_diagrams: false }, signal);
  assert.ok(call.url.endsWith("/query/images"));
  assert.equal(call.options.method, "POST");
  assert.equal(call.options.signal, signal);
  assert.deepEqual(JSON.parse(call.options.body), { document_id: 42, pages: [18], primary_pages: [18], include_diagrams: false });
});
