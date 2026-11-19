const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
for (const [file, expectedLinkCount] of [
  ["components/shared/HomeBanner.tsx", 1],
  ["app/(tabs)/profile.tsx", 1],
]) {
  test(`${file} opens the requested EDUwAI login destination`, () => {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /edwai\.(in|com)\b/i);
    const links = [...source.matchAll(/Linking\.openURL\("([^"]+)"\)/g)];
    assert.equal(links.length, expectedLinkCount);
    for (const [, url] of links) {
      assert.equal(url, "https://eduwai.in/login");
    }
  });
}

test("Profile legal rows open the real privacy policy and terms pages", () => {
  const source = fs.readFileSync(path.join(root, "app/(tabs)/profile.tsx"), "utf8");
  assert.match(source, /Linking\.openURL\(legalUrls\.privacy\)/);
  assert.match(source, /Linking\.openURL\(legalUrls\.terms\)/);
});

test("dashboard footer and resource defaults contain no legacy website URLs", () => {
  for (const file of ["components/HomeFooter.tsx", "components/WhatsNewPanel.tsx"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /https?:\/\/edwai\.(in|com)\b/i);
    assert.match(source, /https:\/\/eduwai\.in\/login/);
    // Website corrections must not rewrite the support email address.
    assert.match(source, /mailto:support@edwai\.com/);
  }
});
