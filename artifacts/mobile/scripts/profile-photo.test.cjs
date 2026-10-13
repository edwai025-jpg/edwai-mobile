const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
function load(file, scope = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: false },
  }).outputText;
  vm.runInNewContext(code, { exports, Error, TypeError, Blob, FormData, ...scope });
  return exports;
}
const crop = load("services/profilePhotoCrop.ts");
test("crop exports square pixels matching centered cover and bounded drags at zoom 1–3", () => {
  const centered = crop.getPhotoCrop(1200, 800, 300, 1, 0, 0);
  assert.equal(centered.width, 800); assert.equal(centered.originX, 200);
  for (const [w, h] of [[1200, 800], [500, 1500], [2, 2]]) {
    for (const z of [1, 1.6, 3]) for (const x of [-9000, 0, 9000]) {
      const rect = crop.getPhotoCrop(w, h, 287, z, x, -x);
      assert.equal(rect.width, rect.height);
      assert.ok(rect.originX >= 0 && rect.originY >= 0);
      assert.ok(rect.originX + rect.width <= w && rect.originY + rect.height <= h);
    }
  }
  assert.throws(() => crop.getPhotoCrop(0, 10, 300, 1, 0, 0), /dimensions/);
});
test("native photo bytes serialize through the installed Expo multipart encoder", async () => {
  class NativeForm { constructor() { this._parts = []; } }
  load("node_modules/expo/src/winter/FormData.ts").installFormDataPatch(NativeForm);
  const uploader = load("services/profilePhotoUpload.ts", {
    FormData: NativeForm,
    require: name => name === "react-native" ? { Platform: { OS: "ios" } } : {
      File: class { size = 4; bytes() { return Promise.resolve(new Uint8Array([255, 216, 255, 217])); } },
    },
  });
  const encoder = load("node_modules/expo/src/winter/fetch/convertFormData.ts", {
    TextEncoder, require: () => ({ blobToArrayBufferAsync: blob => blob.arrayBuffer() }),
  });
  const form = await uploader.prepareProfilePhotoUpload({ uri: "file:///cache/photo.jpg", mimeType: "IMAGE/JPEG", fileName: "photo.jpg", fileSize: 99999999 });
  const result = await encoder.convertFormDataAsync(form, "fixture-photo-boundary");
  const bytes = new Uint8Array(result.body);
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /name="file"; filename="photo.jpg"/);
  assert.match(text, /image\/jpeg/);
  assert.ok(bytes.some((v, i) => v === 255 && bytes[i + 1] === 216));
});
class ApiError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } }
class PhotoValidationError extends Error {}
const flush = () => new Promise(done => setImmediate(done));
const selected = { uri: "data:fixture", width: 800, height: 600 };
function harness(options = {}) {
  let user = { id: 42, name: "Fixture Learner", questionsUsed: 17, profilePhotoUrl: options.existing ? "profiles/42/avatar.jpg" : null };
  let server = { id: 42, full_name: user.name, profile_photo_url: user.profilePhotoUrl };
  let result, si, ri, ei, effects = [];
  const states = [], refs = [], deps = [], calls = [], alerts = [];
  const react = {
    useState(value) {
      const i = si++; if (!(i in states)) states[i] = value;
      return [states[i], value => { states[i] = typeof value === "function" ? value(states[i]) : value; render(); }];
    },
    useRef(value) { const i = ri++; return refs[i] ??= { current: value }; },
    useEffect(fn, next) { const i = ei++; if (!deps[i] || next.some((value, j) => value !== deps[i][j])) { deps[i] = next; effects.push(fn); } },
  };
  const hook = load("hooks/useProfilePhoto.ts", { require: name => {
    if (name === "react") return react;
    if (name === "react-native") return { Platform: { OS: "web" } };
    if (name === "expo-image-picker") return {
      launchImageLibraryAsync: async () => { calls.push("picker"); return { canceled: !!options.cancel, assets: [selected] }; },
    };
    if (name === "@/services/profilePhotoUpload") return { PhotoValidationError };
    if (name === "@/context/auth") return {
      useAuth: () => ({
        user, updateUser: async patch => { user = { ...user, ...patch }; render(); },
        setHasPhoto: value => calls.push(["display", value]),
        runAuthenticatedRequest: operation => operation("fixture-token"),
      }),
      apiUserToProfile: fresh => ({ id: fresh.id, name: fresh.full_name, profilePhotoUrl: fresh.profile_photo_url }),
    };
    if (name === "@/services/api") return { ApiError, default: {
      auth: { getMe: async () => { calls.push("read"); if (options.readFailure) throw new TypeError("Offline"); return server; } },
      profile: {
        uploadPhoto: async (_, file) => {
          calls.push("POST");
          if (options.validation) throw new PhotoValidationError("Photo must be 5 MiB or smaller.");
          if (options.reject) throw new ApiError("Unsupported file type", 400);
          if (options.pending) await options.pending;
          server.profile_photo_url = "profiles/42/avatar.jpg";
          if (options.lost) throw new TypeError("Lost response");
          return { success: true, profile_photo_url: server.profile_photo_url };
        },
        deletePhoto: async () => { calls.push("DELETE"); server.profile_photo_url = null; if (options.lost) throw new TypeError("Lost response"); return { success: true }; },
        probePhoto: async () => { calls.push("GET photo"); return !!server.profile_photo_url; },
      },
    } };
    throw new Error(`Unexpected dependency ${name}`);
  } }).useProfilePhoto;
  function render() {
    si = ri = ei = 0;
    result = hook((...args) => alerts.push(args));
    const pending = effects; effects = []; pending.forEach(fn => fn());
  }
  render();
  return { get photo() { return result; }, get user() { return user; }, calls, alerts,
    async pick() { result.openPicker(); alerts.at(-1)[2].find(button => button.text === "Choose from Library").onPress(); await flush(); },
    switchUser() { user = { id: 43, name: "Other Learner" }; render(); },
  };
}
test("selection and crop cancellation never save account, Education or photo", async () => {
  const h = harness(); await h.pick();
  assert.equal(h.photo.asset, selected);
  h.photo.cancel();
  assert.equal(h.photo.asset, null);
  assert.deepEqual(h.calls, ["picker"]);
  const canceled = harness({ cancel: true }); await canceled.pick();
  assert.equal(canceled.photo.asset, null);
});
test("upload saves only photo metadata and preserves current identity/usage", async () => {
  const h = harness(); await h.pick();
  assert.equal(await h.photo.save(selected), true);
  assert.equal(h.photo.asset, null);
  assert.equal(h.user.profilePhotoUrl, "profiles/42/avatar.jpg");
  assert.equal(h.user.questionsUsed, 17); assert.equal(h.user.id, 42);
  assert.equal(h.calls.filter(call => call === "POST").length, 1);
  assert.match(h.alerts.at(-1)[0], /updated/);
});
test("definite upload and local-size failures preserve the retryable crop without reconciliation", async () => {
  for (const options of [{ reject: true }, { validation: true }]) {
    const h = harness(options); await h.pick();
    assert.equal(await h.photo.save(selected), false);
    assert.equal(h.photo.asset, selected);
    assert.equal(h.calls.includes("read"), false);
    assert.equal(h.user.profilePhotoUrl, null);
  }
});
test("successful upload with failed refresh is not replayed and remains linked", async () => {
  const h = harness({ readFailure: true }); await h.pick();
  assert.equal(await h.photo.save(selected), true);
  assert.equal(h.photo.needsReconcile, true);
  await h.photo.save(selected);
  assert.equal(h.calls.filter(call => call === "POST").length, 1);
  assert.equal(h.user.profilePhotoUrl, "profiles/42/avatar.jpg");
});
test("lost stable-key replacement refreshes image but cannot claim proven replacement or retry automatically", async () => {
  const h = harness({ existing: true, lost: true }); await h.pick();
  assert.equal(await h.photo.save(selected), false);
  assert.ok(h.calls.includes("GET photo"));
  assert.match(h.alerts.at(-1)[1], /cannot prove/);
  assert.equal(h.calls.filter(call => call === "POST").length, 1);
  assert.equal(h.photo.asset, selected);
});
test("unknown upload outcome blocks mutations until an authoritative read succeeds", async () => {
  const h = harness({ lost: true, readFailure: true }); await h.pick();
  await h.photo.save(selected); await h.photo.save(selected); await h.photo.remove();
  assert.equal(h.calls.filter(call => call === "POST").length, 1);
  assert.equal(h.calls.includes("DELETE"), false);
});
test("Remove availability comes from the saved key and clears after only photo DELETE", async () => {
  const h = harness({ existing: true });
  assert.equal(h.photo.canRemove, true);
  await h.photo.remove();
  assert.equal(h.photo.canRemove, false);
  assert.equal(h.user.profilePhotoUrl, null);
  assert.equal(h.user.questionsUsed, 17);
  assert.equal(h.calls.filter(call => call === "DELETE").length, 1);
  assert.equal(h.calls.includes("POST"), false);
});
test("lost DELETE response is confirmed by a cleared authoritative reference, not replayed", async () => {
  const h = harness({ existing: true, lost: true });
  await h.photo.remove();
  assert.equal(h.photo.canRemove, false);
  assert.match(h.alerts.at(-1)[1], /confirmed/);
  assert.equal(h.calls.filter(call => call === "DELETE").length, 1);
});
test("busy state suppresses duplicate uploads and an account switch drops late photo results", async () => {
  let finish;
  const h = harness({ pending: new Promise(resolve => { finish = resolve; }) });
  await h.pick();
  const first = h.photo.save(selected);
  await h.photo.save(selected);
  h.switchUser(); finish(); await first;
  assert.equal(h.user.id, 43);
  assert.equal(h.user.profilePhotoUrl, undefined);
  assert.equal(h.photo.asset, null);
  assert.equal(h.calls.filter(call => call === "POST").length, 1);
});
test("a profile refresh cannot restore completion after logout during its final storage write", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../context/auth.tsx"), "utf8");
  const ast = ts.createSourceFile("auth.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "updateUser") expression = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const exports = {}, epoch = { current: 1 };
  let complete = false, currentUser = { id: 42, questionsUsed: 19 }, writes = 0;
  const code = ts.transpileModule(`exports.update = ${expression};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, sessionEpoch: epoch, user: { id: 42, questionsUsed: 17 },
    STORAGE_KEYS: { user: "user", profileComplete: "complete" },
    AsyncStorage: { setItem: async () => { if (++writes === 2) await pending; } },
    setUser: updater => { currentUser = updater(currentUser); },
    setIsProfileComplete: value => { complete = value; },
  });
  const updating = exports.update({ profilePhotoUrl: "profiles/42/avatar.jpg", profileComplete: true });
  await flush();
  assert.equal(currentUser.questionsUsed, 19);
  epoch.current++; currentUser = null; release();
  await assert.rejects(updating, /session changed/i);
  assert.equal(complete, false);
  assert.equal(currentUser, null);
});
