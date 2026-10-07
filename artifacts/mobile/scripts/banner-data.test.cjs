const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, scope = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, ...scope });
  return exports;
}
const { getBannerUsage } = load("../services/bannerUsage.ts");

test("banner uses real finite quota and never negative remaining", () => {
  const usage = getBannerUsage({ questions_used: 331, question_limit: 350, percent_used: 94.57 });
  assert.equal(usage.countLabel, "331/350 Q");
  assert.equal(usage.remaining, 19);
  assert.equal(usage.percent, 94.57);
  assert.equal(getBannerUsage({ questions_used: 60, question_limit: 50 }).remaining, 0);
  assert.equal(getBannerUsage({ questions_used: 60, question_limit: 50 }).percent, 100);
});

test("missing or invalid quota is not fabricated as a free 0/0 allowance", () => {
  assert.equal(getBannerUsage(null).countLabel, "—/— Q");
  for (const question_limit of [undefined, -1, NaN, Infinity]) {
    const value = getBannerUsage({ questions_used: 4, question_limit });
    assert.equal(value.remaining, null);
    assert.equal(value.countLabel, "4/— Q");
  }
  assert.equal(getBannerUsage({ questions_used: 0, question_limit: 0 }).remaining, 0);
  assert.equal(getBannerUsage({ questions_used: 2, questions_limit: 5 }).remaining, 3);
});

test("progress clamps server percent and calculates only a valid fallback", () => {
  assert.equal(getBannerUsage({ percent_used: 140 }).percent, 100);
  assert.equal(getBannerUsage({ percent_used: -10 }).percent, 0);
  assert.equal(getBannerUsage({ questions_used: 20, question_limit: 50, percent_used: NaN }).percent, 40);
});

test("photo source uses authenticated endpoint, not a storage key, with identity/revision cache separation", async () => {
  const calls = [];
  const client = load("../services/api.ts", {
    FormData,
    process: { env: { EXPO_PUBLIC_DOMAIN: "fixture.replit.dev" } },
    require: name => {
      if (name === "./profilePhotoUpload") return {};
      assert.equal(name, "react-native");
      return { Platform: { OS: "web" } };
    },
    fetch: async (url, opts) => {
      calls.push({ url, opts });
      return new Response(JSON.stringify({ full_name: "Fixture", questions_used: 331 }), { status: 200 });
    },
  });
  const first = client.getProfilePhotoSource("fixture-token", 42, 1);
  const next = client.getProfilePhotoSource("fixture-token", 42, 2);
  assert.equal(first.uri, "https://fixture.replit.dev/api/edwai/student/profile/photo");
  assert.equal(first.headers.Authorization, "Bearer fixture-token");
  assert.ok(!first.uri.includes("fixture-token"));
  assert.notEqual(first.cacheKey, next.cacheKey);
  assert.notEqual(first.cacheKey, client.getProfilePhotoSource("fixture-token", 43, 1).cacheKey);
  await client.default.profile.probePhoto("fixture-token");
  await client.default.auth.getMe("fixture-token");
  await client.default.study.getUsage("fixture-token");
  assert.equal(calls[0].opts.cache, "no-store");
  assert.ok(calls[1].url.endsWith("/auth/me"));
  assert.ok(calls[2].url.endsWith("/billing/usage/me"));
});

test("preview proxy preserves authenticated image bytes and prevents shared caching", async () => {
  let handler;
  const bytes = Buffer.from([137, 80, 78, 71, 255, 0, 128, 254]);
  load("../../api-server/src/routes/proxy.ts", {
    Buffer,
    require: () => ({ default: { raw: () => () => {} }, Router: () => ({ all: (_path, ...fns) => { handler = fns.at(-1); } }) }),
    fetch: async (_url, opts) => {
      assert.equal(opts.headers.authorization, "Bearer fixture-token");
      return { status: 200, headers: new Headers({ "content-type": "image/png" }), arrayBuffer: async () => bytes };
    },
  });
  const headers = {};
  let sent;
  await handler({ originalUrl: "/api/edwai/student/profile/photo", params: { 0: "student/profile/photo" }, method: "GET", headers: { authorization: "Bearer fixture-token" } }, {
    status: status => assert.equal(status, 200),
    set: (name, value) => { headers[name] = value; },
    send: value => { sent = value; },
  });
  assert.deepEqual(sent, bytes);
  assert.equal(headers["cache-control"], "private, no-store");
});
