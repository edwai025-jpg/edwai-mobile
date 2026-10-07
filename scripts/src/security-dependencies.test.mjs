import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const mobileRequire = createRequire(new URL("artifacts/mobile/package.json", root));
const apiRequire = createRequire(new URL("artifacts/api-server/package.json", root));
const rendererRequire = createRequire(mobileRequire.resolve("react-native-markdown-display"));
const MarkdownIt = rendererRequire("markdown-it");
const { build } = apiRequire("esbuild");

// Exercise the renderer's actual parsing/cleanup/AST pipeline, not just
// markdown-it in isolation: the renderer still declares markdown-it 10.
const bundle = await build({
  entryPoints: [rendererRequire.resolve("./lib/parser")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { default: parse } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

function flatten(nodes) {
  return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);
}

test("all listed vulnerable dependency versions are absent from the lockfile", () => {
  const lock = readFileSync(new URL("pnpm-lock.yaml", root), "utf8");
  const vulnerable = {
    "node-forge": ["1.3.3"],
    "@xmldom/xmldom": ["0.8.11"],
    picomatch: ["2.3.1", "3.0.1", "4.0.3"],
    "drizzle-orm": ["0.45.1"],
    "path-to-regexp": ["8.3.0"],
    vite: ["7.3.1"],
    lodash: ["4.17.23"],
    yaml: ["2.8.2"],
    "markdown-it": ["10.0.0"],
    "brace-expansion": ["1.1.12", "2.0.2", "5.0.4"],
    postcss: ["8.4.49", "8.5.8"],
  };
  for (const [name, versions] of Object.entries(vulnerable)) {
    for (const version of versions) {
      const escaped = `${name}@${version}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.ok(!new RegExp(`^  ['"]?${escaped}(?:['"]?:|\\()`, "m").test(lock), `${name}@${version} remains locked`);
    }
  }
});

test("the installed mobile renderer uses patched markdown-it 14", () => {
  assert.match(rendererRequire("markdown-it/package.json").version, /^14\.3\./);
});

test("study markdown retains headings, emphasis, lists, code, tables and citations", () => {
  const source = [
    "# Study answer",
    "**Important** and *emphasis* [Page 12]",
    "- First item",
    "- Second item",
    "",
    "```js",
    "const result = 42;",
    "```",
    "",
    "| Topic | Answer |",
    "| --- | --- |",
    "| Math | 42 |",
    "",
    "[Source](https://example.com/book)",
    "![Diagram](https://example.com/diagram.png)",
  ].join("\n");
  const nodes = flatten(parse(source, (ast) => ast, MarkdownIt({ typographer: true })));
  for (const type of ["heading1", "strong", "em", "bullet_list", "list_item", "fence", "table", "link", "image"]) {
    assert.ok(nodes.some((node) => node.type === type), `Missing ${type}`);
  }
  assert.ok(nodes.some((node) => node.content?.includes("[Page 12]")));
  assert.ok(nodes.some((node) => node.attributes.href === "https://example.com/book"));
  assert.ok(nodes.some((node) => node.attributes.src === "https://example.com/diagram.png"));
});

test("untrusted markdown cannot create javascript links or raw HTML nodes", () => {
  const nodes = flatten(parse(
    "[unsafe](javascript:alert(1))\n<script>alert(1)</script>",
    (ast) => ast,
    MarkdownIt({ typographer: true }),
  ));
  assert.ok(!nodes.some((node) => node.type === "html_inline" || node.type === "html_block"));
  assert.ok(!nodes.some((node) => node.attributes.href?.startsWith("javascript:")));
});

test("malformed and empty markdown do not crash the renderer pipeline", () => {
  for (const source of ["", "***unclosed [link", "> nested\n>> quote\n\n---"]) {
    assert.ok(Array.isArray(parse(source, (ast) => ast, MarkdownIt())));
  }
});
