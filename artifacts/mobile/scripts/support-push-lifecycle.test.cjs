// Deterministic app-side lifecycle checks. No live API writes or physical devices.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load() {
  const modules = {};
  for (const name of ["supportNotification", "supportPushManager"]) {
    const exports = {};
    const source = fs.readFileSync(path.join(__dirname, `../services/${name}.ts`), "utf8");
    vm.runInNewContext(ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, {
      exports, AbortController, Date, Promise, Map, Set,
      require: id => modules[id.replace("./", "")] || {},
    });
    modules[name] = exports;
  }
  return modules.supportPushManager.SupportPushManager;
}
const Manager = load();
const payload = id => ({ type: "support_reply", conversation_id: String(id) });
const settle = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
function fixture(options = {}) {
  const storage = new Map();
  const calls = [];
  let callbacks;
  let tokenNumber = 0;
  const control = { permission: true, cleanupFails: false };
  const native = {
    available: () => options.available !== false,
    requestPermission: async () => { calls.push("permission"); return control.permission; },
    hasPermission: async () => control.permission,
    getToken: async () => {
      calls.push("get-token");
      return options.getToken ? options.getToken() : `fixture-fcm-${++tokenNumber}`;
    },
    invalidateToken: async () => {
      calls.push("invalidate");
      if (control.cleanupFails) throw new Error("Fixture offline");
    },
    notify: async data => { calls.push({ notify: data }); },
    clearBadge: async () => { calls.push("clear-badge"); },
    openSettings: async () => {},
    listen: async cb => {
      callbacks = cb;
      calls.push("listen");
      if (options.coldTap) cb.tap({ data: payload(12), id: "fixture-cold" });
      return () => { calls.push("detach"); };
    },
  };
  const deps = {
    enabled: options.enabled !== false, native,
    storage: { getItem: async k => storage.get(k) ?? null, setItem: async (k, v) => { storage.set(k, v); } },
    storageKey: "fixture-device", ownerKey: id => `fixture-api.${id}`,
    loadPointer: async identity => options.loadPointer ? options.loadPointer(identity)
      : identity === "guest" ? { conversationId: 12, anonymousToken: "fixture-guest" }
        : { conversationId: identity === "user.A" ? 12 : 13 },
    platform: "android",
    register: async (owner, pointer, token, platform, signal) => {
      calls.push({ register: pointer.conversationId, kind: owner.kind, token, platform, aborted: signal.aborted });
      if (options.register) await options.register(signal);
    },
    authorize: async (data, owner, pointer, signal) => {
      calls.push({ authorize: data.conversation_id, kind: owner.kind });
      if (options.authorize) return options.authorize(signal);
      return { kind: pointer?.conversationId === Number(data.conversation_id) ? "authorized" : "recovery" };
    },
  };
  return {
    manager: new Manager(deps), deps, storage, calls, control,
    callbacks: () => callbacks,
    record: () => JSON.parse(storage.get("fixture-device") || "null"),
  };
}
const account = { kind: "authenticated", getToken: () => "fixture-access" };
const guest = { kind: "guest" };

