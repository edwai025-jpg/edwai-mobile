const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const localRequire = createRequire(path.join(__dirname, "../package.json"));
const ts = localRequire("typescript");
function load(file, require = localRequire, extra = {}) {
  const source = fs.readFileSync(path.join(__dirname, "../services", file), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require, console, AbortController, setTimeout, clearTimeout, ...extra });
  return exports;
}
const { RecentQuestionsController, filterQuestions, bookmarkedFirst } = load("recentQuestions.ts");
const row = (id, bookmark = false, question = `Question ${id}`) => ({
  id, is_bookmarked: bookmark, question, mode: null, answer_preview: null, created_at: null,
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
test("search is case-insensitive question-only substring; counts/source text stay untouched", () => {
  const rows = [row(1, true, String.raw`తెలుగు $\frac{1}{2}$`), { ...row(2, false, "Alpha Beta"), answer_preview: "preview-only" }];
  assert.equal(filterQuestions(rows, "ALPHA")[0].id, 2);
  assert.equal(filterQuestions(rows, "preview-only").length, 0);
  assert.equal(filterQuestions(rows, " Alpha").length, 0, "Do not trim the web search rule");
  assert.equal(rows.length, 2);
  assert.equal(filterQuestions(rows, "తెలుగు")[0].question, rows[0].question);
});
test("bookmark partition is stable; timestamps are not changed or locally re-sorted", () => {
  const rows = [row(4), row(3, true), row(2), row(1, true)];
  assert.equal(bookmarkedFirst(rows).map(x => x.id).join(","), "3,1,4,2");
  assert.equal(rows.map(x => x.id).join(","), "4,3,2,1");
});
test("toggle uses history ID and acknowledged boolean; duplicate taps are ignored", async () => {
  const response = deferred(), ids = [];
  const c = new RecentQuestionsController({
    load: async () => [row(77), row(31, true)],
    toggle: id => { ids.push(id); return response.promise; },
  });
  await c.refresh();
  const toggle = c.toggle(77); await c.toggle(77);
  assert.deepEqual(ids, [77]);
  assert.equal(c.snapshot().history[0].is_bookmarked, false, "No optimistic success");
  response.resolve({ id: 77, is_bookmarked: true }); await toggle;
  assert.equal(c.snapshot().history.map(x => x.id).join(","), "77,31");
  assert.equal(c.snapshot().pendingIds.size, 0);
  c.dispose();
});
test("50-bookmark 409 preserves state and unbookmark remains possible at cap", async () => {
  let calls = 0;
  const c = new RecentQuestionsController({
    load: async () => [...Array.from({ length: 50 }, (_, i) => row(i + 1, true)), row(900)],
    toggle: async id => {
      calls++;
      if (id === 900) throw Object.assign(new Error("Bookmark limit reached (50 per book)"), { statusCode: 409 });
      return { id, is_bookmarked: false };
    },
  });
  await c.refresh(); await c.toggle(900);
  assert.match(c.snapshot().notice, /50 bookmark limit/);
  assert.equal(c.snapshot().history.find(x => x.id === 900).is_bookmarked, false);
  await c.toggle(1);
  assert.equal(c.snapshot().history.find(x => x.id === 1).is_bookmarked, false);
  assert.equal(calls, 2);
  c.dispose();
});
test("ambiguous toggle failure reconciles via GET without repeating POST", async () => {
  let gets = 0, posts = 0;
  const c = new RecentQuestionsController({
    load: async () => [row(7, ++gets > 1)],
    toggle: async () => { posts++; throw new TypeError("Response lost"); },
  });
  await c.refresh(); await c.toggle(7);
  assert.equal(posts, 1);
  assert.equal(gets, 2);
  assert.equal(c.snapshot().history[0].is_bookmarked, true);
  assert.equal(c.snapshot().uncertainIds.size, 0);
  c.dispose();
});
test("failed reconciliation preserves last acknowledged state; block toggling until GET succeeds", async () => {
  let gets = 0, posts = 0, fail = true;
  const c = new RecentQuestionsController({
    load: async () => { if (++gets > 1 && fail) throw new Error("Offline"); return [row(7)]; },
    toggle: async () => { posts++; throw new TypeError("Offline"); },
  });
  await c.refresh(); await c.toggle(7); await c.toggle(7);
  assert.equal(posts, 1);
  assert.equal(c.snapshot().history[0].is_bookmarked, false);
  assert.ok(c.snapshot().uncertainIds.has(7));
  fail = false; await c.refresh();
  assert.equal(c.snapshot().uncertainIds.size, 0);
  c.dispose();
});
test("book/account switch disposes pending work; late reads and bookmark acknowledgments are ignored", async () => {
  const get = deferred(), post = deferred();
  let call = 0;
  const oldBook = new RecentQuestionsController({
    load: () => ++call === 1 ? Promise.resolve([row(1)]) : get.promise,
    toggle: () => post.promise,
  });
  await oldBook.refresh();
  const pendingGet = oldBook.refresh(), pendingPost = oldBook.toggle(1);
  oldBook.dispose();
  const newBook = new RecentQuestionsController({ load: async () => [row(999)], toggle: async id => ({ id, is_bookmarked: false }) });
  await newBook.refresh();
  get.resolve([row(44)]); post.resolve({ id: 1, is_bookmarked: true });
  await Promise.all([pendingGet, pendingPost]);
  assert.equal(newBook.snapshot().history[0].id, 999);
  assert.equal(oldBook.snapshot().history[0].is_bookmarked, false);
  newBook.dispose();
});
test("older GET cannot overwrite an acknowledged toggle or a newer GET", async () => {
  const stale = deferred(); let gets = 0;
  const c = new RecentQuestionsController({
    load: async () => ++gets === 2 ? stale.promise : [row(1)],
    toggle: async id => ({ id, is_bookmarked: true }),
  });
  await c.refresh();
  const get = c.refresh(); await c.toggle(1);
  stale.resolve([row(1)]); await get;
  assert.equal(c.snapshot().history[0].is_bookmarked, true);
  c.dispose();
});
test("100-record server result is displayed without client pruning or invented records", async () => {
  const server = Array.from({ length: 100 }, (_, i) => row(i + 1));
  const c = new RecentQuestionsController({ load: async () => server, toggle: async id => ({ id, is_bookmarked: true }) });
  await c.refresh();
  assert.equal(c.snapshot().history.length, 100);
  assert.equal(c.snapshot().history, server);
  c.dispose();
});
test("answer refresh is one immediate GET plus bounded delayed reconciliation, no history write", async () => {
  let gets = 0;
  const c = new RecentQuestionsController({
    load: async () => ++gets === 1 ? [] : [row(701)],
    toggle: async () => { throw new Error("Must not write"); },
  });
  c.refreshAfterAnswer();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(c.snapshot().history.length, 0);
  await new Promise(resolve => setTimeout(resolve, 1230));
  assert.equal(gets, 2);
  assert.equal(c.snapshot().history[0].id, 701);
  c.dispose();
});
test("client route namespaces, bearer auth, no body/query limit on toggle/history", async () => {
  const calls = [];
  const customRequire = id => id === "react-native" ? { Platform: { OS: "ios" } }
    : id === "./profilePhotoUpload" ? { prepareProfilePhotoUpload: async value => value }
    : id === "./answerStream" ? { readAnswerStream: async () => ({ answer: "" }) }
    : localRequire(id);
  const { default: api } = load("api.ts", customRequire, {
    process: { env: {} }, FormData, URL, URLSearchParams,
    fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, text: async () => JSON.stringify(url.endsWith("bookmark") ? { id: 701, is_bookmarked: true } : []) }; },
  });
  await api.study.getQueryHistory("fictional-token", 42);
  await api.phase2.getQueryHistory("fictional-token", 104);
  await api.study.toggleBookmark("fictional-token", 701);
  await api.phase2.toggleBookmark("fictional-token", 1501);
  assert.ok(calls[0].url.endsWith("/api/query-history/42"));
  assert.ok(calls[1].url.endsWith("/api/phase2/documents/104/query-history"));
  assert.ok(calls[2].url.endsWith("/api/query-history/701/bookmark"));
  assert.ok(calls[3].url.endsWith("/api/phase2/history/1501/bookmark"));
  for (const { options } of calls) {
    assert.equal(options.headers.Authorization, "Bearer fictional-token");
    assert.equal(options.body, undefined);
  }
  assert.equal(calls[2].options.method, "POST");
});
