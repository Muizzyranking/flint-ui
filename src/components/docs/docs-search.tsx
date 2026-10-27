"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type SearchItem = {
  href: string;
  title: string;
  group: string;
  headings: { id: string; text: string }[];
};

type Result = {
  href: string;
  title: string;
  subtitle: string;
};

export function DocsSearch({
  open,
  onClose,
  index,
}: {
  open: boolean;
  onClose: () => void;
  index: SearchItem[];
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (!open) return;

    setQuery("");
    setCursor(0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      return index.map((page) => ({
        href: page.href,
        title: page.title,
        subtitle: page.group,
      }));
    }

    const matches: Result[] = [];
    const seen = new Set<string>();

    for (const page of index) {
      if (
        page.title.toLowerCase().includes(q) ||
        page.group.toLowerCase().includes(q)
      ) {
        matches.push({
          href: page.href,
          title: page.title,
          subtitle: page.group,
        });
        seen.add(page.href);
      }

      for (const heading of page.headings) {
        if (!heading.text.toLowerCase().includes(q)) continue;
        const href = `${page.href}#${heading.id}`;
        if (seen.has(href)) continue;
        seen.add(href);
        matches.push({
          href,
          title: heading.text,
          subtitle: page.title,
        });
      }
    }

    return matches.slice(0, 12);
  }, [index, query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function go(result: Result | undefined) {
    if (!result) return;
    onClose();
    router.push(result.href);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            type="button"
            aria-label="Close search"
            onClick={onClose}
            className="absolute inset-0 bg-canvas/75 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search documentation"
            initial={reduce ? false : { opacity: 0, y: -8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]"
          >
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <MagnifyingGlass className="size-4 shrink-0 text-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCursor(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    onClose();
                    return;
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setCursor((value) =>
                      Math.min(value + 1, Math.max(results.length - 1, 0)),
                    );
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setCursor((value) => Math.max(value - 1, 0));
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    go(results[cursor]);
                  }
                }}
                placeholder="Search pages and sections"
                aria-label="Search pages and sections"
                autoComplete="off"
                spellCheck={false}
                className="h-14 w-full bg-transparent text-[16.5px] text-ink placeholder:text-faint focus:outline-none"
              />
              <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint">
                ESC
              </kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto py-2">
              {results.length === 0 ? (
                <p className="px-4 py-8 text-center text-[15.5px] text-faint">
                  No page or section matches &ldquo;{query}&rdquo;.
                </p>
              ) : (
                <ul>
                  {results.map((result, index_) => (
                    <li key={result.href}>
                      <button
                        type="button"
                        onMouseEnter={() => setCursor(index_)}
                        onClick={() => go(result)}
                        className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors ${
                          cursor === index_
                            ? "bg-raised text-ink"
                            : "text-ink-soft hover:bg-raised/60"
                        }`}
                      >
                        <span className="truncate text-[15.5px]">
                          {result.title}
                        </span>
                        <span className="shrink-0 font-mono text-[12px] uppercase tracking-[0.1em] text-faint">
                          {result.subtitle}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 font-mono text-[12px] uppercase tracking-[0.1em] text-faint">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span className="ml-auto">esc close</span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
