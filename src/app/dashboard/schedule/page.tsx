"use client";

import { PaperPlaneRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Select } from "@/components/dashboard/select";
import {
  EmptyPanel,
  ErrorPanel,
  LoadingRow,
  PageHeading,
  Panel,
  PanelHead,
  PriorityTag,
} from "@/components/dashboard/ui";
import {
  type FlintApiError,
  flint,
  type HandlerInfo,
} from "@/lib/flint-client";

/* -------------------------------------------------------------- */
/* JSON Schema → form                                              */
/* -------------------------------------------------------------- */

type SchemaNode = {
  type?: string | string[];
  format?: string;
  anyOf?: SchemaNode[];
  oneOf?: SchemaNode[];
  items?: SchemaNode;
  properties?: Record<string, SchemaNode>;
  required?: string[];
  description?: string;
  maxLength?: number;
};

type FieldKind = "string" | "text" | "number" | "boolean" | "json";

/** Resolve a Pydantic JSON Schema node (incl. anyOf/oneOf with null) to a widget. */
function resolveType(schema: SchemaNode): FieldKind {
  if (schema.type) {
    const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    if (type === "string") return "string";
    if (type === "integer" || type === "number") return "number";
    if (type === "boolean") return "boolean";
    if (type === "array" || type === "object") return "json";
  }
  const variant = schema.anyOf ?? schema.oneOf;
  if (variant) {
    const nonNull = variant.find((node) => (node.type ?? "null") !== "null");
    if (nonNull) return resolveType(nonNull);
  }
  if (schema.properties) return "json";
  return "string";
}

const inputClass =
  "w-full rounded-md border border-line bg-canvas px-3 py-2 text-[13.5px] text-ink-soft placeholder:text-faint outline-none transition-colors hover:border-line-strong focus:border-accent";
const labelClass = "text-[12.5px] text-faint";

function PayloadField({
  name,
  schema,
  required,
  value,
  onChange,
}: {
  name: string;
  schema: SchemaNode;
  required: boolean;
  value: string;
  onChange: (next: string) => void;
}) {
  const kind = resolveType(schema);
  const hint = schema.description ? ` — ${schema.description}` : "";
  const label = `${name}${required ? " *" : ""}`;

  const id = `payload-${name}`;

  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      <span className={labelClass}>
        {label}
        {schema.format === "email" ? " (email)" : ""}
        {kind === "json" ? " (JSON)" : ""}
        {hint ? <span className="text-faint/70">{hint}</span> : null}
      </span>

      {kind === "boolean" ? (
        <Select
          id={id}
          value={value}
          onChange={onChange}
          options={[
            { value: "", label: "unset" },
            { value: "true", label: "true" },
            { value: "false", label: "false" },
          ]}
          mono
        />
      ) : kind === "json" ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          placeholder={
            kind === "json" && schema.type === "object" ? "{}" : "[…]"
          }
          className={`${inputClass} resize-y`}
        />
      ) : (
        <input
          id={id}
          type={
            kind === "number"
              ? "number"
              : schema.format === "email"
                ? "email"
                : "text"
          }
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}
    </label>
  );
}

/** Coerce a raw field value into the JSON value expected by the handler. */
function coerce(kind: FieldKind, raw: string): unknown {
  if (kind === "number") {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed))
      throw new Error(`Field \`${raw}\` must be a number.`);
    return parsed;
  }
  if (kind === "boolean") {
    if (raw === "") return undefined;
    return raw === "true";
  }
  if (kind === "json") {
    if (raw.trim() === "") return undefined;
    return JSON.parse(raw) as unknown;
  }
  return raw === "" ? undefined : raw;
}

/* -------------------------------------------------------------- */
/* Page                                                            */
/* -------------------------------------------------------------- */

