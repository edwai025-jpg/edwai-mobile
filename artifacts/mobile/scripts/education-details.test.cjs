const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "../components/EducationEditModal.tsx"), "utf8");
const ast = ts.createSourceFile("EducationEditModal.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const callbacks = {};
const lookups = {};
function visit(node) {
  if (ts.isVariableDeclaration(node) && ["handleSave", "handleStateSelect", "handleBoardSelect", "handleClassSelect"].includes(node.name.getText(ast))) {
    callbacks[node.name.getText(ast)] = node.initializer.getText(ast);
  }
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect") {
    const code = node.arguments[0].getText(ast);
    for (const name of ["getStates", "getBoards", "getClassesForBoard", "getMediumsForClass"]) {
      if (code.includes(`api.data.${name}`)) lookups[name] = code;
    }
  }
  ts.forEachChild(node, visit);
}
visit(ast);
class ApiError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } }
function evaluate(expression, scope) {
  const exports = {};
  const code = ts.transpileModule(`exports.callback = ${expression};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Error, TypeError, ApiError, ...scope });
  return exports.callback;
}
const canonical = { id: 42, full_name: "Fixture Learner", state: "State", state_id: 1, board: "Board", board_id: 2,
  class_id: 3, class_name: "10", medium_id: 4, medium_name: "English", profile_complete: true };
function scope(overrides = {}) {
  const calls = [], patches = [], toasts = [], changes = {};
  const values = {
    educationManaged: false, accessToken: "fixture-token", user: { id: 42 },
    boardId: 2, classId: 3, mediumId: 4, needsRefresh: false,
    statesLoading: false, boardsLoading: false, classesLoading: false, mediumsLoading: false,
    saveLock: { current: false }, currentScope: { current: "scope" },
    api: {
      profile: { saveEducation: async (_, data) => { calls.push(["write", JSON.parse(JSON.stringify(data))]); return { success: true }; } },
      auth: { getMe: async () => { calls.push(["read"]); return canonical; } },
    },
    runAuthenticatedRequest: operation => operation("fixture-token"),
    updateUser: async patch => patches.push(JSON.parse(JSON.stringify(patch))),
    apiUserToProfile: server => ({
      id: server.id, name: server.full_name, state: server.state, stateId: server.state_id,
      board: server.board, boardId: server.board_id, classId: server.class_id, className: server.class_name,
      medium: server.medium_name, mediumId: server.medium_id, profileComplete: server.profile_complete,
    }),
    showToast: (...args) => toasts.push(args),
    ...overrides,
  };
  for (const setter of ["setSaving", "setNeedsRefresh", "setBoards", "setClasses", "setMediums",
    "setStateId", "setStateName", "setBoardId", "setBoardName", "setClassId", "setClassName", "setMediumId", "setMediumName"]) {
    values[setter] ??= value => { changes[setter] = value; };
  }
  return { values, calls, patches, toasts, changes };
}
test("Education sends only academic IDs, refreshes the canonical State ID and does not overwrite unrelated account fields", async () => {
  const h = scope();
  await evaluate(callbacks.handleSave, h.values)();
  assert.deepEqual(h.calls, [["write", { board_id: 2, class_id: 3, medium_id: 4 }], ["read"]]);
  assert.equal(h.patches[0].stateId, 1);
  assert.equal(h.patches[0].mediumId, 4);
  assert.equal(h.changes.setStateId, 1);
  assert.equal(h.changes.setStateName, "State");
  assert.equal(h.patches[0].name, "Fixture Learner");
  assert.equal(h.patches[0].questionsUsed, undefined);
  assert.equal(h.values.saveLock.current, false);
});
test("institution-managed education cannot issue a write", async () => {
  const h = scope({ educationManaged: true });
  await evaluate(callbacks.handleSave, h.values)();
  assert.equal(h.calls.length, 0);
});
test("an optional empty Medium is sent as null rather than fabricated or blocked", async () => {
  const h = scope({ mediumId: null });
  h.values.api.auth.getMe = async () => ({ ...canonical, medium_id: null, medium_name: null });
  await evaluate(callbacks.handleSave, h.values)();
  assert.equal(h.calls[0][1].medium_id, null);
  assert.equal(h.toasts.at(-1)[0], "ok");
});
test("State, Board and Class selection clear only the dependent academic drafts and lists", () => {
  for (const [callback, expected] of [
    ["handleStateSelect", ["setBoardId", "setClassId", "setMediumId"]],
    ["handleBoardSelect", ["setClassId", "setMediumId"]],
    ["handleClassSelect", ["setMediumId"]],
  ]) {
    const h = scope();
    evaluate(callbacks[callback], h.values)({ id: 99, name: "New" });
    for (const setter of expected) assert.equal(h.changes[setter], null);
    assert.equal(h.changes.setMediums.length, 0);
  }
});
test("lost save response is reconciled with a read, without an automatic write retry", async () => {
  const calls = [];
  const h = scope({ api: {
    profile: { saveEducation: async () => { calls.push("write"); throw new TypeError("Lost response"); } },
    auth: { getMe: async () => { calls.push("read"); return canonical; } },
  } });
  await evaluate(callbacks.handleSave, h.values)();
  assert.deepEqual(calls, ["write", "read"]);
  assert.equal(h.toasts.at(-1)[0], "ok");
});
test("a definite rejected save never appears successful just because the previous academic IDs match", async () => {
  const calls = [];
  const h = scope({ api: {
    profile: { saveEducation: async () => { throw new ApiError("Not permitted", 403); } },
    auth: { getMe: async () => { calls.push("read"); return canonical; } },
  } });
  await evaluate(callbacks.handleSave, h.values)();
  assert.equal(calls.length, 0);
  assert.equal(h.toasts.at(-1)[0], "err");
});
test("an unresolved prior save performs only a canonical read before allowing a deliberate new save", async () => {
  const h = scope({ needsRefresh: true });
  await evaluate(callbacks.handleSave, h.values)();
  assert.deepEqual(h.calls, [["read"]]);
  assert.equal(h.changes.setNeedsRefresh, false);
});
test("a successful HTTP write with mismatched canonical academics cannot display save success", async () => {
  const h = scope();
  h.values.api.auth.getMe = async () => ({ ...canonical, class_id: 88 });
  await evaluate(callbacks.handleSave, h.values)();
  assert.equal(h.toasts.at(-1)[0], "err");
  assert.match(h.toasts.at(-1)[1], /did not confirm/);
  assert.equal(h.changes.setClassId, undefined);
  assert.equal(h.patches.at(-1).classId, 88);
});
for (const [name, field] of [["getBoards", "setBoards"], ["getClassesForBoard", "setClasses"], ["getMediumsForClass", "setMediums"]]) {
  test(`${name} discards an old lookup response after its parent selection changes`, async () => {
    let resolve;
    const changes = [];
    const effect = evaluate(lookups[name], {
      visible: true, educationManaged: false, stateId: 1, boardId: 2, classId: 3,
      api: { data: { [name]: () => new Promise(done => { resolve = done; }) } },
      [field]: value => changes.push(value),
      setBoardsLoading: () => {}, setClassesLoading: () => {}, setMediumsLoading: () => {},
      showToast: () => {},
    });
    const cleanup = effect();
    cleanup();
    resolve([{ id: 99, name: "Old response" }]);
    await new Promise(done => setImmediate(done));
    assert.equal(changes.length, 1);
    assert.equal(changes[0].length, 0);
  });
}