test("release gate off never asks permission, imports native listeners, gets tokens or registers", async () => {
  const f = fixture({ enabled: false });
  await f.manager.setIdentity("guest", guest);
  await f.manager.enable();
  assert.equal(f.manager.getSnapshot().status, "unavailable");
  assert.deepEqual(f.calls, []);
});
test("web/Expo Go unavailable adapter keeps foreground support independent", async () => {
  const f = fixture({ available: false });
  await f.manager.setIdentity("guest", guest);
  await f.manager.enable();
  assert.equal(f.manager.getSnapshot().status, "unavailable");
  assert.equal(f.calls.length, 0);
});
test("no token before opt-in; guest registration uses saved conversation and a native token", async () => {
  const f = fixture();
  await f.manager.setIdentity("guest", guest);
  assert.deepEqual(f.calls, ["listen"]);
  await f.manager.enable();
  assert.equal(f.manager.getSnapshot().status, "enabled");
  assert.equal(f.record().ownerKey, "fixture-api.guest");
  assert.equal(f.record().pendingInvalidation, false);
  assert.equal(f.calls.find(c => c.register)?.kind, "guest");
  assert.equal(f.calls.find(c => c.register)?.register, 12);
});
test("permission denial never creates/registers a token or blocks foreground chat", async () => {
  const f = fixture();
  f.control.permission = false;
  await f.manager.setIdentity("guest", guest);
  await f.manager.enable();
  assert.equal(f.manager.getSnapshot().status, "off");
  assert.ok(!f.calls.includes("get-token"));
  assert.ok(!f.calls.some(c => c.register));
});
test("a conversation must exist before permission or token acquisition", async () => {
  const f = fixture({ loadPointer: async () => null });
  await f.manager.setIdentity("user.A", account);
  await f.manager.enable();
  assert.equal(f.manager.getSnapshot().status, "off");
  assert.ok(!f.calls.includes("permission"));
  assert.ok(!f.calls.some(c => c.register));
});
test("logout during token acquisition cancels old registration and invalidates before new identity opt-in", async () => {
  const acquired = deferred();
  const started = deferred();
  let count = 0;
  const f = fixture({ getToken: async () => {
    if (++count === 1) { started.resolve(); return acquired.promise; }
    return "fixture-new-fcm";
  } });
  await f.manager.setIdentity("user.A", account);
  const enabling = f.manager.enable();
  await started.promise;
  const oldCallbacks = f.callbacks();
  f.manager.suspendIdentity();
  const switchIdentity = f.manager.setIdentity("user.B", account);
  acquired.resolve("fixture-retired-fcm");
  await enabling;
  await switchIdentity;
  assert.ok(!f.calls.some(c => c.register === 12));
  assert.equal(f.manager.getSnapshot().optedIn, false);
  oldCallbacks.tap({ data: payload(12), id: "old-listener" });
  await settle();
  assert.ok(!f.calls.some(c => c.authorize));
  await f.manager.enable();
  const registrationIndex = f.calls.findIndex(c => c.register === 13);
  assert.ok(f.calls.indexOf("invalidate") < registrationIndex);
  assert.equal(f.record().retiredToken, "fixture-retired-fcm");
  assert.equal(f.record().ownerKey, "fixture-api.user.B");
});
test("offline cleanup persists its marker and blocks new identity registration until retry succeeds", async () => {
  const f = fixture();
  await f.manager.setIdentity("user.A", account);
  await f.manager.enable();
  f.control.cleanupFails = true;
  f.manager.suspendIdentity();
  await f.manager.setIdentity("user.B", account);
  await f.manager.enable();
  assert.equal(f.manager.getSnapshot().status, "blocked");
  assert.equal(f.record().pendingInvalidation, true);
  assert.ok(!f.calls.some(c => c.register === 13));
  f.control.cleanupFails = false;
  await f.manager.recover();
  await f.manager.enable();
  assert.equal(f.manager.getSnapshot().status, "enabled");
  assert.equal(f.calls.filter(c => c.register === 13).length, 1);
});
test("SDK token refresh registers only the current opted-in conversation", async () => {
  const f = fixture();
  await f.manager.setIdentity("guest", guest);
  f.callbacks().token();
  await settle();
  assert.ok(!f.calls.includes("get-token"));
  await f.manager.enable();
  f.callbacks().token();
  await settle();
  const registered = f.calls.filter(c => c.register);
  assert.equal(registered.length, 2);
  assert.equal(registered[1].register, 12);
  assert.notEqual(registered[0].token, registered[1].token);
});
test("open-thread foreground replies refresh without duplicates; closed-chat alerts use generic text only", async () => {
  const f = fixture();
  await f.manager.setIdentity("guest", guest);
  await f.manager.enable();
  f.manager.setChatVisible("guest", true);
  f.callbacks().message({ data: { ...payload(12), body: "Untrusted private preview" } });
  await settle();
  assert.equal(f.manager.getSnapshot().replyVersion, 1);
  assert.ok(!f.calls.some(c => c.notify));
  f.manager.setChatVisible("guest", false);
  f.callbacks().message({ data: { ...payload(12), body: "Untrusted private preview" } });
  await settle();
  assert.equal(f.calls.filter(c => c.notify).length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(c => c.notify).notify)), payload(12));
  f.callbacks().message({ data: payload(99) });
  await settle();
  assert.equal(f.calls.filter(c => c.notify).length, 1);
});
test("cold tap waits for identity/storage restoration and opens only after authorization", async () => {
  const restored = deferred();
  const f = fixture({ coldTap: true, loadPointer: () => restored.promise });
  const starting = f.manager.setIdentity("guest", guest);
  await settle();
  assert.equal(f.manager.getSnapshot().openVersion, 0);
  assert.ok(!f.calls.some(c => c.authorize));
  restored.resolve({ conversationId: 12, anonymousToken: "fixture-guest" });
  await starting;
  await settle();
  assert.equal(f.manager.getSnapshot().openVersion, 1);
  assert.equal(f.calls.filter(c => c.authorize).length, 1);
  assert.ok(!f.calls.includes("get-token"));
});
test("stale authorization cannot open a thread after account switch", async () => {
  const authorized = deferred();
  const started = deferred();
  const f = fixture({ authorize: async () => { started.resolve(); return authorized.promise; } });
  await f.manager.setIdentity("user.A", account);
  f.callbacks().tap({ data: payload(12), id: "fixture-tap" });
  await started.promise;
  f.manager.suspendIdentity();
  const next = f.manager.setIdentity("user.B", account);
  authorized.resolve({ kind: "authorized" });
  await next;
  assert.equal(f.manager.getSnapshot().openVersion, 0);
  assert.equal(f.manager.getSnapshot().notice, null);
});
test("malformed taps are ignored; missing/discarded threads produce recovery without token/ticket creation", async () => {
  const f = fixture();
  await f.manager.setIdentity("guest", guest);
  f.callbacks().tap({ data: { type: "other", conversation_id: "12" } });
  await settle();
  assert.equal(f.manager.getSnapshot().openVersion, 0);
  f.callbacks().tap({ data: payload(99), id: "discarded" });
  await settle();
  assert.equal(f.manager.getSnapshot().openVersion, 1);
  assert.ok(f.manager.getSnapshot().notice.includes("No new ticket"));
  assert.ok(!f.calls.some(c => c.register));
});
test("New invalidates the old binding and requires opt-in for the new conversation", async () => {
  const f = fixture();
  await f.manager.setIdentity("guest", guest);
  await f.manager.enable();
  f.manager.setConversation("guest", null);
  await settle();
  assert.equal(f.record().optIn, false);
  assert.ok(f.calls.includes("invalidate"));
  f.manager.setConversation("guest", { conversationId: 15, anonymousToken: "fixture-new-guest" });
  await settle();
  assert.equal(f.manager.getSnapshot().optedIn, false);
  await f.manager.enable();
  assert.equal(f.calls.filter(c => c.register).at(-1).register, 15);
});
test("permission revoked in Settings invalidates the token on resume", async () => {
  const f = fixture();
  await f.manager.setIdentity("guest", guest);
  await f.manager.enable();
  f.control.permission = false;
  f.callbacks().resume();
  await settle();
  assert.equal(f.record().optIn, false);
  assert.ok(f.calls.includes("invalidate"));
  assert.equal(f.manager.getSnapshot().status, "off");
});
test("SDK reuse of a retired token is blocked before backend registration", async () => {
  const f = fixture({ getToken: async () => "fixture-fixed-token" });
  await f.manager.setIdentity("user.A", account);
  await f.manager.enable();
  f.manager.suspendIdentity();
  await f.manager.setIdentity("user.B", account);
  await f.manager.enable();
  assert.equal(f.manager.getSnapshot().status, "blocked");
  assert.equal(f.record().pendingInvalidation, true);
  assert.ok(!f.calls.some(c => c.register === 13));
});

