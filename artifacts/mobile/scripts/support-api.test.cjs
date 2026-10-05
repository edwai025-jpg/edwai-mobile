// Contract tests use controlled HTTP responses; they never contact production.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function client(fetch) {
  const code = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../services/supportApi.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, fetch, process: { env: {} }, AbortController, URLSearchParams, setTimeout, clearTimeout,
  });
  return exports;
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });

test("guest creation carries initial text once, with contact fields and no JWT", async () => {
  const calls = [];
  const { supportApi } = client(async (url, opts) => {
    calls.push({ url, opts });
    return json({ conversation_id: 12, anonymous_token: "fixture-guest" });
  });
  const pointer = await supportApi.create({ kind: "guest" }, "  Please help  ", {
    name: " Test ", email: "test@example.com", phone: "9876543210",
  });
  assert.equal(pointer.conversationId, 12);
  assert.equal(pointer.anonymousToken, "fixture-guest");
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith("/support/conversation"));
  assert.equal(calls[0].opts.headers.Authorization, undefined);
  const body = JSON.parse(calls[0].opts.body);
  assert.equal(body.initial_message, "Please help");
  assert.equal(body.guest_phone, "9876543210");
  assert.equal(body.guest_name, "Test");
});

test("guest fetch uses anonymous_token while send uses guest_token", async () => {
  const calls = [];
  const { supportApi } = client(async (url, opts) => {
    calls.push({ url, opts });
    return opts.method === "GET"
      ? json({ conversation: { id: 12, status: "open" }, messages: [] }) : json({ success: true });
  });
  const pointer = { conversationId: 12, anonymousToken: "fixture+/= token" };
  await supportApi.fetch({ kind: "guest" }, pointer, 99);
  await supportApi.send({ kind: "guest" }, pointer, "Hello");
  const parsed = new URL(calls[0].url);
  assert.equal(parsed.searchParams.get("since_id"), "99");
  assert.equal(parsed.searchParams.get("anonymous_token"), pointer.anonymousToken);
  assert.equal(JSON.parse(calls[1].opts.body).guest_token, pointer.anonymousToken);
  assert.equal(JSON.parse(calls[1].opts.body).anonymous_token, undefined);
});

test("signed-in creation/send uses auth routes and bearer token, never guest data", async () => {
  const calls = [];
  const { supportApi } = client(async (url, opts) => {
    calls.push({ url, opts });
    return url.endsWith("/message") ? json({ success: true }) : json({ conversation_id: 14, anonymous_token: null });
  });
  const owner = { kind: "authenticated", getToken: () => "fixture-access" };
  const pointer = await supportApi.create(owner, "First text");
  await supportApi.send(owner, pointer, "Second text");
  assert.ok(calls[0].url.endsWith("/support/conversation/auth"));
  assert.ok(calls[1].url.endsWith("/support/conversation/auth/14/message"));
  assert.equal(calls[0].opts.headers.Authorization, "Bearer fixture-access");
  assert.equal(JSON.parse(calls[0].opts.body).guest_name, undefined);
  assert.equal(JSON.parse(calls[1].opts.body).guest_token, undefined);
});

test("401 refresh retries at most once with the updated JWT", async () => {
  let count = 0, refreshes = 0, token = "expired";
  const { supportApi } = client(async (_url, opts) => {
    count++;
    if (count === 1) return json({ detail: "Expired" }, 401);
    assert.equal(opts.headers.Authorization, "Bearer fresh");
    return json({ conversation: { id: 14, status: "open" }, messages: [] });
  });
  await supportApi.fetch({
    kind: "authenticated", getToken: () => token,
    refreshToken: async () => { refreshes++; token = "fresh"; return token; },
  }, { conversationId: 14 }, 0);
  assert.equal(count, 2);
  assert.equal(refreshes, 1);
});

test("a repeated 401 stops instead of refresh looping", async () => {
  let calls = 0, refreshes = 0;
  const { supportApi } = client(async () => { calls++; return json({ detail: "Expired" }, 401); });
  await assert.rejects(supportApi.fetch({
    kind: "authenticated", getToken: () => "fixture",
    refreshToken: async () => { refreshes++; return "fixture"; },
  }, { conversationId: 14 }, 0), e => e.status === 401);
  assert.equal(calls, 2);
  assert.equal(refreshes, 1);
});

test("ambiguous send failures never automatically repeat POST", async () => {
  let calls = 0;
  const { supportApi } = client(async () => { calls++; throw new TypeError("Network unavailable"); });
  await assert.rejects(
    supportApi.send({ kind: "guest" }, { conversationId: 12, anonymousToken: "fixture" }, "Help"),
    e => e.uncertain === true,
  );
  assert.equal(calls, 1);
});

test("validation detail arrays are normalized and a resolved send is not delivery-uncertain", async () => {
  const { supportApi } = client(async () => json({ detail: [{ msg: "Conversation resolved" }] }, 400));
  await assert.rejects(
    supportApi.send({ kind: "guest" }, { conversationId: 12, anonymousToken: "fixture" }, "Help"),
    e => e.message === "Conversation resolved" && e.status === 400 && !e.uncertain,
  );
});

test("non-JSON gateway errors are not exposed as HTML and no write is retried", async () => {
  let calls = 0;
  const { supportApi } = client(async () => {
    calls++;
    return new Response("<html>Gateway error</html>", { status: 502 });
  });
  await assert.rejects(
    supportApi.send({ kind: "guest" }, { conversationId: 12, anonymousToken: "fixture" }, "Help"),
    e => e.uncertain === true && !e.message.includes("<html>"),
  );
  assert.equal(calls, 1);
});

test("a restored thread with another ID is rejected", async () => {
  const { supportApi } = client(async () => json({ conversation: { id: 99, status: "open" }, messages: [] }));
  await assert.rejects(supportApi.fetch({ kind: "guest" }, {
    conversationId: 12, anonymousToken: "fixture",
  }, 0), /invalid conversation/);
});