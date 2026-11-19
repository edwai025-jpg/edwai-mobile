const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
function load(file, scope) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: false },
  }).outputText;
  vm.runInNewContext(js, { exports, Error, AbortController, ...scope });
  return exports;
}
const colors = load("constants/studyActionColors.ts", {});
const palette = load("constants/flashcardPalette.ts", {});
const context = { id: "one", question: "Original question", answer: "**Original answer**", language: "english", bookTitle: "Book", pageNumber: 1 };
const cards = ["concept", "concept", "fact", "definition", "fact", "diagram", "process"].map((type, i) => ({ type, front: `Q${i}`, back: `A${i}` }));
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness(operation = async () => cards) {
  const state = [], refs = [], effectDeps = [], cleanups = [];
  let si, ri, ei, dirty = false, pending = [], tree;
  const calls = [], animations = [];
  const props = { context, open: false, onCollapse: () => { props.open = false; } };
  const hooks = {
    useState(initial) {
      const i = si++;
      if (!(i in state)) state[i] = typeof initial === "function" ? initial() : initial;
      return [state[i], value => {
        const next = typeof value === "function" ? value(state[i]) : value;
        if (!Object.is(next, state[i])) { state[i] = next; dirty = true; }
      }];
    },
    useRef(initial) { const i = ri++; return refs[i] ?? (refs[i] = { current: initial }); },
    useCallback: fn => fn,
    useEffect(fn, deps) {
      const i = ei++;
      if (!effectDeps[i] || deps.some((value, n) => !Object.is(value, effectDeps[i][n]))) {
        effectDeps[i] = deps;
        pending.push(() => { cleanups[i]?.(); cleanups[i] = fn(); });
      }
    },
  };
  const jsx = (type, props) => typeof type === "function" ? type(props) : { type, props };
  class Value {
    stopAnimation() {} setValue(value) { this.value = value; }
    interpolate(options) { return options; }
  }
  const Component = load("components/study/StudyFlashcards.tsx", {
    require: name => {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
      if (name === "react-native") return {
        Pressable: "Pressable", Text: "Text", View: "View", StyleSheet: { create: value => value },
        Animated: { Value, View: "Animated", timing: (_, options) => { animations.push(options); return { start() {} }; } },
        Easing: { bezier: (...args) => args },
        AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }) },
        Share: { share: async () => ({}) },
      };
      if (name === "expo-linear-gradient") return { LinearGradient: "Gradient" };
      if (name === "@expo/vector-icons") return { Ionicons: "Icon" };
      if (name.includes("flashcardPalette")) return palette;
      if (name.includes("studyActionColors")) return colors;
      if (name.includes("context/theme")) return { useTheme: () => ({ isDark: false }) };
      if (name.includes("services/studyResources")) return { studyResources: { flashcards: (token, ctx, signal) => {
        calls.push({ ctx, signal }); return operation(calls.length);
      } } };
      if (name.includes("services/flashcardShare")) return { buildFlashcardShareText: () => "" };
      if (name === "./studyRequests") return { errMsg: (e, fallback) => e.message || fallback };
      throw new Error(`Unexpected import ${name}`);
    },
  }).default;
  props.run = (fn, controller) => fn("fixture", controller.signal);
  function render() {
    let safety = 0;
    do {
      dirty = false; si = ri = ei = 0;
      tree = Component(props);
      const effects = pending; pending = []; effects.forEach(fn => fn());
      assert.ok(++safety < 20, "render loop must settle");
    } while (dirty);
    return tree;
  }
  function nodes(node) {
    if (arguments.length === 0) node = tree;
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    return [node, ...nodes(node.props?.children)];
  }
  function text(node) {
    if (arguments.length === 0) node = tree;
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(text).join("");
    return node?.props ? text(node.props.children) : "";
  }
  function press(label) {
    const button = nodes().find(node => node.type === "Pressable" && node.props.accessibilityLabel === label);
    assert.ok(button, `Missing control: ${label}`);
    if (!button.props.disabled) button.props.onPress();
    render();
  }
  render();
  return { props, calls, animations, state, render, text, nodes, press,
    async settle() { await flush(); render(); await flush(); render(); },
    unmount() { cleanups.forEach(fn => fn?.()); },
  };
}

