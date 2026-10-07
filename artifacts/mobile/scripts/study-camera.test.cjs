// App-side permission and OCR contract checks; no physical camera or live API writes.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function fixture({ os = "ios", granted = false, canAskAgain = true, requestGranted = true, canceled = false, settingsFails = false, pickerFails = false } = {}) {
  const calls = [];
  const alerts = [];
  let permission = { granted, canAskAgain };
  const picker = {
    getCameraPermissionsAsync: async () => { calls.push("get"); return permission; },
    requestCameraPermissionsAsync: async () => {
      calls.push("request");
      permission = { granted: requestGranted, canAskAgain };
      return permission;
    },
    launchCameraAsync: async options => {
      calls.push(["camera", options]);
      if (pickerFails) throw new Error("No camera");
      return canceled ? { canceled: true, assets: null } : { canceled: false, assets: [{ uri: "file://question.jpg" }] };
    },
    launchImageLibraryAsync: async options => {
      calls.push(["library", options]);
      return { canceled: false, assets: [{ uri: "file://library.jpg" }] };
    },
  };
  const Alert = { alert: (...args) => alerts.push(args) };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../services/studyImageCapture.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports,
    require: id => {
      if (id === "expo-image-picker") return picker;
      if (id === "react-native") return {
        Platform: { OS: os }, Alert,
        Linking: { openSettings: async () => { calls.push("settings"); if (settingsFails) throw new Error("Unavailable"); } },
      };
      throw new Error(`Unexpected module ${id}`);
    },
  });

  // Execute the actual screen handler, including its unchanged OCR API invocation.
  const screen = fs.readFileSync(path.join(__dirname, "../app/(tabs)/index.tsx"), "utf8");
  const handler = screen.match(/const handleImageCapture = useCallback\(([\s\S]*?)\n  \}, \[accessToken\]\);/);
  assert.ok(handler, "Study capture handler must remain wired to the picker");
  const state = { question: "Existing question", uri: null, loading: false };
  const context = {
    pickStudyImage: exports.pickStudyImage, Alert, accessToken: "fixture-token",
    setCaptureUri: uri => { state.uri = uri; },
    setOcrLoading: loading => { state.loading = loading; },
    setQuestion: question => { state.question = question; },
    api: { study: { extractQuestionFromImage: async (...args) => { calls.push(["ocr", ...args]); return { text: "Extracted question" }; } } },
  };
  vm.runInNewContext(ts.transpileModule(`const handleImageCapture = ${handler[1]}\n}; globalThis.capture = handleImageCapture;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return { calls, alerts, state, capture: context.capture, allow: () => { permission = { granted: true, canAskAgain: true }; } };
}

for (const os of ["ios", "android"]) {
  test(`${os}: first grant requests permission before camera and preserves OCR arguments`, async () => {
    const f = fixture({ os });
    await f.capture(true);
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), ["get", "request", ["camera", { quality: 0.8 }], ["ocr", "fixture-token", "file://question.jpg"]]);
    assert.equal(f.state.question, "Extracted question");
    assert.equal(f.state.loading, false);
  });
  test(`${os}: already granted skips request`, async () => {
    const f = fixture({ os, granted: true });
    await f.capture(true);
    assert.equal(f.calls.includes("request"), false);
    assert.ok(f.calls.some(c => c[0] === "ocr"));
  });
}

test("denial prevents camera/OCR and exposes working retry and photo alternatives", async () => {
  const f = fixture({ requestGranted: false });
  await f.capture(true);
  assert.deepEqual(f.calls, ["get", "request"]);
  assert.equal(f.state.question, "Existing question");
  const buttons = f.alerts[0][2];
  assert.ok(buttons.find(b => b.text === "Cancel" && b.style === "cancel"));
  f.allow();
  buttons.find(b => b.text === "Try Again").onPress();
  await new Promise(setImmediate);
  assert.equal(f.state.question, "Extracted question");
  buttons.find(b => b.text === "Choose Photo").onPress();
  await new Promise(setImmediate);
  assert.ok(f.calls.some(c => c[0] === "ocr" && c[2] === "file://library.jpg"));
});

test("permanent denial skips request, opens settings, and rechecks on next tap", async () => {
  const f = fixture({ canAskAgain: false });
  await f.capture(true);
  assert.deepEqual(f.calls, ["get"]);
  assert.equal(f.state.question, "Existing question");
  f.alerts[0][2].find(b => b.text === "Open Settings").onPress();
  await new Promise(setImmediate);
  assert.ok(f.calls.includes("settings"));
  f.allow();
  await f.capture(true);
  assert.equal(f.state.question, "Extracted question");
});

test("settings failure gives manual recovery rather than an unhandled rejection", async () => {
  const f = fixture({ canAskAgain: false, settingsFails: true });
  await f.capture(true);
  f.alerts[0][2].find(b => b.text === "Open Settings").onPress();
  await new Promise(setImmediate);
  assert.equal(f.alerts[1][0], "Could not open Settings");
});

test("camera cancellation preserves question and capture state without OCR", async () => {
  const f = fixture({ granted: true, canceled: true });
  await f.capture(true);
  assert.equal(f.state.question, "Existing question");
  assert.equal(f.state.uri, null);
  assert.equal(f.state.loading, false);
  assert.equal(f.calls.some(c => c[0] === "ocr"), false);
  assert.equal(f.alerts.length, 0);
});

test("picker errors are surfaced rather than silently swallowed", async () => {
  const f = fixture({ granted: true, pickerFails: true });
  await f.capture(true);
  assert.equal(f.alerts[0][0], "Could not open photo capture");
  assert.equal(f.state.question, "Existing question");
});

test("library never asks camera permission; web launches camera directly", async () => {
  const library = fixture();
  await library.capture(false);
  assert.equal(library.calls.includes("get"), false);
  assert.equal(library.calls.includes("request"), false);
  assert.deepEqual(JSON.parse(JSON.stringify(library.calls[0])), ["library", { quality: 0.8, mediaTypes: ["images"] }]);
  const web = fixture({ os: "web" });
  await web.capture(true);
  assert.equal(web.calls[0][0], "camera");
  assert.equal(web.calls.includes("get"), false);
  assert.equal(web.calls.includes("request"), false);
});
