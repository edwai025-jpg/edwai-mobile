// Contract/preparation checks only. These do not prove native push delivery.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(fetch) {
  const api = {};
  function execute(name, exports) {
    const source = fs.readFileSync(path.join(__dirname, "../services", name), "utf8");
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, {
      exports, fetch, process: { env: {} }, AbortController, URLSearchParams,
      setTimeout, clearTimeout,
      require: (module) => {
        assert.equal(module, "./supportApi");
        return api;
      },
    });
  }
  execute("supportApi.ts", api);
  const notifications = {};
  execute("supportNotification.ts", notifications);
  return { ...api, ...notifications };
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const guest = { kind: "guest" };
const pointer = { conversationId: 12, anonymousToken: "fixture-guest" };
const account = { kind: "authenticated", getToken: () => "fixture-access" };
const payload = { type: "support_reply", conversation_id: "12" };

test("guest registration binds its saved thread with anonymous_token, never a JWT", async () => {
  const calls = [];
  const { supportApi } = load(async (url, options) => {
    calls.push({ url, options });
    return json({ success: true });
  });
  await supportApi.registerFcmToken(guest, pointer, "fixture-native-fcm", "android");
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith("/support/fcm-token"));
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    fcm_token: "fixture-native-fcm", platform: "android",
    conversation_id: 12, anonymous_token: "fixture-guest",
  });
});

test("account registration uses the authenticated route and strips guest fields", async () => {
  const { supportApi } = load(async (url, options) => {
    assert.ok(url.endsWith("/support/fcm-token/auth"));
    assert.equal(options.headers.Authorization, "Bearer fixture-access");
    assert.deepEqual(JSON.parse(options.body), {
      fcm_token: "fixture-native-fcm", platform: "ios", conversation_id: 12,
    });
    return json({ success: true });
  });
  await supportApi.registerFcmToken(account, { conversationId: 12 }, "fixture-native-fcm", "ios");
});

test("wrong token types, platforms, and owner credentials never reach the API", async () => {
  let calls = 0;
  const { supportApi } = load(async () => { calls++; return json({ success: true }); });
  for (const token of ["ExponentPushToken[fixture]", "ExpoPushToken[fixture]", "", " bad-token"]) {
    await assert.rejects(supportApi.registerFcmToken(guest, pointer, token, "android"));
  }
  await assert.rejects(supportApi.registerFcmToken(guest, pointer, "fixture-native-fcm", "web"));
  await assert.rejects(supportApi.registerFcmToken(guest, { conversationId: 12 }, "fixture-native-fcm", "android"));
  await assert.rejects(supportApi.registerFcmToken(account, pointer, "fixture-native-fcm", "ios"));
  await assert.rejects(supportApi.registerFcmToken(guest, { ...pointer, conversationId: -1 }, "fixture-native-fcm", "android"));
  assert.equal(calls, 0);
});

test("registration failures are explicit and do not claim a chat message was saved", async () => {
  for (const result of [json({ success: false }), json({ detail: "Not authorized" }, 403)]) {
    const { supportApi } = load(async () => result);
    await assert.rejects(supportApi.registerFcmToken(guest, pointer, "fixture-native-fcm", "android"),
      error => /Foreground chat still works/.test(error.message) && !error.uncertain);
  }
});

test("registration uses the existing single refresh retry on 401", async () => {
  let token = "expired", calls = 0, refreshes = 0;
  const { supportApi } = load(async (_url, options) => {
    calls++;
    if (calls === 1) return json({ detail: "Expired" }, 401);
    assert.equal(options.headers.Authorization, "Bearer fresh");
    return json({ success: true });
  });
  await supportApi.registerFcmToken({
    kind: "authenticated", getToken: () => token,
    refreshToken: async () => { refreshes++; token = "fresh"; return token; },
  }, { conversationId: 12 }, "fixture-native-fcm", "ios");
  assert.equal(calls, 2);
  assert.equal(refreshes, 1);
});

test("only canonical string support_reply IDs are accepted", () => {
  const { parseSupportReply } = load(async () => { throw new Error("Unexpected HTTP call"); });
  assert.equal(parseSupportReply(payload), 12);
  for (const id of [12, "0", "-1", "01", "12.0", "1e2", " 12", "9007199254740992"]) {
    assert.equal(parseSupportReply({ ...payload, conversation_id: id }), null);
  }
  for (const data of [null, {}, { ...payload, type: "other" }]) {
    assert.equal(parseSupportReply(data), null);
  }
});

test("missing, mismatched, and cross-owner credentials request recovery without fetching", async () => {
  let calls = 0;
  const { authorizeSupportReply } = load(async () => { calls++; throw new Error("Unexpected HTTP call"); });
  for (const saved of [null, { ...pointer, conversationId: 99 }, { conversationId: 12 }]) {
    assert.equal((await authorizeSupportReply(payload, guest, saved)).kind, "recovery");
  }
  assert.equal((await authorizeSupportReply(payload, account, pointer)).kind, "recovery");
  assert.equal((await authorizeSupportReply({ ...payload, type: "other" }, guest, pointer)).kind, "ignored");
  assert.equal(calls, 0);
});

test("a matching saved guest thread must pass REST authorization; push preview is not history", async () => {
  const { authorizeSupportReply } = load(async (url) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, "/api/support/conversation/12");
    assert.equal(parsed.searchParams.get("anonymous_token"), "fixture-guest");
    assert.equal(parsed.searchParams.get("since_id"), "0");
    return json({ conversation: { id: 12, status: "open" }, messages: [] });
  });
  const result = await authorizeSupportReply({ ...payload, body: "Untrusted preview" }, guest, pointer);
  assert.equal(result.kind, "authorized");
  assert.equal(result.thread.messages.length, 0);
});

test("account notification taps use JWT authorization, not guest fallback", async () => {
  const { authorizeSupportReply } = load(async (url, options) => {
    assert.ok(url.includes("/support/conversation/auth/12?"));
    assert.equal(options.headers.Authorization, "Bearer fixture-access");
    assert.ok(!url.includes("anonymous_token"));
    return json({ conversation: { id: 12, status: "resolved" }, messages: [] });
  });
  const result = await authorizeSupportReply(payload, account, { conversationId: 12 });
  assert.equal(result.thread.conversation.status, "resolved");
});

test("inaccessible or wrong server threads are never returned as authorized", async () => {
  for (const response of [
    json({ detail: "Not authorized" }, 403),
    json({ detail: "Missing" }, 404),
    json({ conversation: { id: 99, status: "open" }, messages: [] }),
  ]) {
    const { authorizeSupportReply } = load(async () => response);
    await assert.rejects(authorizeSupportReply(payload, guest, pointer));
  }
});
