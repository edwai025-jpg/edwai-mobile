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
function visit(node) {
  if (ts.isVariableDeclaration(node) && ["loadBoardStatus", "handleStartProcessing", "boardReady"].includes(node.name.getText(ast))) {
    initializers[node.name.getText(ast)] = node.initializer.getText(ast);
  }
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect"
    && node.arguments[0].getText(ast).includes("let busy = false")) {
    pollingEffect = node.arguments[0].getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(initializers.loadBoardStatus);
assert.ok(initializers.handleStartProcessing);
assert.ok(pollingEffect);

function statusLoader(client) {
  const state = { status: null, loading: true, error: null, starting: false };
  const currentBoardScope = { current: "account-board" };
  const scope = {
    accessToken: "fixture-token",
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
  return { state, loadBoardStatus, handleStartProcessing, currentBoardScope };
}

const status = processing_status => ({ is_restricted: true, processing_status, processing_delay_minutes: 5 });
const json = (data, code = 200) => new Response(JSON.stringify(data), { status: code });

function isReady(state) {
  return evaluate(`exports.ready = ${initializers.boardReady};`, {
    boardStatusLoading: state.loading, boardStatusError: state.error,
    boardStatus: state.status,
    isRestricted: !!state.status?.is_restricted && state.status.processing_status !== "completed",
  }).ready;
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
    code === 200 ? { is_restricted: false, processing_status: "completed", processing_delay_minutes: 5 } : { detail: "Not found" },
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
    return json(status("in_progress"));
  });
  const loader = statusLoader(client);
  loader.state.status = status("not_started");
  await loader.handleStartProcessing();
  assert.deepEqual(calls, ["/api/student/process-documents", "/api/student/board-status"]);
  assert.equal(loader.state.status.processing_status, "in_progress");
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

for (const data of [null, {}, { ...status("completed"), is_restricted: undefined }, status("unknown")]) {
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
