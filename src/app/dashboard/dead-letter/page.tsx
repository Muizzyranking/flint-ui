"use client";

import { ArrowCounterClockwise, TrashSimple } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

import {
  EmptyPanel,
  ErrorPanel,
  LoadingRow,
  PageHeading,
  Pagination,
  Panel,
  PanelHead,
  PriorityTag,
  RefreshButton,
} from "@/components/dashboard/ui";
import {
  type FlintApiError,
  flint,
  formatLocal,
  type Job,
} from "@/lib/flint-client";

export default function DeadLetterPage() {
  const [page, setPage] = useState(1);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [meta, setMeta] = useState<{
    page: number;
    limit: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(() => {
    setJobs(null);
    flint<Job[]>(`/dlq?page=${page}&limit=20`)
      .then((payload) => {
        setJobs(payload.data);
        setMeta(payload.meta);
        setError(null);
      })
      .catch((reason: Error) => setError(reason.message));
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  async function retry(job: Job) {
    setError(null);
    try {
      await flint(`/dlq/${job.id}/retry`, { method: "POST" });
      setNotice(
        `Job ${job.id.slice(0, 8)}… requeued as pending with attempts reset.`,
      );
      load();
    } catch (reason) {
      setError((reason as FlintApiError).message);
    }
  }

  async function discard(job: Job) {
    setError(null);
    try {
      await flint(`/dlq/${job.id}`, { method: "DELETE" });
      setNotice(`Job ${job.id.slice(0, 8)}… moved to the bin.`);
      setConfirming(null);
      load();
    } catch (reason) {
      setError((reason as FlintApiError).message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        kicker="Dead letter queue"
        title="Failed and parked"
        description="Jobs that exhausted their retries. Replay them, or move them to the bin."
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

      {jobs === null && !error ? (
        <div className="mt-8">
          <LoadingRow label="loading DLQ…" />
        </div>
      ) : jobs !== null && jobs.length === 0 ? (
        <div className="mt-8">
          <EmptyPanel label="dead letter queue is empty — jobs ran clean" />
        </div>
      ) : jobs !== null ? (
        <Panel className="mt-6">
          <PanelHead
            title={`${meta?.total ?? jobs.length} in queue`}
            detail={
              meta && Math.ceil(meta.total / meta.limit) > 1 ? (
                <span className="font-mono text-[11.5px] text-faint">
                  page {meta.page}
                </span>
              ) : null
            }
          />
          <ul className="divide-y divide-line">
            {jobs.map((job) => (
              <li key={job.id} className="px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[13.5px] text-ink-soft">
                      {job.type}
                      <span className="ml-2 text-faint">
                        {job.id.slice(0, 8)}…
                      </span>
                      <span className="ml-2">
                        <PriorityTag priority={job.priority} />
                      </span>
                    </p>
                    <p className="mt-1 font-mono text-[12px] text-faint">
                      attempt {job.retry_count}/{job.max_retries} · failed{" "}
                      {job.completed_at ? formatLocal(job.completed_at) : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => retry(job)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-completed/40 px-2.5 text-[13px] text-completed transition-colors hover:bg-completed/10"
                    >
                      <ArrowCounterClockwise
                        className="size-3.5"
                        weight="bold"
                      />
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(job.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-failed/40 px-2.5 text-[13px] text-failed transition-colors hover:bg-failed/10"
                    >
                      <TrashSimple className="size-3.5" />
                      Discard
                    </button>
                  </div>
                </div>
                {confirming === job.id ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-failed/30 bg-failed/[0.06] px-3 py-2.5">
                    <p className="text-[13.5px] text-failed">
                      Discard permanently? The job moves to the bin, where it
                      can still be restored or hard-deleted.
                    </p>
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => discard(job)}
                        className="rounded-md border border-failed/40 px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.08em] text-failed transition-colors hover:bg-failed/10"
                      >
                        Discard to bin
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="rounded-md border border-line px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.08em] text-muted transition-colors hover:text-ink"
                      >
                        Keep
                      </button>
                    </span>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {meta ? <Pagination meta={meta} onChange={setPage} /> : null}
    </div>
  );
}
