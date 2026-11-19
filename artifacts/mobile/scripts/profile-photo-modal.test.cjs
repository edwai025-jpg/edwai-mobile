const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const asset = { uri: "file:///selected.jpg", width: 800, height: 600 };
function fixture(os = "ios", overrides = {}) {
  const calls = [], refs = [], updates = [];
  let stateIndex = 0;
  const noop = () => {};
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState: initial => {
      const index = stateIndex++;
      return [overrides.states?.[index] ?? initial, value => updates.push([index, value])];
    },
    useRef: initial => { const ref = { current: initial }; refs.push(ref); return ref; },
    useEffect: noop, useMemo: callback => callback(), useCallback: callback => callback,
    useImperativeHandle: (ref, create) => { if (ref) ref.current = create(); },
  };
  const photo = { asset, busy: false, cancel: () => calls.push("cancel"), save: async () => true, ...overrides.photo };
  const modules = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      Platform: { OS: os }, StyleSheet: { create: value => value, absoluteFill: {} },
      useWindowDimensions: () => ({ width: 375, height: 812 }),
      PanResponder: { create: () => ({ panHandlers: {} }) },
      Image: "Image", Modal: "Modal", View: "View", Text: "Text", ScrollView: "ScrollView",
      Pressable: "Pressable", TouchableOpacity: "TouchableOpacity", TextInput: "TextInput",
      ActivityIndicator: "ActivityIndicator", KeyboardAvoidingView: "KeyboardAvoidingView",
    },
    "expo-image-manipulator": {
      SaveFormat: { JPEG: "jpeg" },
      manipulateAsync: overrides.manipulate ?? (async () => ({ uri: "file:///cropped.jpg", width: 600, height: 600 })),
    },
    "expo-file-system": {
      File: class { size = 4; exists = true; constructor(uri) { this.uri = uri; } delete() { calls.push(["delete", this.uri]); } },
    },
    "@expo/vector-icons": { Feather: "Feather", Ionicons: "Ionicons", MaterialIcons: "MaterialIcons" },
    "@/constants/colors": { Colors: {} }, "expo-image": { Image: "ExpoImage" },
    "expo-linear-gradient": { LinearGradient: "LinearGradient" },
    "expo-router": { useFocusEffect: noop },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    "@/context/auth": { useAuth: () => ({ user: { id: 42, name: "Fixture Learner" } }) },
    "@/context/theme": { useTheme: () => ({ isDark: true }) },
    "@/hooks/useProfileAlert": { useProfileAlert: () => ({ showAlert: noop, alertDialog: null }) },
    "@/hooks/useAccountDetails": { useAccountDetails: () => ({ name: "Pending Draft", email: "", phone: "" }) },
    "@/hooks/useProfilePhoto": { useProfilePhoto: () => photo },
    "@/services/api": { default: {} },
    "@/services/onboarding": { legalUrls: { privacy: "https://eduwai.in/privacy-policy", terms: "https://eduwai.in/terms" } },
    "@/constants/storePolicy": { SHOW_WEB_PAYMENTS: true },
    "@/services/profilePhotoCrop": load("services/profilePhotoCrop.ts"),
    "@/components/EducationEditModal": { default: "EducationEditModal" },
    "@/components/SessionsModal": { default: "SessionsModal" },
    "@/components/AccountEditModal": { default: "AccountEditModal" },
  };
  function load(relative) {
    const file = path.join(__dirname, "..", relative), exports = {};
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: false },
    }).outputText;
    vm.runInNewContext(code, { exports, Error, require: name => {
      if (!(name in modules)) throw new Error(`Unexpected import ${name}`);
      return modules[name];
    } });
    return exports;
  }
  // The geometry module has no imports, so it can be loaded during setup.
  const Crop = load("components/ProfilePhotoCropModal.tsx").default;
  modules["@/components/ProfilePhotoCropModal"] = { default: Crop };
  return { load, Crop, calls, updates, photo, reset: () => { stateIndex = 0; } };
}
function elements(tree, type) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(child => elements(child, type));
  return [...(tree.type === type ? [tree] : []), ...elements(tree.props?.children, type)];
}
for (const os of ["ios", "android", "web"]) {
  test(`${os}: Account cropping reuses its existing modal and system back cancels crop, not editor`, () => {
    const f = fixture(os), Account = f.load("components/AccountEditModal.tsx").default;
    const editor = Account({ visible: true, photo: f.photo, onClose: () => f.calls.push("close editor") });
    assert.equal(elements(editor, "Modal").filter(node => node.props.visible).length, 1);
    const child = elements(editor, f.Crop)[0];
    assert.equal(child.props.embedded, true);
    f.reset();
    const crop = f.Crop(child.props);
    assert.equal(elements(crop, "Modal").length, 0);
    editor.props.onRequestClose();
    assert.deepEqual(f.calls, ["cancel"]);
  });
}
test("the Profile screen does not mount another crop host while Account is open", () => {
  const f = fixture("ios", { states: { 3: true } });
  const Profile = f.load("app/(tabs)/profile.tsx").default;
  const tree = Profile();
  assert.equal(elements(tree, f.Crop).length, 0);
});
test("the Profile avatar retains a standalone crop host when Account is closed", () => {
  const f = fixture("ios");
  const tree = f.load("app/(tabs)/profile.tsx").default();
  const child = elements(tree, f.Crop)[0];
  assert.equal(child.props.asset, asset);
  f.reset();
  assert.equal(f.Crop(child.props).type, "Modal");
});
test("embedded crop refuses system back during JPEG preparation, then cleans only its generated file", async () => {
  let finish;
  const f = fixture("ios", { states: { 0: { w: 800, h: 600 } }, manipulate: () => new Promise(resolve => { finish = resolve; }) });
  const ref = { current: null };
  const tree = f.Crop({ asset, embedded: true, busy: false, closeRequestRef: ref, onCancel: f.photo.cancel, onSave: f.photo.save });
  const save = elements(tree, "Pressable").find(node => node.props.testID === "crop-save").props.onPress();
  ref.current.requestClose();
  assert.equal(f.calls.includes("cancel"), false);
  finish({ uri: "file:///cropped.jpg", width: 600, height: 600 });
  await save;
  assert.deepEqual(f.calls, [["delete", "file:///cropped.jpg"]]);
});
test("unconfirmed saves remain visibly retryable rather than silently swallowing the result", async () => {
  for (const onSave of [async () => false, async () => { throw new Error("unexpected failure"); }]) {
    const f = fixture("ios", { states: { 0: { w: 800, h: 600 } } });
    const tree = f.Crop({ asset, embedded: true, busy: false, onCancel: f.photo.cancel, onSave });
    await elements(tree, "Pressable").find(node => node.props.testID === "crop-save").props.onPress();
    assert.ok(f.updates.some(([, value]) => typeof value === "string" && value.includes("Could not confirm this photo was saved")));
    assert.equal(f.calls.includes("cancel"), false);
  }
});
