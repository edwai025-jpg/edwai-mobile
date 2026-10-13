const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, requireModule) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: false },
  }).outputText;
  vm.runInNewContext(code, { exports, Error, TypeError, require: requireModule, process: { env: {} } });
  return exports;
}
const onboarding = load("../services/onboarding.ts", () => { throw Error("Unexpected import"); });
const validation = load("../services/accountDetails.ts", () => onboarding);
const initial = { id: 42, name: "Saved Learner", email: "old@example.invalid", phone: "+916123456789",
  emailVerified: true, phoneVerified: true, questionsUsed: 17 };
function profile(user) {
  return { id: user.id, full_name: user.name, email: user.email, phone: user.phone,
    email_verified: user.emailVerified, phone_verified: user.phoneVerified };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness(options = {}) {
  let user = { ...initial }, server = { ...initial }, visible = true, result;
  const calls = [], alerts = [], toasts = [], state = [], refs = [], dependencies = [];
  let stateIndex, refIndex, effectIndex, effects = [];
  const react = {
    useState(value) {
      const index = stateIndex++;
      if (!(index in state)) state[index] = value;
      return [state[index], update => {
        state[index] = typeof update === "function" ? update(state[index]) : update;
        render();
      }];
    },
    useRef(value) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: value };
      return refs[index];
    },
    useEffect(fn, deps) {
      const index = effectIndex++;
      if (!dependencies[index] || deps.some((value, i) => value !== dependencies[index][i])) {
        dependencies[index] = deps;
        effects.push(fn);
      }
    },
  };
  const api = {
    auth: { getMe: async () => {
      calls.push({ action: "read" });
      if (options.readFailure) throw new TypeError("Offline");
      return profile(server);
    } },
    profile: {
      sendEmailOtp: async (_, email) => {
        calls.push({ action: "send", channel: "email", target: email });
        if (options.sendFailure) throw new TypeError("Delivery failed");
        return { sent: true };
      },
      sendPhoneOtp: async (_, phone) => { calls.push({ action: "send", channel: "phone", target: phone }); return { sent: true }; },
      verifyEmailOtp: async (_, email, otp) => {
        calls.push({ action: "verify", channel: "email", target: email, otp });
        if (options.invalidCode) throw new FakeApiError("Invalid or expired OTP", 400);
        server.email = email; server.emailVerified = true;
        if (options.lostVerification) throw new TypeError("Response lost");
        return { success: true, user: profile(server) };
      },
      verifyPhoneOtp: async (_, phone, otp) => {
        calls.push({ action: "verify", channel: "phone", target: phone, otp });
        server.phone = phone; server.phoneVerified = true;
        return { success: true, user: profile(server) };
      },
      saveAccount: async (_, data) => {
        calls.push({ action: "save", data: JSON.parse(JSON.stringify(data)) });
        server.name = data.full_name;
        if (data.phone === "") { server.phone = ""; server.phoneVerified = false; }
        return { success: true };
      },
    },
  };
  class FakeApiError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } }
  const hook = load("../hooks/useAccountDetails.ts", name => {
    if (name === "react") return react;
    if (name === "@/context/auth") return {
      useAuth: () => ({ user, runAuthenticatedRequest: operation => operation("fixture-token"), updateUser: async fresh => { user = { ...user, ...fresh }; render(); } }),
      apiUserToProfile: fresh => ({ id: fresh.id, name: fresh.full_name, email: fresh.email, phone: fresh.phone,
        emailVerified: fresh.email_verified, phoneVerified: fresh.phone_verified }),
    };
    if (name === "@/services/api") return { default: api, ApiError: FakeApiError };
    if (name === "@/services/onboarding") return onboarding;
    if (name === "@/services/accountDetails") return validation;
    throw Error(`Unexpected import ${name}`);
  }).useAccountDetails;
  function render() {
    stateIndex = refIndex = effectIndex = 0;
    result = hook(visible, (...args) => alerts.push(args), (...args) => toasts.push(args));
    const pending = effects; effects = [];
    pending.forEach(effect => effect());
  }
  render();
  return { get form() { return result; }, get user() { return user; }, calls, alerts, toasts,
    close() { visible = false; render(); }, open() { visible = true; render(); } };
}

