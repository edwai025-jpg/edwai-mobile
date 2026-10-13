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
  vm.runInNewContext(js, { exports, ...scope });
  return exports;
}

function apiClient(fetch) {
  return evaluate(fs.readFileSync(path.join(__dirname, "../services/api.ts"), "utf8"), {
    fetch, FormData, process: { env: {} },
    require: name => {
      if (name === "react-native") return { Platform: { OS: "ios" } };
      if (name === "./profilePhotoUpload" || name === "./answerStream") return {};
      throw new Error(`Unexpected import: ${name}`);
    },
  });
}

// Exercise the actual screen callback, including clearing a previous warning.
const screen = fs.readFileSync(path.join(__dirname, "../app/(tabs)/index.tsx"), "utf8");
const ast = ts.createSourceFile("index.tsx", screen, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initializer;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "loadBoardStatus") {
    initializer = node.initializer.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(initializer);

function statusLoader(client) {
  const state = { status: null, loading: true, error: null };
  const { loadBoardStatus } = evaluate(`const loadBoardStatus = ${initializer}; exports.loadBoardStatus = loadBoardStatus;`, {
    accessToken: "fixture-token",
    api: client.default,
    ApiError: client.ApiError,
    TypeError,
    useCallback: fn => fn,
    setBoardStatus: value => { state.status = value; },
    setBoardStatusLoading: value => { state.loading = value; },
    setBoardStatusError: value => { state.error = value; },
  });
  return { state, loadBoardStatus };
}

test("board check uses the server's documented route and preserves authenticated status", async () => {
  const response = { is_restricted: false, processing_status: "completed", processing_delay_minutes: 5 };
  const client = apiClient(async (url, options) => {
    assert.equal(new URL(url).pathname, "/api/student/board-status");
    assert.equal(options.headers.Authorization, "Bearer fixture-token");
    return new Response(JSON.stringify(response), { status: 200 });
  });
  const { state, loadBoardStatus } = statusLoader(client);
  await loadBoardStatus();
  assert.deepEqual(JSON.parse(JSON.stringify(state.status)), response);
  assert.equal(state.error, null);
  assert.equal(state.loading, false);
});

test("HTTP failures are not described as a network outage and successful retry removes the warning", async () => {
  let code = 404;
  const client = apiClient(async () => new Response(JSON.stringify(
    code === 200 ? { is_restricted: false, processing_status: "completed" } : { detail: "Not found" },
  ), { status: code }));
  const { state, loadBoardStatus } = statusLoader(client);
  await loadBoardStatus();
  assert.equal(state.error, "Couldn't check textbook access: Not found");
  assert.equal(state.status, null);
  assert.equal(state.loading, false);
  code = 200;
  await loadBoardStatus();
  assert.equal(state.error, null);
  assert.equal(state.status.processing_status, "completed");
});

test("only a transport failure is described as a connection problem", async () => {
  const client = apiClient(async () => { throw new TypeError("Network request failed"); });
  const { state, loadBoardStatus } = statusLoader(client);
  await loadBoardStatus();
  assert.equal(state.error, "Couldn't reach the server. Check your connection and retry.");
  assert.equal(state.loading, false);
});

test("an authentication failure prompts sign-in rather than alleging an unreachable server", async () => {
  const client = apiClient(async () => new Response(JSON.stringify({ detail: "Not authenticated" }), { status: 401 }));
  const { state, loadBoardStatus } = statusLoader(client);
  await loadBoardStatus();
  assert.equal(state.error, "Your session could not be verified. Please sign in again.");
});
