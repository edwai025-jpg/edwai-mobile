// Contract and capture checks only: no microphone device or external API calls.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
function load(file, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Error, Promise, AbortController, Blob, FormData, URL, setTimeout, clearTimeout, ...globals });
  return exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const modes = load("services/inputModes.ts");
test("restoring a candidate caret uses DOM methods on web, not an unavailable native method", () => {
  const source = fs.readFileSync(path.join(__dirname, "../components/study/QuestionComposer.tsx"), "utf8");
  const caret = source.match(/const setCaret = ([\s\S]*?)\n  \};/);
  assert.ok(caret);
  for (const os of ["web", "ios"]) {
    const calls = [], exports = {}, selectionRef = { current: null };
    const node = { focus: () => calls.push("focus") };
    if (os === "web") node.setSelectionRange = (...args) => calls.push(["dom", ...args]);
    else node.setNativeProps = props => calls.push(["native", plain(props)]);
    vm.runInNewContext(ts.transpileModule(`exports.setCaret = ${caret[1]}\n};`, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, Platform: { OS: os }, input: { current: node }, selectionRef, setSelection() {}, requestAnimationFrame: callback => callback() });
    exports.setCaret(4, true);
    assert.deepEqual(plain(selectionRef.current), { start: 4, end: 4 });
    assert.deepEqual(calls, ["focus", os === "web" ? ["dom", 4, 4] : ["native", { selection: { start: 4, end: 4 } }]]);
  }
});
test("the ten API codes include or for Odia; transliteration and keyboard defaults are independent", () => {
  assert.deepEqual(plain(modes.INPUT_LANGUAGES.map(item => item.code)), ["hi", "te", "ta", "kn", "ml", "mr", "bn", "gu", "pa", "or"]);
  const composer = fs.readFileSync(path.join(__dirname, "../components/study/QuestionComposer.tsx"), "utf8");
  const keyboard = fs.readFileSync(path.join(__dirname, "../components/study/QuestionKeyboard.tsx"), "utf8");
  assert.match(composer, /useState\("te"\)/); assert.match(keyboard, /useState<KeyboardLanguage>\("hi"\)/);
});
test("selection-aware candidate replacement preserves spaces, paragraphs and text after the word", () => {
  const text = "Keep  namaste\nand this tail";
  const range = modes.caretWord(text, 13);
  assert.deepEqual(plain(range), { word: "namaste", start: 6, end: 13 });
  assert.deepEqual(plain(modes.replaceWord(text, range, "నమస్తే")), { text: "Keep  నమస్తే \nand this tail", caret: 13 });
  assert.equal(modes.replaceWord(text, range, "नमस्ते", false).text, "Keep  नमस्ते\nand this tail");
});
test("empty, punctuation, digits and native script are not transliteration requests", () => {
  for (const text of ["", "hello ", "hello!", "123", "abc123", "నమస్తే", "नमस्ते"]) assert.equal(modes.caretWord(text, text.length), null, text);
});
test("all ten supplied layouts retain five default and five shift rows and exact special keys", () => {
  const { INDIAN_KEYBOARD_LAYOUTS: layouts } = load("constants/indianKeyboardLayouts.ts");
  assert.equal(Object.keys(layouts).length, 10);
  for (const language of Object.values(layouts)) {
    for (const type of ["default", "shift"]) {
      assert.equal(language[type].length, 5);
      for (const key of ["{bksp}", "{tab}", "{lock}", "{shift}", "{enter}", "{space}", ".com", "@"]) assert.ok(language[type].join(" ").includes(key), `${language.name} ${type} ${key}`);
    }
  }
  assert.equal(layouts.hi.default[1], "{tab} ौ ै ा ी ू ब ह ग द ज ड ़ \\");
  assert.equal(layouts.or.shift[3], "{shift} ଐ ଁ ଣ ଞ ଳ ଶ ଷ କ୍ଷ ଜ୍ଞ {shift}");
});
test("declared duration rounds up and clamps to 1–60; timezone-less period ends use UTC", () => {
  assert.equal(modes.voiceDuration(0), 1); assert.equal(modes.voiceDuration(1.01), 2); assert.equal(modes.voiceDuration(61), 60);
  assert.equal(modes.voicePeriodEnd("not a date"), null);
  assert.equal(modes.voicePeriodEnd(null), null);
  assert.equal(modes.voicePeriodEnd("2026-11-09T00:00:00"), modes.voicePeriodEnd("2026-11-09T00:00:00Z"));
});
class FixtureForm { constructor() { this.parts = []; } append(...args) { this.parts.push(args); } }
function nativeCapture({ granted = true, canAskAgain = true, size = 128, prepareGate } = {}) {
  const calls = [];
  const recorder = {
    uri: "file:///cache/voice.m4a", isRecording: false,
    prepareToRecordAsync: async () => { calls.push("prepare"); if (prepareGate) await prepareGate; },
    record: options => { calls.push(["record", options.forDuration]); recorder.isRecording = true; },
    stop: async () => { calls.push("stop"); recorder.isRecording = false; },
  };
  const capture = load("services/voiceCapture.ts", {
    FormData: FixtureForm,
    require: id => {
      if (id === "react-native") return { Platform: { OS: "ios" } };
      if (id === "expo-audio") return {
        requestRecordingPermissionsAsync: async () => { calls.push("permission"); return { granted, canAskAgain }; },
        setAudioModeAsync: async options => { calls.push(["audio-mode", plain(options)]); },
      };
      if (id === "expo-file-system/legacy") return {
        getInfoAsync: async () => ({ exists: true, isDirectory: false, size }),
        deleteAsync: async uri => { calls.push(["delete", uri]); },
      };
      if (id === "expo-file-system") return {
        File: class {
          constructor(uri) { assert.equal(uri, recorder.uri); }
          async bytes() { return new Uint8Array([0, 255, 127, 2]); }
        },
      };
      if (id === "./inputModes") return modes;
      throw new Error(`Unexpected dependency: ${id}`);
    },
  });
  return { capture, recorder, calls };
}
test("native denial never prepares the recorder; permanent denial is identifiable", async () => {
  const fixture = nativeCapture({ granted: false, canAskAgain: false });
  await assert.rejects(fixture.capture.startVoiceCapture(fixture.recorder, new AbortController().signal), error => error.permanent === true);
  assert.deepEqual(fixture.calls, ["permission"]);
});
test("native AAC-in-MP4 file is finalized once, uploaded with accurate metadata, and disposed", async () => {
  const fixture = nativeCapture();
  const recording = await fixture.capture.startVoiceCapture(fixture.recorder, new AbortController().signal);
  const [first, second] = await Promise.all([recording.stop(), recording.stop()]);
  assert.equal(first, second); assert.equal(fixture.calls.filter(item => item === "stop").length, 1);
  assert.deepEqual(plain(first.file), { uri: fixture.recorder.uri, type: "audio/mp4", name: "voice-question.m4a" });
  const parts = fixture.capture.voiceFormData(first, 12).parts;
  assert.deepEqual(plain(parts), [["audio", { name: first.file.name, type: first.file.type }], ["duration_seconds", "12"]]);
  assert.deepEqual(Array.from(await parts[0][1].bytes()), [0, 255, 127, 2]);
  assert.ok(fixture.calls.some(item => Array.isArray(item) && item[0] === "record" && item[1] === 60));
  await first.dispose(); assert.ok(fixture.calls.some(item => Array.isArray(item) && item[0] === "delete"));
});
test("native zero-byte and over-10-MiB files are discarded; exact 10 MiB is accepted", async () => {
  for (const size of [0, modes.MAX_VOICE_BYTES + 1]) {
    const fixture = nativeCapture({ size });
    const recording = await fixture.capture.startVoiceCapture(fixture.recorder, new AbortController().signal);
    await assert.rejects(recording.stop());
    assert.ok(fixture.calls.some(item => Array.isArray(item) && item[0] === "delete"));
  }
  const fixture = nativeCapture({ size: modes.MAX_VOICE_BYTES });
  const recording = await fixture.capture.startVoiceCapture(fixture.recorder, new AbortController().signal);
  assert.equal((await recording.stop()).size, modes.MAX_VOICE_BYTES);
});
test("cancellation while native preparation is pending does not start recording or leak the file", async () => {
  let prepared;
  const fixture = nativeCapture({ prepareGate: new Promise(resolve => { prepared = resolve; }) });
  const controller = new AbortController();
  const pending = fixture.capture.startVoiceCapture(fixture.recorder, controller.signal);
  await new Promise(resolve => setImmediate(resolve));
  controller.abort(); prepared();
  await assert.rejects(pending, error => error.name === "AbortError");
  assert.ok(!fixture.calls.some(item => Array.isArray(item) && item[0] === "record"));
  assert.ok(fixture.calls.some(item => Array.isArray(item) && item[0] === "delete"));
});
test("browser stop finalizes a real multipart Blob and releases every microphone track", async () => {
  let stopped = 0;
  class BrowserRecorder {
    constructor() { this.mimeType = "audio/webm;codecs=opus"; }
    start() {}
    stop() { this.ondataavailable({ data: new Blob(["recorded bytes"], { type: this.mimeType }) }); this.onstop(); }
  }
  const track = { addEventListener() {}, removeEventListener() {}, stop() { stopped++; } };
  const capture = load("services/voiceCapture.ts", {
    MediaRecorder: BrowserRecorder, navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track] }) } },
    require: id => id === "react-native" ? { Platform: { OS: "web" } } : id === "./inputModes" ? modes : {},
  });
  const recording = await capture.startVoiceCapture({}, new AbortController().signal);
  assert.equal(stopped, 0);
  const file = await recording.stop(), form = capture.voiceFormData(file, 2);
  assert.equal(stopped, 1); assert.equal(form.get("audio").name, "voice-question.webm"); assert.equal(form.get("duration_seconds"), "2");
  assert.equal(form.get("audio").type, "audio/webm;codecs=opus");
});
test("installed Expo multipart encoder rejects legacy URI parts and encodes native voice bytes", async () => {
  class NativeForm {
    constructor() { this._parts = []; }
  }
  const patched = load("node_modules/expo/src/winter/FormData.ts");
  patched.installFormDataPatch(NativeForm);
  const encoder = load("node_modules/expo/src/winter/fetch/convertFormData.ts", {
    TextEncoder,
    require: id => {
      if (id === "../../utils/blobUtils") return { blobToArrayBufferAsync: blob => blob.arrayBuffer() };
      throw new Error(`Unexpected encoder dependency: ${id}`);
    },
  });
  const legacy = new NativeForm();
  legacy.append("audio", { uri: "file:///cache/voice.m4a", type: "audio/mp4", name: "voice-question.m4a" });
  await assert.rejects(encoder.convertFormDataAsync(legacy, "voice-boundary"), /Unsupported FormDataPart implementation/);
  const fixture = nativeCapture();
  const recording = await fixture.capture.startVoiceCapture(fixture.recorder, new AbortController().signal);
  const file = await recording.stop();
  const form = fixture.capture.voiceFormData(file, 12);
  const nativeForm = new NativeForm();
  for (const [name, value] of form.parts) nativeForm.append(name, value);
  const encoded = await encoder.convertFormDataAsync(nativeForm, "voice-boundary");
  const wire = Buffer.from(encoded.body);
  assert.ok(wire.includes(Buffer.from([0, 255, 127, 2])), "audio must remain binary, not a URI or base64 string");
  assert.match(wire.toString("latin1"), /name="audio"; filename="voice-question\.m4a"\r\ncontent-type: audio\/mp4/);
  assert.match(wire.toString("latin1"), /name="duration_seconds"\r\n\r\n12\r\n/);
  assert.equal(encoded.boundary, "voice-boundary");
  assert.deepEqual([...nativeForm.keys()], ["audio", "duration_seconds"]);
  await file.dispose();
});
test("usage is a GET and voice is one authenticated multipart POST without provider, model or language fields", async () => {
  const calls = [];
  const client = load("services/api.ts", {
    FormData: FixtureForm, process: { env: {} },
    require: () => ({ Platform: { OS: "ios" } }),
    fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, text: async () => JSON.stringify({ result: ["నమస్తే"], success: true }) }; },
  }).default;
  await client.study.transliterate("fixture-token", "te", "namaste");
  await client.study.getVoiceQuestionUsage("fixture-token");
  const form = new FixtureForm(); form.append("audio", { uri: "file://fixture.m4a", type: "audio/mp4", name: "voice-question.m4a" }); form.append("duration_seconds", "12");
  await client.study.transcribeVoiceQuestion("fixture-token", form, new AbortController().signal);
  assert.match(calls[0].url, /\/api\/transliterate\/te\/namaste\?num_suggestions=5$/);
  assert.match(calls[1].url, /\/api\/billing\/voice-question-usage$/); assert.equal(calls[1].options.method, undefined);
  assert.match(calls[2].url, /\/api\/transcribe-voice-question$/); assert.equal(calls[2].options.method, "POST");
  assert.equal(calls[2].options.headers.Authorization, "Bearer fixture-token"); assert.equal(calls[2].options.headers["Content-Type"], undefined);
  assert.deepEqual(form.parts.map(item => item[0]), ["audio", "duration_seconds"]);
});
test("preview proxy supports the voice request cap without changing other multipart routes", () => {
  const proxy = fs.readFileSync(path.join(__dirname, "../../api-server/src/routes/proxy.ts"), "utf8");
  assert.match(proxy, /transcribe-voice-question[\s\S]*limit: 10 \* 1024 \* 1024 \+ 64 \* 1024/);
  assert.match(proxy, /limit: "6mb"/);
});
