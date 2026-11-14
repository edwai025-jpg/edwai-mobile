const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../components/study/RecentQuestionsPanel.tsx"), "utf8");
const ast = ts.createSourceFile("RecentQuestionsPanel.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = {};
function visit(node) {
  if (ts.isJsxAttribute(node) && ["onLayout", "onScroll"].includes(node.name.getText(ast))) {
    const tag = node.parent.parent.tagName.getText(ast);
    const key = `${tag}.${node.name.getText(ast)}`;
    handlers[key] = node.initializer.expression.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
function handler(name, scope) {
  assert.ok(handlers[name], `Missing actual component handler ${name}`);
  const exports = {};
  const js = ts.transpileModule(`exports.handler = (${handlers[name]});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(js, { exports, ...scope });
  return exports.handler;
}

test("viewport layout snapshots height before the native event is released", () => {
  let update;
  const onLayout = handler("ScrollView.onLayout", { setViewport: value => { update = value; } });
  const event = { nativeEvent: { layout: { y: 0, height: 146 } } };
  onLayout(event);
  event.nativeEvent = null; // React Native returns pooled events after delivery.
  const previous = { y: 91, height: 192 };
  let next;
  assert.doesNotThrow(() => { next = update(previous); });
  assert.equal(next.height, 146);
  assert.equal(next.y, 91);
  assert.equal(previous.height, 192);
});

test("queued layout updates preserve the latest scroll position and ignore unchanged height", () => {
  let update;
  const onLayout = handler("ScrollView.onLayout", { setViewport: value => { update = value; } });
  const event = { nativeEvent: { layout: { height: 128 } } };
  onLayout(event);
  event.nativeEvent.layout.height = 999;
  event.nativeEvent = null;
  const next = update({ y: 300, height: 192 });
  assert.equal(next.y, 300);
  assert.equal(next.height, 128);
  assert.equal(update(next), next);
});

test("scroll handler captures offset and viewport size synchronously", () => {
  let captured;
  const onScroll = handler("ScrollView.onScroll", { setViewport: value => { captured = value; } });
  const event = { nativeEvent: { contentOffset: { y: 240 }, layoutMeasurement: { height: 192 } } };
  onScroll(event);
  event.nativeEvent = null;
  assert.equal(captured.y, 240);
  assert.equal(captured.height, 192);
});

test("row measurements also survive pooled events and keep matching layouts stable", () => {
  let update;
  const onLayout = handler("View.onLayout", { h: { id: 7 }, setRowLayouts: value => { update = value; } });
  const event = { nativeEvent: { layout: { y: 80, height: 56 } } };
  onLayout(event);
  event.nativeEvent = null;
  const previous = { 2: { y: 0, height: 42 } };
  const next = update(previous);
  assert.equal(next[7].y, 80);
  assert.equal(next[7].height, 56);
  assert.equal(next[2], previous[2]);
  assert.equal(update(next), next);
});
