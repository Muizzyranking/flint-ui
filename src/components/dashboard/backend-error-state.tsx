"use client";

import { ArrowUpRight, Plugs } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { FlintMark } from "@/components/brand";

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Full-screen "backend down" state. Matches the landing design: pure black,
 * violet accent, mono details — the plug pulses detached while the server is
 * away. Offers a way out to the docs so the reader can fix the compose env.
 */
export function BackendErrorState({
  apiUrl,
  reason,
}: {
  apiUrl: string | null;
  reason: string;
}) {
  const reduce = useReducedMotion();

  const rise = (delay: number) => ({
    initial: reduce ? false : ({ opacity: 0, y: 18 } as const),
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.75, delay, ease },
  });

  return (
    <section className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-20 text-center">
      <div className="accent-wash pointer-events-none absolute inset-0 opacity-60" />

      <motion.div {...rise(0)} className="relative">
        <div className="relative inline-flex items-center justify-center">
          <motion.span
            aria-hidden
            className="absolute size-24 rounded-full border border-failed/25"
            animate={
              reduce ? undefined : { scale: [1, 1.35], opacity: [0.8, 0] }
            }
            transition={{
              duration: 2.2,
              ease: "easeOut",
              repeat: Infinity,
              repeatDelay: 0.6,
            }}
          />
          <motion.span
            aria-hidden
            className="absolute size-24 rounded-full border border-failed/20"
            animate={
              reduce ? undefined : { scale: [1, 1.35], opacity: [0.8, 0] }
            }
            transition={{
              duration: 2.2,
              ease: "easeOut",
              repeat: Infinity,
              repeatDelay: 0.6,
              delay: 1.1,
            }}
          />
          <span className="relative flex size-24 items-center justify-center rounded-full border border-line bg-surface shadow-[0_0_60px_-20px_rgba(248,113,113,0.35)]">
            <motion.span
              animate={
                reduce
                  ? undefined
                  : { scale: [1, 0.94, 1], opacity: [1, 0.75, 1] }
              }
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="flex items-center justify-center"
            >
              <Plugs className="size-10 text-failed" weight="light" />
            </motion.span>
          </span>
        </div>
      </motion.div>

      <motion.p
        {...rise(0.08)}
        className="mt-8 font-mono text-[12.5px] uppercase tracking-[0.16em] text-failed/80"
      >
        Connection refused
      </motion.p>

      <motion.h1
        {...rise(0.14)}
        className="mt-4 max-w-[16ch] text-[clamp(2.4rem,5.4vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink"
      >
        The server is <span className="accent-gradient">probably down</span>.
      </motion.h1>

      <motion.p
        {...rise(0.2)}
        className="mt-5 max-w-[48ch] text-[17px] leading-8 text-white/55"
      >
        {reason} The dashboard will come alive as soon as the API answers on{" "}
        <code className="rounded border border-line bg-white/[0.04] px-1.5 py-0.5 font-mono text-[14px] text-accent-bright">
          /health/ready
        </code>
        .
      </motion.p>

      {apiUrl ? (
        <motion.p
          {...rise(0.24)}
          className="mt-4 font-mono text-[13px] text-faint"
        >
          looking for <span className="text-muted">{apiUrl}</span>
        </motion.p>
      ) : null}

      <motion.div
        {...rise(0.3)}
        className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
      >
        <Link
          href="/docs/getting-started"
          className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-7 text-[16px] font-semibold text-black transition-colors hover:bg-white/85 active:translate-y-px sm:w-auto"
        >
          Read the docs
          <ArrowUpRight
            className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            weight="bold"
          />
        </Link>
        <Link
          href="/"
          className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-6 text-[15px] font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white active:translate-y-px sm:w-auto"
        >
          Back to the landing page
        </Link>
      </motion.div>

      <motion.div
        {...rise(0.36)}
        className="mt-14 w-full max-w-md rounded-xl border border-line bg-surface px-5 py-4 text-left"
      >
        <div className="flex items-center justify-between gap-3">
          <FlintMark className="size-3 text-accent-bright" />
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-faint">
            Fix it
          </span>
        </div>
        <ul className="mt-3 space-y-2 text-[14px] leading-6 text-muted">
          <li className="flex justify-between gap-4">
            <span className="text-faint">1</span>
            <span className="flex-1">
              Start the stack:{" "}
              <code className="font-mono text-[13px] text-ink-soft">
                docker compose --profile frontend up -d
              </code>
            </span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-faint">2</span>
            <span className="flex-1">
              Make sure{" "}
              <code className="font-mono text-[13px] text-ink-soft">
                API_URL
              </code>{" "}
              points at the API (e.g.{" "}
              <code className="font-mono text-[13px] text-ink-soft">
                http://api:8000/api/v1
              </code>
              ) and{" "}
              <code className="font-mono text-[13px] text-ink-soft">
                API_KEY
              </code>{" "}
              matches.
            </span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-faint">3</span>
            <span className="flex-1">
              Reload the dashboard — no rebuild needed, env is read per request.
            </span>
          </li>
        </ul>
      </motion.div>
    </section>
  );
}
