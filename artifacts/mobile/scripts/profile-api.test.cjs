const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, scope = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
    fileName: path.join(__dirname, file),
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, FormData, Blob, ...scope });
  return exports;
}

function photoModule(os = "web", scope = {}) {
  return load("../services/profilePhotoUpload.ts", {
    require: () => ({ Platform: { OS: os } }), ...scope,
  });
}

function client(fetch) {
  return load("../services/api.ts", {
    process: { env: { EXPO_PUBLIC_DOMAIN: "fixture.replit.dev" } },
    require: name => name === "./profilePhotoUpload"
      ? photoModule() : { Platform: { OS: "web" } },
    fetch,
  }).default;
}

test("verified Profile write routes use their documented methods and canonical user refresh", async () => {
  const calls = [];
  const api = client(async (url, options) => {
    calls.push({ url, options });
    // Account write deliberately has no user envelope.
    return new Response(JSON.stringify(url.endsWith("/auth/me")
      ? { id: 42, full_name: "Saved name" } : { success: true, autopay_enabled: false }));
  });
  const updated = await api.profile.updateAccount("fixture-token", { full_name: "Saved name", email: "test@example.invalid" });
  assert.equal(updated.user.full_name, "Saved name");
  assert.equal(calls[0].options.method, "PUT");
  assert.ok(calls[0].url.endsWith("/student/profile/account"));
  assert.equal(JSON.parse(calls[0].options.body).full_name, "Saved name");
  assert.ok(calls[1].url.endsWith("/auth/me"));
  await api.profile.saveEducation("fixture-token", { board_id: 3, class_id: null, medium_id: null });
  assert.equal(calls.at(-1).options.method, "PUT");
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { board_id: 3, class_id: null, medium_id: null });
  await api.profile.sendPhoneOtp("fixture-token", "+911234567890");
  assert.ok(calls.at(-1).url.endsWith("/auth/phone/send-otp"));
  await api.profile.verifyPhoneOtp("fixture-token", "+911234567890", "123456");
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { phone: "+911234567890", otp: "123456" });
  await api.profile.toggleAutopay("fixture-token");
  assert.ok(calls.at(-1).url.endsWith("/billing/autopay"));
  assert.equal(calls.at(-1).options.method, "PATCH");
  assert.equal(calls.at(-1).options.body, undefined);
  await api.profile.logoutAll("fixture-token");
  assert.ok(calls.at(-1).url.endsWith("/auth/logout-all"));
  assert.equal(calls.at(-1).options.method, "POST");
  assert.equal(calls.at(-1).options.body, undefined);
  await api.profile.deleteAccount("fixture-token");
  assert.ok(calls.at(-1).url.endsWith("/student/profile"));
  assert.equal(calls.at(-1).options.method, "DELETE");
  assert.ok(calls.every(({ options }) => options.headers.Authorization === "Bearer fixture-token"));
});

test("web photo uploads send a real file with no manually-set content type", async () => {
  let options;
  const api = client(async (_url, opts) => {
    options = opts;
    return new Response(JSON.stringify({ success: true, profile_photo_url: "profiles/42/avatar.jpg" }));
  });
  const photo = new Blob(["image"], { type: "image/png" });
  await api.profile.uploadPhoto("fixture-token", { uri: "blob:fixture", file: photo, fileName: "photo.png" });
  assert.equal(options.headers["Content-Type"], undefined);
  assert.equal(options.body.get("file").type, "image/png");
  assert.equal(options.body.get("file").size, 5);
});

