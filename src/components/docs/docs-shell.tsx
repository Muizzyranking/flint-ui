"use client";

import { CaretRight, List, MagnifyingGlass, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { FlintLogo, GithubMark } from "@/components/brand";
import { CodeCopy } from "@/components/docs/code-copy";
import { DocsSearch } from "@/components/docs/docs-search";
import { GITHUB_URL } from "@/lib/site";

export type DocsNavGroup = {
  label: string;
  collapsible?: boolean;
  items: { title: string; href: string }[];
};

type SearchItem = {
  href: string;
  title: string;
  group: string;
  headings: { id: string; text: string }[];
};

export function DocsShell({
  groups,
  searchIndex,
  children,
}: {
  groups: DocsNavGroup[];
  searchIndex: SearchItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
      if (event.key === "Escape") setDrawerOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  const isActive = (href: string) =>
    href === "/docs" ? pathname === "/docs" : pathname === href;

  const isGroupOpen = (group: DocsNavGroup) => {
    if (!group.collapsible) return true;
    if (group.label in openGroups) return openGroups[group.label];
    return pathname.startsWith("/docs/handlers");
  };

  const nav = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-7" aria-label="Documentation">
      <Link
        href="/docs"
        onClick={onNavigate}
        className={`text-[16px] transition-colors ${
          isActive("/docs")
            ? "font-medium text-ink"
            : "text-muted hover:text-ink"
        }`}
      >
        Overview
      </Link>

      {groups.map((group) => {
        const open = isGroupOpen(group);
        return (
          <div key={group.label}>
            {group.collapsible ? (
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((current) => ({
                    ...current,
                    [group.label]: !open,
                  }))
                }
                aria-expanded={open}
                className="flex w-full items-center gap-1.5 text-left font-mono text-[12.5px] uppercase tracking-[0.14em] text-faint transition-colors hover:text-ink-soft"
              >
                <CaretRight
                  className={`size-3 transition-transform duration-200 ${
                    open ? "rotate-90" : ""
                  }`}
                  weight="bold"
                />
                {group.label}
              </button>
            ) : (
              <p className="font-mono text-[12.5px] uppercase tracking-[0.14em] text-accent-bright/70">
                {group.label}
              </p>
            )}

            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduce ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <ul className="ml-[5px] border-l border-line pt-2 pl-3">
                    {group.items.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <li key={item.href} className="py-1">
                          <Link
                            href={item.href}
                            onClick={onNavigate}
                            className={`relative block text-[15.5px] leading-7 transition-colors ${
                              active
                                ? "text-ink"
                                : "text-muted hover:text-ink-soft"
                            }`}
                          >
                            {active ? (
                              <span className="absolute top-1/2 -left-[13.5px] h-4 w-[2px] -translate-y-1/2 rounded-full bg-accent" />
                            ) : null}
                            {item.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open documentation menu"
            className="-ml-1 inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:text-ink lg:hidden"
          >
            <List className="size-4" />
          </button>

          <FlintLogo />
          <span className="hidden h-3.5 w-px bg-line-strong sm:block" />
          <Link
            href="/docs"
            className="hidden text-[15px] text-muted transition-colors hover:text-ink sm:block"
          >
            Documentation
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Flint on GitHub"
              className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/55 transition-colors hover:border-white/20 hover:text-white"
            >
              <GithubMark className="size-4" />
            </a>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-[15px] text-faint transition-colors hover:border-line-strong hover:text-ink-soft"
              aria-label="Search documentation"
            >
              <MagnifyingGlass className="size-3.5" />
              <span className="hidden sm:inline">Search docs</span>
              <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[11.5px] tracking-wide text-faint sm:inline">
                ⌘K
              </kbd>
            </button>

            <Link
              href="/"
              className="inline-flex h-9 items-center rounded-md px-2.5 text-[15px] text-muted transition-colors hover:text-ink"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1420px] flex-1">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-line px-6 py-9 lg:block">
          {nav()}
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>

      <AnimatePresence>
        {drawerOpen ? (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Close documentation menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-canvas/70 backdrop-blur-sm"
            />
            <motion.div
              initial={reduce ? false : { x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reduce ? undefined : { x: -24, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex h-full w-[290px] flex-col border-r border-line bg-canvas"
            >
              <div className="flex h-16 items-center justify-between border-b border-line px-4">
                <FlintLogo />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-8">
                {nav(() => setDrawerOpen(false))}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <DocsSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        index={searchIndex}
      />
      <CodeCopy />
    </div>
  );
}
