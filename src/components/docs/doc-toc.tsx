"use client";

import { useEffect, useState } from "react";

type Heading = { id: string; text: string; depth: number };

export function DocToc({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState(headings[0]?.id ?? "");

  useEffect(() => {
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-88px 0px -68% 0px", threshold: 0 },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-3">
      <p className="font-mono text-[12.5px] uppercase tracking-[0.14em] text-accent-bright/70">
        On this page
      </p>
      <ul className="mt-3 border-l border-line">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={`-ml-px block border-l py-1.5 text-[14.5px] leading-6 transition-colors ${
                heading.depth === 3 ? "pl-6" : "pl-3"
              } ${
                active === heading.id
                  ? "border-accent text-ink"
                  : "border-transparent text-faint hover:text-ink-soft"
              }`}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
