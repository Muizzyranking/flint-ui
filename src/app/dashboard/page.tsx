"use client";

import {
  ArrowRight,
  CheckCircle,
  CircleNotch,
  Fire,
  Pause,
  Stack,
  XCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  EmptyPanel,
  ErrorPanel,
  LoadingRow,
  PageHeading,
  Panel,
  PanelHead,
  RefreshButton,
  StatusBadge,
} from "@/components/dashboard/ui";
import {
  type DashboardStats,
  flint,
  type HandlerInfo,
} from "@/lib/flint-client";
import { type FlintEvent, useFlintEvents } from "@/lib/flint-events";

type StatsCard = {
  key: string;
  label: string;
  href: string;
  icon: typeof Stack;
  tone: string;
};

const cards: StatsCard[] = [
  {
    key: "pending",
    label: "Pending",
    href: "/dashboard/jobs?status=pending",
    icon: CircleNotch,
    tone: "text-pending",
  },
  {
    key: "processing",
    label: "Processing",
    href: "/dashboard/jobs?status=processing",
    icon: Stack,
    tone: "text-processing",
  },
  {
    key: "completed",
    label: "Completed",
    href: "/dashboard/jobs?status=completed",
    icon: CheckCircle,
    tone: "text-completed",
  },
  {
    key: "failed",
    label: "Failed",
    href: "/dashboard/jobs?status=failed",
    icon: XCircle,
    tone: "text-failed",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    href: "/dashboard/jobs?status=cancelled",
    icon: Pause,
    tone: "text-cancelled",
  },
  {
    key: "dlq",
    label: "Dead letter",
    href: "/dashboard/dead-letter",
    icon: Fire,
    tone: "text-accent-bright",
  },
];

export default function OverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [handlers, setHandlers] = useState<HandlerInfo[] | null>(null);
  const [events, setEvents] = useState<FlintEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState(false);

  const loadStats = useCallback(() => {
    flint<DashboardStats>("/dashboard/stats")
      .then((payload) => {
        setStats(payload.data);
        setError(null);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const loadHandlers = useCallback(() => {
    flint<{ handlers: HandlerInfo[] }>("/handlers")
      .then((payload) => {
        setHandlers(payload.data.handlers);
        setError(null);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    loadStats();
    loadHandlers();
  }, [loadStats, loadHandlers]);

  // Every transition refreshes the counts and feeds the activity log.
  const onEvent = useCallback(
    (event: FlintEvent) => {
      setStreamError(false);
      setEvents((current) => [event, ...current].slice(0, 12));
      loadStats();
    },
    [loadStats],
  );

  useFlintEvents(
    useCallback(
      (event: FlintEvent) => {
        if (!("status" in event) || typeof event.status !== "string") return;
        onEvent(event);
      },
      [onEvent],
    ),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        kicker="Overview"
        title="Fleet at a glance"
        description="Counts refresh live from the SSE stream; every job transition lands in the activity feed."
        actions={
          <RefreshButton
            onTap={() => {
              loadStats();
              loadHandlers();
            }}
          />
        }
      />

      {error ? (
        <div className="mt-6">
          <ErrorPanel message={error} />
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => {
          const value = stats ? stats[card.key as keyof DashboardStats] : null;
          const label = card.label === "Dead letter" ? "DLQ" : card.label;
          return (
            <Link key={card.key} href={card.href} className="group">
              <Panel className="h-full px-4 py-4 transition-colors group-hover:border-line-strong">
                <div className="flex items-center justify-between">
                  <card.icon
                    className={`size-4 ${card.tone}`}
                    weight="regular"
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                    {label}
                  </span>
                </div>
                <p className="mt-3 font-mono text-[26px] leading-none tabular-nums text-ink">
                  {value === null ? "—" : value.toLocaleString()}
                </p>
              </Panel>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel>
          <PanelHead
            title="Live activity"
            detail={
              <span className="font-mono text-[11.5px] text-faint">
                {streamError ? "reconnecting…" : "streaming"}
              </span>
            }
          />
          {events.length === 0 ? (
            <div className="px-4 py-10">
              <EmptyPanel label="no transitions yet — waiting for the stream" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {events.map((event, index) => (
                <li
                  key={`${event.job_id}-${index}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="truncate font-mono text-[12.5px] text-muted">
                    {event.job_id.slice(0, 8)}
                    {event.worker_id ? (
                      <span className="text-faint"> · {event.worker_id}</span>
                    ) : null}
                  </span>
                  <StatusBadge
                    status={event.is_dlq ? "failed" : event.status}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHead
            title="Job types available"
            detail={
              handlers ? (
                <span className="font-mono text-[11.5px] text-faint">
                  {handlers.length} registered
                </span>
              ) : null
            }
          />
          {handlers === null ? (
            <div className="px-4 py-4">
              <LoadingRow label="loading handlers…" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {handlers.map((handler) => (
                <li key={handler.name} className="px-4 py-3">
                  <p className="font-mono text-[13.5px] text-ink-soft">
                    {handler.name}
                  </p>
                  {handler.description ? (
                    <p className="mt-0.5 text-[13px] leading-5 text-faint">
                      {handler.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-line px-4 py-3">
            <Link
              href="/dashboard/schedule"
              className="group inline-flex items-center gap-1.5 text-[14px] text-accent-bright/90 transition-colors hover:text-accent-bright"
            >
              Schedule a job
              <ArrowRight
                className="size-3.5 transition-transform group-hover:translate-x-0.5"
                weight="bold"
              />
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
