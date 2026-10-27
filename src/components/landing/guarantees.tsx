import { Reveal } from "@/components/landing/reveal";

const retries = [
  { attempt: "attempt 1", delay: "+5s" },
  { attempt: "attempt 2", delay: "+25s" },
  { attempt: "attempt 3", delay: "+125s" },
];

export function Guarantees() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
        <Reveal>
          <h2 className="max-w-[15ch] text-[clamp(2.25rem,4.6vw,3.4rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-ink">
            Work cannot quietly <span className="accent-gradient">vanish</span>.
          </h2>
          <p className="mt-5 max-w-[54ch] text-[17.5px] leading-8 text-muted">
            Every guarantee below is enforced in Postgres or in the claim query.
            None of it depends on a convention holding.
          </p>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="mt-12 grid overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-2">
            <article className="border-b border-line p-7 sm:p-9 md:border-r">
              <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-faint">
                Admission
              </p>
              <h3 className="mt-4 text-[22px] font-medium tracking-[-0.02em] text-ink">
                Committed before you hear back
              </h3>
              <p className="mt-3 text-[16px] leading-7 text-muted">
                The job is a Postgres row before the response leaves. Workers
                can crash, restart, or vanish. The row cannot.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-2.5 font-mono text-[12.5px]">
                <span className="rounded-md border border-line bg-canvas px-2.5 py-1.5 text-ink-soft">
                  POST /jobs
                </span>
                <span className="text-faint">&rarr;</span>
                <span className="rounded-md border border-completed/30 bg-completed/10 px-2.5 py-1.5 text-completed">
                  201 durable
                </span>
                <span className="text-faint">&rarr;</span>
                <span className="rounded-md border border-line bg-canvas px-2.5 py-1.5 text-muted">
                  row committed
                </span>
              </div>
            </article>

            <article className="border-b border-line p-7 sm:p-9">
              <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-faint">
                Dispatch
              </p>
              <h3 className="mt-4 text-[22px] font-medium tracking-[-0.02em] text-ink">
                One worker owns the lease
              </h3>
              <p className="mt-3 text-[16px] leading-7 text-muted">
                A single locked read picks the next eligible row. No coordinator
                to run, and no chance of two workers executing the same job.
              </p>

              <pre className="mt-7 overflow-x-auto rounded-lg border border-line bg-canvas/70 px-4 py-3.5 font-mono text-[13px] leading-6 text-ink-soft">
                <code>
                  <span className="text-faint">ORDER BY</span>{" "}
                  effective_priority, available_at{"\n"}
                  <span className="text-accent">FOR UPDATE SKIP LOCKED</span>
                </code>
              </pre>
            </article>

            <article className="border-b border-line p-7 sm:p-9 md:border-r md:border-b-0">
              <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-faint">
                Recovery
              </p>
              <h3 className="mt-4 text-[22px] font-medium tracking-[-0.02em] text-ink">
                Retries that spread out
              </h3>
              <p className="mt-3 text-[16px] leading-7 text-muted">
                Failures return to pending with a jittered delay. Attempts that
                run out park in the DLQ with the last error kept.
              </p>

              <div className="mt-7 space-y-2.5">
                {retries.map((retry, index) => (
                  <div
                    key={retry.attempt}
                    className="flex items-center justify-between border-b border-line/70 pb-2.5 font-mono text-[13px] last:border-b-0 last:pb-0"
                  >
                    <span className="text-faint">{retry.attempt}</span>
                    <span
                      className="text-ink-soft"
                      style={{ opacity: 1 - index * 0.16 }}
                    >
                      {retry.delay}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="p-7 sm:p-9">
              <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-faint">
                Graphs
              </p>
              <h3 className="mt-4 text-[22px] font-medium tracking-[-0.02em] text-ink">
                Dependencies hold the chain
              </h3>
              <p className="mt-3 text-[16px] leading-7 text-muted">
                A job runs only after every upstream job completes. A failure
                cancels the pending branches instead of leaving half a result.
              </p>

              <div className="mt-7 flex items-center gap-2 font-mono text-[12.5px]">
                {["extract", "report", "notify"].map((node, index) => (
                  <span key={node} className="flex items-center gap-2">
                    <span className="rounded-md border border-line-strong bg-canvas px-2.5 py-1.5 text-ink-soft">
                      {node}
                    </span>
                    {index < 2 ? (
                      <span className="text-faint" aria-hidden="true">
                        &rarr;
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
            </article>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
