"use client";

import { ArrowsClockwise, Cpu, Pause } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

import {
  EmptyPanel,
  ErrorPanel,
  LoadingRow,
  PageHeading,
  Panel,
  RefreshButton,
} from "@/components/dashboard/ui";
import { type FlintApiError, flint, type Worker } from "@/lib/flint-client";

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setWorkers(null);
    flint<Worker[]>("/workers")
      .then((payload) => {
        setWorkers(payload.data);
        setError(null);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function control(worker: Worker, command: "stop" | "restart") {
    setError(null);
    try {
      await flint(`/workers/${worker.worker_id}/${command}`, {
        method: "POST",
      });
      setNotice(
        `${command} published to ${worker.worker_id} — it exits gracefully via the orchestrator.`,
      );
      load();
    } catch (reason) {
      setError((reason as FlintApiError).message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        kicker="Workers"
        title="Worker fleet"
        description="Presence registers in Redis with a 60-second TTL; job execution stays durable in Postgres regardless."
        actions={<RefreshButton onTap={load} />}
      />

      {error ? (
        <div className="mt-6">
          <ErrorPanel message={error} />
        </div>
      ) : null}
      {notice ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-completed/30 bg-completed/[0.06] px-4 py-3">
          <p className="text-[14px] leading-6 text-completed">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded-md border border-completed/40 px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.08em] text-completed transition-colors hover:text-white"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {workers === null && !error ? (
        <div className="mt-8">
          <LoadingRow label="loading fleet…" />
        </div>
      ) : workers !== null && workers.length === 0 ? (
        <div className="mt-8">
          <EmptyPanel label="no workers registered — jobs still schedule and run once a worker polls" />
        </div>
      ) : workers !== null ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {workers.map((worker) => (
            <Panel key={worker.worker_id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Cpu
                    className="mt-0.5 size-5 shrink-0 text-accent-bright"
                    weight="regular"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[13.5px] text-ink-soft">
                      {worker.worker_id}
                    </p>
                    <p className="mt-1 font-mono text-[12px] text-faint">
                      ttl {worker.ttl_seconds}s
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[11.5px] ${
                    worker.status === "busy"
                      ? "border-processing/30 text-processing"
                      : "border-completed/30 text-completed"
                  }`}
                >
                  {worker.status}
                </span>
              </div>

              {worker.capabilities.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {worker.capabilities.map((capability) => (
                    <span
                      key={capability}
                      className="rounded border border-line bg-canvas px-1.5 py-0.5 font-mono text-[11.5px] text-muted"
                    >
                      {capability}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => control(worker, "stop")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-[13px] text-muted transition-colors hover:border-white/20 hover:text-ink"
                >
                  <Pause className="size-3.5" />
                  Stop
                </button>
                <button
                  type="button"
                  onClick={() => control(worker, "restart")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-[13px] text-muted transition-colors hover:border-white/20 hover:text-ink"
                >
                  <ArrowsClockwise className="size-3.5" />
                  Restart
                </button>
                <span className="ml-auto font-mono text-[11px] text-faint">
                  finishes in-flight first
                </span>
              </div>
            </Panel>
          ))}
        </div>
      ) : null}
    </div>
  );
}
