"use client";

import { useEffect } from "react";

export function CodeCopy() {
  useEffect(() => {
    const onClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>("[data-copy]");
      if (!button) return;

      const frame = button.closest("figure");
      const pre = frame?.querySelector("pre");
      const code = pre?.querySelector("code") ?? pre;
      const text = code?.textContent ?? "";
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        button.dataset.copied = "true";
        button.textContent = "Copied";
        window.setTimeout(() => {
          button.dataset.copied = "false";
          button.textContent = "Copy";
        }, 1600);
      } catch {
        button.textContent = "Copy failed";
        window.setTimeout(() => {
          button.textContent = "Copy";
        }, 1600);
      }
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
