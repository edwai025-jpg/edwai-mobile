const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, scope = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: false },
  }).outputText;
  vm.runInNewContext(code, { exports, process: { env: {} }, Error, URL, AbortController, setTimeout, clearTimeout, ...scope });
  return exports;
}
const validation = load("../services/onboarding.ts");

test("name validation matches normalized Unicode name contract", () => {
  for (const name of ["Ada Lovelace", " O'Connor  ", "Anne-Marie", "José", "张 三", " María   García "]) {
    assert.equal(validation.validateName(name), "", name);
  }
  for (const name of ["", "A", "x".repeat(101), "Ada123", "----", "''''", "Ada 😀"]) {
    assert.notEqual(validation.validateName(name), "", name);
  }
});
test("phone paste strips exactly one complete Indian prefix and never truncates an invalid number", () => {
  for (const raw of ["+91 98765 43210", "919876543210", "(98765) 43210"]) {
    assert.equal(validation.normalizePhoneInput(raw), "9876543210");
  }
  for (const raw of ["+61 98765432", "+1 9876543210", "+91919876543210", "987654321099"]) {
    const result = validation.normalizePhoneInput(raw);
    assert.notEqual(validation.validatePhone(result), "", raw);
  }
  assert.equal(validation.validatePhone(""), "");
  assert.equal(validation.validatePhone("9876543210"), "");
  assert.notEqual(validation.validatePhone("1234567890"), "");
  assert.notEqual(validation.validatePhone("987"), "");
});
test("legal URLs use the approved frontend host rather than API or development paths", () => {
  assert.equal(validation.legalUrls.terms, "https://eduwai.in/terms");
  assert.equal(validation.legalUrls.privacy, "https://eduwai.in/privacy-policy");
  const bad = load("../services/onboarding.ts", { process: { env: { EXPO_PUBLIC_EDUWAI_WEB_ORIGIN: "javascript:bad" } } });
  assert.equal(bad.legalUrls.home, "https://eduwai.in");
});

function client(fetch) {
  return load("../services/api.ts", {
    require: () => ({ Platform: { OS: "ios" } }),
    FormData, Blob, fetch,
  }).default;
}
test("completion API sends only selected fields, correct requests and authenticated profile OTP", async () => {
  const calls = [];
  const api = client(async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ success: true, id: 17, user: { phone_verified: true } }));
  });
  await api.auth.saveProfile("fixture-token", { full_name: "Ada Lovelace" });
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { full_name: "Ada Lovelace" });
  await api.auth.saveProfile("fixture-token", { terms_accepted: true });
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { terms_accepted: true });
  await api.onboarding.requestCurriculum("fixture-token", {
    state_id: 1, board_id: 2, board_name: "Example Board", class_name_requested: "Class Ten",
  });
  assert.ok(calls.at(-1).url.endsWith("/api/class-requests"));
  assert.equal(calls.at(-1).options.method, "POST");
  assert.equal(calls.at(-1).options.headers.Authorization, "Bearer fixture-token");
  const response = await api.auth.verifyPhoneForProfile("fixture-token", "+919876543210", "123456");
  assert.ok(calls.at(-1).url.endsWith("/auth/phone/verify-for-profile"));
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { phone: "+919876543210", otp: "123456" });
  assert.equal(response.user.phone_verified, true);
});
test("structured schema errors produce a readable message", async () => {
  const api = client(async () => new Response(JSON.stringify({ detail: [{ loc: ["body", "full_name"], msg: "Name is required" }] }), { status: 422 }));
  await assert.rejects(api.auth.saveProfile("fixture-token", {}), /Name is required/);
});
test("native public API base supports an origin or /api base without duplicate prefixes", () => {
  for (const base of ["https://api.eduwai.in", "https://api.eduwai.in/api/"]) {
    const module = load("../services/api.ts", {
      require: () => ({ Platform: { OS: "ios" } }),
      process: { env: { EXPO_PUBLIC_EDUWAI_API_BASE_URL: base } },
    });
    assert.equal(module.resolveUrl("/api/states"), "https://api.eduwai.in/api/states");
  }
});