test("New invalidates already-authorized navigation before a React effect can open the wrong thread", async () => {
  const f = fixture();
  await f.manager.setIdentity("guest", guest);
  f.callbacks().tap({ data: payload(12), id: "fixture-authorized" });
  await settle();
  const version = f.manager.getSnapshot().openVersion;
  assert.equal(f.manager.canOpen("guest", version), true);
  f.manager.setConversation("guest", null);
  assert.equal(f.manager.canOpen("guest", version), false);
  await settle();
});

test("native adapter attempts tray/badge cleanup even if token invalidation fails offline", async () => {
  const calls = [];
  const source = fs.readFileSync(path.join(__dirname, "../services/nativeSupportPush.ts"), "utf8");
  const exports = {};
  const messaging = {
    getMessaging: () => ({}),
    setAutoInitEnabled: async (_, enabled) => { calls.push(`auto:${enabled}`); },
    deleteToken: async () => { calls.push("delete"); throw new Error("Fixture offline"); },
    unregisterDeviceForRemoteMessages: async () => { calls.push("unregister"); },
  };
  const notifications = {
    dismissAllNotificationsAsync: async () => { calls.push("tray"); },
    setBadgeCountAsync: async count => { calls.push(`badge:${count}`); },
  };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, process: { env: {} },
    require: name => ({
      "expo-constants": { default: { executionEnvironment: "standalone" } },
      "expo-device": { isDevice: true },
      "react-native": { Platform: { OS: "ios" }, TurboModuleRegistry: { get: () => ({}) } },
      "@react-native-firebase/messaging": messaging,
      "expo-notifications": notifications,
    })[name],
  });
  await assert.rejects(exports.nativeSupportPush.invalidateToken(), /cleanup could not be completed/);
  assert.deepEqual(calls, ["auto:false", "delete", "unregister", "tray", "badge:0"]);
});
