import GithubSlugger from "github-slugger";
import type { Element, Root as HastRoot } from "hast";
import type { Heading, Root as MdastRoot } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

export type DocHeading = {
  id: string;
  text: string;
  depth: number;
};

export type RenderResult = {
  html: string;
  headings: DocHeading[];
};

type HrefResolver = (href: string) => string | null;

/**
 * Collect h2/h3 headings in document order. The slugger walks every heading
 * (including the h1) so the generated ids match rehype-slug exactly.
 */
function remarkCollectHeadings(options: { sink: DocHeading[] }) {
  return (tree: MdastRoot) => {
    const slugger = new GithubSlugger();

    visit(tree, "heading", (node: Heading) => {
      const text = mdastToString(node).replace(/\s+/g, " ").trim();
      const id = slugger.slug(text);

      if (node.depth === 2 || node.depth === 3) {
        options.sink.push({ id, text, depth: node.depth });
      }
    });
  };
}

/** Map relative Markdown links onto the rendered docs routes. */
function rehypeDocLinks(options: { resolveHref: HrefResolver }) {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return;

      const href = node.properties?.href;
      if (typeof href !== "string") return;

      const mapped = options.resolveHref(href);
      if (mapped) node.properties.href = mapped;

      if (/^https?:\/\//.test(href)) {
        node.properties.target = "_blank";
        node.properties.rel = ["noreferrer", "noopener"];
      }
    });
  };
}

/** Tables scroll horizontally instead of stretching the article. */
function rehypeTableWrapper() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "table" || !parent || index === undefined) return;

      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: ["table-scroll"] },
        children: [node],
      };
    });
  };
}

function codeHeader(language: string): Element {
  return {
    type: "element",
    tagName: "div",
    properties: { className: ["code-frame-head"] },
    children: [
      {
        type: "element",
        tagName: "span",
        properties: { className: ["code-frame-lang"] },
        children: [{ type: "text", value: language || "diagram" }],
      },
      {
        type: "element",
        tagName: "button",
        properties: {
          type: "button",
          className: ["code-copy"],
          "data-copy": "true",
          "aria-label": "Copy code to clipboard",
        },
        children: [{ type: "text", value: "Copy" }],
      },
    ],
  };
}

/**
 * Add a small header (language label + copy button) to every code block.
 * Highlighted blocks already sit in a figure; plain diagram fences get one.
 * Copy buttons are inert markup; a client listener handles the clipboard.
 */
function rehypeCodeFrame() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "pre" || !parent || index === undefined) return;

      const rawLanguage = node.properties?.["data-language"];
      const language =
        typeof rawLanguage === "string" ? rawLanguage.trim() : "";

      const figureParent =
        parent.type === "element" && parent.tagName === "figure"
          ? (parent as Element)
          : undefined;

      if (figureParent) {
        if (figureParent.properties["data-frame-built"] === "true") return;

        const isPretty =
          "data-rehype-pretty-code-figure" in figureParent.properties;
        const isPlain = "data-plain-code" in figureParent.properties;
        if (!isPretty && !isPlain) return;

        figureParent.properties["data-frame-built"] = "true";
        figureParent.properties["data-plain"] = language ? undefined : "true";
        figureParent.children.unshift(codeHeader(language || "diagram"));
        return;
      }

      parent.children[index] = {
        type: "element",
        tagName: "figure",
        properties: { "data-plain-code": "true", "data-frame-built": "true" },
        children: [codeHeader(language || "diagram"), node],
      };
      return;
    });
  };
}

export async function renderMarkdown(
  markdown: string,
  resolveHref: HrefResolver,
): Promise<RenderResult> {
  const headings: DocHeading[] = [];

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkCollectHeadings, { sink: headings })
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypePrettyCode, {
      theme: "vesper",
      keepBackground: false,
    })
    .use(rehypeTableWrapper)
    .use(rehypeCodeFrame)
    .use(rehypeDocLinks, { resolveHref })
    .use(rehypeStringify)
    .process(markdown);

  return { html: String(file), headings };
}
