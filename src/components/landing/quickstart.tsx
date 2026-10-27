import { Suspense } from "react";

import { CodeTabs } from "@/components/landing/code-tabs";
import { DeploymentFacts } from "@/components/landing/deployment-facts";
import { Reveal } from "@/components/landing/reveal";

function FactsFallback() {
  return (
    <div className="flex items-center gap-2 border-t border-line pt-5 font-mono text-[12px] text-faint">
      <span className="size-2 rounded-full bg-line-strong" />
      Checking the deployment
    </div>
  );
}

export function Quickstart() {
  return (
    <section id="quickstart" className="scroll-mt-20 border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-16">
          <Reveal>
            <h2 className="max-w-[15ch] text-[clamp(2.25rem,4.6vw,3.4rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-ink">
              Running in about a <span className="accent-gradient">minute</span>
              .
            </h2>
            <p className="mt-5 max-w-[42ch] text-[17.5px] leading-8 text-muted">
              Compose brings up Postgres, Redis, the API, and a worker. Then
              schedule a job and inspect the result.
            </p>

            <dl className="mt-9 space-y-3.5 border-t border-line pt-6">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[15px] text-muted">API</dt>
                <dd className="font-mono text-[13px] text-ink-soft">
                  127.0.0.1:8000
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[15px] text-muted">Local API key</dt>
                <dd className="font-mono text-[13px] text-ink-soft">
                  dev-api-key
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[15px] text-muted">MailHog</dt>
                <dd className="font-mono text-[13px] text-ink-soft">
                  127.0.0.1:8025
                </dd>
              </div>
            </dl>

            <div className="mt-7">
              <Suspense fallback={<FactsFallback />}>
                <DeploymentFacts />
              </Suspense>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <CodeTabs />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