test("no answer-arrival generation; one explicit open generates once with frozen original context", async () => {
  const h = harness(); await h.settle(); assert.equal(h.calls.length, 0);
  h.props.open = true; h.render(); await h.settle();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].ctx, context);
  assert.match(h.text(), /7 cards · 0 mastered/);
  assert.match(h.text(), /💡 Concept/);
  const gradients = h.nodes().filter(n => n.type === "Gradient");
  assert.ok(gradients.some(n => JSON.stringify(n.props.colors) === '["#0ea5e9","#2563eb"]'));
  assert.ok(gradients.some(n => JSON.stringify(n.props.colors) === '["#2563eb","#0ea5e9"]'));
});

test("flip, dots, mastery and collapse are local; current-card dot and all navigation reset the face", async () => {
  const h = harness(); h.props.open = true; h.render(); await h.settle();
  h.press("Card 1 of 7, Concept question: Q0");
  assert.equal(h.animations.at(-1).duration, 550);
  assert.deepEqual(Array.from(h.animations.at(-1).easing), [0.4, 0, 0.2, 1]);
  assert.ok(h.nodes().some(n => n.props?.accessibilityLabel === "Card 1 of 7, answer: A0"));
  h.press("Go to card 1");
  assert.ok(h.nodes().some(n => n.props?.accessibilityLabel === "Card 1 of 7, Concept question: Q0"));
  h.press("Mastered"); assert.match(h.text(), /1 mastered/);
  h.press("Collapse flashcards"); assert.equal(h.text(), "");
  h.props.open = true; h.render(); assert.match(h.text(), /1 mastered/);
  h.press("Go to card 7");
  h.press("Next card"); assert.ok(h.nodes().some(n => n.props?.accessibilityLabel === "Card 7 of 7, Process question: Q6"));
  h.press("Go to card 1, mastered");
  h.press("Previous card"); assert.ok(h.nodes().some(n => n.props?.accessibilityLabel === "Card 1 of 7, Concept question: Q0"));
  assert.equal(h.calls.length, 1);
});

test("all-mastered celebration is local and unmarking removes it without recoloring the face", async () => {
  const h = harness(); h.props.open = true; h.render(); await h.settle();
  for (let i = 1; i <= cards.length; i++) { h.press(`Go to card ${i}`); h.press("Mastered"); }
  assert.match(h.text(), /All 7 cards mastered/); assert.equal(h.calls.length, 1);
  h.press("Mastered"); assert.doesNotMatch(h.text(), /All 7 cards mastered/);
  assert.ok(h.nodes().some(n => n.type === "Gradient" && JSON.stringify(n.props.colors) === '["#10b981","#0d9488"]'));
});

test("regeneration clears deck, index, flip and mastery immediately; failure does not restore old cards or retry", async () => {
  let fail;
  const h = harness(async n => n === 1 ? cards : new Promise((_, reject) => { fail = reject; }));
  h.props.open = true; h.render(); await h.settle();
  h.press("Mastered"); h.press("Go to card 3"); h.press("Card 3 of 7, Key Fact question: Q2");
  h.press("Regenerate flashcards"); h.press("Regenerate flashcards");
  assert.equal(h.calls.length, 2); assert.deepEqual(Array.from(h.state[2]), []);
  assert.equal(h.state[3], 0); assert.equal(h.state[4].size, 0); assert.equal(h.state[5], false);
  fail(new Error("Flashcard generation took too long. Please try again."));
  await h.settle();
  assert.match(h.text(), /took too long/); assert.doesNotMatch(h.text(), /7 cards/);
  assert.equal(h.calls.length, 2); assert.equal(context.answer, "**Original answer**");
});

test("same-text different-answer context aborts old request and ignores its late result; unmount also aborts", async () => {
  let finish;
  const h = harness(() => new Promise(resolve => { finish = resolve; }));
  h.props.open = true; h.render();
  h.props.open = false; h.props.context = { ...context, id: "two", orgSubdomain: "other-school" }; h.render();
  assert.equal(h.calls[0].signal.aborted, true);
  finish(cards); await h.settle(); assert.equal(h.state[2].length, 0);
  h.props.open = true; h.render(); assert.equal(h.calls.length, 2);
  h.unmount(); assert.equal(h.calls[1].signal.aborted, true);
  finish(cards); await flush(); assert.equal(h.state[2].length, 0);
});
