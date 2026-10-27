import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocPager } from "@/components/docs/doc-pager";
import { DocToc } from "@/components/docs/doc-toc";
import { docStaticParams, getDocNeighbors, getDocPage } from "@/lib/docs";

type PageParams = { params: Promise<{ slug: string[] }> };

export function generateStaticParams() {
  return docStaticParams;
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocPage(slug);

  if (!page) return {};

  return {
    title: page.title,
    description: page.description,
  };
}

export const instant = false;
export default async function DocumentationPage({ params }: PageParams) {
  const { slug } = await params;
  const page = getDocPage(slug);

  if (!page) notFound();

  const { previous, next } = getDocNeighbors(slug);

  return (
    <div className="flex gap-14 px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
      <article className="min-w-0 max-w-[55rem] flex-1">
        <div className="mb-8 flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.14em] text-faint">
          <Link href="/docs" className="transition-colors hover:text-ink-soft">
            Docs
          </Link>
          <span className="text-line-strong">/</span>
          <span>{page.group}</span>
        </div>

        <details className="mb-8 rounded-lg border border-line bg-surface px-4 py-3 xl:hidden">
          <summary className="cursor-pointer font-mono text-[12px] uppercase tracking-[0.14em] text-accent-bright/70">
            On this page
          </summary>
          <ul className="mt-3 grid gap-1.5">
            {page.headings.map((heading) => (
              <li
                key={heading.id}
                className={heading.depth === 3 ? "pl-4" : ""}
              >
                <a
                  href={`#${heading.id}`}
                  className="text-[14.5px] text-muted transition-colors hover:text-ink"
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </details>

        <div
          className="docs-prose"
          dangerouslySetInnerHTML={{ __html: page.html }}
        />

        <DocPager previous={previous} next={next} />
      </article>

      <aside className="hidden w-52 shrink-0 xl:block">
        <DocToc headings={page.headings} />
      </aside>
    </div>
  );
}
