import fs from "node:fs";
import path from "node:path";

import { type DocHeading, renderMarkdown } from "@/lib/markdown";

export type DocNavItem = {
  slug: string[];
  href: string;
  title: string;
  description: string;
  file: string;
};

export type DocNavGroup = {
  label: string;
  collapsible?: boolean;
  items: DocNavItem[];
};

function item(
  slug: string[],
  file: string,
  title: string,
  description: string,
): DocNavItem {
  return { slug, file, title, description, href: `/docs/${slug.join("/")}` };
}

/**
 * The docs order is declared here, explicitly, in reading order. Nothing is
 * derived from filenames or directory listings.
 */
export const docNav: DocNavGroup[] = [
  {
    label: "Start here",
    items: [
      item(
        ["introduction"],
        "introduction.md",
        "Introduction",
        "What Flint is, the guarantees it makes, and how a job moves through it.",
      ),
      item(
        ["getting-started"],
        "getting-started.md",
        "Getting started",
        "Run the stack with Compose, schedule a first job, and read the config reference.",
      ),
    ],
  },
  {
    label: "Using Flint",
    items: [
      item(
        ["usage-guide"],
        "usage-guide.md",
        "Usage guide",
        "Priority, schedules, recurring runs, DAGs, retries, cancellation, and workers.",
      ),
      item(
        ["api-reference"],
        "api-reference.md",
        "API reference",
        "Every endpoint, the response envelope, the error surface, and SSE payloads.",
      ),
      item(
        ["cli-reference"],
        "cli-reference.md",
        "CLI reference",
        "CLI reference, including the `flint` command, and the `flint` Docker image."
      ),
    ],
  },
  {
    label: "Handlers",
    collapsible: true,
    items: [
      item(
        ["handlers", "default-handlers"],
        "handlers/default-handlers.md",
        "Default handlers",
        "The eight handlers that ship with Flint and the payload each one expects.",
      ),
      item(
        ["handlers", "adding-a-handler"],
        "handlers/adding-a-new-handler.md",
        "Adding a handler",
        "Write a typed handler, publish its schema, and register it at startup.",
      ),
    ],
  },
  {
    label: "Operating",
    items: [
      item(
        ["architecture"],
        "architecture.md",
        "Architecture",
        "Durable dispatch, leases, the worker heap, and cross-layer guarantees.",
      ),
      item(
        ["operations"],
        "operations.md",
        "Operations",
        "Scaling, health checks, worker control, the DLQ runbook, and production setup.",
      ),
    ],
  },
];

const orderedItems = docNav.flatMap((group) =>
  group.items.map((navItem) => ({ ...navItem, group: group.label })),
);

const FILE_ROUTES = new Map(
  orderedItems.map((entry) => [entry.file, entry.href]),
);

const DOCS_DIR = path.join(process.cwd(), "content", "docs");

/** Rewrite `./03-api-reference.md#errors` style links onto docs routes. */
function resolveHref(href: string): string | null {
  if (!href || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href)) {
    return null;
  }

  const [rawPath, hash] = href.split("#");
  const file = rawPath.replace(/^\.\//, "");

  if (!file) return hash ? `#${hash}` : null;

  const route = FILE_ROUTES.get(file);
  if (!route) return null;

  return hash ? `${route}#${hash}` : route;
}

export type DocPage = DocNavItem & {
  group: string;
  html: string;
  headings: DocHeading[];
};

const pages = new Map<string, DocPage>();

await Promise.all(
  orderedItems.map(async ({ group, ...navItem }) => {
    const source = fs.readFileSync(path.join(DOCS_DIR, navItem.file), "utf8");
    const { html, headings } = await renderMarkdown(source, resolveHref);

    pages.set(navItem.slug.join("/"), {
      ...navItem,
      group,
      html,
      headings,
    });
  }),
);

export const allDocs = orderedItems.map((entry) => {
  const page = pages.get(entry.slug.join("/"));
  if (!page) throw new Error(`Missing docs page for ${entry.href}`);
  return page;
});

export function getDocPage(slug: string[]): DocPage | undefined {
  return pages.get(slug.join("/"));
}

export function getDocNeighbors(slug: string[]) {
  const key = slug.join("/");
  const index = allDocs.findIndex((page) => page.slug.join("/") === key);

  return {
    previous: index > 0 ? allDocs[index - 1] : undefined,
    next:
      index >= 0 && index < allDocs.length - 1 ? allDocs[index + 1] : undefined,
  };
}

export const docStaticParams = allDocs.map((page) => ({ slug: page.slug }));

export type SearchEntry = {
  href: string;
  title: string;
  group: string;
  headings: { id: string; text: string }[];
};

export const docSearchIndex: SearchEntry[] = allDocs.map((page) => ({
  href: page.href,
  title: page.title,
  group: page.group,
  headings: page.headings.map(({ id, text }) => ({ id, text })),
}));

export const readingPaths = [
  {
    label: "Evaluate Flint",
    description: "Understand the model, then run it locally.",
    items: ["/docs/introduction", "/docs/getting-started"],
  },
  {
    label: "Integrate an application",
    description: "Schedule work, then read the exact wire contract.",
    items: ["/docs/usage-guide", "/docs/api-reference"],
  },
  {
    label: "Ship a handler",
    description: "Learn the built-ins, then write and register your own.",
    items: [
      "/docs/handlers/default-handlers",
      "/docs/handlers/adding-a-handler",
    ],
  },
  {
    label: "Operate the service",
    description: "Know the internals, then the runbooks.",
    items: ["/docs/architecture", "/docs/operations"],
  },
];
