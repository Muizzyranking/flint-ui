"use client";

import { ArrowLeft, ArrowRight, ArrowsClockwise } from "@phosphor-icons/react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";

import { formatCountdown, type Meta } from "@/lib/flint-client";

/* -------------------------------------------------------------- */
/* Page scaffold                                                   */
/* -------------------------------------------------------------- */

export function PageHeading({
  kicker,
  title,
  description,
  actions,
}: {
  kicker: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-accent-bright/80">
          {kicker}
        </p>
        <h1 className="mt-2 text-[clamp(1.7rem,3.4vw,2.3rem)] font-semibold leading-[1.08] tracking-[-0.035em] text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[56ch] text-[15px] leading-7 text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2.5">{actions}</div>
      ) : null}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-line bg-surface ${className}`}>
      {children}
    </div>
  );
}

export function PanelHead({
  title,
  detail,
}: {
  title: string;
  detail?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
      <span className="font-mono text-[12.5px] uppercase tracking-[0.12em] text-faint">
        {title}
      </span>
      {detail}
    </div>
  );
}

export function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center font-mono text-[13px] text-faint">
      {label}
    </div>
  );
}

export function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-1 py-2 font-mono text-[13px] text-faint">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-2 animate-ping rounded-full bg-accent-bright opacity-50" />
        <span className="relative inline-flex size-2 rounded-full bg-accent-bright" />
      </span>
      {label}
    </div>
  );
}

export function ErrorPanel({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-failed/30 bg-failed/[0.06] px-4 py-3">
      <p className="text-[14.5px] leading-6 text-failed">{message}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-failed/30 px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.08em] text-failed/80 transition-colors hover:text-failed"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- */
/* Badges                                                          */
/* -------------------------------------------------------------- */

const statusTone: Record<string, string> = {
  pending: "text-pending border-pending/30 bg-pending/10",
  processing: "text-processing border-processing/30 bg-processing/10",
  completed: "text-completed border-completed/30 bg-completed/10",
  failed: "text-failed border-failed/30 bg-failed/10",
  cancelled: "text-cancelled border-cancelled/30 bg-cancelled/10",
  busy: "text-processing border-processing/30 bg-processing/10",
  ready: "text-completed border-completed/30 bg-completed/10",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[11.5px] ${
        statusTone[status] ?? "text-cancelled border-line bg-white/[0.04]"
      }`}
    >
      {status}
      {status === "processing" ? "…" : ""}
    </span>
  );
}

const priorityTone: Record<number, string> = {
  1: "text-failed border-failed/30",
  2: "text-pending border-pending/30",
  3: "text-cancelled border-cancelled/30",
};

export function PriorityTag({ priority }: { priority: number }) {
  return (
    <span
      className={`shrink-0 rounded border bg-transparent px-1.5 py-0.5 font-mono text-[11.5px] ${
        priorityTone[priority] ?? "text-cancelled border-cancelled/30"
      }`}
    >
      p{priority}
    </span>
  );
}

/* -------------------------------------------------------------- */
/* Pagination                                                      */
/* -------------------------------------------------------------- */

export function Pagination({
  meta,
  onChange,
}: {
  meta: Exclude<Meta, null>;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(meta.total / meta.limit));
  if (pages <= 1 && meta.page === 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="font-mono text-[12.5px] text-faint">
        page {meta.page} of {pages} · {meta.total} total
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={meta.page <= 1}
          onClick={() => onChange(meta.page - 1)}
          className="inline-flex size-8 items-center justify-center rounded-full border border-line bg-white/[0.04] text-white/60 transition-colors hover:border-white/20 hover:text-white disabled:opacity-30 disabled:hover:border-line disabled:hover:text-white/60"
          aria-label="Previous page"
        >
          <ArrowLeft className="size-3.5" weight="bold" />
        </button>
        <button
          type="button"
          disabled={meta.page >= pages}
          onClick={() => onChange(meta.page + 1)}
          className="inline-flex size-8 items-center justify-center rounded-full border border-line bg-white/[0.04] text-white/60 transition-colors hover:border-white/20 hover:text-white disabled:opacity-30 disabled:hover:border-line disabled:hover:text-white/60"
          aria-label="Next page"
        >
          <ArrowRight className="size-3.5" weight="bold" />
        </button>
      </div>
    </div>
  );
}

/** Manual refresh affordance shared by all live-ish panels. */
export function RefreshButton({
  onTap,
  title = "Refresh",
}: {
  onTap: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      title={title}
      aria-label={title}
      className="inline-flex size-8 items-center justify-center rounded-full border border-line bg-white/[0.04] text-white/55 transition-colors hover:border-white/20 hover:text-white"
    >
      <ArrowsClockwise className="size-4" />
    </button>
  );
}

/* -------------------------------------------------------------- */
/* Countdown (available_at waits)                                  */
/* -------------------------------------------------------------- */

/** Tick per second so `available_at` waits render as live countdowns. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

export function Countdown({ to }: { to: string }) {
  const now = useNow();
  const target = new Date(to).getTime();

  if (Number.isNaN(target)) return <span>{to}</span>;
  if (target <= now) return <span className="text-completed">due</span>;

  return (
    <span
      className="text-pending"
      title={`${formatCountdown(to)} remaining (recomputed each second)`}
    >
      in {formatCountdown(to)}
    </span>
  );
}

/* -------------------------------------------------------------- */
/* Table row link (detail affordance)                              */
/* -------------------------------------------------------------- */

export function JobLink({ id }: { id: string }) {
  return (
    <Link
      href={`/dashboard/jobs?q=${id}`}
      className="font-mono text-[12.5px] text-accent-bright/80 underline decoration-accent/40 underline-offset-2 transition-colors hover:text-accent-bright"
    >
      {id.slice(0, 8)}
    </Link>
  );
}