test("photo validation rejects unsupported formats, oversized files and unknown native sizes", async () => {
  const web = photoModule().prepareProfilePhotoUpload;
  await assert.rejects(web({ file: new Blob(["x"], { type: "image/gif" }) }), /JPEG, PNG or WebP/);
  await assert.rejects(web({ file: new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/jpeg" }) }), /5 MiB/);
  const native = photoModule("ios").prepareProfilePhotoUpload;
  await assert.rejects(native({ uri: "file:///photo.png", mimeType: "image/png" }), /determine the photo size/);
});

test("native photo metadata keeps the real format and validates the size", async () => {
  let part;
  class NativeFormData { append(name, value) { assert.equal(name, "file"); part = value; } }
  await photoModule("ios", { FormData: NativeFormData }).prepareProfilePhotoUpload({
    uri: "file:///photo.webp", mimeType: "image/webp", fileName: "photo.webp", fileSize: 1024,
  });
  assert.equal(part.type, "image/webp");
  assert.equal(part.uri, "file:///photo.webp");
});

test("photo probe distinguishes no photo from an auth or network failure", async () => {
  assert.equal(await client(async () => new Response("", { status: 404 })).profile.probePhoto("fixture-token"), false);
  await assert.rejects(client(async () => new Response("", { status: 401 })).profile.probePhoto("fixture-token"), /401/);
});

test("preview proxy preserves multipart bytes, boundaries and dropdown query parameters", async () => {
  let handler;
  let forwarded;
  const bytes = Buffer.from("multipart fixture");
  load("../../api-server/src/routes/proxy.ts", {
    Buffer,
    require: () => ({ default: { raw: () => () => {} }, Router: () => ({ all: (_path, ...fns) => { handler = fns.at(-1); } }) }),
    fetch: async (url, options) => {
      forwarded = { url, options };
      return new Response("{}", { headers: { "content-type": "application/json" } });
    },
  });
  const response = { status() {}, set() {}, send() {} };
  await handler({
    originalUrl: "/api/edwai/student/profile/photo",
    params: { 0: "student/profile/photo" }, method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=fixture", authorization: "Bearer fixture-token" },
    body: bytes,
  }, response);
  assert.equal(forwarded.options.body, bytes);
  assert.equal(forwarded.options.headers["content-type"], "multipart/form-data; boundary=fixture");
  await handler({
    originalUrl: "/api/edwai/mediums?class_id=7&board_id=3",
    params: { 0: "mediums" }, method: "GET", headers: {},
  }, response);
  assert.ok(forwarded.url.endsWith("/api/mediums?class_id=7&board_id=3"));
});

test("institution-managed education locks by org role even without an org ID", () => {
  const { isEducationManaged } = load("../services/profileContracts.ts");
  assert.equal(isEducationManaged({ orgRole: "student" }), true);
  assert.equal(isEducationManaged({ orgRole: "student", orgId: null }), true);
  assert.equal(isEducationManaged({ role: "student" }), false);
  assert.equal(isEducationManaged({ orgRole: "teacher", orgId: 123 }), false);
  assert.equal(isEducationManaged(null), false);
});

test("canonical auth mapping preserves institution context and the actual medium_name field", () => {
  const noop = () => null;
  const { apiUserToProfile } = load("../context/auth.tsx", {
    require: name => name === "react"
      ? { createContext: noop } : {},
  });
  const profile = apiUserToProfile({
    id: 42, full_name: "Fixture", org_role: "student", org_id: 123,
    org_name: "Example Institute", class_name: "Example Class", medium_name: "English",
  });
  assert.equal(profile.orgRole, "student");
  assert.equal(profile.orgId, 123);
  assert.equal(profile.orgName, "Example Institute");
  assert.equal(profile.className, "Example Class");
  assert.equal(profile.medium, "English");
});

test("timezone-less session timestamps are UTC and explicit timezones are preserved", () => {
  const { sessionDate, sessionLastUsed } = load("../services/profileContracts.ts");
  assert.equal(sessionDate("2026-10-07T10:15:00").toISOString(), "2026-10-07T10:15:00.000Z");
  assert.equal(sessionDate("2026-10-07T10:15:00Z").toISOString(), "2026-10-07T10:15:00.000Z");
  assert.equal(sessionDate("2026-10-07T15:45:00+05:30").toISOString(), "2026-10-07T10:15:00.000Z");
  assert.equal(sessionDate(null), null);
  assert.equal(sessionDate("invalid"), null);
  assert.equal(sessionLastUsed(null), "Last used: Unknown");
  assert.equal(sessionLastUsed("2026-10-07T10:15:00", Date.parse("2026-10-07T10:45:00Z")), "Last used: 30 minutes ago");
});

test("session list uses the supplied top-level array and never invents a current session", async () => {
  const rows = [{
    id: 101, device_hint: "Mozilla/5.0 (Linux; Android 14) Chrome/130.0",
    auth_method: "Google", ip_address: null, created_at: null,
    last_used_at: "2026-10-07T10:15:00", is_current: false,
  }];
  const api = client(async () => new Response(JSON.stringify(rows)));
  const response = await api.profile.getSessions("fixture-token");
  assert.equal(response[0].id, 101);
  assert.equal(response[0].is_current, false);
  const { sessionDevice, currentSessionsFirst } = load("../services/profileContracts.ts");
  assert.equal(sessionDevice(response[0].device_hint).label, "Chrome · Android");
  assert.equal(sessionDevice(response[0].device_hint).mobile, true);
  assert.ok(currentSessionsFirst(response).every((row) => row.is_current === false));
  assert.equal(currentSessionsFirst([...response, { ...rows[0], id: 102, is_current: true }])[0].id, 102);
  await assert.rejects(client(async () => new Response(JSON.stringify({ sessions: rows }))).profile.getSessions("fixture-token"), /could not be read/);
  assert.equal((await client(async () => new Response("[]")).profile.getSessions("fixture-token")).length, 0);
});

test("session revocation uses its integer ID and documented success response", async () => {
  let call;
  const api = client(async (url, options) => {
    call = { url, options };
    return new Response(JSON.stringify({ success: true }));
  });
  assert.equal((await api.profile.deleteSession("fixture-token", 101)).success, true);
  assert.ok(call.url.endsWith("/auth/sessions/101"));
  assert.equal(call.options.method, "DELETE");
  await assert.rejects(client(async () => new Response(JSON.stringify({ detail: "Not found" }), { status: 404 })).profile.deleteSession("fixture-token", 101), /Not found/);
});

test("a successful HTML response from a misrouted API is rejected instead of saved as user data", async () => {
  await assert.rejects(client(async () => new Response("<html>App fallback</html>")).auth.getMe("fixture-token"), /unexpected response/);
});

test("logout redirects to the distinct login route rather than the colliding root tab", () => {
  const { getAuthRedirect } = load("../services/authRouting.ts");
  const loggedOut = { isRestored: true, isLoggedIn: false, isProfileComplete: false };
  assert.equal(getAuthRedirect(loggedOut, ["(tabs)", "index"]), "/login");
  assert.equal(getAuthRedirect(loggedOut, ["(tabs)", "profile"]), "/login");
  assert.equal(getAuthRedirect(loggedOut, ["complete-profile"]), "/login");
  assert.equal(getAuthRedirect(loggedOut, ["login"]), null);
  assert.equal(getAuthRedirect(loggedOut, ["otp"]), null);
  assert.equal(getAuthRedirect({ ...loggedOut, isRestored: false }, ["(tabs)"]), null);
  const loggedIn = { ...loggedOut, isLoggedIn: true, isProfileComplete: true };
  assert.equal(getAuthRedirect(loggedIn, ["login"]), "/(tabs)");
  assert.equal(getAuthRedirect(loggedIn, ["(tabs)", "profile"]), null);
  assert.equal(getAuthRedirect({ ...loggedIn, isProfileComplete: false }, ["(tabs)"]), "/complete-profile");
});
