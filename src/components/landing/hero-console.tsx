"use client";

import { Pause, Play } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useReducer, useState } from "react";

import { FlintMark } from "@/components/brand";

type Job = {
  id: string;
  type: string;
  priority: 1 | 2 | 3;
};

type Settled = {
  job: Job;
  outcome: "completed" | "failed";
  duration: string;
};

type Showcase = {
  queue: Job[];
  active: Job | null;
  settled: Settled[];
  sequence: number;
  completed: number;
  dlq: number;
};

const catalog: { type: string; priority: 1 | 2 | 3 }[] = [
  { type: "webhook_delivery", priority: 2 },
  { type: "send_email", priority: 1 },
  { type: "log_processing", priority: 3 },
  { type: "http_ping", priority: 1 },
  { type: "job_retention", priority: 3 },
];

let jobSequence = 0;

function makeJob(offset: number): Job {
  jobSequence += 1;
  const spec = catalog[(offset + jobSequence) % catalog.length];
  return {
    id: `0f5f2f${(jobSequence * 37).toString(16).padStart(2, "0")}`,
    type: spec.type,
    priority: spec.priority,
  };
}

const initial: Showcase = {
  queue: [makeJob(1), makeJob(2)],
  active: null,
  settled: [],
  sequence: 3,
  completed: 981,
  dlq: 3,
};

initial.settled = [
  { job: makeJob(4), outcome: "completed", duration: "38ms" },
  { job: makeJob(5), outcome: "completed", duration: "42ms" },
];

function step(state: Showcase): Showcase {
  if (state.active) {
    const failed = state.sequence % 5 === 4;
    const settled: Settled = {
      job: state.active,
      outcome: failed ? "failed" : "completed",
      duration: failed ? "timeout" : "41ms",
    };

    return {
      queue: [...state.queue, makeJob(state.sequence)].slice(-2),
      active: null,
      settled: [settled, ...state.settled].slice(0, 2),
      sequence: state.sequence + 1,
      completed: state.completed + (failed ? 0 : 1),
      dlq: state.dlq + (failed ? 1 : 0),
    };
  }

  if (state.queue.length === 0) return state;

  return { ...state, active: state.queue[0], queue: state.queue.slice(1) };
}

const priorityTone: Record<number, string> = {
  1: "text-failed border-failed/30",
  2: "text-pending border-pending/30",
  3: "text-cancelled border-cancelled/30",
};

