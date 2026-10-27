"use client";

import { List, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { FlintLogo, GithubMark } from "@/components/brand";
import { GITHUB_URL } from "@/lib/site";

const links = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/api-reference", label: "API reference" },
  { href: "/docs/architecture", label: "Architecture" },
  { href: "/docs/operations", label: "Operations" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <FlintLogo />

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[15px] text-white/55 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Flint on GitHub"
            className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:border-white/20 hover:text-white"
          >
            <GithubMark className="size-4" />
          </a>

          <Link
            href="/dashboard"
            className="hidden h-9 items-center rounded-full bg-white px-4 text-[15px] font-semibold text-black transition-colors hover:bg-white/85 active:translate-y-px sm:inline-flex"
          >
            View dashboard
          </Link>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:text-white md:hidden"
          >
            {open ? <X className="size-4" /> : <List className="size-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="mobile-nav"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-white/[0.06] bg-black md:hidden"
          >
            <nav
              className="mx-auto flex max-w-6xl flex-col px-5 py-2"
              aria-label="Mobile"
            >
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-white/[0.06] py-3 text-[16px] text-white/75 last:border-b-0"
                >
                  {link.label}
                </Link>
              ))}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2 border-b border-white/[0.06] py-3 text-[16px] text-white/75"
              >
                <GithubMark className="size-4" />
                GitHub
              </a>
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="my-3 rounded-full bg-white px-4 py-2.5 text-center text-[15px] font-semibold text-black"
              >
                View dashboard
              </Link>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
