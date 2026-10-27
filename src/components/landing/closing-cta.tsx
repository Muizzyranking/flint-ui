import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { FlintMark } from "@/components/brand";
import { Reveal } from "@/components/landing/reveal";

export function ClosingCta() {
  return (
    <section className="relative overflow-hidden">
      <div className="accent-wash pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-line bg-surface px-7 py-12 sm:px-12 lg:py-16">
            <FlintMark className="pointer-events-none absolute -top-10 -right-8 size-56 text-accent/[0.045] sm:size-72" />

            <h2 className="max-w-[14ch] text-[clamp(2.5rem,5vw,3.8rem)] leading-[1] font-semibold tracking-[-0.05em] text-ink">
              Start with a job, not a{" "}
              <span className="accent-gradient">platform</span>.
            </h2>
            <p className="mt-5 max-w-[46ch] text-[17.5px] leading-8 text-muted">
              Compose brings up Postgres, Redis, the API, and a worker. The docs
              cover everything after that.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/docs/getting-started"
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-[15.5px] font-semibold text-black transition-colors duration-200 hover:bg-white/85 active:translate-y-px"
              >
                Get started
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  weight="bold"
                />
              </Link>
              <Link
                href="/docs/api-reference"
                className="inline-flex h-12 items-center rounded-full border border-white/10 bg-white/[0.04] px-6 text-[15px] font-medium text-white/70 transition-colors duration-200 hover:border-white/20 hover:text-white active:translate-y-px"
              >
                See the API
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