function JobCard({
  job,
  outcome,
  muted = false,
}: {
  job: Job;
  outcome?: Settled;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-raised px-3.5 py-3 ${
        outcome?.outcome === "failed" ? "border-failed/35" : "border-line"
      } ${muted ? "opacity-80" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-mono text-[15px] text-ink">
          {job.type}
        </span>
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[11.5px] ${priorityTone[job.priority]}`}
        >
          p{job.priority}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[12.5px] text-faint">
        <span>{job.id}</span>
        {outcome ? (
          <span
            className={
              outcome.outcome === "failed" ? "text-failed" : "text-completed"
            }
          >
            {outcome.outcome === "failed" ? "DLQ" : outcome.duration}
          </span>
        ) : (
          <span>ready</span>
        )}
      </div>
    </div>
  );
}

function LaneHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-[12.5px] uppercase tracking-[0.14em] text-faint">
        {title}
      </span>
      <span className="font-mono text-[12.5px] text-faint">{detail}</span>
    </div>
  );
}

export function HeroConsole() {
  const reduce = useReducedMotion();
  const [state, dispatch] = useReducer(step, initial);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce) return;
    if (paused) return;

    const timer = window.setInterval(() => {
      dispatch();
    }, 1700);

    return () => window.clearInterval(timer);
  }, [reduce, paused]);

  useEffect(() => {
    if (!reduce || state.active) return;
    if (state.queue.length === 0) return;
    dispatch();
  }, [reduce, state.active, state.queue.length]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_100px_-50px_rgba(0,0,0,0.95)]">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
        <div className="flex items-center gap-2.5">
          <FlintMark className="size-3.5 text-accent-bright" />
          <span className="font-mono text-[14.5px] text-ink-soft">flint</span>
          <span className="font-mono text-[14.5px] text-faint">
            / scheduler
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[12.5px] uppercase tracking-[0.12em] text-faint">
            {paused ? "Paused" : "Illustrative sample"}
          </span>
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => setPaused((current) => !current)}
            aria-label={paused ? "Resume animation" : "Pause animation"}
            title={paused ? "Resume" : "Pause"}
            className="grid size-7 cursor-pointer place-items-center rounded-md border border-line bg-white/[0.03] text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            {paused ? (
              <Play className="size-3" weight="fill" />
            ) : (
              <Pause className="size-3.5" weight="fill" />
            )}
          </motion.button>
        </div>
      </div>

      <div className="grid divide-y divide-line md:grid-cols-[1.05fr_1.1fr_1.15fr] md:divide-x md:divide-y-0">
        <div className="flex min-h-[228px] flex-col gap-3 p-4 sm:p-5">
          <LaneHeader title="Queue" detail={`${state.queue.length} waiting`} />

          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {state.queue.map((job) => (
                <motion.div
                  key={job.id}
                  layoutId={job.id}
                  layout
                  initial={reduce ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 240, damping: 30 }}
                >
                  <JobCard job={job} />
                </motion.div>
              ))}
            </AnimatePresence>

            {state.queue.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line px-3.5 py-6 text-center font-mono text-[13px] text-faint">
                Queue empty
              </div>
            ) : null}
          </div>

          <p className="mt-auto font-mono text-[12.5px] text-faint">
            ordered by priority, then due time
          </p>
        </div>

        <div className="flex min-h-[228px] flex-col gap-3 bg-raised/30 p-4 sm:p-5">
          <LaneHeader
            title="Workers"
            detail={state.active ? "1 leased" : "polling"}
          />

          <div className="flex flex-1 flex-col justify-start gap-2">
            <AnimatePresence initial={false}>
              {state.active ? (
                <motion.div
                  key={state.active.id}
                  layoutId={state.active.id}
                  layout
                  transition={{ type: "spring", stiffness: 240, damping: 30 }}
                >
                  <div className="rounded-lg border border-processing/40 bg-processing/5 px-3.5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[15px] text-ink">
                        {state.active.type}
                      </span>
                      <span className="shrink-0 rounded border border-processing/35 px-1.5 py-0.5 font-mono text-[11.5px] text-processing">
                        processing
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between font-mono text-[12.5px] text-faint">
                      <span>{state.active.id}</span>
                      <span>host-7c2a</span>
                    </div>
                    <div className="mt-3 flex h-px w-full items-center overflow-hidden bg-line">
                      <motion.div
                        className="h-px w-1/3 bg-gradient-to-r from-transparent via-processing to-transparent"
                        initial={false}
                        animate={
                          paused
                            ? { x: "100%", opacity: 0.55 }
                            : { x: ["-120%", "420%"], opacity: 1 }
                        }
                        transition={
                          paused
                            ? { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
                            : {
                                duration: 1.9,
                                ease: "easeInOut",
                                repeat: Infinity,
                                repeatDelay: 0.15,
                              }
                        }
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line px-4 py-8 text-center font-mono text-[13px] leading-5 text-faint">
                  No active lease.
                  <br />
                  Polling every 500ms.
                </div>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-auto font-mono text-[12.5px] text-faint">
            leases renew while the work runs
          </p>
        </div>

        <div className="flex min-h-[228px] flex-col gap-3 p-4 sm:p-5">
          <LaneHeader title="Outcomes" detail={`${state.dlq} in DLQ`} />

          <div className="flex flex-col gap-2">
            {state.settled.map((settled) => (
              <motion.div
                key={settled.job.id}
                layoutId={settled.job.id}
                layout
                transition={{ type: "spring", stiffness: 240, damping: 30 }}
              >
                <JobCard job={settled.job} outcome={settled} muted />
              </motion.div>
            ))}
          </div>

          <p className="mt-auto font-mono text-[12.5px] text-faint">
            failed jobs park with their last error
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 border-t border-line font-mono">
        {[
          { label: "queued", value: state.queue.length },
          { label: "processing", value: state.active ? 1 : 0 },
          { label: "completed", value: state.completed },
          { label: "DLQ", value: state.dlq },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1 border-r border-line px-4 py-3 last:border-r-0"
          >
            <span className="text-[12.5px] uppercase tracking-[0.1em] text-faint">
              {stat.label}
            </span>
            <span className="text-[20px] tabular-nums text-ink-soft">
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
