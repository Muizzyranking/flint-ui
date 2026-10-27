"use client";

import { ArrowRight, Check, Copy } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { FlintMark } from "@/components/brand";
import { HeroConsole } from "@/components/landing/hero-console";

const ease = [0.16, 1, 0.3, 1] as const;
const command = "docker compose up -d";

export function Hero() {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.75, delay, ease },
  });

  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="accent-wash pointer-events-none absolute inset-x-0 top-0 h-[620px]" />
      <div className="dot-field pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-25 [mask-image:linear-gradient(to_bottom,black,transparent)]" />

      <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-16 sm:px-8 sm:pt-20 lg:pt-24 lg:pb-24">
        <div className="flex flex-col items-center text-center">
          <motion.p
            {...rise(0)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-white/60"
          >
            <FlintMark className="size-3 text-accent-bright" />
            Durable job scheduling
          </motion.p>

          <motion.h1
            {...rise(0.07)}
            className="mt-7 max-w-[15ch] text-[clamp(3rem,7.6vw,5.75rem)] leading-[0.95] font-bold tracking-[-0.055em] text-ink"
          >
            Jobs that <span className="accent-gradient">survive</span> the
            crash.
          </motion.h1>

          <motion.p
            {...rise(0.14)}
            className="mt-6 max-w-[52ch] text-[19px] leading-8 text-white/55"
          >
            POST work over HTTP. Flint keeps it in Postgres, leases it to a
            worker, and retries until it is done.
          </motion.p>

          <motion.div
            {...rise(0.2)}
            className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
          >
            <Link
              href="/docs/getting-started"
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-7 text-[16px] font-semibold text-black transition-colors hover:bg-white/85 active:translate-y-px sm:w-auto"
            >
              Get started
              <ArrowRight
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                weight="bold"
              />
            </Link>

            <button
              type="button"
              onClick={copyCommand}
              className="group inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-6 font-mono text-[14px] text-white/60 backdrop-blur-sm transition-colors hover:border-accent/40 hover:bg-white/[0.07] hover:text-white active:translate-y-px sm:w-auto"
              aria-label="Copy the docker compose command"
            >
              <span className="text-accent-bright">$</span>
              <span className="whitespace-nowrap">docker compose up -d</span>
              {copied ? (
                <Check className="size-4 text-accent-bright" weight="bold" />
              ) : (
                <Copy className="size-4 opacity-60 transition-opacity group-hover:opacity-100" />
              )}
            </button>
          </motion.div>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.95, delay: 0.28, ease }}
          className="mx-auto mt-14 max-w-5xl lg:mt-16"
        >
          <HeroConsole />
        </motion.div>
      </div>
    </section>
  );
}
