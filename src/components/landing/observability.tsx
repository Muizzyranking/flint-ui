import { Reveal } from "@/components/landing/reveal";

const runbook = [
  {
    label: "DLQ alerts",
    body: "Set a threshold and recipients. The running fleet reads both without a restart.",
    code: "dlq_threshold",
  },
  {
    label: "One-call replay",
    body: "Reset attempts and revive the dependents a failure cancelled along the way.",
    code: "POST /dlq/{id}/retry",
  },
  {
    label: "Worker control",
    body: "Stop or restart a worker calmly. Presence lives in Redis with a 60 second TTL.",
    code: "POST /workers/{id}/stop",
  },
  {
    label: "Honest probes",
    body: "Readiness fails only when Postgres is unreachable. A degraded Redis stays up.",
    code: "/health/ready",
  },
];

const terminal = [
  { method: "GET ", path: "/api/v1/dlq" },
  { method: "POST", path: "/api/v1/dlq/{id}/retry" },
  { method: "GET ", path: "/api/v1/workers" },
];

export function Observability() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <Reveal>
          <h2 className="max-w-[15ch] text-[clamp(2.25rem,4.6vw,3.4rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-ink">
            Built for the <span className="accent-gradient">pager</span>.
          </h2>
          <p className="mt-5 max-w-[56ch] text-[17.5px] leading-8 text-muted">
            The UI is optional. Counts, worker controls, retries, and queue
            health are already in the API.
          </p>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-12 overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
              {runbook.map((item) => (
                <div key={item.label} className="p-6">
                  <h3 className="text-[16px] font-medium tracking-[-0.01em] text-ink">
                    {item.label}
                  </h3>
                  <p className="mt-2.5 text-[15px] leading-7 text-muted">
                    {item.body}
                  </p>
                  <p className="mt-5 truncate font-mono text-[12px] text-faint">
                    {item.code}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-line bg-canvas/60 px-6 py-5">
              <div className="flex items-center justify-between pb-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                  Operator calls
                </span>
                <span className="font-mono text-[11px] text-faint">
                  X-API-Key
                </span>
              </div>
              <div className="space-y-2">
                {terminal.map((line) => (
                  <div
                    key={line.path}
                    className="flex gap-3 overflow-x-auto font-mono text-[13px] leading-6 whitespace-nowrap"
                  >
                    <span className="text-accent-bright">{line.method}</span>
                    <span className="text-muted">{line.path}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