export default function SchedulePage() {
  const [handlers, setHandlers] = useState<HandlerInfo[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [options, setOptions] = useState({
    priority: "2",
    scheduled_at: "",
    interval: "",
    max_retries: "",
  });
  const [result, setResult] = useState<{ id: string; type: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    flint<{ handlers: HandlerInfo[] }>("/handlers")
      .then((payload) => {
        setHandlers(payload.data.handlers);
        setSelected(payload.data.handlers[0]?.name ?? "");
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const handler = useMemo(
    () => handlers?.find((candidate) => candidate.name === selected) ?? null,
    [handlers, selected],
  );

  // Reset the generated fields whenever the handler changes.
  useEffect(() => {
    if (!handler) return;
    const schema = handler.payload_schema as SchemaNode;
    const next: Record<string, string> = {};
    for (const name of Object.keys(schema.properties ?? {})) next[name] = "";
    setFields(next);
  }, [handler]);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!handler) return;

      setError(null);
      const schema = handler.payload_schema as SchemaNode;
      const payload: Record<string, unknown> = {};
      try {
        for (const [name, node] of Object.entries(schema.properties ?? {})) {
          const value = coerce(resolveType(node), fields[name] ?? "");
          if (value === undefined) continue;
          payload[name] = value;
        }

        const body: Record<string, unknown> = { type: handler.name, payload };
        body.priority = Number(options.priority);
        if (options.scheduled_at)
          body.scheduled_at = new Date(options.scheduled_at).toISOString();
        if (options.interval.trim()) body.interval = options.interval.trim();
        if (options.max_retries.trim())
          body.max_retries = Number(options.max_retries);

        setSubmitting(true);
        const response = await flint<{ id: string; type: string }>("/jobs", {
          method: "POST",
          body,
        });
        setResult({ id: response.data.id, type: response.data.type });
      } catch (reason) {
        if (reason instanceof SyntaxError) {
          setError(`Invalid JSON in a payload field: ${reason.message}`);
        } else {
          const apiError = reason as FlintApiError;
          setError(apiError.message);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [handler, fields, options],
  );

  const schema = handler?.payload_schema as SchemaNode | undefined;
  const required = new Set(schema?.required ?? []);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        kicker="Schedule"
        title="Schedule a job"
        description="Pick a handler registered in this deployment; the form is generated from its payload schema."
      />

      {error ? (
        <div className="mt-6">
          <ErrorPanel message={error} onDismiss={() => setError(null)} />
        </div>
      ) : null}

      {result ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-completed/30 bg-completed/[0.06] px-4 py-3">
          <p className="text-[14px] leading-6 text-completed">
            Job created —{" "}
            <span className="font-mono">{result.id.slice(0, 8)}…</span> (
            {result.type})
          </p>
          <Link
            href={`/dashboard/jobs?q=${result.id}`}
            className="rounded-md border border-completed/40 px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.08em] text-completed transition-colors hover:text-white"
          >
            View
          </Link>
        </div>
      ) : null}

      {handlers === null && !error ? (
        <div className="mt-8">
          <LoadingRow label="loading handlers…" />
        </div>
      ) : handlers !== null && handlers.length === 0 ? (
        <div className="mt-8">
          <EmptyPanel label="this deployment registers no handlers" />
        </div>
      ) : handlers !== null ? (
        <form onSubmit={submit} className="mt-7">
          <Panel>
            <PanelHead title="Handler" />
            <div className="flex flex-col gap-4 px-4 py-4">
              <Select
                value={selected}
                onChange={setSelected}
                options={handlers.map((candidate) => ({
                  value: candidate.name,
                  label: candidate.name,
                }))}
                ariaLabel="Job type"
                mono
              />

              {handler?.description ? (
                <p className="text-[13.5px] leading-6 text-muted">
                  {handler.description}
                </p>
              ) : null}
            </div>
          </Panel>

          {schema?.properties && Object.keys(schema.properties).length > 0 ? (
            <Panel className="mt-4">
              <PanelHead title="Payload" />
              <div className="flex flex-col gap-4 px-4 py-4">
                {Object.entries(schema.properties).map(([name, node]) => (
                  <PayloadField
                    key={name}
                    name={name}
                    schema={node}
                    required={required.has(name)}
                    value={fields[name] ?? ""}
                    onChange={(next) =>
                      setFields((current) => ({ ...current, [name]: next }))
                    }
                  />
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel className="mt-4">
            <PanelHead title="Options" />
            <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Priority</span>
                <Select
                  value={options.priority}
                  onChange={(next) =>
                    setOptions((current) => ({ ...current, priority: next }))
                  }
                  options={[
                    { value: "1", label: "1 · high" },
                    { value: "2", label: "2 · medium" },
                    { value: "3", label: "3 · low" },
                  ]}
                  ariaLabel="Priority"
                />
                {options.priority ? (
                  <PriorityTag priority={Number(options.priority)} />
                ) : null}
              </div>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>
                  Schedule at (optional, local time)
                </span>
                <input
                  type="datetime-local"
                  step="1"
                  value={options.scheduled_at}
                  onChange={(event) =>
                    setOptions((current) => ({
                      ...current,
                      scheduled_at: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>
                  Interval (optional, makes it recurring)
                </span>
                <input
                  type="text"
                  value={options.interval}
                  onChange={(event) =>
                    setOptions((current) => ({
                      ...current,
                      interval: event.target.value,
                    }))
                  }
                  placeholder="1h / 30m / 7d"
                  className={inputClass}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Max retries (0–10)</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={options.max_retries}
                  onChange={(event) =>
                    setOptions((current) => ({
                      ...current,
                      max_retries: event.target.value,
                    }))
                  }
                  placeholder="3"
                  className={inputClass}
                />
              </label>
            </div>
          </Panel>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-black transition-colors hover:bg-white/85 active:translate-y-px disabled:opacity-50"
            >
              <PaperPlaneRight className="size-4" weight="bold" />
              {submitting ? "Scheduling…" : "Schedule job"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
