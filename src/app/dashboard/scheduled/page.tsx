"use client";

import { CalendarPlus } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  Countdown,
  EmptyPanel,
  ErrorPanel,
  LoadingRow,
  PageHeading,
  Panel,
  PanelHead,
  PriorityTag,
  RefreshButton,
  StatusBadge,
} from "@/components/dashboard/ui";
import {
  flint,
  formatCountdown,
  formatLocal,
  intervalLabel,
  type Job,
} from "@/lib/flint-client";

/** Recurring jobs: `recurrence_id` set, `interval_seconds` non-null. */
export default function ScheduledPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setJobs(null);
    // A higher limit keeps the client-side filter accurate for busy queues.
    flint<Job[]>("/jobs?page=1&limit=100")
      .then((payload) => {
        setJobs(payload.data.filter((job) => job.interval_seconds !== null));
        setError(null);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        kicker="Scheduled"
        title="Recurring jobs"
        description="Chains that re-insert their next run on completion."
        actions={
          <>
            <Link
              href="/dashboard/schedule"
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-4 text-[13.5px] font-semibold text-black transition-colors hover:bg-white/85 active:translate-y-px"
            >
              <CalendarPlus className="size-4" weight="bold" />
              Schedule job
            </Link>
            <RefreshButton onTap={load} />
          </>
        }
      />

      {error ? (
        <div className="mt-6">
          <ErrorPanel message={error} />
        </div>
      ) : null}

      {jobs === null && !error ? (
        <div className="mt-8">
          <LoadingRow label="loading schedules…" />
        </div>
      ) : jobs !== null && jobs.length === 0 ? (
        <div className="mt-8">
          <EmptyPanel label="no recurring jobs: schedule one with an interval like 1h" />
        </div>
      ) : jobs !== null ? (
        <Panel className="mt-6 overflow-hidden">
          <PanelHead title={`${jobs.length} recurring`} />
          <table className="w-full">
            <thead>
              <tr className="bg-white/[0.028]">
                {[
                  "Type",
                  "Status",
                  "Interval",
                  "Run",
                  "Next available",
                  "Last error",
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
                  <td className="max-w-[16rem] truncate px-4 py-3 font-mono text-[13px] text-ink-soft">
                    {job.type}
                    <span className="ml-2 font-mono text-[11px] text-faint">
                      {job.id.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-muted">
                    every {intervalLabel(job.interval_seconds)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-muted">
                    {job.recurrence_id ? `#${job.recurrence_run}` : "—"}{" "}
                    <PriorityTag priority={job.priority} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px]">
                    {job.status === "pending" &&
                    new Date(job.available_at).getTime() > Date.now() ? (
                      <Countdown to={job.available_at} />
                    ) : (
                      <span className="text-muted">
                        {formatLocal(job.available_at)}
                      </span>
                    )}
                    <span className="ml-2 font-mono text-[11px] text-faint">
                      {formatCountdown(job.available_at)}
                    </span>
                  </td>
                  <td
                    className="max-w-[18rem] truncate px-4 py-3 font-mono text-[12.5px] text-failed/80"
                    title={formatLocal(job.created_at)}
                  >
                    {job.last_error ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}
    </div>
  );
}
