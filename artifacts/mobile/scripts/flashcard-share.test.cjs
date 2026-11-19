const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: () => ({}) });
  return exports;
}
const share = load("../services/flashcardShare.ts");

test("shared deck lists every card and ends with the app name and link", () => {
  const text = share.buildFlashcardShareText(
    [{ type: "definition", front: "What is **photosynthesis**?", back: "Plants make food using $CO_2$ and sunlight." },
     { type: "fact", front: "Where?", back: "In chloroplasts" }],
    { question: "Photosynthesis", bookTitle: "EDUwAI Biology" },
  );
  assert.match(text, /^📚 \*EDUwAI Flashcards\* — Photosynthesis/);
  assert.match(text, /📖 EDUwAI Biology/);
  assert.match(text, /1\. \*Q:\* What is photosynthesis\?/);
  assert.match(text, /\*A:\* Plants make food using CO₂ and sunlight\./);
  assert.match(text, /2\. \*Q:\* Where\?/);
  const lines = text.trim().split("\n");
  assert.match(lines.at(-1), /https:\/\/eduwai\.in$/);
  assert.match(lines.at(-2), /Made with EDUwAI/);
});

test("long decks are capped with a count of the remaining cards", () => {
  const cards = Array.from({ length: 25 }, (_, i) => ({ type: "fact", front: `Q${i + 1}`, back: `A${i + 1}` }));
  const text = share.buildFlashcardShareText(cards, { question: "Big deck" });
  assert.match(text, /20\. \*Q:\* Q20/);
  assert.doesNotMatch(text, /21\. \*Q:\*/);
  assert.match(text, /…and 5 more cards on EDUwAI/);
});
