const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, modules = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: name => {
      assert.ok(name in modules, `Unexpected import: ${name}`);
      return modules[name];
    },
  });
  return exports;
}

const { Colors } = load("../constants/colors.ts");
const bannerLayout = load("../services/bannerTopLayout.ts");
const jsx = (type, props) => ({ type, props });
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return Array.from(tree).flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

// Model RN's entry ownership: popping an entry restores the remaining stack,
// rather than resetting a global style. Drive callbacks from the real screens.
function harness(platform, priorStyle = "dark-content") {
  const entries = [], calls = [];
  const StatusBar = {
    pushStackEntry(props) {
      const entry = { ...props };
      entries.push(entry);
      calls.push(["push", entry]);
      return entry;
    },
    popStackEntry(entry) {
      const index = entries.indexOf(entry);
      assert.notEqual(index, -1, "cleanup must remove its own live entry");
      entries.splice(index, 1);
      calls.push(["pop", entry]);
    },
  };
  function screen(kind, { isDark = true, inset = 59, status = "active", dismissed = true } = {}) {
    const effects = [];
    let stateIndex = 0;
    const noop = () => {};
    const modules = {
      react: {
        useState: initial => [kind === "banner" && stateIndex++ === 1 ? dismissed : initial, noop],
        useEffect: noop,
        useCallback: callback => callback,
      },
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "react-native": {
        Platform: { OS: platform }, StatusBar,
        StyleSheet: { create: styles => styles, absoluteFill: {} },
        View: "View", Text: "Text", ScrollView: "ScrollView",
        Pressable: "Pressable", ActivityIndicator: "ActivityIndicator",
      },
      "expo-router": { useFocusEffect: callback => effects.push(callback), useRouter: () => ({ push: noop }) },
      "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: inset, bottom: 34 }) },
      "expo-linear-gradient": { LinearGradient: "LinearGradient" },
      "expo-image": { Image: "Image" },
      "@expo/vector-icons": {},
      "expo-image-picker": {},
      "@/context/auth": { useAuth: () => ({ user: { name: "Student" }, refreshUser: noop, probeHasPhoto: noop }) },
      "@/context/theme": { useTheme: () => ({ isDark }) },
      "@/constants/colors": { Colors },
      "@/constants/shadow": { platformShadow: () => ({}) },
      "@/services/api": {},
      "@/hooks/useProfileAlert": { useProfileAlert: () => ({ showAlert: noop }) },
      "@/components/AccountEditModal": {},
      "@/components/EducationEditModal": {},
      "@/components/SessionsModal": {},
      "@/services/bannerTopLayout": bannerLayout,
      "@/services/bannerUsage": { getBannerUsage: () => ({ percent: 0, countLabel: "0/200 Q" }) },
      "@/components/shared/BannerBackground": {},
      "@/assets/images/eduwai-logo.png": "logo",
      "@react-native-async-storage/async-storage": {},
    };
    const tree = kind === "profile"
      ? load("../app/(tabs)/profile.tsx", modules).default()
      : load("../components/shared/HomeBanner.tsx", modules).HomeBanner({
        usage: { status, percent_used: 0 }, usageLoading: false,
        isDark, onUpgrade: noop, onLogout: noop, onToggleTheme: noop,
      });
    let cleanups = [];
    return {
      tree,
      focus() {
        assert.equal(cleanups.length, 0);
        cleanups = effects.map(effect => effect()).filter(Boolean);
      },
      blur() { cleanups.forEach(cleanup => cleanup()); cleanups = []; },
    };
  }
  return { screen, calls, entries, style: () => entries.at(-1)?.barStyle ?? priorStyle };
}

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(part => {
    const v = parseInt(part, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

test("Profile's actual gradient needs light indicators in both themes; native inset ownership is unchanged", () => {
  for (const platform of ["ios", "android", "web"]) {
    for (const isDark of [false, true]) {
      for (const inset of [0, 24, 47, 59, 62]) {
        const h = harness(platform);
        const profile = h.screen("profile", { isDark, inset });
        const header = nodes(profile.tree).find(node =>
          node.type === "LinearGradient" && node.props.colors[0] === Colors.navHeader1);
        assert.ok(header);
        assert.equal(header.props.style[1].paddingTop, (platform === "web" ? 67 : inset) + 14);
        for (const color of header.props.colors) {
          const l = luminance(color);
          assert.ok((l + 0.05) / 0.05 < 2, `black indicators lack contrast on ${color}`);
          assert.ok(1.05 / (l + 0.05) > 10, `white indicators contrast on ${color}`);
        }
        assert.equal(h.calls.length, 0, "inactive Profile cannot set the status bar");
      }
    }
  }
});

test("fresh native Profile entry applies light content and restores prior Login style on blur/unmount", () => {
  for (const platform of ["ios", "android"]) {
    for (const prior of ["default", "dark-content", "light-content"]) {
      const h = harness(platform, prior);
      const profile = h.screen("profile");
      assert.equal(h.style(), prior);
      profile.focus();
      assert.equal(h.style(), "light-content");
      assert.deepEqual(Object.keys(h.entries[0]), ["barStyle"], "do not change background, visibility or translucency");
      const entry = h.entries[0];
      profile.blur(); // useFocusEffect also runs this cleanup on unmount/logout.
      assert.equal(h.style(), prior);
      assert.equal(h.calls[1][1], entry);
      profile.focus();
      assert.equal(h.style(), "light-content");
      assert.notEqual(h.entries[0], entry, "re-entry owns a new stack entry");
      profile.blur();
      assert.equal(h.entries.length, 0);
    }
  }
});

test("all banner-to-Profile round trips restore the destination style, regardless of focus/blur ordering", () => {
  for (const platform of ["ios", "android"]) {
    for (const [status, dismissed, expected] of [
      ["active", true, "light-content"], ["grace_period", true, "dark-content"],
      ["past_due", true, "light-content"], ["free", false, "dark-content"],
    ]) {
      for (const focusFirst of [false, true]) {
        const h = harness(platform);
        const banner = h.screen("banner", { status, dismissed });
        const profile = h.screen("profile");
        banner.focus();
        assert.equal(h.style(), expected);
        // A newly rendered or updated off-screen banner cannot override Profile.
        if (focusFirst) { profile.focus(); banner.blur(); }
        else { banner.blur(); profile.focus(); }
        assert.equal(h.style(), "light-content");
        h.screen("banner", { status: "grace_period", dismissed: false });
        h.screen("profile", { isDark: false });
        assert.equal(h.style(), "light-content");
        if (focusFirst) { banner.focus(); profile.blur(); }
        else { profile.blur(); banner.focus(); }
        assert.equal(h.style(), expected);
        banner.blur();
        assert.equal(h.style(), "dark-content", "logout leaves no stale tab-owned style on Login");
        assert.equal(h.entries.length, 0);
      }
    }
  }
});

test("web focus and cleanup never touch native status-bar APIs", () => {
  const h = harness("web");
  const profile = h.screen("profile");
  profile.focus();
  profile.blur();
  assert.equal(h.calls.length, 0);
});
