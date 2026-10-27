/**
 * Server-side access to the Flint API.
 *
 * `API_URL` and `API_KEY` are read from `process.env` inside function bodies,
 * never at module scope — so the server picks env changes up at request time
 * and the build bakes in nothing (no `NEXT_PUBLIC_API_*` anywhere).
 */

export type FlintHealth =
  | { ok: true; version: string | null }
  | { ok: false; reason: string };

const HEALTH_TIMEOUT_MS = 4000;

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Root of the Flint API host, e.g. `http://api:8000`.
 *
 * `API_URL` may be given with or without the `/api/v1` prefix — both are
 * accepted (Compose injects `http://api:8000/api/v1`; pointing it at the
 * bare host also works). The prefix is applied exactly once when building
 * upstream URLs, so `health/ready` can still target the root paths defined
 * by the contract (they live OUTSIDE `/api/v1`).
 */
export function getApiUrl(): string | null {
  const raw = process.env.API_URL;
  if (!raw) return null;
  // Strip trailing slashes and any trailing `/api/v1` so it is never doubled.
  return stripTrailingSlash(raw).replace(/\/api\/v1$/, "");
}

/** API key injected by the environment; forwarded as `X-API-Key`. */
export function getApiKey(): string | null {
  return process.env.API_KEY ?? null;
}

/**
 * Build an upstream URL in the shape the browser would use on the backend:
 * `/api/v1/<path>`. Path is the contract path (`jobs`, `dlq`, `sse/stream`…).
 */
export function upstreamUrl(path: string, query?: string): string | null {
  const base = getApiUrl();
  if (!base) return null;

  const suffix = `${path}?${query ?? ""}`.replace(/\?$/, "");
  return `${base}/api/v1/${suffix.replace(/^\//, "")}`;
}

/**
 * Check that the backend exists and is healthy: `GET /health/ready` must be
 * 200 with `"status": "ready"`. The version comes from the unauthenticated
 * `GET /` root document, best-effort.
 */
export async function checkFlintHealth(): Promise<FlintHealth> {
  const base = getApiUrl();
  if (!base) {
    return { ok: false, reason: "API_URL is not configured." };
  }

  try {
    const response = await fetch(`${base}/health/ready`, {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: `Health check returned ${response.status} from ${base}.`,
      };
    }

    const body = (await response.json()) as { status?: string };
    if (body?.status !== "ready") {
      return {
        ok: false,
        reason: `API is not ready (status: ${body?.status ?? "unknown"}).`,
      };
    }
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? `Timed out contacting ${base}.`
        : `Could not reach ${base}.`;
    return { ok: false, reason: message };
  }

  // Root document is unauthenticated and carries the deployed version.
  let version: string | null = null;
  try {
    const root = await fetch(base, {
      method: "GET",
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (root.ok) {
      const payload = (await root.json()) as { version?: string };
      version = payload?.version ?? null;
    }
  } catch {
    version = null;
  }

  return { ok: true, version };
}
