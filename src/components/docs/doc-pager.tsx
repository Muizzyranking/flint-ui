import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

type Neighbor = { href: string; title: string } | undefined;

export function DocPager({
  previous,
  next,
}: {
  previous: Neighbor;
  next: Neighbor;
}) {
  return (
    <nav
      aria-label="Documentation pages"
      className="mt-16 grid gap-3 border-t border-line pt-6 sm:grid-cols-2"
    >
      {previous ? (
        <Link
          href={previous.href}
          className="group rounded-lg border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong hover:bg-raised"
        >
          <span className="flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.12em] text-accent-bright/60">
            <ArrowLeft className="size-3" weight="bold" />
            Previous
          </span>
          <span className="mt-1.5 block text-[16px] text-ink-soft transition-colors group-hover:text-ink">
            {previous.title}
          </span>
        </Link>
      ) : (
        <div className="hidden sm:block" />
      )}

      {next ? (
        <Link
          href={next.href}
          className="group rounded-lg border border-line bg-surface px-4 py-3 text-right transition-colors hover:border-line-strong hover:bg-raised"
        >
          <span className="flex items-center justify-end gap-1.5 font-mono text-[12px] uppercase tracking-[0.12em] text-accent-bright/60">
            Next
            <ArrowRight className="size-3" weight="bold" />
          </span>
          <span className="mt-1.5 block text-[16px] text-ink-soft transition-colors group-hover:text-ink">
            {next.title}
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
