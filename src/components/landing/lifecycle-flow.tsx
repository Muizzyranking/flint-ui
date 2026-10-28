"use client";

import {
  ArrowUUpLeft,
  CheckCircle,
  CircleNotch,
  Clock,
  Prohibit,
  Stack,
  WarningOctagon,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import {
  type ComponentType,
  type CSSProperties,
  useEffect,
  useState,
} from "react";

import { lifecycle } from "@/lib/product";

/* ------------------------------------------------------------------ */
/* The tree: pending -> processing, then one route per outcome.        */
/* Coordinates are design units inside a 1040x590 viewBox; HTML nodes  */
/* are pinned to the same percentages so they track the SVG anchors.   */
/* ------------------------------------------------------------------ */

type NodeId =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "retry"
  | "dlq";

type NodeSpec = {
  x: number;
  y: number;
  color: string;
  icon: ComponentType<{
    className?: string;
    weight?: "fill" | "duotone" | "regular";
    style?: CSSProperties;
  }>;
  label: string;
  captionWidth: string;
};

const stageCopy = new Map(lifecycle.map((state) => [state.status, state]));

function copyFor(id: string): string {
  return stageCopy.get(id)?.detail ?? "";
}

const NODES: Record<NodeId, NodeSpec> = {
  pending: {
    x: 130,
    y: 165,
    color: "var(--color-pending)",
    icon: Clock,
    label: "pending",
    captionWidth: "max-w-[212px]",
  },
  processing: {
    x: 380,
    y: 165,
    color: "var(--color-processing)",
    icon: CircleNotch,
    label: "processing",
    captionWidth: "max-w-[220px]",
  },
  completed: {
    x: 800,
    y: 60,
    color: "var(--color-completed)",
    icon: CheckCircle,
    label: "completed",
    captionWidth: "max-w-[230px]",
  },
  failed: {
    x: 800,
    y: 250,
    color: "var(--color-failed)",
    icon: WarningOctagon,
    label: "failed",
    captionWidth: "max-w-[230px]",
  },
  cancelled: {
    x: 800,
    y: 445,
    color: "var(--color-cancelled)",
    icon: Prohibit,
    label: "cancelled",
    captionWidth: "max-w-[230px]",
  },
  retry: {
    x: 462,
    y: 428,
    color: "var(--color-pending)",
    icon: ArrowUUpLeft,
    label: "re-queued → pending",
    captionWidth: "",
  },
  dlq: {
    x: 950,
    y: 176,
    color: "var(--color-accent-bright)",
    icon: Stack,
    label: "parks in DLQ",
    captionWidth: "",
  },
};

const CIRCLE_NODES: NodeId[] = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
];
const CHIP_NODES: NodeId[] = ["retry", "dlq"];

const JUNCTION = { x: 510, y: 165 };

const EDGES: {
  id: string;
  d: string;
  color: string;
  dashed?: boolean;
  arrow?: boolean;
}[] = [
  {
    id: "pending-processing",
    d: `M ${NODES.pending.x} ${NODES.pending.y} H ${NODES.processing.x}`,
    color: "var(--color-processing)",
  },
  {
    id: "processing-junction",
    d: `M ${NODES.processing.x} ${NODES.processing.y} H ${JUNCTION.x}`,
    color: "var(--color-processing)",
  },
  {
    id: "junction-completed",
    d: `M ${JUNCTION.x} ${JUNCTION.y} C 590 165 640 60 ${NODES.completed.x} ${NODES.completed.y}`,
    color: "var(--color-completed)",
    arrow: true,
  },
  {
    id: "junction-failed",
    d: `M ${JUNCTION.x} ${JUNCTION.y} C 580 165 660 250 ${NODES.failed.x} ${NODES.failed.y}`,
    color: "var(--color-failed)",
    arrow: true,
  },
  {
    id: "junction-cancelled",
    d: `M ${JUNCTION.x} ${JUNCTION.y} C 590 165 640 445 ${NODES.cancelled.x} ${NODES.cancelled.y}`,
    color: "var(--color-cancelled)",
    arrow: true,
  },
  {
    id: "failed-retry",
    d: `M ${NODES.failed.x} ${NODES.failed.y} C 680 410 560 430 ${NODES.retry.x + 33} ${NODES.retry.y - 1}`,
    color: "var(--color-pending)",
    dashed: true,
  },
  {
    id: "failed-dlq",
    d: `M ${NODES.failed.x} ${NODES.failed.y} C 850 225 900 195 ${NODES.dlq.x - 5} ${NODES.dlq.y + 2}`,
    color: "var(--color-accent-bright)",
  },
];