/** Tiny hook runner exercises the actual provider, no React DOM/native renderer. */
function authHarness(overrides = {}, seed = {}) {
  const values = new Map(Object.entries(seed));
  const state = [], refs = [], effects = [];
  let cursor = 0;
  const react = {
    createContext: () => ({ Provider: "Provider" }),
    useState: initial => {
      const i = cursor++;
      if (!(i in state)) state[i] = typeof initial === "function" ? initial() : initial;
      return [state[i], v => { state[i] = typeof v === "function" ? v(state[i]) : v; }];
    },
    useRef: initial => {
      const i = cursor++;
      return refs[i] ??= { current: initial };
    },
    useCallback: fn => fn,
    useEffect: fn => { effects.push(fn); },
  };
  const storage = {
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async key => { values.delete(key); },
    multiRemove: async keys => { keys.forEach(key => values.delete(key)); },
  };
  class ApiError extends Error {
    constructor(message, statusCode) { super(message); this.statusCode = statusCode; }
  }
  const user = { id: 77, full_name: "Ada Lovelace", profile_complete: false, phone_verified: false, role: "student" };
  const api = {
    auth: {
      getMe: async () => user,
      saveProfile: async () => ({ success: true, profile_complete: false, user }),
      refreshToken: async () => ({ access_token: "refreshed-fixture-token", user }),
      logout: async () => {},
      ...overrides,
    },
    onboarding: { requestCurriculum: async () => ({ success: true, id: 5 }) },
    profile: { probePhoto: async () => false },
  };
  const queryClient = { clear() {}, cancelQueries: async () => {}, invalidateQueries: async () => {} };
  const modules = {
    react,
    "react/jsx-runtime": { jsx: (_type, props) => ({ props }) },
    "@react-native-async-storage/async-storage": { default: storage },
    "@/services/api": { default: api, ApiError },
    "@/services/credentialStorage": { credentialStorage: storage },
    "@/services/supportPush": { supportPush: { suspendIdentity() {} } },
    "@/services/supportSession": { supportStorageKey: identity => identity },
    "@tanstack/react-query": { useQueryClient: () => queryClient },
  };
  const mod = load("../context/auth.tsx", { require: name => {
    if (!modules[name]) throw new Error(`Unexpected dependency: ${name}`);
    return modules[name];
  } });
  function render() { cursor = 0; return mod.AuthProvider({ children: null }).props.value; }
  render();
  return { render, effects, values, api, user, ApiError };
}
const seeded = {
  edwai_access_token: "fixture-token",
  edwai_refresh_token: "fixture-refresh",
  edwai_user_v2: JSON.stringify({ id: 77, name: "Ada", profileComplete: false }),
  edwai_profile_complete: "true", // deliberately stale separate cache
};

