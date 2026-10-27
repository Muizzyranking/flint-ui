"use client";

import { CaretDown, Check } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

export type SelectOption = { value: string; label: string };

/**
 * Custom listbox-style select. Replaces every native <select> in the
 * dashboard: trigger keeps the input footprint, the popup is a themed
 * panel with keyboard support (arrows, Home/End, Enter, Escape, Tab).
 * Focus stays on the trigger the whole time.
 */
export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  id,
  size = "sm",
  mono = false,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Accessible name; omit when the trigger sits inside a <label>. */
  ariaLabel?: string;
  id?: string;
  /** sm: filter-bar footprint. md: full-width form field. */
  size?: "sm" | "md";
  mono?: boolean;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reduce = useReducedMotion();
  const listId = useId();

  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const selected = options.find((option) => option.value === value);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  // Close on outside interaction.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // On open: point the highlight at the current value, and flip the popup
  // up when there is not enough room below the viewport position.
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const height = Math.min(options.length * 38 + 12, 288);
    setDropUp(
      window.innerHeight - rect.bottom < height + 16 && rect.top > height + 16,
    );
    setHighlight(selectedIndex);
  }, [open, options.length, selectedIndex]);

  // Keyboard navigation scrolls the highlighted option into view.
  useEffect(() => {
    if (!open) return;
    const target = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${highlight}"]`,
    );
    target?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function commit(next: string) {
    setOpen(false);
    buttonRef.current?.focus();
    if (next !== value) onChange(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        setHighlight((index) => (index >= options.length - 1 ? 0 : index + 1));
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        setHighlight((index) => (index <= 0 ? options.length - 1 : index - 1));
        break;
      }
      case "Home": {
        event.preventDefault();
        setHighlight(0);
        break;
      }
      case "End": {
        event.preventDefault();
        setHighlight(options.length - 1);
        break;
      }
      case "Enter":
      case " ": {
        event.preventDefault();
        commit(options[highlight]?.value ?? value);
        break;
      }
      case "Escape": {
        setOpen(false);
        break;
      }
      case "Tab": {
        setOpen(false);
        break;
      }
    }
  }

  const triggerClass =
    size === "md"
      ? "flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-line bg-canvas px-3.5 text-left text-[13.5px] text-ink-soft outline-none transition-colors hover:border-line-strong focus-visible:border-accent"
      : "inline-flex h-9 cursor-pointer items-center gap-2.5 rounded-md border border-line bg-surface px-3 text-left text-[13px] text-ink-soft outline-none transition-colors hover:border-line-strong focus-visible:border-accent";

  return (
    <div
      ref={rootRef}
      className={`relative ${size === "md" ? "block" : "inline-flex shrink-0"} ${className}`}
    >
      <button
        id={id}
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={open ? `${listId}-${highlight}` : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
        className={triggerClass}
      >
        <span className={`min-w-0 truncate ${mono ? "font-mono" : ""}`}>
          {selected?.label ?? value}
        </span>
        <CaretDown
          className={`size-3.5 shrink-0 text-faint transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            initial={
              reduce
                ? { opacity: 1 }
                : {
                    opacity: 0,
                    scale: 0.97,
                    y: dropUp ? 4 : -4,
                  }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: dropUp ? "bottom left" : "top left" }}
            className={`absolute z-40 max-h-72 w-max min-w-full overflow-y-auto rounded-xl border border-line bg-raised p-1.5 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.85)] ${
              dropUp ? "bottom-full mb-2" : "top-full mt-2"
            }`}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isHighlighted = index === highlight;
              return (
                // Standard ARIA combobox listbox pattern: focus stays on the
                // trigger; options are reached via aria-activedescendant.
                <div
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  data-index={index}
                  aria-selected={isSelected}
                  tabIndex={-1}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => commit(option.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commit(option.value);
                    }
                  }}
                  className={`flex cursor-pointer items-center justify-between gap-6 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                    isHighlighted ? "bg-white/[0.07] text-ink" : "text-ink-soft"
                  } ${option.value === "" ? "text-muted" : ""}`}
                >
                  <span className={`truncate ${mono ? "font-mono" : ""}`}>
                    {option.label}
                  </span>
                  {isSelected ? (
                    <Check
                      className="size-3.5 shrink-0 text-accent-bright"
                      weight="bold"
                    />
                  ) : null}
                </div>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
