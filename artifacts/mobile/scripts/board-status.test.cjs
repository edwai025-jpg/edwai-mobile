const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function evaluate(source, scope) {
  const exports = {};
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(js, { exports, Error, TypeError, ...scope });
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
const initializers = {};
let pollingEffect;
let errorBanner;
let catalogEffect;
let resetEffect;
let countdownEffect;
function visit(node) {
  if (ts.isJsxExpression(node) && node.expression
    && node.expression.getText(ast).startsWith("!boardStatusLoading && boardStatusError &&")) {
    errorBanner = node.expression.getText(ast);
  }
  if (ts.isVariableDeclaration(node) && ["loadBoardStatus", "handleStartProcessing", "boardReady", "isRestricted", "hasNoBoard"].includes(node.name.getText(ast))) {
    initializers[node.name.getText(ast)] = node.initializer.getText(ast);
  }
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect"
    && node.arguments[0].getText(ast).includes("let busy = false")) {
    pollingEffect = node.arguments[0].getText(ast);
  }
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect") {
    const body = node.arguments[0].getText(ast);
    if (body.includes("api.study.getAvailableClasses")) catalogEffect = body;
    if (body.includes("setBoardStatus(null)")) resetEffect = body;
    if (body.includes("const deadline = Date.now()")) countdownEffect = body;
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(initializers.loadBoardStatus);
assert.ok(initializers.handleStartProcessing);
assert.ok(pollingEffect);
assert.ok(errorBanner);

test("textbook failures show contact guidance alongside the error and retry, but success/loading do not", () => {
  const jsx = (type, props) => ({ type, props });
  function render(error, loading = false) {
    return evaluate(`exports.banner = (${errorBanner});`, {
      boardStatusLoading: loading, boardStatusError: error, instituteStudent: false,
      View: "View", Text: "Text", Pressable: "Pressable", Feather: "Feather",
      sc: {}, loadBoardStatus: () => {},
      require: name => {
        assert.equal(name, "react/jsx-runtime");
        return { jsx, jsxs: jsx };
      },
    }).banner;
  }
  function text(node) {
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(text).join("");
    return node?.props ? text(node.props.children) : "";
  }
  for (const error of [
    "Couldn't check textbook access: Not found",
    "Couldn't reach the server. Check your connection and retry.",
    "Your session could not be verified. Please sign in again.",
    "Couldn't start textbook processing: Please retry.",
  ]) {
    const content = text(render(error));
    assert.ok(content.includes(error));
    assert.ok(content.includes("Please contact the EDUwAI team through in-app chat or the “Contact Us” section on the home page for help."));
    assert.ok(content.includes("Retry"));
  }
  assert.equal(render(null), null);
  assert.equal(render("Network error", true), false);
});

function statusLoader(client, instituteStudent = false) {
  const state = { status: null, loading: true, error: null, starting: false };
  const currentBoardScope = { current: "account-board" };
  const scope = {
    accessToken: "fixture-token",
    instituteStudent,
    boardScope: "account-board",
    currentBoardScope,
    boardStatusRequest: { current: 0 },
    processingStartScope: { current: null },
    api: client.default,
    ApiError: client.ApiError,
    useCallback: fn => fn,
    setBoardStatus: value => { state.status = value; },
    setBoardStatusScope: value => { state.scope = value; },
    setBoardStatusLoading: value => { state.loading = value; },
    setBoardStatusError: value => { state.error = value; },
    setStartingProcess: value => { state.starting = value; },
  };
  const { loadBoardStatus, handleStartProcessing } = evaluate(`
    const loadBoardStatus = ${initializers.loadBoardStatus};
    const handleStartProcessing = ${initializers.handleStartProcessing};
    exports.loadBoardStatus = loadBoardStatus;
    exports.handleStartProcessing = handleStartProcessing;
  `, scope);
  return { state, loadBoardStatus, handleStartProcessing, currentBoardScope, scope };
}

const status = processing_status => ({ has_board: true, is_restricted: true, processing_status, processing_delay_minutes: 5 });
const json = (data, code = 200) => new Response(JSON.stringify(data), { status: code });

function accessState(state, instituteStudent = false, boardId = 123) {
  return evaluate(`
    const isRestricted = ${initializers.isRestricted};
    exports.ready = ${initializers.boardReady};
    exports.hasNoBoard = ${initializers.hasNoBoard};
  `, {
    instituteStudent, boardId,
    boardStatusLoading: state.loading, boardStatusError: state.error,
    boardStatus: state.status,
  });
}
const isReady = state => accessState(state).ready;

test("board check uses the server's documented route and preserves authenticated status", async () => {
  const response = { ...status(null), is_restricted: false };
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
    code === 200 ? { ...status("completed"), is_restricted: false } : { detail: "Not found" },
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

test("start posts to the documented account-scoped route and gets server status without assuming a success envelope", async () => {
  const calls = [];
  const client = apiClient(async (url, options) => {
    calls.push(new URL(url).pathname);
    assert.equal(options.headers.Authorization, "Bearer fixture-token");
    if (calls.length === 1) {
      assert.equal(options.method, "POST");
      assert.equal(options.body, undefined); // no client board/account overrides
      return json({ message: "Accepted" });
    }
    return json({ ...status("processing"), remaining_seconds: 180 });
  });
  const loader = statusLoader(client);
  loader.state.status = status(null);
  await loader.handleStartProcessing();
  assert.deepEqual(calls, ["/api/student/process-documents", "/api/student/board-status"]);
  assert.equal(loader.state.status.processing_status, "processing");
  assert.equal(loader.state.status.remaining_seconds, 180);
  assert.equal(loader.state.status.is_restricted, true);
  assert.equal(loader.state.starting, false);
  assert.equal(isReady(loader.state), false);
});

for (const terminal of ["completed", "failed", "not_started"]) {
  test(`start uses confirmed ${terminal} state, not an optimistic in_progress state`, async () => {
    const client = apiClient(async (_, options) => json(options.method === "POST" ? {} : status(terminal)));
    const loader = statusLoader(client);
    loader.state.status = status("not_started");
    await loader.handleStartProcessing();
    assert.equal(loader.state.status.processing_status, terminal);
    assert.equal(loader.state.status.is_restricted, true);
    assert.equal(isReady(loader.state), terminal === "completed");
  });
}

for (const code of [401, 403, 404, 503]) {
  test(`failed start HTTP ${code} remains restricted, reports the failure and permits retry`, async () => {
    let fail = true;
    let gets = 0;
    const client = apiClient(async (_, options) => {
      if (options.method === "POST") return fail ? json({ detail: "Unavailable" }, code) : json({});
      gets++;
      return json(status("in_progress"));
    });
    const loader = statusLoader(client);
    loader.state.status = status("not_started");
    await loader.handleStartProcessing();
    assert.equal(loader.state.status.processing_status, "not_started");
    assert.equal(gets, 0);
    assert.equal(isReady(loader.state), false);
    assert.match(loader.state.error, code === 401 ? /sign in again/ : code === 403 ? /permission/ : /Unavailable/);
    assert.equal(loader.state.starting, false);
    fail = false;
    await loader.handleStartProcessing();
    assert.equal(loader.state.error, null);
    assert.equal(loader.state.status.processing_status, "in_progress");
  });
}

for (const body of [{ success: false }, { processing_status: "failed" }]) {
  test(`an explicit start failure in HTTP 200 is not treated as progress: ${JSON.stringify(body)}`, async () => {
    const loader = statusLoader(apiClient(async () => json(body)));
    loader.state.status = status("failed");
    await loader.handleStartProcessing();
    assert.equal(loader.state.status.processing_status, "failed");
    assert.match(loader.state.error, /could not start/);
    assert.equal(loader.state.starting, false);
  });
}

test("unconfirmed start due to a network failure or unreadable status never unlocks access", async () => {
  for (const failPost of [true, false]) {
    const loader = statusLoader(apiClient(async (_, options) => {
      if (failPost) throw new TypeError("Network request failed");
      return json(options.method === "POST" ? {} : {});
    }));
    loader.state.status = status("not_started");
    await loader.handleStartProcessing();
    assert.equal(loader.state.status.processing_status, "not_started");
    assert.equal(isReady(loader.state), false);
    assert.match(loader.state.error, failPost ? /not confirmed/ : /could not be read/);
    assert.equal(loader.state.starting, false);
  }
});

for (const data of [null, {}, { ...status("completed"), has_board: undefined },
  { ...status("completed"), is_restricted: undefined }, status("unknown"), status(["completed"]),
  { ...status("processing"), remaining_seconds: -1 },
  { ...status("processing"), remaining_seconds: 1.5 },
  { ...status("processing"), remaining_seconds: "180" }]) {
  test(`unreadable status fails closed: ${JSON.stringify(data)}`, async () => {
    const loader = statusLoader(apiClient(async () => json(data)));
    await loader.loadBoardStatus();
    assert.equal(loader.state.status, null);
    assert.equal(isReady(loader.state), false);
    assert.match(loader.state.error, /could not be read/);
  });
}

for (const terminal of ["completed", "failed"]) {
  test(`actual polling callback preserves restriction and transitions to ${terminal}`, async () => {
    const loader = statusLoader(apiClient(async () => json(status(terminal))));
    loader.state.status = status("in_progress");
    loader.state.loading = false;
    let tick;
    let cleared = false;
    const { effect } = evaluate(`exports.effect = ${pollingEffect};`, {
      boardStatus: loader.state.status,
      instituteStudent: false,
      loadBoardStatus: loader.loadBoardStatus,
      setInterval: (fn, ms) => { assert.equal(ms, 5000); tick = fn; return 1; },
      clearInterval: () => { cleared = true; },
    });
    const cleanup = effect();
    await tick();
    assert.equal(loader.state.status.processing_status, terminal);
    assert.equal(loader.state.status.is_restricted, true);
    assert.equal(loader.state.loading, false);
    assert.equal(isReady(loader.state), terminal === "completed");
    cleanup(); // React cleans up on terminal state dependency change
    assert.equal(cleared, true);
  });
}

test("polling errors stay visible, retain server restriction, and recover on retry", async () => {
  let fail = true;
  const loader = statusLoader(apiClient(async () => fail ? json({ detail: "Unavailable" }, 503) : json(status("completed"))));
  loader.state.status = status("in_progress");
  loader.state.loading = false;
  await loader.loadBoardStatus(true);
  assert.equal(loader.state.status.processing_status, "in_progress");
  assert.match(loader.state.error, /Unavailable/);
  assert.equal(isReady(loader.state), false);
  fail = false;
  await loader.loadBoardStatus();
  assert.equal(loader.state.error, null);
  assert.equal(isReady(loader.state), true);
});

function loadCatalog(state, instituteStudent = false, boardId = 123) {
  const access = accessState(state, instituteStudent, boardId);
  const catalog = { calls: 0, classes: [], loading: false };
  const { effect } = evaluate(`exports.effect = ${catalogEffect};`, {
    accessToken: "fixture-token", classScope: "account-board-class",
    boardReady: access.ready, hasNoBoard: access.hasNoBoard,
    loadedClassesScope: { current: null },
    setClasses: value => { catalog.classes = value; },
    setClassesLoading: value => { catalog.loading = value; },
    api: { study: { getAvailableClasses: async () => {
      catalog.calls++;
      return [{ id: 9, name: "Class 9" }];
    } } },
  });
  effect();
  return catalog;
}

for (const [label, response, expectedAccess] of [
  ["unrestricted without an access record", { ...status(null), is_restricted: false }, true],
  ["restricted without an access record", status(null), false],
  ["restricted processing with remaining time", { ...status("processing"), remaining_seconds: 180 }, false],
  ["restricted processing with zero remaining time", { ...status("processing"), remaining_seconds: 0 }, false],
  ["restricted processing without a completion timestamp", status("processing"), false],
  ["restricted completed", { ...status("completed"), remaining_seconds: 0 }, true],
]) {
  test(`web contract: ${label} is readable and ${expectedAccess ? "loads" : "blocks"} the catalog`, async () => {
    const loader = statusLoader(apiClient(async () => json(response)));
    await loader.loadBoardStatus();
    assert.equal(loader.state.error, null);
    assert.deepEqual(JSON.parse(JSON.stringify(loader.state.status)), response);
    assert.equal(isReady(loader.state), expectedAccess);
    const catalog = loadCatalog(loader.state);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(catalog.calls, Number(expectedAccess));
    assert.equal(catalog.classes.length, Number(expectedAccess));
  });
}

test("the no-board response permits absent IDs/countdown but cannot load textbooks even with a stale profile board", async () => {
  const response = { has_board: false, is_restricted: false, processing_status: null, processing_delay_minutes: 5 };
  const loader = statusLoader(apiClient(async () => json(response)));
  await loader.loadBoardStatus();
  assert.equal(loader.state.error, null);
  assert.equal(accessState(loader.state).hasNoBoard, true);
  assert.equal(loadCatalog(loader.state).calls, 0);
});

test("institution students skip board GET and processing POST, clear the gate, and load organization classes without a board", async () => {
  let requests = 0;
  const loader = statusLoader(apiClient(async () => {
    requests++;
    throw new Error("Institution students must not call board processing");
  }), true);
  loader.state.error = "Previous board error";
  const { effect } = evaluate(`exports.effect = ${resetEffect};`, loader.scope);
  effect();
  await loader.loadBoardStatus();
  await loader.handleStartProcessing();
  assert.equal(requests, 0);
  assert.equal(loader.state.loading, false);
  assert.equal(loader.state.error, null);
  assert.equal(loader.state.status, null);
  const access = accessState(loader.state, true, undefined);
  assert.equal(access.ready, true);
  assert.equal(access.hasNoBoard, false);
  const catalog = loadCatalog(loader.state, true, undefined);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(catalog.calls, 1);
  assert.equal(catalog.classes.length, 1);
});

test("the real processing status is polled and only confirmed completion opens the catalog", async () => {
  const loader = statusLoader(apiClient(async () => json(status("completed"))));
  loader.state.status = { ...status("processing"), remaining_seconds: 0 };
  loader.state.loading = false;
  assert.equal(isReady(loader.state), false);
  let tick;
  const { effect } = evaluate(`exports.effect = ${pollingEffect};`, {
    instituteStudent: false, boardStatus: loader.state.status,
    loadBoardStatus: loader.loadBoardStatus,
    setInterval: (fn, ms) => { assert.equal(ms, 5000); tick = fn; return 1; },
    clearInterval: () => {},
  });
  const cleanup = effect();
  await tick();
  assert.equal(loader.state.status.processing_status, "completed");
  assert.equal(isReady(loader.state), true);
  cleanup();
});

test("countdown uses server remaining time, accounts for delayed ticks, and rechecks once at zero", () => {
  let now = 0;
  let tick;
  let remaining;
  let rechecks = 0;
  const { effect } = evaluate(`exports.effect = ${countdownEffect};`, {
    status: "processing", remainingSeconds: 3,
    Date: { now: () => now },
    setRemaining: value => { remaining = value; },
    onCountdownEnd: () => { rechecks++; },
    setInterval: (fn, ms) => { assert.equal(ms, 1000); tick = fn; return 1; },
    clearInterval: () => { tick = null; },
  });
  const cleanup = effect();
  assert.equal(remaining, 3); // not the full five-minute board delay
  now = 2500;
  tick();
  assert.equal(remaining, 1);
  now = 3500;
  tick();
  assert.equal(remaining, 0);
  assert.equal(rechecks, 1);
  assert.equal(tick, null);
  cleanup();
});

test("missing/zero remaining time does not invent a countdown or a completed status", () => {
  for (const remainingSeconds of [undefined, 0]) {
    let remaining;
    const { effect } = evaluate(`exports.effect = ${countdownEffect};`, {
      status: "processing", remainingSeconds,
      setRemaining: value => { remaining = value; },
      onCountdownEnd: () => { throw new Error("No countdown has elapsed"); },
      setInterval: () => { throw new Error("Do not invent remaining time"); },
    });
    effect();
    assert.equal(remaining, 0);
    assert.equal(isReady({ status: status("processing"), loading: false, error: null }), false);
  }
});

test("late account/board responses and superseded status reads are ignored", async () => {
  const pending = [];
  const loader = statusLoader(apiClient(() => new Promise(resolve => pending.push(resolve))));
  const first = loader.loadBoardStatus();
  const second = loader.loadBoardStatus();
  pending[1](json(status("failed")));
  await second;
  pending[0](json(status("completed")));
  await first;
  assert.equal(loader.state.status.processing_status, "failed");
  const oldScope = loader.loadBoardStatus();
  loader.currentBoardScope.current = "another-account-board";
  pending[2](json(status("completed")));
  await oldScope;
  assert.equal(loader.state.status.processing_status, "failed");
});

test("a pending start cannot update another account/board or post twice", async () => {
  let finish;
  let calls = 0;
  const loader = statusLoader(apiClient(() => {
    calls++;
    return new Promise(resolve => { finish = resolve; });
  }));
  loader.state.status = status("not_started");
  const first = loader.handleStartProcessing();
  await loader.handleStartProcessing();
  assert.equal(calls, 1);
  loader.currentBoardScope.current = "another-account-board";
  finish(json({}));
  await first;
  assert.equal(calls, 1); // no stale status GET either
  assert.equal(loader.state.status.processing_status, "not_started");
});
