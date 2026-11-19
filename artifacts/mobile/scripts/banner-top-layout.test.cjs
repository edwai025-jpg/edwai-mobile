const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, requireModule = () => { throw new Error("Unexpected import"); }) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(js, { exports, require: requireModule });
  return exports;
}
const layoutModule = load("../services/bannerTopLayout.ts");
const { getBannerTopLayout } = layoutModule;
const statuses = [undefined, null, "free", "active", "cancelled", "grace_period", "past_due"];
const insets = [0, 20, 24, 47, 59, 62];
const platforms = ["ios", "android", "web"];

test("only a visible alert moves safe-area ownership away from the main banner", () => {
  for (const platform of platforms) {
    for (const inset of insets) {
      for (const status of statuses) {
        for (const dismissed of [false, true]) {
          const result = getBannerTopLayout(status, dismissed, inset, platform);
          const expectedAlert = ["grace_period", "past_due"].includes(status)
            ? status : dismissed ? null : "phone";
          const safeTop = platform === "web" ? 0 : inset;
          assert.equal(result.alert, expectedAlert);
          assert.equal(result.navPaddingTop, expectedAlert ? 12 : safeTop + 12);
          const consumedInset = result.navPaddingTop - 12 +
            (expectedAlert ? result.alertPaddingTop - 10 : 0);
          assert.equal(consumedInset, safeTop, `${platform}/${status}/${dismissed}/${inset}`);
        }
      }
    }
  }
});

test("loading, normal usage, phone dismissal and payment recovery never lose the inset", () => {
  const sequence = [
    [undefined, true], ["active", true], ["active", false], ["active", true],
    ["grace_period", false], ["past_due", false], ["free", false], ["free", true],
    ["cancelled", true],
  ];
  for (const [status, dismissed] of sequence) {
    const result = getBannerTopLayout(status, dismissed, 62, "ios");
    assert.equal(result.navPaddingTop - 12 + (result.alert ? result.alertPaddingTop - 10 : 0), 62);
  }
});

// Render the real component with platform/hooks mocked, not a copied layout.
function renderBanner({ status, dismissed, inset, platform }) {
  let stateIndex = 0;
  const focusEffects = [];
  const statusBarCalls = [];
  const jsx = (type, props) => ({ type, props });
  const colors = new Proxy({}, { get: (_, key) => key });
  const { HomeBanner } = load("../components/shared/HomeBanner.tsx", name => {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "react") return {
      useState: initial => [stateIndex++ === 1 ? dismissed : initial, () => {}],
      useEffect: () => {},
      useCallback: callback => callback,
      useRef: initial => ({ current: initial }),
    };
    if (name === "react-native") return {
      Platform: { OS: platform },
      StyleSheet: { create: styles => Object.fromEntries(
        Object.entries(styles).map(([key, value]) => [key, { ...value, styleName: key }]),
      ) },
      StatusBar: {
        pushStackEntry: props => { statusBarCalls.push(["push", props.barStyle]); return props; },
        popStackEntry: entry => statusBarCalls.push(["pop", entry.barStyle]),
      },
      View: "View", Text: "Text", Pressable: "Pressable", Modal: "Modal",
      Dimensions: { get: () => ({ width: 390, height: 844 }) },
      Animated: { Value: class { setValue() {} stopAnimation() {} interpolate() { return 0; } }, View: "Animated.View", timing: () => ({ start: () => {} }) },
    };
    if (name === "expo-router") return {
      useRouter: () => ({ push: () => {} }),
      useFocusEffect: callback => focusEffects.push(callback),
    };
    if (name === "react-native-safe-area-context") return { useSafeAreaInsets: () => ({ top: inset }) };
    if (name === "@/context/auth") return { useAuth: () => ({ user: { name: "Student" } }) };
    if (name === "@/constants/colors") return { Colors: colors };
    if (name === "@/constants/storePolicy") return { SHOW_WEB_PAYMENTS: true };
    if (name === "@/services/bannerTopLayout") return layoutModule;
    if (name === "@/services/bannerUsage") return { getBannerUsage: () => ({ percent: 0, countLabel: "0/200 Q" }) };
    if (name === "@/constants/shadow") return { platformShadow: () => ({}) };
    if (name === "expo-linear-gradient") return { LinearGradient: "LinearGradient" };
    if (name === "expo-image") return { Image: "Image" };
    if (name === "@/assets/images/eduwai-logo.png") return "existing-logo";
    if (name === "@/services/api" || name === "@/components/shared/BannerBackground" ||
        name === "@react-native-async-storage/async-storage" || name === "@expo/vector-icons") return {};
    throw new Error(`Unexpected component import: ${name}`);
  });
  const root = HomeBanner({
    usage: status == null ? null : { status, percent_used: 0 },
    usageLoading: status == null,
    isDark: true,
    onUpgrade: () => {}, onLogout: () => {}, onToggleTheme: () => {},
  });
  const nodes = [];
  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    nodes.push(node);
    walk(node.props?.children);
  }
  walk(root);
  const styled = name => nodes.find(node => {
    const styles = Array.isArray(node.props?.style) ? node.props.style : [node.props?.style];
    return styles.some(style => style?.styleName === name);
  });
  return { nodes, styled, focusEffects, statusBarCalls };
}

