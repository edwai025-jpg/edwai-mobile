const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function evaluate(source, scope) {
  const exports = {};
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, { exports, Error, TypeError, FormData, ...scope });
  return exports;
}
const source = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const asset = { uri: "file:///cache/lesson.pdf", name: "lesson.pdf", size: 13, lastModified: 0 };
const document = { id: 11, title: "Lesson", source_type: "pdf", book_type: "notes", processing_status: "uploaded", is_ready: false };

function clientHarness(os, { nativeUpload, info, fetch } = {}) {
  const calls = [];
  const legacy = {
    FileSystemUploadType: { MULTIPART: 1 }, FileSystemSessionType: { FOREGROUND: 1 },
    getInfoAsync: async uri => {
      calls.push({ kind: "file", uri });
      return info ?? { exists: true, isDirectory: false, size: 13 };
    },
    uploadAsync: async (url, uri, options) => {
      calls.push({ kind: "upload", url, uri, options });
      return nativeUpload ? nativeUpload() : { status: 200, body: JSON.stringify(document) };
    },
  };
  const platform = { Platform: { OS: os } };
  const helper = evaluate(source("services/pdfUpload.ts"), {
    fetch: fetch ?? (() => { throw new Error("Native upload must not use JS fetch"); }),
    require: name => {
      if (name === "react-native") return platform;
      if (name === "expo-file-system/legacy") return legacy;
      throw new Error(`Unexpected dependency ${name}`);
    },
  });
  const api = evaluate(source("services/api.ts"), {
    process: { env: {} },
    fetch: fetch ?? (() => { throw new Error("Unexpected JS fetch"); }),
    require: name => {
      if (name === "react-native") return platform;
      if (name === "./pdfUpload") return helper;
      if (name === "./profilePhotoUpload" || name === "./answerStream") return {};
      throw new Error(`Unexpected dependency ${name}`);
    },
  });
  return { api, calls };
}

for (const os of ["ios", "android"]) {
  test(`${os}: actual API caller uses native multipart with file URI, metadata and bearer header`, async () => {
    const { api, calls } = clientHarness(os);
    const result = await api.default.phase2.uploadPdf("fixture-token", asset, "  Lesson  ", "notes");
    assert.deepEqual(JSON.parse(JSON.stringify(result)), document);
    assert.equal(calls.length, 2);
    const upload = calls[1];
    assert.equal(new URL(upload.url).pathname, "/api/phase2/documents/upload");
    assert.equal(upload.uri, asset.uri);
    assert.equal(upload.options.httpMethod, "POST");
    assert.equal(upload.options.uploadType, 1);
    assert.equal(upload.options.sessionType, 1); // never indefinitely retry a write in background
    assert.equal(upload.options.fieldName, "file");
    assert.equal(upload.options.mimeType, "application/pdf");
    assert.deepEqual(JSON.parse(JSON.stringify(upload.options.parameters)), { title: "Lesson", book_type: "notes" });
    assert.equal(upload.options.headers.Authorization, "Bearer fixture-token");
    assert.equal(upload.options.headers["Content-Type"], undefined); // native boundary, not JSON
  });
}

test("web: actual request body contains intact PDF bytes, original filename and UTF-8 metadata", async () => {
  const bytes = Uint8Array.from([37, 80, 68, 70, 45, 49, 46, 55, 10, 0, 128, 255, 10]);
  const file = new File([bytes], "notes.pdf", { type: "application/pdf" });
  let requests = 0;
  const { api, calls } = clientHarness("web", {
    fetch: async (url, options) => {
      requests++;
      assert.equal(new URL(url).pathname, "/api/phase2/documents/upload");
      assert.equal(options.headers.Authorization, "Bearer fixture-token");
      assert.equal(options.headers["Content-Type"], undefined);
      const request = new Request(url, options);
      assert.match(request.headers.get("content-type"), /^multipart\/form-data; boundary=/);
      const form = await request.formData();
      assert.equal(form.get("title"), "చాప్టర్ 1");
      assert.equal(form.get("book_type"), "reference");
      assert.equal(form.get("file").name, "notes.pdf");
      assert.deepEqual(new Uint8Array(await form.get("file").arrayBuffer()), bytes);
      return new Response(JSON.stringify(document), { status: 200 });
    },
  });
  await api.default.phase2.uploadPdf("fixture-token", { ...asset, name: file.name, file }, "చాప్టర్ 1", "reference");
  assert.equal(requests, 1);
  assert.equal(calls.length, 0);
});

for (const info of [{ exists: false }, { exists: true, isDirectory: true, size: 13 }, { exists: true, isDirectory: false, size: 0 }]) {
  test(`unreadable native file never starts an upload: ${JSON.stringify(info)}`, async () => {
    const { api, calls } = clientHarness("ios", { info });
    await assert.rejects(api.default.phase2.uploadPdf("fixture-token", asset, "Lesson", "textbook"), /select the file again/);
    assert.equal(calls.some(call => call.kind === "upload"), false);
  });
}

test("invalid filename/title fail before accessing the file or starting a write", async () => {
  const { api, calls } = clientHarness("ios");
  await assert.rejects(api.default.phase2.uploadPdf("fixture-token", { ...asset, name: "photo.jpg" }, "Lesson", "textbook"), /choose a PDF/);
  await assert.rejects(api.default.phase2.uploadPdf("fixture-token", asset, " ", "textbook"), /Enter a title/);
  assert.equal(calls.length, 0);
});

