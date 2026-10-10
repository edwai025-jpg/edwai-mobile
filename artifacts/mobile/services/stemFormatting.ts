import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import "katex/contrib/mhchem";
import type { TypographySettings } from "./api";

export function preprocessLatex(content: string): string {
  return content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, equation) => `$$${equation}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, equation) => `$${equation}$`)
    .replace(/(?<!\*)\[Page\s*(\d+)\](?!\*)/g, "**[Page $1]**");
}

export function looksUnclosed(source: string): boolean {
  const withoutBlocks = source.replace(/\$\$[\s\S]*?\$\$/g, "");
  return ((withoutBlocks.match(/(?<!\\)\$/g) || []).length % 2 !== 0) || /\\(?:\(|\[)[\s\S]*$/.test(source);
}

type Node = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: Node[] };
// Match ReactMarkdown's inert HTML text: no raw HTML parser or executable answer markup.
// Disable answer links/images and keep wide tables in their own scroller.
function containAndSecure() {
  return (tree: Node) => {
    const visit = (node: Node) => {
      if (node.type === "raw") { node.type = "text"; return; }
      if (node.properties) {
        delete node.properties.href;
        delete node.properties.src;
        for (const key of Object.keys(node.properties)) if (/^on/i.test(key)) delete node.properties[key];
      }
      if (node.tagName === "img") {
        node.tagName = "span";
        node.children = [{ type: "text", value: String(node.properties?.alt ?? "") }];
        node.properties = {};
      }
      for (let i = 0; i < (node.children?.length ?? 0); i++) {
        const child = node.children![i];
        visit(child);
        if (child.tagName === "table") node.children![i] = {
          type: "element", tagName: "div", properties: { className: ["table-scroll"] }, children: [child],
        };
      }
    };
    visit(tree);
  };
}

const processor = unified().use(remarkParse).use(remarkMath).use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeKatex, { strict: false, throwOnError: false, trust: false, errorColor: "#b42318" })
  .use(containAndSecure).use(rehypeStringify);

export function formatStem(content: string): { html: string; incomplete: boolean } {
  const processed = preprocessLatex(content);
  return { html: String(processor.processSync(processed)), incomplete: looksUnclosed(processed) };
}

export function stemStyles(dark: boolean, typography?: TypographySettings | null, fontScale = 1): string {
  const size = Math.min(32, Math.max(12, parseFloat(typography?.font_size ?? "") || 16)) * Math.max(1, fontScale);
  const leading = Math.min(2.5, Math.max(1.2, parseFloat(typography?.line_height ?? "") || 1.7));
  const family = typography?.font_family === "serif" ? 'Georgia,Cambria,"Times New Roman",serif'
    : typography?.font_family === "system" || !typography?.font_family ? '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'
      : '"Helvetica Neue",Arial,sans-serif';
  const border = dark ? "#4b5563" : "#d1d5db", fill = dark ? "#1f2937" : "#f3f4f6";
  return `html,body{margin:0;padding:0;background:transparent;overflow-x:hidden;color:${dark ? "#e5e7eb" : "#1f2937"}}
  #answer{min-width:0;padding:2px 0 4px;font:${size}px/${leading} ${family};overflow-wrap:anywhere;word-break:break-word}
  p{margin:0 0 8px;line-height:1.625}p:last-child{margin-bottom:0}
  ul,ol{padding-left:20px;margin:0 0 8px}li{line-height:1.625}li+li{margin-top:4px}
  h1{font-size:1.25em;line-height:1.4;margin:12px 0 8px}h2{font-size:1.125em;line-height:1.55;margin:12px 0 8px}h3{font-size:1em;line-height:1.5;margin:8px 0 4px}
  strong,h1,h2,h3{font-weight:700}em{font-style:italic}
  .table-scroll,pre{max-width:100%;overflow-x:auto;margin-bottom:12px}
  table{min-width:100%;border-collapse:collapse}th,td{border:1px solid ${border};padding:6px 12px;text-align:left}th{background:${fill};font-weight:600}
  blockquote{border-left:4px solid #60a5fa;padding-left:12px;margin:8px 0;font-style:italic}
  pre{padding:12px;border-radius:4px;background:${fill};white-space:pre;overflow-wrap:normal;word-break:normal}
  code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.875em}p code,li code{background:${fill};padding:2px 4px;border-radius:4px}
  hr{border:0;border-top:1px solid ${border};margin:12px 0}
  .katex-display{display:block;max-width:100%;overflow-x:auto;overflow-y:hidden;padding:0.15rem 0 4px;margin:.5em 0;word-break:normal;overflow-wrap:normal}
  p .katex,li .katex{display:inline-block;max-width:100%;overflow-x:auto;overflow-y:hidden;vertical-align:middle;word-break:normal;overflow-wrap:normal}
  @media(max-width:640px){.katex{font-size:.9em}}`;
}
