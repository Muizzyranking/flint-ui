import type { ReactNode } from "react";

import { type DocsNavGroup, DocsShell } from "@/components/docs/docs-shell";
import { docNav, docSearchIndex } from "@/lib/docs";

const groups: DocsNavGroup[] = docNav.map((group) => ({
  label: group.label,
  collapsible: group.collapsible,
  items: group.items.map((item) => ({ title: item.title, href: item.href })),
}));

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <DocsShell groups={groups} searchIndex={docSearchIndex}>
      {children}
    </DocsShell>
  );
}
