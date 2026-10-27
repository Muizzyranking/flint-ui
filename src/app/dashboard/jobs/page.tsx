"use client";

import {
  ArrowSquareOut,
  CalendarPlus,
  TrashSimple,
  X,
  XCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Select } from "@/components/dashboard/select";
import {
  Countdown,
  EmptyPanel,
  ErrorPanel,
  LoadingRow,
  PageHeading,
  Pagination,
  Panel,
  PriorityTag,
  RefreshButton,
  StatusBadge,
} from "@/components/dashboard/ui";
import {
  type FlintApiError,
  flint,
  formatLocal,
  type HandlerInfo,
  intervalLabel,
  type Job,
  type JobStatus,
  type LogEntry,
} from "@/lib/flint-client";

const STATUSES: (JobStatus | "all")[] = [
  "all",
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
];
const PRIORITIES = ["all", "1", "2", "3"];

export default function JobsPage() {
  const [status, setStatus] = useState<JobStatus | "all">("all");
  const [type, setType] = useState("all");
  const [priority, setPriority] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [types, setTypes] = useState<string[]>([]);

  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [meta, setMeta] = useState<{
    page: number;
    limit: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState<Job | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    const query = new URLSearchParams();
    query.set("page", String(page));
    query.set("limit", "20");
    if (status !== "all") query.set("status", status);
    if (type !== "all") query.set("type", type);
    if (priority !== "all") query.set("priority", priority);
    if (search.trim()) query.set("search", search.trim());

    setJobs(null);
    flint<Job[]>(`/jobs?${query.toString()}`)
      .then((payload) => {
        setJobs(payload.data);
        setMeta(payload.meta);
        setError(null);
      })
      .catch((reason: Error) => setError(reason.message));
  }, [status, type, priority, search, page]);

  useEffect(() => {
    flint<{ handlers: HandlerInfo[] }>("/handlers")
      .then((payload) => setTypes(payload.data.handlers.map((h) => h.name)))
      .catch(() => setTypes([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Support deep links from other pages: /dashboard/jobs?q=<id>
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const q = query.get("q");
    const presetStatus = query.get("status");
    if (q) setSearch(q);
    if (presetStatus)
      setStatus(presetStatus.replace(/\.[a-z]+/g, "") as JobStatus);
  }, []);

  async function cancelJob(job: Job) {
    setActionError(null);
    try {
      const payload = await flint<Job>(`/jobs/${job.id}/cancel`, {
        method: "PATCH",
      });
      setOpen(payload.data);
      load();
    } catch (reason) {
      setActionError((reason as FlintApiError).message);
    }
  }

  async function deleteJob(job: Job) {
    setActionError(null);
    try {
      await flint(`/jobs/${job.id}`, { method: "DELETE" });
      setOpen(null);
      load();
    } catch (reason) {
      setActionError((reason as FlintApiError).message);
    }
  }

  const filtersDirty =
    status !== "all" ||
    type !== "all" ||
    priority !== "all" ||
    search.trim() !== "";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        kicker="Jobs"
        title="Job queue"
        description="Every durable row in the queue: filters map straight onto the API query."
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

      {/* Filter bar */}
      <div className="mt-7 flex flex-wrap items-center gap-2.5">
        <Select
          value={status}
          onChange={(next) => {
            setStatus(next as JobStatus | "all");
            setPage(1);
          }}
          options={STATUSES.map((option) => ({
            value: option,
            label: option === "all" ? "all statuses" : option,
          }))}
          ariaLabel="Filter by status"
        />

        <Select
          value={type}
          onChange={(next) => {
            setType(next);
            setPage(1);
          }}
          options={[
            { value: "all", label: "all types" },
            ...types.map((option) => ({ value: option, label: option })),
          ]}
          ariaLabel="Filter by job type"
          mono
        />

        <Select
          value={priority}
          onChange={(next) => {
            setPriority(next);
            setPage(1);
          }}
          options={PRIORITIES.map((option) => ({
            value: option,
            label: option === "all" ? "all priorities" : `p${option}`,
          }))}
          ariaLabel="Filter by priority"
        />

        <input
          type="text"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="search id or type…"
          aria-label="Search jobs"
          className="h-9 w-56 grow rounded-md border border-line bg-surface px-3 text-[13.5px] text-ink-soft outline-none transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent sm:grow-0"
        />

        {filtersDirty ? (
          <button
            type="button"
            onClick={() => {
              setStatus("all");
              setType("all");
              setPriority("all");
              setSearch("");
              setPage(1);
            }}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 text-[13px] text-muted transition-colors hover:text-ink"
          >
            <X className="size-3.5" weight="bold" />
            Clear
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mt-6">
          <ErrorPanel message={error} />
        </div>
      ) : null}

      {jobs === null && !error ? (
        <div className="mt-8">
          <LoadingRow label="loading jobs…" />
        </div>
      ) : jobs !== null && jobs.length === 0 ? (
        <div className="mt-8">
          <EmptyPanel label="no jobs match the current filters" />
        </div>
      ) : jobs !== null ? (
        <Panel className="mt-6 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-white/[0.028]">
                {[
                  "Type",
                  "Status",
                  "Priority",
                  "Available at",
                  "Attempts",
                  "Created",
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
                  className="group cursor-pointer transition-colors hover:bg-white/[0.018]"
                  onClick={() => setOpen(job)}
                >
                  <td className="px-4 py-3 font-mono text-[13px] text-ink-soft">
                    {job.type}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <StatusBadge status={job.status} />
                      {job.cancellation_requested ? (
                        <span className="rounded border border-failed/30 px-1.5 py-0.5 font-mono text-[11px] text-failed">
                          cancelling…
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <PriorityTag priority={job.priority} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-muted">
                    {job.status === "pending" &&
                    new Date(job.available_at).getTime() > Date.now() ? (
                      <Countdown to={job.available_at} />
                    ) : (
                      formatLocal(job.available_at)
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-muted">
                    {job.retry_count}/{job.max_retries}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-faint">
                    {formatLocal(job.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}

      {meta ? <Pagination meta={meta} onChange={setPage} /> : null}

      {open ? (
        <JobDrawer
          job={open}
          error={actionError}
          onClose={() => {
            setOpen(null);
            setActionError(null);
          }}
          onCancel={cancelJob}
          onDelete={deleteJob}
        />
      ) : null}
    </div>
  );
}

function JobDrawer({
  job,
  error,
  onClose,
  onCancel,
  onDelete,
}: {
  job: Job;
  error: string | null;
  onClose: () => void;
  onCancel: (job: Job) => void;
  onDelete: (job: Job) => void;
}) {
  const [detail, setDetail] = useState<Job | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Detail endpoint is the only one that populates dependencies and logs.
  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setDetailError(null);
    flint<Job>(`/jobs/${job.id}`)
      .then((payload) => {
        if (!cancelled) setDetail(payload.data);
      })
      .catch((reason: Error) => {
        if (!cancelled) setDetailError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  const active =
    detail?.status === "pending" || detail?.status === "processing";
  const terminal =
    detail?.status === "completed" ||
    detail?.status === "failed" ||
    detail?.status === "cancelled";
  const effective = detail ?? job;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close job detail"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <aside
        className="absolute top-0 right-0 flex h-full w-full max-w-xl flex-col border-l border-line bg-canvas"
        role="dialog"
        aria-label={`Job detail: ${effective.type}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <p className="truncate font-mono text-[15px] text-ink">
              {effective.type}
            </p>
            <p className="truncate font-mono text-[12px] text-faint">
              {effective.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {error ? (
            <div className="mb-4">
              <ErrorPanel message={error} />
            </div>
          ) : null}
          {detailError ? (
            <div className="mb-4">
              <ErrorPanel message={detailError} />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5">
            <StatusBadge status={effective.status} />
            {effective.cancellation_requested ? (
              <span className="rounded border border-failed/30 px-1.5 py-0.5 font-mono text-[11px] text-failed">
                cancelling…
              </span>
            ) : null}
            {effective.is_dlq ? (
              <span className="rounded border border-accent/40 px-1.5 py-0.5 font-mono text-[11px] text-accent-bright">
                DLQ
              </span>
            ) : null}
            <PriorityTag priority={effective.priority} />
            {intervalLabel(effective.interval_seconds) ? (
              <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">
                every {intervalLabel(effective.interval_seconds)}
              </span>
            ) : null}
          </div>

          {effective.last_error ? (
            <Panel className="mt-4 border-failed/30 bg-failed/[0.05] px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-failed">
                Last error
              </p>
              <p className="mt-1.5 font-mono text-[12.5px] leading-5 text-failed/90">
                {effective.last_error}
              </p>
            </Panel>
          ) : null}

          <dl className="mt-5 grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2.5 text-[13.5px]">
            <dt className="text-faint">Scheduled</dt>
            <dd className="font-mono text-[12.5px] text-ink-soft">
              {formatLocal(effective.scheduled_at)}
            </dd>
            <dt className="text-faint">Available</dt>
            <dd className="font-mono text-[12.5px] text-ink-soft">
              {formatLocal(effective.available_at)}
            </dd>
            <dt className="text-faint">Attempts</dt>
            <dd className="font-mono text-[12.5px] text-ink-soft">
              {effective.retry_count} / {effective.max_retries}
            </dd>
            <dt className="text-faint">Worker</dt>
            <dd className="font-mono text-[12.5px] text-ink-soft">
              {effective.worker_id ?? "—"}
            </dd>
            {effective.started_at ? (
              <>
                <dt className="text-faint">Started</dt>
                <dd className="font-mono text-[12.5px] text-ink-soft">
                  {formatLocal(effective.started_at)}
                </dd>
              </>
            ) : null}
            {effective.completed_at ? (
              <>
                <dt className="text-faint">Completed</dt>
                <dd className="font-mono text-[12.5px] text-ink-soft">
                  {formatLocal(effective.completed_at)}
                </dd>
              </>
            ) : null}
            {effective.recurrence_id ? (
              <>
                <dt className="text-faint">Recurrence</dt>
                <dd className="font-mono text-[12.5px] text-ink-soft">
                  run {effective.recurrence_run}
                </dd>
              </>
            ) : null}
          </dl>

          <div className="mt-6">
            <p className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-faint">
              Payload
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-surface p-4 font-mono text-[12.5px] leading-5 text-ink-soft">
              {JSON.stringify(effective.payload, null, 2)}
            </pre>
          </div>

          <div className="mt-6">
            <p className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-faint">
              Dependencies
            </p>
            {effective.dependencies === null ? (
              <p className="mt-2 font-mono text-[12.5px] text-faint">
                loading…
              </p>
            ) : effective.dependencies.length === 0 ? (
              <p className="mt-2 font-mono text-[12.5px] text-faint">none</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {effective.dependencies.map((id) => (
                  <li
                    key={id}
                    className="flex items-center gap-2 font-mono text-[12.5px] text-muted"
                  >
                    <ArrowSquareOut className="size-3.5 text-faint" />
                    <JobLink id={id} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6">
            <p className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-faint">
              Event log
            </p>
            {effective.logs === null ? (
              <p className="mt-2 font-mono text-[12.5px] text-faint">
                loading…
              </p>
            ) : effective.logs.length === 0 ? (
              <p className="mt-2 font-mono text-[12.5px] text-faint">
                no events yet
              </p>
            ) : (
              <ol className="mt-3 border-l border-line pl-4">
                {effective.logs.map((log: LogEntry) => (
                  <li key={log.id} className="relative pb-4">
                    <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-accent" />
                    <p className="font-mono text-[12.5px] text-ink-soft">
                      {log.event}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-5 text-muted">
                      {log.message}
                    </p>
                    <p className="mt-0.5 font-mono text-[11.5px] text-faint">
                      {formatLocal(log.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3.5">
          <Link
            href={`/dashboard/logs?job_id=${effective.id}`}
            className="inline-flex h-9 items-center rounded-md border border-line px-3 text-[13.5px] text-muted transition-colors hover:text-ink"
          >
            Open in event logs
          </Link>
          <div className="flex items-center gap-2">
            {active ? (
              <button
                type="button"
                onClick={() => onCancel(effective)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-failed/40 px-3 text-[13.5px] text-failed transition-colors hover:bg-failed/10"
              >
                <XCircle className="size-4" />
                Cancel job
              </button>
            ) : null}
            {terminal ? (
              <button
                type="button"
                onClick={() => onDelete(effective)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-failed/40 px-3 text-[13.5px] text-failed transition-colors hover:bg-failed/10"
              >
                <TrashSimple className="size-4" />
                Move to bin
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

function JobLink({ id }: { id: string }) {
  return (
    <Link
      href={`/dashboard/jobs?q=${id}`}
      className="underline decoration-accent/40 underline-offset-2 transition-colors hover:text-ink"
    >
      {id.slice(0, 8)}…
    </Link>
  );
}
