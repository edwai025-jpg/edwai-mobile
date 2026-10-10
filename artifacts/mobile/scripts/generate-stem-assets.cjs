// Build output: embed the installed KaTeX stylesheet and WOFF2 fonts for offline WebViews.
const fs = require("node:fs");
const path = require("node:path");
const cssPath = require.resolve("katex/dist/katex.min.css");
let fonts = 0;
const katexCss = fs.readFileSync(cssPath, "utf8").replace(/src:[^;]+;/g, source => {
  const match = source.match(/url\(([^)]+\.woff2)\)/);
  if (!match) throw new Error("KaTeX font declaration has no WOFF2 resource");
  const font = fs.readFileSync(path.resolve(path.dirname(cssPath), match[1].replace(/['"]/g, "")));
  fonts++;
  return `src:url(data:font/woff2;base64,${font.toString("base64")}) format("woff2");`;
});
const target = path.join(__dirname, "../generated-artifacts/stem-assets.json");
fs.mkdirSync(path.dirname(target), { recursive: true });
const output = JSON.stringify({ katexCss });
if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== output) fs.writeFileSync(target, output);
console.log(`Bundled KaTeX styles and ${fonts} local fonts.`);