/* One walk per cycle: the trunk, then whichever route that run took. */
const WALKS = [
  {
    nodes: ["pending", "processing", "completed"],
    edges: ["pending-processing", "processing-junction", "junction-completed"],
  },
  {
    nodes: ["pending", "processing", "failed", "retry"],
    edges: [
      "pending-processing",
      "processing-junction",
      "junction-failed",
      "failed-retry",
    ],
  },
  {
    nodes: ["pending", "processing", "failed", "dlq"],
    edges: [
      "pending-processing",
      "processing-junction",
      "junction-failed",
      "failed-dlq",
    ],
  },
  {
    nodes: ["pending", "processing", "cancelled"],
    edges: ["pending-processing", "processing-junction", "junction-cancelled"],
  },
] as const;

const WALK_DELAY = 1500;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

/** Shared walk timeline: one run per cycle, then the next route. */
function useWalkTimeline(reduce: boolean | null) {
  const [slot, setSlot] = useState({ walk: 0, step: 0 });

  useEffect(() => {
    if (reduce) return;

    const timer = window.setInterval(() => {
      setSlot((current) => {
        const nextStep = current.step + 1;
        if (nextStep < WALKS[current.walk].nodes.length) {
          return { ...current, step: nextStep };
        }
        return { walk: (current.walk + 1) % WALKS.length, step: 0 };
      });
    }, WALK_DELAY);

    return () => window.clearInterval(timer);
  }, [reduce]);

  const walk = reduce ? WALKS[0] : WALKS[slot.walk];
  const step = reduce ? walk.nodes.length - 1 : slot.step;
  const activeNode = walk.nodes[step] as NodeId;
  /* Light every edge up to — and including — the edge arriving at the
     active node, so outcome edges color as soon as the node does. The
     virtual junction between nodes 1 and 2 puts that edge at index `step`. */
  const traced = new Set<string>(
    walk.edges.slice(0, step < 2 ? step : step + 1),
  );

  return { activeNode, traced };
}