test("Own Resources honors false server completion and grants only nonpersisted session access", async () => {
  let payload;
  const h = authHarness({ saveProfile: async (_token, data) => {
    payload = data;
    return { success: true, profile_complete: false, user: { id: 77, full_name: "Ada", profile_complete: false } };
  } }, seeded);
  await h.render().completeProfile({ name: "Ada" }, { allowOwnResources: true });
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), { full_name: "Ada" });
  assert.equal(h.render().isProfileComplete, false);
  assert.equal(h.render().canUseOwnResources, true);
  assert.equal(h.values.get("edwai_profile_complete"), "false");
  assert.equal([...h.values.keys()].some(key => /ownresources/i.test(key)), false);
  await h.render().logout({ localOnly: true });
  assert.equal(h.render().canUseOwnResources, false);
  assert.equal(h.values.has("edwai_access_token"), false);
});
test("profile OTP updates authoritative user without issuing a sign-in or replacing credentials", async () => {
  let received;
  const h = authHarness({ verifyPhoneForProfile: async (token, phone, otp) => {
    received = { token, phone, otp };
    return { success: true, user: { id: 77, full_name: "Ada", phone, phone_verified: true, profile_complete: false } };
  } }, seeded);
  await h.render().verifyProfilePhone("+919876543210", "123456");
  assert.equal(received.phone, "+919876543210");
  assert.equal(h.render().user.phoneVerified, true);
  assert.equal(h.render().isProfileComplete, false);
  assert.equal(h.values.get("edwai_access_token"), "fixture-token");
  assert.equal(h.values.get("edwai_refresh_token"), "fixture-refresh");
});
test("institute acceptance uses terms-only PATCH and requires confirmed timestamp", async () => {
  let payload;
  const h = authHarness({ saveProfile: async (_token, data) => {
    payload = data;
    return { success: true, profile_complete: true, user: { id: 77, full_name: "Ada", is_pre_registered: true, terms_accepted_at: "2026-10-09T12:00:00Z", profile_complete: true } };
  } }, seeded);
  await h.render().acceptOrgTerms();
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), { terms_accepted: true });
  assert.equal(h.render().isProfileComplete, true);
  assert.equal(h.render().user.isPreRegistered, true);
  const bad = authHarness({}, seeded);
  await assert.rejects(bad.render().acceptOrgTerms(), /could not be confirmed/);
});
test("401 refresh is shared across concurrent completion writes and replayed only once", async () => {
  let refreshes = 0;
  const h = authHarness({}, seeded);
  h.api.auth.refreshToken = async () => {
    refreshes++;
    await new Promise(resolve => setTimeout(resolve, 5));
    return { access_token: "refreshed-fixture-token" };
  };
  h.api.auth.saveProfile = async token => {
    if (token !== "refreshed-fixture-token") throw new h.ApiError("Expired", 401);
    return { success: true, profile_complete: false, user: h.user };
  };
  await Promise.all([h.render().completeProfile({ name: "Ada" }), h.render().completeProfile({ name: "Ada" })]);
  assert.equal(refreshes, 1);
});
test("session restoration reconciles institute flags and ignores stale completion cache", async () => {
  const h = authHarness({ getMe: async () => ({
    id: 77, full_name: "Ada", profile_complete: false, is_pre_registered: true, terms_accepted_at: null,
  }) }, seeded);
  h.effects[0]();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(h.render().isRestored, true);
  assert.equal(h.render().isProfileComplete, false);
  assert.equal(h.render().user.isPreRegistered, true);
});
test("route guard permits session-only own books but institute acceptance always takes priority", () => {
  const { getAuthRedirect } = load("../services/authRouting.ts");
  const state = { isRestored: true, isLoggedIn: true, isProfileComplete: false };
  assert.equal(getAuthRedirect(state, ["(tabs)", "my-docs"]), "/complete-profile");
  assert.equal(getAuthRedirect({ ...state, canUseOwnResources: true }, ["(tabs)", "my-docs"]), null);
  assert.equal(getAuthRedirect({ ...state, canUseOwnResources: true, requiresOrgTerms: true }, ["(tabs)"]), "/complete-profile");
  assert.equal(getAuthRedirect({ ...state, isLoggedIn: false, canUseOwnResources: true }, ["(tabs)"]), "/login");
});
test("expired restored sessions with no refresh credential exit rather than retaining invalid cached auth", async () => {
  const { edwai_refresh_token: _unused, ...noRefresh } = seeded;
  const h = authHarness({}, noRefresh);
  h.api.auth.getMe = async () => { throw new h.ApiError("Expired", 401); };
  h.effects[0]();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(h.render().isRestored, true);
  assert.equal(h.render().isLoggedIn, false);
  assert.equal(h.values.has("edwai_access_token"), false);
});
test("late profile responses after logout cannot restore the previous user", async () => {
  const h = authHarness({}, seeded);
  let finish;
  h.api.auth.saveProfile = () => new Promise(resolve => { finish = resolve; });
  const pending = h.render().completeProfile({ name: "Ada" });
  await new Promise(resolve => setTimeout(resolve, 1));
  await h.render().logout({ localOnly: true });
  finish({ success: true, profile_complete: true, user: { ...h.user, profile_complete: true } });
  await assert.rejects(pending, /Session changed/);
  assert.equal(h.render().user, null);
  assert.equal(h.values.has("edwai_user_v2"), false);
});
