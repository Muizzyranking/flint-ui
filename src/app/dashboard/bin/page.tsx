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
  StatusBadge,
} from "@/components/dashboard/ui";
import {
  type FlintApiError,
  flint,
  formatLocal,
  type Job,
} from "@/lib/flint-client";

export default function BinPage() {
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
    flint<Job[]>(`/bin?page=${page}&limit=20`)
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

  async function restore(job: Job) {
    setError(null);
    try {
      await flint(`/bin/${job.id}/restore`, { method: "PATCH" });
      setNotice(
        `Job ${job.id.slice(0, 8)}… restored — it keeps its previous status.`,
      );
      load();
    } catch (reason) {
      setError((reason as FlintApiError).message);
    }
  }

  async function hardDelete(job: Job) {
    setError(null);
    try {
      await flint(`/bin/${job.id}`, { method: "DELETE" });
      setNotice(
        `Job ${job.id.slice(0, 8)}… permanently deleted (logs cascade).`,
      );
      setConfirming(null);
      load();
    } catch (reason) {
      setError((reason as FlintApiError).message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        kicker="Bin"
        title="Soft-deleted jobs"
        description="Rows live here until you restore them or delete them permanently. Restore keeps the former status."
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
          <LoadingRow label="loading bin…" />
        </div>
      ) : jobs !== null && jobs.length === 0 ? (
        <div className="mt-8">
          <EmptyPanel label="bin is empty" />
        </div>
      ) : jobs !== null ? (
        <Panel className="mt-6">
          <PanelHead title={`${meta?.total ?? jobs.length} in bin`} />
          <table className="w-full">
            <thead>
              <tr className="bg-white/[0.028]">
                {[
                  "Type",
                  "Status was",
                  "Deleted at",
                  "Last error",
                  "Actions",
                ].map((head) => (
                  <th
                    key={head}
                    className="px-4 py-2.5 text-left font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-faint"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className="transition-colors hover:bg-white/[0.018]"
                >
                  <td className="max-w-[14rem] truncate px-4 py-3 font-mono text-[13px] text-ink-soft">
                    {job.type}
                    <span className="ml-2 font-mono text-[11px] text-faint">
                      {job.id.slice(0, 8)}
                    </span>
                    <span className="ml-2">
                      <PriorityTag priority={job.priority} />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-muted">
                    {formatLocal(job.created_at)}
                  </td>
                  <td
                    className="max-w-[18rem] truncate px-4 py-3 font-mono text-[12.5px] text-failed/80"
                    title={formatLocal(job.scheduled_at)}
                  >
                    {job.last_error ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => restore(job)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-completed/40 px-2.5 text-[13px] text-completed transition-colors hover:bg-completed/10"
                      >
                        <ArrowCounterClockwise
                          className="size-3.5"
                          weight="bold"
                        />
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(job.id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-failed/40 px-2.5 text-[13px] text-failed transition-colors hover:bg-failed/10"
                      >
                        <TrashSimple className="size-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {jobs.some((job) => confirming === job.id) ? (
            <div className="border-t border-line px-4 py-3">
              <p className="text-[13.5px] text-failed">
                Hard delete cascades to this job's logs and dependency edges.
                This cannot be undone.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const job = jobs.find(
                      (candidate) => confirming === candidate.id,
                    );
                    if (job) hardDelete(job);
                  }}
                  className="rounded-md border border-failed/40 px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.08em] text-failed transition-colors hover:bg-failed/10"
                >
                  Delete permanently
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="rounded-md border border-line px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.08em] text-muted transition-colors hover:text-ink"
                >
                  Keep
                </button>
              </div>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {meta ? <Pagination meta={meta} onChange={setPage} /> : null}
    </div>
  );
}
