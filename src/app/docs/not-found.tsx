import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default function DocsNotFound() {
  return (
    <div className="px-5 py-24 sm:px-8 lg:px-10">
      <div className="max-w-[44ch]">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
          404
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-ink">
          That page is not in the corpus.
        </h1>
        <p className="mt-3 text-[14px] leading-7 text-muted">
          The docs are generated from a fixed set of pages. The overview lists
          all of them in reading order.
        </p>
        <Link
          href="/docs"
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] text-accent transition-colors hover:text-accent-bright"
        >
          <ArrowLeft className="size-3.5" weight="bold" />
          Documentation overview
        </Link>
      </div>
    </div>
  );
}