test("validates Unicode names, email handoff rules, and Indian numbers", () => {
  assert.equal(validation.validateName(" 学生 "), "");
  assert.ok(validation.validateName("Learner 12"));
  for (const email of ["a..b@example.invalid", "a@domain", "a@b.c", "a b@example.invalid", "@a.invalid"]) assert.ok(validation.validateAccountEmail(email));
  assert.equal(validation.validateAccountEmail("learner@example.invalid"), "");
  assert.ok(validation.validatePhone("5123456789"));
});
test("new contacts clear verified badges; Send targets the draft and does not save contact or pending name", async () => {
  const h = harness();
  h.form.setName("Pending Name");
  h.form.changeEmail("new@example.invalid");
  assert.equal(h.form.emailVerified, false);
  h.form.save(); await flush();
  assert.equal(h.calls[0].target, "new@example.invalid");
  assert.equal(h.user.email, initial.email);
  assert.equal(h.user.name, initial.name);
  assert.equal(h.calls.filter(call => call.action === "save").length, 0);
});
test("OTP confirmation cancellation sends no verification; confirmation saves only that contact", async () => {
  const h = harness();
  h.form.setName("Pending Name");
  h.form.changeEmail("new@example.invalid");
  h.form.send("email"); await flush();
  h.form.changeCode("email", "123456"); h.form.verify("email");
  assert.equal(h.calls.filter(call => call.action === "verify").length, 0);
  assert.equal(h.alerts[0][2][0].text, "Cancel");
  h.form.verify("email"); h.alerts.at(-1)[2][1].onPress(); await flush();
  assert.equal(h.user.email, "new@example.invalid");
  assert.equal(h.user.name, initial.name);
  assert.equal(h.form.name, "Pending Name");
  assert.equal(h.user.questionsUsed, 17);
  assert.equal(h.calls.filter(call => call.action === "save").length, 0);
});
test("editing a contact clears stale OTP state and leading-zero codes stay strings", async () => {
  const h = harness();
  h.form.changeEmail("new@example.invalid"); h.form.send("email"); await flush();
  h.form.changeCode("email", "001234");
  assert.equal(h.form.codes.email.code, "001234");
  h.form.changeEmail("another@example.invalid");
  assert.equal(h.form.codes.email.sentTo, null);
  assert.equal(h.form.codes.email.code, "");
  h.form.verify("email");
  assert.equal(h.alerts.length, 0);
});
test("both changed contacts remain independent and Save does not resend already sent codes", async () => {
  const h = harness();
  h.form.changeEmail("new@example.invalid"); h.form.changePhone("9876543210");
  h.form.save(); await flush(); h.form.save(); await flush();
  assert.equal(h.calls.filter(call => call.action === "send").length, 2);
  h.form.changeCode("email", "123456"); h.form.verify("email"); h.alerts.at(-1)[2][1].onPress(); await flush();
  assert.equal(h.user.phone, initial.phone);
  assert.equal(h.form.codes.phone.sentTo, "+919876543210");
  assert.equal(h.form.pendingContacts, true);
});
test("failed resend invalidates local sent/code state", async () => {
  const options = {}, h = harness(options);
  h.form.changeEmail("new@example.invalid"); h.form.send("email"); await flush();
  h.form.changeCode("email", "123456");
  options.sendFailure = true; h.form.send("email"); await flush();
  assert.equal(h.form.codes.email.sentTo, null);
  assert.equal(h.form.codes.email.code, "");
  assert.match(h.form.codes.email.error, /Contact Us/);
});
test("invalid OTP leaves the old contact saved and the panel retryable", async () => {
  const h = harness({ invalidCode: true });
  h.form.changeEmail("new@example.invalid"); h.form.send("email"); await flush();
  h.form.changeCode("email", "123456"); h.form.verify("email"); h.alerts.at(-1)[2][1].onPress(); await flush();
  assert.equal(h.user.email, initial.email);
  assert.match(h.form.codes.email.error, /Invalid or expired OTP/);
  assert.equal(h.form.codes.email.sentTo, "new@example.invalid");
});
test("lost verification response reads the authoritative account instead of replaying mutation", async () => {
  const h = harness({ lostVerification: true });
  h.form.changeEmail("new@example.invalid"); h.form.send("email"); await flush();
  h.form.changeCode("email", "123456"); h.form.verify("email"); h.alerts.at(-1)[2][1].onPress(); await flush();
  assert.equal(h.user.email, "new@example.invalid");
  assert.equal(h.calls.filter(call => call.action === "verify").length, 1);
  assert.equal(h.calls.filter(call => call.action === "read").length, 1);
});
test("unknown verification outcome blocks further mutations until a saved-profile read succeeds", async () => {
  const h = harness({ lostVerification: true, readFailure: true });
  h.form.changeEmail("new@example.invalid"); h.form.send("email"); await flush();
  h.form.changeCode("email", "123456"); h.form.verify("email"); h.alerts.at(-1)[2][1].onPress(); await flush();
  assert.equal(h.form.needsReconcile, true);
  h.form.save(); h.form.verify("email"); await flush();
  assert.equal(h.calls.filter(call => call.action === "verify").length, 1);
});
test("name save normalizes name and never submits contacts or a password", async () => {
  const h = harness();
  h.form.setName(" Updated   Learner ");
  h.form.save(); await flush();
  assert.deepEqual(h.calls[0].data, { full_name: "Updated Learner" });
  assert.equal(h.form.password, undefined);
  assert.equal(h.form.setPassword, undefined);
  assert.equal(h.form.setConfirmation, undefined);
  assert.equal(h.user.name, "Updated Learner");
});
test("successful account write followed by failed read is never replayed", async () => {
  const h = harness({ readFailure: true });
  h.form.save(); await flush(); h.form.save(); await flush();
  assert.equal(h.calls.filter(call => call.action === "save").length, 1);
  assert.equal("password" in h.calls[0].data, false);
  assert.equal(h.form.needsReconcile, true);
});
test("Account editor replaces password inputs with the web OTP-only support notice", () => {
  const source = fs.readFileSync(path.join(__dirname, "../components/AccountEditModal.tsx"), "utf8");
  const ast = ts.createSourceFile("AccountEditModal.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const labels = [], text = [];
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === "accessibilityLabel"
      && node.initializer && ts.isStringLiteral(node.initializer)) labels.push(node.initializer.text);
    if (ts.isJsxText(node)) text.push(node.text.trim());
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(ast.parseDiagnostics.length, 0);
  assert.ok(labels.includes("Full Name") && labels.includes("Email Address") && labels.includes("Phone Number"));
  assert.ok(!labels.some(label => /password/i.test(label)));
  assert.ok(text.includes("Password login is disabled"));
  assert.ok(text.includes("Your account uses OTP-based login via phone or email. Password sign-in is not available. If you're unable to receive an OTP, please contact support for assisted access."));
});
test("phone removal requires confirmation and sends explicit empty string", async () => {
  const h = harness();
  h.form.changePhone(""); h.form.save();
  assert.equal(h.calls.length, 0);
  h.alerts[0][2][1].onPress(); await flush();
  assert.equal(h.calls[0].data.phone, "");
  assert.equal(h.user.phone, "");
});
test("close/reopen discards unsaved drafts and codes but keeps verified replacements", async () => {
  const h = harness();
  h.form.changeEmail("new@example.invalid"); h.form.send("email"); await flush();
  h.form.changeCode("email", "123456"); h.form.verify("email"); h.alerts.at(-1)[2][1].onPress(); await flush();
  h.form.setName("Unsaved Name"); h.close(); h.open();
  assert.equal(h.form.email, "new@example.invalid");
  assert.equal(h.form.name, initial.name);
  assert.equal(h.form.codes.email.code, "");
});