export function LifecycleFlow() {
  const reduce = useReducedMotion();
  const { activeNode, traced } = useWalkTimeline(reduce);
  const junctionLive = traced.has("processing-junction");

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface">
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        {/* Desktop: the tree */}
        <div className="mx-auto hidden max-w-[1040px] sm:block">
          <div
            className="relative w-full"
            style={{ aspectRatio: "1040 / 590" }}
          >
            <motion.svg
              initial={reduce ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 1040 590"
              fill="none"
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="lf-arrow"
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M0 0 L8 4 L0 8 Z" fill="rgb(255 255 255 / 0.3)" />
                </marker>
              </defs>

              {EDGES.map((edge) => {
                const isTraced = traced.has(edge.id);
                return (
                  <path
                    key={edge.id}
                    d={edge.d}
                    stroke={isTraced ? edge.color : "rgb(255 255 255 / 0.09)"}
                    strokeWidth={isTraced ? 1.5 : 1}
                    strokeLinecap="round"
                    strokeDasharray={edge.dashed ? "3 7" : undefined}
                    markerEnd={edge.arrow ? "url(#lf-arrow)" : undefined}
                    className="transition-[stroke,stroke-width] duration-500"
                  />
                );
              })}
            </motion.svg>

            {/* Fork point off the trunk */}
            <span
              className="absolute z-10 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-300"
              style={{
                left: `${(JUNCTION.x / 1040) * 100}%`,
                top: `${(JUNCTION.y / 590) * 100}%`,
                backgroundColor: junctionLive
                  ? "var(--color-processing)"
                  : "rgb(255 255 255 / 0.25)",
              }}
            />

            {CIRCLE_NODES.map((id, index) => (
              <FlowNode
                key={id}
                id={id}
                active={activeNode === id}
                spinning={id === "processing" && activeNode === "processing"}
                entryDelay={index * 0.05}
                reduce={reduce}
              />
            ))}

            {CHIP_NODES.map((id, index) => (
              <FlowChip
                key={id}
                id={id}
                active={activeNode === id}
                entryDelay={0.3 + index * 0.05}
                reduce={reduce}
              />
            ))}
          </div>
        </div>

        {/* Mobile: portrait fan tree mirroring the desktop walk */}
        <MobileTree activeNode={activeNode} traced={traced} />
      </div>

      <div className="grid gap-5 border-t border-white/10 bg-black/40 px-6 py-5 sm:px-8 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
          <span className="shrink-0 font-mono text-[11.5px] uppercase tracking-[0.12em] text-white/35">
            Retry
          </span>
          <p className="font-mono text-[13px] leading-6 text-white/45">
            failed + attempts left &rarr; pending,{" "}
            <span className="text-white/75">available_at = now + backoff</span>
          </p>
        </div>
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
          <span className="shrink-0 font-mono text-[11.5px] uppercase tracking-[0.12em] text-white/35">
            Cancel
          </span>
          <p className="font-mono text-[13px] leading-6 text-white/45">
            pending &rarr; instant. processing &rarr;{" "}
            <span className="text-white/75">cancellation_requested</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Nodes (desktop)                                                     */
/* ------------------------------------------------------------------ */

function FlowNode({
  id,
  active,
  spinning,
  entryDelay,
  reduce,
}: {
  id: NodeId;
  active: boolean;
  spinning: boolean;
  entryDelay: number;
  reduce: boolean | null;
}) {
  const spec = NODES[id];
  const Icon = spec.icon;
  const detail = copyFor(id);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{
        duration: 0.5,
        delay: entryDelay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="absolute z-10 flex -translate-x-1/2 flex-col items-center"
      style={{
        left: `${(spec.x / 1040) * 100}%`,
        top: `calc(${(spec.y / 590) * 100}% - 24px)`,
      }}
    >
      <div
        className="relative flex size-12 items-center justify-center rounded-full border border-white/15 bg-black transition-[border-color,background-color] duration-300"
        style={{
          borderColor: active
            ? `color-mix(in srgb, ${spec.color} 65%, transparent)`
            : undefined,
          backgroundColor: active
            ? `color-mix(in srgb, ${spec.color} 10%, black)`
            : undefined,
        }}
      >
        {active ? (
          <motion.span
            layoutId="lifecycle-walk"
            className="absolute -inset-1.5 rounded-full border"
            style={{ borderColor: spec.color }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          />
        ) : null}
        <Icon
          className={`size-5 transition-opacity duration-300 ${
            spinning ? "motion-safe:animate-spin [animation-duration:3s]" : ""
          }`}
          style={{ color: spec.color, opacity: active ? 1 : 0.55 }}
          weight={active ? "fill" : "duotone"}
        />
      </div>

      <p
        className="mt-3.5 font-mono text-[13.5px] transition-colors duration-300"
        style={{ color: active ? spec.color : "var(--color-ink)" }}
      >
        {spec.label}
      </p>
      <p
        className={`mt-1.5 text-center text-[15.5px] leading-6 text-white/45 ${spec.captionWidth}`}
      >
        {detail}
      </p>
    </motion.div>
  );
}

function FlowChip({
  id,
  active,
  entryDelay,
  reduce,
}: {
  id: NodeId;
  active: boolean;
  entryDelay: number;
  reduce: boolean | null;
}) {
  const spec = NODES[id];
  const Icon = spec.icon;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{
        duration: 0.5,
        delay: entryDelay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${(spec.x / 1040) * 100}%`,
        top: `${(spec.y / 590) * 100}%`,
      }}
    >
      <div
        className="relative flex items-center gap-2 rounded-full border bg-black px-3.5 py-1.5 transition-[border-color,background-color] duration-300"
        style={{
          borderColor: active
            ? `color-mix(in srgb, ${spec.color} 55%, transparent)`
            : "rgb(255 255 255 / 0.15)",
          backgroundColor: active
            ? `color-mix(in srgb, ${spec.color} 10%, black)`
            : undefined,
        }}
      >
        {active ? (
          <motion.span
            layoutId="lifecycle-walk"
            className="absolute -inset-1.5 rounded-full border"
            style={{ borderColor: spec.color }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          />
        ) : null}
        <Icon className="size-3.5" style={{ color: spec.color }} />
        <span
          className="font-mono text-[12.5px] transition-colors duration-300"
          style={{ color: active ? spec.color : "var(--color-muted)" }}
        >
          {spec.label}
        </span>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile: same walk, staged vertically                                */
/* ------------------------------------------------------------------ */

function NodeBadge({
  spec,
  active,
  spinning = false,
}: {
  spec: NodeSpec;
  active: boolean;
  spinning?: boolean;
}) {
  const Icon = spec.icon;

  return (
    <div
      className="relative flex size-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black transition-[border-color,background-color] duration-300"
      style={
        active
          ? {
              borderColor: `color-mix(in srgb, ${spec.color} 65%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${spec.color} 10%, black)`,
            }
          : undefined
      }
    >
      {active ? (
        <motion.span
          className="absolute -inset-1.5 rounded-full border"
          style={{ borderColor: spec.color }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        />
      ) : null}
      <Icon
        className={`size-5 transition-opacity duration-300 ${
          spinning ? "motion-safe:animate-spin [animation-duration:3s]" : ""
        }`}
        style={{ color: spec.color, opacity: active ? 1 : 0.55 }}
        weight={active ? "fill" : "duotone"}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile: portrait fan tree — SVG edges + nodes pinned like desktop   */
/* ------------------------------------------------------------------ */

const MOBILE_W = 480;
const MOBILE_H = 640;

const MOBILE_JUNCTION = { x: 240, y: 238 };

type MobileCircleId =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

const MOBILE_POSITIONS: Record<MobileCircleId, { x: number; y: number }> = {
  pending: { x: 240, y: 42 },
  processing: { x: 240, y: 156 },
  completed: { x: 76, y: 372 },
  failed: { x: 240, y: 372 },
  cancelled: { x: 404, y: 372 },
};

const MOBILE_CHIP_POSITIONS: Record<"retry" | "dlq", { x: number; y: number }> =
  {
    retry: { x: 118, y: 494 },
    dlq: { x: 356, y: 558 },
  };

const MOBILE_EDGES: {
  id: string;
  d: string;
  color: string;
  dashed?: boolean;
  arrow?: boolean;
}[] = [
  {
    id: "pending-processing",
    d: `M ${MOBILE_POSITIONS.pending.x} ${MOBILE_POSITIONS.pending.y} V ${MOBILE_POSITIONS.processing.y}`,
    color: "var(--color-processing)",
  },
  {
    id: "processing-junction",
    d: `M ${MOBILE_POSITIONS.processing.x} ${MOBILE_POSITIONS.processing.y} V ${MOBILE_JUNCTION.y}`,
    color: "var(--color-processing)",
  },
  {
    id: "junction-completed",
    d: `M ${MOBILE_JUNCTION.x} ${MOBILE_JUNCTION.y} C 200 280 76 300 ${MOBILE_POSITIONS.completed.x} ${MOBILE_POSITIONS.completed.y}`,
    color: "var(--color-completed)",
    arrow: true,
  },
  {
    id: "junction-failed",
    d: `M ${MOBILE_JUNCTION.x} ${MOBILE_JUNCTION.y} V ${MOBILE_POSITIONS.failed.y}`,
    color: "var(--color-failed)",
    arrow: true,
  },
  {
    id: "junction-cancelled",
    d: `M ${MOBILE_JUNCTION.x} ${MOBILE_JUNCTION.y} C 280 280 404 300 ${MOBILE_POSITIONS.cancelled.x} ${MOBILE_POSITIONS.cancelled.y}`,
    color: "var(--color-cancelled)",
    arrow: true,
  },
  {
    id: "failed-retry",
    d: `M ${MOBILE_POSITIONS.failed.x} ${MOBILE_POSITIONS.failed.y} C 190 420 118 440 ${MOBILE_CHIP_POSITIONS.retry.x} ${MOBILE_CHIP_POSITIONS.retry.y}`,
    color: "var(--color-pending)",
    dashed: true,
  },
  {
    id: "failed-dlq",
    d: `M ${MOBILE_POSITIONS.failed.x} ${MOBILE_POSITIONS.failed.y} C 290 440 356 470 ${MOBILE_CHIP_POSITIONS.dlq.x} ${MOBILE_CHIP_POSITIONS.dlq.y}`,
    color: "var(--color-accent-bright)",
  },
];

function MobileNode({ id, active }: { id: MobileCircleId; active: boolean }) {
  const spec = NODES[id];
  const pos = MOBILE_POSITIONS[id];

  return (
    <div
      className="absolute z-10 flex -translate-x-1/2 flex-col items-center"
      style={{
        left: `${(pos.x / MOBILE_W) * 100}%`,
        top: `calc(${(pos.y / MOBILE_H) * 100}% - 24px)`,
      }}
    >
      <NodeBadge
        spec={spec}
        active={active}
        spinning={id === "processing" && active}
      />
      <p
        className="mt-2.5 whitespace-nowrap font-mono text-[12px]"
        style={{ color: active ? spec.color : "var(--color-ink)" }}
      >
        {spec.label}
      </p>
    </div>
  );
}

function MobileChip({ id, active }: { id: NodeId; active: boolean }) {
  const spec = NODES[id];
  const Icon = spec.icon;

  return (
    <div
      className="relative flex items-center gap-1.5 rounded-full border bg-black px-2.5 py-1 transition-[border-color,background-color] duration-300"
      style={
        active
          ? {
              borderColor: `color-mix(in srgb, ${spec.color} 55%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${spec.color} 10%, black)`,
            }
          : undefined
      }
    >
      {active ? (
        <motion.span
          className="absolute -inset-1 rounded-full border"
          style={{ borderColor: spec.color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        />
      ) : null}
      <Icon className="size-2.5" style={{ color: spec.color }} />
      <span
        className="whitespace-nowrap font-mono text-[11px] transition-colors duration-300"
        style={{
          color: active ? spec.color : "rgb(255 255 255 / 0.45)",
        }}
      >
        {spec.label}
      </span>
    </div>
  );
}

function MobileTree({
  activeNode,
  traced,
}: {
  activeNode: NodeId;
  traced: Set<string>;
}) {
  const junctionLive = traced.has("processing-junction");

  return (
    <div className="sm:hidden">
      <div
        className="relative mx-auto w-full max-w-[420px]"
        style={{ aspectRatio: "480 / 640" }}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 480 640"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="lf-arrow-mobile"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="6.5"
              markerHeight="6.5"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L8 4 L0 8 Z" fill="rgb(255 255 255 / 0.3)" />
            </marker>
          </defs>

          {MOBILE_EDGES.map((edge) => {
            const isTraced = traced.has(edge.id);
            return (
              <path
                key={edge.id}
                d={edge.d}
                stroke={isTraced ? edge.color : "rgb(255 255 255 / 0.09)"}
                strokeWidth={isTraced ? 2 : 1.25}
                strokeLinecap="round"
                strokeDasharray={edge.dashed ? "3 7" : undefined}
                markerEnd={edge.arrow ? "url(#lf-arrow-mobile)" : undefined}
                className="transition-[stroke,stroke-width] duration-500"
              />
            );
          })}
        </svg>

        {/* Fork point: the junction the three branches leave */}
        <span
          aria-hidden="true"
          className={`absolute z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-300 ${
            junctionLive ? "bg-processing" : "bg-white/25"
          }`}
          style={{
            left: `${(MOBILE_JUNCTION.x / MOBILE_W) * 100}%`,
            top: `${(MOBILE_JUNCTION.y / MOBILE_H) * 100}%`,
          }}
        />

        {(CIRCLE_NODES as MobileCircleId[]).map((id) => (
          <MobileNode key={id} id={id} active={activeNode === id} />
        ))}

        {CHIP_NODES.map((id) => (
          <div
            key={id}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(MOBILE_CHIP_POSITIONS[id as "retry" | "dlq"].x / MOBILE_W) * 100}%`,
              top: `${(MOBILE_CHIP_POSITIONS[id as "retry" | "dlq"].y / MOBILE_H) * 100}%`,
            }}
          >
            <MobileChip id={id} active={activeNode === id} />
          </div>
        ))}
      </div>

      {/* Active-state readout: fixed slot so text changes never shift layout. */}
      <div className="border-t border-white/10 bg-canvas/50 px-5 pb-4 pt-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/35">
          {NODES[activeNode].label}
        </p>
        <p className="mt-1 min-h-[3.6rem] text-[13.5px] leading-[1.4] text-white/45">
          {copyFor(activeNode)}
        </p>
      </div>
    </div>
  );
}