test("real HomeBanner renders exactly one top-inset owner across all platforms and alert states", () => {
  for (const platform of platforms) {
    for (const inset of insets) {
      for (const status of statuses) {
        for (const dismissed of [false, true]) {
          const rendered = renderBanner({ status, dismissed, inset, platform });
          const navTop = rendered.styled("nav").props.style[1].paddingTop;
          const alerts = ["grace", "pastDue", "phone"].map(rendered.styled).filter(Boolean);
          const hasAlert = ["grace_period", "past_due"].includes(status) || !dismissed;
          assert.equal(alerts.length, hasAlert ? 1 : 0);
          assert.equal(navTop, (hasAlert || platform === "web" ? 0 : inset) + 12);
          if (hasAlert) assert.equal(alerts[0].props.style[1].paddingTop, (platform === "web" ? 0 : inset) + 10);
          assert.ok(rendered.nodes.some(node => node.props?.testID === "student-banner-logo"));
          assert.ok(rendered.nodes.some(node => node.props?.accessibilityLabel === "Log out"));
        }
      }
    }
  }
});

test("native status indicators contrast with the first visible layer and are restored on blur", () => {
  for (const platform of platforms) {
    for (const [status, dismissed, expected] of [
      ["active", true, "light-content"],
      ["free", false, "dark-content"],
      ["grace_period", false, "dark-content"],
      ["past_due", false, "light-content"],
    ]) {
      const rendered = renderBanner({ status, dismissed, inset: 59, platform });
      assert.equal(rendered.statusBarCalls.length, 0, "merely rendering an inactive tab changes nothing");
      const cleanup = rendered.focusEffects[0]();
      if (platform === "web") {
        assert.equal(rendered.statusBarCalls.length, 0);
        assert.equal(cleanup, undefined);
      } else {
        assert.deepEqual(rendered.statusBarCalls, [["push", expected]]);
        cleanup();
        assert.deepEqual(rendered.statusBarCalls, [["push", expected], ["pop", expected]]);
      }
    }
  }
});

test("compact header controls leave space for truncated identity text on narrow phones", () => {
  const { styled } = renderBanner({ status: "active", dismissed: true, inset: 59, platform: "ios" });
  const style = name => styled(name).props.style;
  const nav = style("nav")[0];
  const fixedWidth = style("logoWrap").width + style("divider").width +
    2 * style("divider").marginHorizontal + style("themeBtn").width +
    style("logoutBtn").width + style("actions").gap + 3 * style("navRow").gap;
  for (const width of [320, 375, 390, 428]) {
    const nameSpace = width - 2 * nav.paddingHorizontal - fixedWidth -
      style("avatarWrap").width - style("userBlock").gap;
    assert.ok(nameSpace >= 60, `identity text has ${nameSpace}px at ${width}px width`);
  }
});

test("top control hit areas stay outside system indicators, including phone-dismiss hit slop", () => {
  for (const inset of insets) {
    const main = renderBanner({ status: "active", dismissed: true, inset, platform: "ios" });
    const theme = main.styled("themeBtn");
    const navTop = main.styled("nav").props.style[1].paddingTop;
    const logoHeight = main.styled("logoWrap").props.style.height;
    const topHitArea = navTop + (logoHeight - theme.props.style.height) / 2 - theme.props.hitSlop;
    assert.ok(topHitArea >= inset);

    const phone = renderBanner({ status: "free", dismissed: false, inset, platform: "android" });
    const dismiss = phone.styled("phoneDismiss");
    const phoneTop = phone.styled("phone").props.style[1].paddingTop;
    assert.ok(phoneTop + dismiss.props.style.marginTop - dismiss.props.hitSlop >= inset);
  }
});
