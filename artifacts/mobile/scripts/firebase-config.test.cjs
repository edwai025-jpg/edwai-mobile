const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Firebase client configurations match the approved Android/iOS identity and existing project", () => {
  const root = path.join(__dirname, "..");
  const config = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo;
  const android = JSON.parse(fs.readFileSync(path.join(root, config.android.googleServicesFile), "utf8"));
  const ios = fs.readFileSync(path.join(root, config.ios.googleServicesFile), "utf8");
  const field = key => ios.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`))?.[1];
  assert.equal(config.android.package, "in.eduwai.app");
  assert.equal(config.ios.bundleIdentifier, "com.edwai.app");
  assert.ok(
    android.client.some(c => c.client_info?.android_client_info?.package_name === config.android.package),
    "The Android Firebase file must contain a client for the approved package",
  );
  assert.equal(field("BUNDLE_ID"), config.ios.bundleIdentifier);
  // Pin the existing project too: two matching replacement files must not pass.
  assert.equal(android.project_info.project_id, "edwai-prod-70474");
  assert.equal(field("PROJECT_ID"), "edwai-prod-70474");
  assert.equal(field("PROJECT_ID"), android.project_info.project_id);
  assert.equal(field("GCM_SENDER_ID"), android.project_info.project_number);
  const defaults = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8"))["react-native"];
  assert.equal(defaults.messaging_auto_init_enabled, false);
  assert.equal(defaults.messaging_ios_auto_register_for_remote_messages, false);
});
