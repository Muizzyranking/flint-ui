"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { quickstartTabs } from "@/lib/product";

export function CodeTabs() {
  const [active, setActive] = useState(quickstartTabs[0].id);
  const [copied, setCopied] = useState(false);

  const tab =
    quickstartTabs.find((item) => item.id === active) ?? quickstartTabs[0];

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tab.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div
        className="flex items-center gap-1 overflow-x-auto border-b border-line px-2 py-1.5"
        role="tablist"
        aria-label="Quickstart steps"
      >
        {quickstartTabs.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`quickstart-${item.id}`}
              onClick={() => {
                setActive(item.id);
                setCopied(false);
              }}
              className={`relative shrink-0 rounded-md px-3 py-2 font-mono text-[13.5px] tracking-tight transition-colors ${
                selected ? "text-ink" : "text-faint hover:text-ink-soft"
              }`}
            >
              {item.label}
              {selected ? (
                <motion.span
                  layoutId="quickstart-tab"
                  className="absolute inset-0 -z-10 rounded-md bg-raised"
                  transition={{ type: "spring", stiffness: 320, damping: 30 }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-start justify-between gap-4 px-4 pt-3.5 pb-1">
        <p className="text-[15px] leading-7 text-muted">{tab.hint}</p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 font-mono text-[12px] uppercase tracking-[0.1em] text-faint transition-colors hover:border-line-strong hover:text-ink"
          aria-label="Copy command"
        >
          {copied ? (
            <Check className="size-3 text-completed" weight="bold" />
          ) : (
            <Copy className="size-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div
        id={`quickstart-${tab.id}`}
        role="tabpanel"
        className="overflow-x-auto px-4 pt-2 pb-4"
      >
        <pre className="font-mono text-[14px] leading-7 text-ink-soft">
          <code>{tab.code}</code>
        </pre>
      </div>

      <div className="flex items-center gap-3 border-t border-line bg-canvas/50 px-4 py-2.5 font-mono text-[12px] uppercase tracking-[0.12em] text-faint">
        <span>{tab.lang}</span>
        <span className="h-3 w-px bg-line" />
        <span>127.0.0.1:8000</span>
      </div>
    </div>
  );
}
