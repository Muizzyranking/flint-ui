import { Reveal } from "@/components/landing/reveal";

const capabilities = [
  {
    title: "Priority with aging",
    body: "1 is urgent, 3 is background. Old low-priority rows age up, so they cannot starve behind a stream of new work.",
    example: "priority: 1",
  },
  {
    title: "Scheduled runs",
    body: "Set a future time once. The row waits until it is due, survives restarts, and needs no clock process to wake it.",
    example: "scheduled_at: 2026-11-01T09:00:00Z",
  },
  {
    title: "Recurring work",
    body: "Pass an interval and the next run is inserted in the same commit as completion. A chain cannot duplicate itself.",
    example: 'interval: "15m"',
  },
  {
    title: "Dependency graphs",
    body: "Fan out to many jobs, then fan back in. Downstream work waits for every parent, and failures cascade.",
    example: 'dependency_ids: ["0f5f2f5e"]',
  },
];

export function Capabilities() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
        <Reveal>
          <h2 className="max-w-[14ch] text-[clamp(2.25rem,4.6vw,3.4rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-ink">
            More than a <span className="accent-gradient">delayed</span> call.
          </h2>
          <p className="mt-5 max-w-[56ch] text-[17.5px] leading-8 text-muted">
            Priority, future runs, recurrence, and dependency graphs are
            first-class options on the same request.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-16">
          <Reveal>
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-faint">
                  POST /api/v1/jobs
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
                  json
                </span>
              </div>
              <pre className="overflow-x-auto px-4 py-4 font-mono text-[13.5px] leading-7 text-ink-soft">
                <code>
                  <span className="text-faint">{`{`}</span>
                  {"\n  "}
                  <span className="text-accent-bright">&quot;type&quot;</span>
                  <span className="text-faint">: </span>
                  <span className="text-completed">
                    &quot;webhook_delivery&quot;
                  </span>
                  <span className="text-faint">,</span>
                  {"\n  "}
                  <span className="text-accent-bright">
                    &quot;payload&quot;
                  </span>
                  <span className="text-faint">: {`{`} </span>
                  <span className="text-accent-bright">&quot;url&quot;</span>
                  <span className="text-faint">: </span>
                  <span className="text-completed">
                    &quot;https://example.com/hook&quot;
                  </span>
                  <span className="text-faint"> {`}`},</span>
                  {"\n  "}
                  <span className="text-accent-bright">
                    &quot;priority&quot;
                  </span>
                  <span className="text-faint">: </span>
                  <span className="text-processing">1</span>
                  <span className="text-faint">,</span>
                  {"\n  "}
                  <span className="text-accent-bright">
                    &quot;scheduled_at&quot;
                  </span>
                  <span className="text-faint">: </span>
                  <span className="text-completed">
                    &quot;2026-11-01T09:00:00Z&quot;
                  </span>
                  <span className="text-faint">,</span>
                  {"\n  "}
                  <span className="text-accent-bright">
                    &quot;interval&quot;
                  </span>
                  <span className="text-faint">: </span>
                  <span className="text-completed">&quot;15m&quot;</span>
                  <span className="text-faint">,</span>
                  {"\n  "}
                  <span className="text-accent-bright">
                    &quot;dependency_ids&quot;
                  </span>
                  <span className="text-faint">: [</span>
                  <span className="text-completed">&quot;0f5f2f5e&quot;</span>
                  <span className="text-faint">]</span>
                  {"\n"}
                  <span className="text-faint">{`}`}</span>
                </code>
              </pre>
            </div>

            <p className="mt-5 max-w-[42ch] text-[15px] leading-7 text-faint">
              One endpoint for all of it. A 201 means the work is durable, not
              queued in memory.
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="border-t border-line">
              {capabilities.map((capability) => (
                <div
                  key={capability.title}
                  className="border-b border-line py-7"
                >
                  <div className="flex items-baseline justify-between gap-6">
                    <h3 className="text-[20px] font-medium tracking-[-0.015em] text-ink">
                      {capability.title}
                    </h3>
                    <code className="hidden shrink-0 font-mono text-[12.5px] text-faint sm:block">
                      {capability.example}
                    </code>
                  </div>
                  <p className="mt-2.5 max-w-[50ch] text-[16px] leading-7 text-muted">
                    {capability.body}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