for (const [status, body, message] of [
  [401, '{"detail":"Not authenticated"}', /Not authenticated/],
  [403, '{"detail":"Upload access is not available"}', /Upload access/],
  [413, '{"detail":"PDF exceeds the allowed size"}', /allowed size/],
  [422, '{"detail":[{"msg":"Invalid PDF"}]}', /Invalid PDF/],
  [503, "Server unavailable", /Server unavailable/],
  [200, "<html>Not a document response</html>", /unexpected response/],
]) {
  test(`native HTTP ${status} uses the existing API error decoder`, async () => {
    const { api, calls } = clientHarness("ios", { nativeUpload: async () => ({ status, body }) });
    await assert.rejects(api.default.phase2.uploadPdf("fixture-token", asset, "Lesson", "textbook"), error => {
      assert.ok(error instanceof api.ApiError);
      assert.equal(error.statusCode, status);
      assert.match(error.message, message);
      return true;
    });
    assert.equal(calls.filter(call => call.kind === "upload").length, 1);
  });
}

test("a lost native upload response is not automatically replayed", async () => {
  const { api, calls } = clientHarness("ios", {
    nativeUpload: async () => { throw new TypeError("Connection lost after upload"); },
  });
  await assert.rejects(api.default.phase2.uploadPdf("fixture-token", asset, "Lesson", "textbook"), /Connection lost/);
  assert.equal(calls.filter(call => call.kind === "upload").length, 1);
});

const screen = source("app/(tabs)/my-docs.tsx");
const ast = ts.createSourceFile("my-docs.tsx", screen, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const initializers = {};
function visit(node) {
  if (ts.isVariableDeclaration(node) && ["handlePickPdf", "handleUploadPdf"].includes(node.name.getText(ast))) {
    initializers[node.name.getText(ast)] = node.initializer.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);

function screenHarness({ reject, uploading = false, picked = asset } = {}) {
  const state = { file: asset, title: "Lesson", uploading, progress: 0, form: true, docs: [] };
  const alerts = [];
  let posts = 0;
  const { pick, upload } = evaluate(`
    exports.pick = ${initializers.handlePickPdf};
    exports.upload = ${initializers.handleUploadPdf};
  `, {
    useCallback: fn => fn, pdfTitle: state.title, pdfFile: asset, pdfDocType: "notes",
    accessToken: "fixture-token", uploading, progressRef: { current: null },
    clearInterval: () => {}, setTimeout: fn => fn(),
    startProgressSimulation: () => { state.progress = 3; },
    setPdfFile: value => { state.file = value; },
    setPdfTitle: value => { state.title = value; },
    setUploading: value => { state.uploading = value; },
    setUploadProgress: value => { state.progress = value; },
    setShowUploadForm: value => { state.form = value; },
    setDocs: fn => { state.docs = fn(state.docs); },
    DocumentPicker: { getDocumentAsync: async options => {
      assert.equal(options.type, "application/pdf");
      assert.equal(options.copyToCacheDirectory, true);
      return picked ? { canceled: false, assets: [picked] } : { canceled: true };
    } },
    Alert: { alert: (...args) => alerts.push(args) },
    api: { phase2: { uploadPdf: async (token, selected, title, bookType) => {
      posts++;
      assert.equal(selected, asset); assert.equal(token, "fixture-token");
      assert.equal(title, "Lesson"); assert.equal(bookType, "notes");
      if (reject) throw reject;
      return document;
    } } },
  });
  return { state, alerts, pick, upload, posts: () => posts };
}

test("picker retains the real web File and metadata; cancellation leaves selection unchanged", async () => {
  const picked = { ...asset, file: new File(["%PDF-1.7"], "lesson.pdf"), mimeType: "application/pdf" };
  const h = screenHarness({ picked }); await h.pick();
  assert.equal(h.state.file, picked);
  assert.equal(h.state.file.file, picked.file);
  const canceled = screenHarness({ picked: null }); await canceled.pick();
  assert.equal(canceled.state.file, asset);
});

test("successful upload adds the document and clears only the completed upload form", async () => {
  const h = screenHarness(); await h.upload();
  assert.equal(h.posts(), 1);
  assert.equal(h.state.file, null); assert.equal(h.state.title, "");
  assert.equal(h.state.form, false); assert.equal(h.state.uploading, false);
  assert.equal(h.state.docs[0], document);
  assert.equal(h.alerts[0][0], "Uploaded");
});

for (const error of [new Error("Native file upload failed"), new TypeError("Response lost")]) {
  test(`failed upload preserves file/title for explicit retry and clears busy state: ${error.name}`, async () => {
    const h = screenHarness({ reject: error }); await h.upload();
    assert.equal(h.posts(), 1);
    assert.equal(h.state.file, asset); assert.equal(h.state.title, "Lesson");
    assert.equal(h.state.form, true); assert.equal(h.state.uploading, false);
    assert.equal(h.state.progress, 0); assert.equal(h.state.docs.length, 0);
    assert.equal(h.alerts[0][0], "Upload Failed");
    assert.match(h.alerts[0][1], /in-app chat.*Contact Us/);
    assert.match(h.alerts[0][1], error instanceof TypeError ? /not confirmed.*avoid a duplicate/s : /Native file upload failed/);
  });
}

test("a busy upload callback cannot start another upload", async () => {
  const h = screenHarness({ uploading: true }); await h.upload();
  assert.equal(h.posts(), 0);
});
