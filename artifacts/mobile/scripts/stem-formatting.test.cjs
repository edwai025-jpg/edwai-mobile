const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const localRequire = createRequire(path.join(__dirname, "../package.json"));
const ts = localRequire("typescript");
function load(file) {
  const source = fs.readFileSync(path.join(__dirname, "../services", file), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: localRequire, console, TextDecoder, TextEncoder });
  return exports;
}
// Match Metro's ES-import conditions; a CommonJS test import of mhchem would register
// a different KaTeX instance from rehype-katex's ES import and falsely fail chemistry.
async function loadFormatting() {
  const source = fs.readFileSync(path.join(__dirname, "../services/stemFormatting.ts"), "utf8");
  const target = path.join(__dirname, "../generated-artifacts/stem-formatting.test.mjs");
  fs.writeFileSync(target, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  return import(require("node:url").pathToFileURL(target).href);
}
require("./generate-stem-assets.cjs");
(async () => {
const { formatStem, preprocessLatex, stemStyles } = await loadFormatting();
const { readAnswerStream } = load("answerStream.ts");
const languages = ["हिंदी पाठ: मान", "मराठी मजकूर: मूल्य", "తెలుగు పాఠ్యం: విలువ", "தமிழ் உரை: மதிப்பு", "ಕನ್ನಡ ಪಠ್ಯ: ಮೌಲ್ಯ", "മലയാളം പാഠം: മൂല്യം", "বাংলা পাঠ: মান", "ગુજરાતી લખાણ: મૂલ્ય", "ਪੰਜਾਬੀ ਪਾਠ: ਮੁੱਲ", "ଓଡ଼ିଆ ପାଠ୍ୟ: ମୂଲ୍ୟ"];

test("fractions, sets, roots, Greek, vectors, units, and multiline maths", () => {
  const raw = String.raw`Sets $A=\{1,2,3\}$; roots $x=\frac{-b+\sqrt{b^2-4ac}}{2a}$; $\sin^2\theta+\cos^2\theta=1$.

$$
\vec{F}=m\vec{a},\quad a=9.8\,\mathrm{m\,s^{-2}}
$$`;
  const result = formatStem(raw);
  assert.match(result.html, /class="katex"/);
  assert.match(result.html, /katex-display/);
  assert.match(result.html, /<math/);
  assert.doesNotMatch(result.html, /katex-error/);
  assert.equal(result.incomplete, false);
  assert.ok(raw.includes(String.raw`\frac`), "canonical source is untouched");
});
test("mhchem molecules, ions, and reactions", () => {
  for (const formula of [String.raw`\ce{H2O}`, String.raw`\ce{SO4^{2-}}`, String.raw`\ce{2H2 + O2 -> 2H2O}`]) {
    const result = formatStem(`$${formula}$`);
    assert.match(result.html, /class="katex"/);
    assert.doesNotMatch(result.html, /katex-error|color:#b42318/);
  }
});
test("alternate delimiters and page-marker guards match the supplied source", () => {
  const raw = String.raw`Inline \(A\subseteq B\).
\[
\sum_{i=1}^{n}i=\frac{n(n+1)}2
\]
[Page 12] **[Page 13]** [Page14]`;
  assert.match(preprocessLatex(raw), /\*\*\[Page 12\]\*\*/);
  assert.doesNotMatch(preprocessLatex(raw), /\*\*\*\*/);
  assert.equal(formatStem(raw).incomplete, false);
  assert.doesNotMatch(formatStem(raw).html, /katex-error/);
});
for (const language of languages) test(`Unicode and math: ${language}`, () => {
  const raw = `${language} $x^2=4$.`;
  const result = formatStem(raw);
  assert.ok(result.html.includes(language));
  assert.match(result.html, /class="katex"/);
  assert.doesNotMatch(result.html, /katex-error/);
});
test("Markdown structure, inert code and no invented plain chemistry", () => {
  const result = formatStem("## Notes\n\n**Strong** and *emphasis*. H2O stays plain.\n\n- Item\n\n1. Ordered\n\n> Quote\n\n[Page 12]\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n~~~text\n$not math$\n~~~");
  for (const pattern of [/<h2>/, /<strong>/, /<em>/, /<ul>/, /<ol>/, /<blockquote>/, /class="table-scroll"/, /<pre><code/, /H2O stays plain/]) assert.match(result.html, pattern);
  assert.doesNotMatch(result.html, /class="katex"/);
});
test("incomplete and invalid notation stays readable and can recover", () => {
  const partial = formatStem(String.raw`Working: $x=\frac{1}{`);
  assert.equal(partial.incomplete, true);
  assert.ok(partial.html.includes(String.raw`\frac`));
  assert.equal(formatStem(String.raw`Working: $x=\frac{1}{2}$.`).incomplete, false);
  assert.match(formatStem(String.raw`Malformed: $\frac{1}{$.`).html, /katex-error/);
});
test("untrusted HTML, links, images and LaTeX cannot introduce active content", () => {
  const result = formatStem('<script>window.attack=true</script>\n\n[unsafe](javascript:alert(1)) ![image](https://invalid.example/track)\n\n' + String.raw`$\href{javascript:alert(1)}{x}$` + "\n\nSafe text.");
  assert.doesNotMatch(result.html, /<script|<img|href=|src=|onerror=/i);
  assert.match(result.html, /(?:&lt;|&#x3C;)script>/i, "HTML-looking source remains visible as inert text");
  assert.match(result.html, /Safe text/);
});
test("local font resources and narrow-screen containment", () => {
  const { katexCss } = localRequire("./generated-artifacts/stem-assets.json");
  assert.equal((katexCss.match(/data:font\/woff2;base64/g) || []).length, 20);
  assert.doesNotMatch(katexCss, /url\((?!data:)/);
  assert.match(stemStyles(false), /max-width:640px/);
  assert.match(stemStyles(true), /overflow-x:auto/);
  assert.match(stemStyles(false, { font_size: "18px", line_height: "1.8", font_family: "system" }, 2), /font:36px\/1.8/);
});
function response(text, byteSize = 1) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += byteSize) controller.enqueue(bytes.slice(i, i + byteSize));
    controller.close();
  } }));
}
test("SSE byte/line boundaries preserve Indic Unicode, formula commands, and whitespace", async () => {
  const tokens = [String.raw`తెలుగు: $\frac`, "{1}", "{2}$", " ", "हिंदी."];
  const wire = tokens.map(content => "data:" + JSON.stringify({ type: "token", content }) + "\r\n\r\n").join("")
    + 'data: {"type":"done","answer":"","sources":[{"page":12}],"answer_language":"telugu","cache_used":true}\n\n';
  const chunks = [];
  const result = await readAnswerStream(response(wire), token => chunks.push(token));
  assert.equal(result.answer, tokens.join(""));
  assert.deepEqual(chunks, tokens);
  assert.equal(result.sources[0].page, 12);
  assert.equal(result.cached, true);
  assert.equal(result.answer_language, "telugu");
});
test("a token callback runs before the stream finishes", async () => {
  let controller;
  const stream = new ReadableStream({ start(value) { controller = value; } });
  let firstToken;
  const arrived = new Promise(resolve => { firstToken = resolve; });
  const result = readAnswerStream(new Response(stream), firstToken);
  controller.enqueue(new TextEncoder().encode('data: {"chunk":"first "}\n\n'));
  assert.equal(await arrived, "first ");
  controller.enqueue(new TextEncoder().encode('data: {"answer":"final","document_id":12,"image_source_pages":[3]}\n\ndata: [DONE]\n\n'));
  controller.close();
  const done = await result;
  assert.equal(done.answer, "final");
  assert.equal(done.document_id, 12);
  assert.equal(done.image_source_pages[0], 3);
});
test("terminal done does not cancel the stream before server-side history persistence", async () => {
  let controller, cancelled = false, resolved = false;
  const stream = new ReadableStream({ start(value) { controller = value; }, cancel() { cancelled = true; } });
  const answer = readAnswerStream(new Response(stream), () => {}).then(result => { resolved = true; return result; });
  controller.enqueue(new TextEncoder().encode('data: {"type":"done","answer":"saved"}\n\n'));
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(resolved, false);
  assert.equal(cancelled, false);
  controller.close();
  assert.equal((await answer).answer, "saved");
});
test("EOF, malformed lines, terminal stream errors, and buffered native responses", async () => {
  const chunks = [];
  const eof = await readAnswerStream(response('data: malformed\n\ndata: {"chunk":"unchanged \\\\n"}'), t => chunks.push(t));
  assert.equal(eof.answer, "unchanged \\n");
  const failure = await readAnswerStream(response('data: {"type":"token","content":"partial"}\n\ndata: {"type":"error","content":"Quota exceeded"}\n\ndata: {"type":"done","answer":"wrong"}\n'), () => {});
  assert.equal(failure.answer, "Error: Quota exceeded");
  assert.equal(failure.sources.length, 0);
  const native = await readAnswerStream({ body: undefined, text: async () => 'data: {"chunk":"తెలుగు"}\n\ndata: [DONE]\n' }, () => {});
  assert.equal(native.answer, "తెలుగు");
});
test("non-stream JSON and cancellation", async () => {
  const raw = { answer: String.raw`मराठी $\frac{1}{2}$`, sources: [], cache_used: true };
  assert.equal((await readAnswerStream(response(JSON.stringify(raw)), () => {})).answer, raw.answer);
  const ctrl = new AbortController(); ctrl.abort();
  await assert.rejects(readAnswerStream(response('data: {"chunk":"late"}\n'), () => assert.fail("stale callback"), ctrl.signal), { name: "AbortError" });
});
})().catch(error => { console.error(error); process.exitCode = 1; });
