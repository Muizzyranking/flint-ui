import { LifecycleFlow } from "@/components/landing/lifecycle-flow";
import { Reveal } from "@/components/landing/reveal";

export function Lifecycle() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
        <Reveal>
          <h2 className="max-w-[17ch] text-[clamp(2.5rem,5vw,3.75rem)] leading-[1.02] font-semibold tracking-[-0.05em] text-ink">
            From POST to <span className="accent-gradient">settled</span>.
          </h2>
          <p className="mt-5 max-w-[56ch] text-[17.5px] leading-8 text-white/55">
            Five states, one eligibility clock, and a lease a worker has to keep
            renewing. A job settles once, as completed, failed, or cancelled.
          </p>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="mt-12">
            <LifecycleFlow />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
