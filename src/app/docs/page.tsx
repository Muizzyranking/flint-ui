import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { allDocs, docNav, readingPaths } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "The complete Flint documentation: run the stack, schedule jobs, read the API contract, write handlers, and operate the service.",
};

const pageByHref = new Map(allDocs.map((page) => [page.href, page]));

export default function DocsOverview() {
  return (
    <div className="px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
      <div className="max-w-[54rem]">
        <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-accent-bright/80">
          Flint documentation
        </p>
        <h1 className="mt-4 text-[clamp(2.3rem,4.6vw,3rem)] font-semibold leading-[1.08] tracking-[-0.04em] text-ink">
          Everything between{" "}
          <code className="font-mono text-[0.82em] text-accent-bright">
            POST
          </code>{" "}
          and completed.
        </h1>
        <p className="mt-5 max-w-[58ch] text-[17.5px] leading-8 text-muted">
          Eight pages, one contract. Start with the model, run it locally, then
          read the endpoint shapes when you build against it.
        </p>

        <div className="mt-10 border-t border-line">
          {readingPaths.map((path) => (
            <div
              key={path.label}
              className="grid gap-3 border-b border-line py-5 sm:grid-cols-[13rem_1fr] sm:gap-6"
            >
              <div>
                <h2 className="text-[16.5px] font-medium text-ink">
                  {path.label}
                </h2>
                <p className="mt-1.5 text-[14px] leading-6 text-faint">
                  {path.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                {path.items.map((href, index) => {
                  const page = pageByHref.get(href);
                  if (!page) return null;

                  return (
                    <span key={href} className="flex items-center gap-2">
                      <Link
                        href={href}
                        className="rounded-md border border-line bg-surface px-3 py-2 text-[14.5px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
                      >
                        {page.title}
                      </Link>
                      {index < path.items.length - 1 ? (
                        <ArrowRight
                          className="size-3 text-faint"
                          weight="bold"
                        />
                      ) : null}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14">
          <h2 className="text-[16.5px] font-medium text-ink">All pages</h2>
          <div className="mt-4 space-y-8">
            {docNav.map((group) => (
              <div key={group.label}>
                <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-accent-bright/70">
                  {group.label}
                </p>
                <ul className="mt-2 border-t border-line">
                  {group.items.map((item) => (
                    <li key={item.href} className="border-b border-line">
                      <Link
                        href={item.href}
                        className="group flex items-start justify-between gap-6 py-4"
                      >
                        <span>
                          <span className="block text-[16.5px] text-ink-soft transition-colors group-hover:text-ink">
                            {item.title}
                          </span>
                          <span className="mt-1.5 block max-w-[60ch] text-[15px] leading-7 text-faint">
                            {item.description}
                          </span>
                        </span>
                        <ArrowRight
                          className="mt-1 size-3.5 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent-bright"
                          weight="bold"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-12 border-t border-line pt-5 text-[14px] leading-6 text-faint">
          The API reference is the wire contract. The docs describe behaviour;
          the envelope, field names, and status codes there are authoritative.
        </p>
      </div>
    </div>
  );
}
