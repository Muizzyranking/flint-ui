"use client";

/**
 * Client-side access to the Flint API through the same-origin proxy
 * (`/api/flint/*`). The browser never talks to the backend directly: the
 * proxy injects `X-API-Key` server-side, so no CORS flows and no key
 * exposure. All JSON endpoints speak the standard envelope.
 */

export type ApiError = {
  field: string | null;
  message: string;
  type: string | null;
};

export type Meta = { page: number; limit: number; total: number } | null;

export type Envelope<T> = {
  message: string;
  data: T;
  errors: ApiError[];
  meta: Meta;
};

export class FlintApiError extends Error {
  status: number;
  errors: ApiError[];

  constructor(message: string, status: number, errors: ApiError[]) {
    super(message);
    this.name = "FlintApiError";
    this.status = status;
    this.errors = errors;
  }
}

type FlintRequest = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Perform a request through the proxy and unwrap the envelope. Throws
 * `FlintApiError` (with `errors[]`, including `field` paths) on failure.
 */
export async function flint<T>(
  path: string,
  options: FlintRequest = {},
): Promise<Envelope<T>> {
  const hasBody = options.body !== undefined;

  const response = await fetch(`/api/flint${path}`, {
    method: options.method ?? "GET",
    headers: hasBody ? { "content-type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    signal: options.signal ?? AbortSignal.timeout(15_000),
  });

  let payload: Envelope<T> | null = null;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload) {
    throw new FlintApiError(
      payload?.message ?? `Request failed (${response.status}).`,
      response.status,
      payload?.errors ?? [],
    );
  }

  return payload;
}

/* -------------------------------------------------------------- */
/* Contract types                                                  */
/* -------------------------------------------------------------- */

export type JobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type JobLog = {
  id: string;
  job_id: string;
  event: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type Job = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  priority: number;
  status: JobStatus;
  scheduled_at: string;
  available_at: string;
  interval_seconds: number | null;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  effective_priority: number;
  cancellation_requested: boolean;
  worker_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  lease_expires_at: string | null;
  recurrence_id: string | null;
  recurrence_run: number;
  is_dlq: boolean;
  dependencies: string[] | null;
  logs: JobLog[] | null;
  created_at: string;
};

export type Worker = {
  worker_id: string;
  status: string;
  capabilities: string[];
  ttl_seconds: number;
};

export type HandlerInfo = {
  name: string;
  description: string;
  tags: string[];
  version: string;
  payload_schema: Record<string, unknown>;
};

export type LogEntry = {
  id: string;
  job_id: string;
  event: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type DashboardStats = {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  dlq: number;
};

export type SettingsMap = Record<string, string>;

/* -------------------------------------------------------------- */
/* Formatting helpers                                              */
/* -------------------------------------------------------------- */

/** ISO 8601 UTC timestamps render in the viewer's local time. */
export function formatLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Future timestamps as a countdown, e.g. `2m 14s`; past as `-2m 05s`. */
export function formatCountdown(iso: string): string {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return iso;
  const delta = Math.round((target - Date.now()) / 1000);
  const sign = delta < 0 ? "-" : "";
  const abs = Math.abs(delta);
  const minutes = Math.floor(abs / 60);
  const seconds = abs % 60;
  if (minutes === 0) return `${sign}${seconds}s`;
  const hours = Math.floor(minutes / 60);
  if (hours === 0)
    return `${sign}${minutes}m ${String(seconds).padStart(2, "0")}s`;
  const days = Math.floor(hours / 24);
  if (days === 0)
    return `${sign}${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
  return `${sign}${days}d ${String(hours % 24).padStart(2, "0")}h`;
}

export const intervalLabel = (seconds: number | null): string | null => {
  if (seconds === null) return null;
  const units: [number, string][] = [
    [31_536_000, "y"],
    [2_592_000, "mo"],
    [86_400, "d"],
    [3_600, "h"],
    [60, "m"],
    [1, "s"],
  ];
  for (const [factor, unit] of units) {
    if (seconds % factor === 0) return `${seconds / factor}${unit}`;
  }
  return `${seconds}s`;
};
