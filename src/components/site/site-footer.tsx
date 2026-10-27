import Link from "next/link";

import { FlintLogo, GithubMark } from "@/components/brand";
import { GITHUB_URL } from "@/lib/site";

const columns = [
  {
    title: "Documentation",
    links: [
      { href: "/docs/introduction", label: "Introduction" },
      { href: "/docs/getting-started", label: "Getting started" },
      { href: "/docs/usage-guide", label: "Usage guide" },
      { href: "/docs/api-reference", label: "API reference" },
    ],
  },
  {
    title: "Operating",
    links: [
      { href: "/docs/architecture", label: "Architecture" },
      { href: "/docs/operations", label: "Operations" },
      { href: "/docs/operations#scaling", label: "Scaling workers" },
      { href: "/docs/operations#dlq-runbook", label: "DLQ runbook" },
    ],
  },
  {
    title: "Reference",
    links: [
      {
        href: "/docs/getting-started#configuration-reference",
        label: "Configuration",
      },
      { href: "/docs/operations#health-checks", label: "Health checks" },
      {
        href: "/docs/usage-guide#delivery-guarantees-read-this-once",
        label: "Delivery guarantees",
      },
      { href: "/docs/cli-reference", label: "CLI" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto grid max-w-6xl gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1.4fr_2fr]">
        <div>
          <FlintLogo />
          <p className="mt-5 max-w-xs text-[15px] leading-7 text-white/50">
            A self-hostable job scheduling service. Every accepted job is a
            Postgres row, and every transition is observable.
          </p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[13.5px] text-white/60 transition-colors hover:border-white/20 hover:text-white"
          >
            <GithubMark className="size-4" />
            View on GitHub
          </a>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          {columns.map((column) => (
            <div key={column.title}>
              <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-white/35">
                {column.title}
              </p>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[15px] text-white/55 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-[13.5px] text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            Flint is an open, API-driven scheduler. The API works without the
            UI.
          </p>
          <Link href="/docs" className="transition-colors hover:text-white/70">
            Browse the documentation
          </Link>
        </div>
      </div>
    </footer>
  );
}
