const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function pickerHarness(searchable = true) {
  const slots = [], selected = [], scrollCalls = [];
  let cursor = 0, dismissals = 0;
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
  };
  const native = {
    StyleSheet: { create: value => value },
    Keyboard: { dismiss: () => { dismissals++; } },
  };
  for (const name of ["ActivityIndicator", "Pressable", "ScrollView", "Text", "TextInput", "View"]) native[name] = name;
  const modules = {
    react, "react/jsx-runtime": { jsx, jsxs: jsx }, "react-native": native,
    "@expo/vector-icons": { Feather: "Feather" }, "./ui": { T: new Proxy({}, { get: () => "#000" }) },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../components/onboarding/Picker.tsx"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: false },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => { assert.ok(modules[name], name); return modules[name]; } });
  const items = ["Andhra Pradesh", "Telangana", "Tamil Nadu", "Karnataka", "Kerala", "Maharashtra", "West Bengal"].map((name, i) => ({ id: i + 1, name }));
  const props = {
    label: searchable ? "State" : "Board / University", items, selectedId: 2, placeholder: "Select",
    searchable, searchPlaceholder: "Search states...",
    onSelect: item => { selected.push(item); props.selectedId = item.id; },
  };
  function render() {
    cursor = 0;
    const tree = exports.default(props);
    const list = nodes(tree).find(n => n.type === "ScrollView");
    if (list) list.props.ref.current = { scrollTo: options => scrollCalls.push(options) };
    return tree;
  }
  return { render, props, selected, scrollCalls, items, get dismissals() { return dismissals; } };
}

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return Array.from(tree).flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const trigger = tree => nodes(tree).find(n => n.props?.accessibilityState?.expanded !== undefined);
const input = tree => nodes(tree).find(n => n.type === "TextInput");
const options = tree => nodes(tree).filter(n => n.props?.accessibilityRole === "menuitem");
const track = tree => nodes(tree).find(n => n.props?.pointerEvents === "none");

test("state search filters case-insensitively, clears, handles no results, and preserves original selection IDs", () => {
  const h = pickerHarness();
  trigger(h.render()).props.onPress();
  let tree = h.render();
  assert.equal(input(tree).props.placeholder, "Search states...");
  input(tree).props.onChangeText("  tAm  ");
  tree = h.render();
  assert.equal(options(tree).length, 1);
  assert.equal(options(tree)[0].props.children[0].props.children, "Tamil Nadu");
  assert.equal(trigger(tree).props.accessibilityLabel, "State: Telangana");
  input(tree).props.onChangeText("not-a-state");
  tree = h.render();
  assert.equal(options(tree).length, 0);
  assert.ok(nodes(tree).some(n => n.props?.children === "No matches found. Try another search."));
  nodes(tree).find(n => n.props?.accessibilityLabel === "Clear search").props.onPress();
  tree = h.render();
  assert.equal(options(tree).length, h.items.length);
  input(tree).props.onChangeText("tamil");
  options(h.render())[0].props.onPress();
  tree = h.render();
  assert.equal(input(tree), undefined);
  assert.equal(h.selected[0], h.items[2]);
  assert.equal(h.dismissals, 1);
  assert.equal(trigger(tree).props.accessibilityLabel, "State: Tamil Nadu");
  trigger(tree).props.onPress();
  assert.equal(input(h.render()).props.value, "");
  assert.equal(options(h.render()).length, h.items.length);
  assert.ok(h.scrollCalls.every(call => call.y === 0 && call.animated === false));
});

test("state scrollbar persists for overflow, follows scrolling, and hides when results fit", () => {
  const h = pickerHarness();
  trigger(h.render()).props.onPress();
  let tree = h.render(), list = nodes(tree).find(n => n.type === "ScrollView");
  list.props.onLayout({ nativeEvent: { layout: { height: 220 } } });
  list.props.onContentSizeChange(300, 322);
  tree = h.render();
  assert.ok(track(tree));
  assert.equal(track(tree).props.children.props.style[1].top, 0);
  list.props.onScroll({ nativeEvent: { contentOffset: { y: 102 } } });
  tree = h.render();
  const thumb = track(tree).props.children.props.style[1];
  assert.equal(thumb.top, 208 - thumb.height);
  list.props.onContentSizeChange(300, 46);
  assert.equal(track(h.render()), undefined);
});

test("board and class pickers remain unsearchable; busy state disables searchable options", () => {
  const board = pickerHarness(false);
  trigger(board.render()).props.onPress();
  let tree = board.render();
  assert.equal(input(tree), undefined);
  assert.equal(options(tree).length, board.items.length);
  assert.equal(nodes(tree).find(n => n.type === "ScrollView").props.showsVerticalScrollIndicator, true);
  const state = pickerHarness();
  trigger(state.render()).props.onPress();
  state.props.disabled = true;
  tree = state.render();
  assert.equal(input(tree).props.editable, false);
  assert.ok(options(tree).every(n => n.props.disabled));
});
