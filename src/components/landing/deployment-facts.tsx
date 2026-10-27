type Facts = {
  service: string;
  version: string;
  ready: boolean;
};

async function getJson<T>(
  url: string,
  headers: HeadersInit,
): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function loadFacts(): Promise<Facts | null> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return null;

  let origin: string;
  try {
    origin = new URL(apiUrl).origin;
  } catch {
    return null;
  }

  const headers: HeadersInit = process.env.API_KEY
    ? { "X-API-Key": process.env.API_KEY }
    : {};

  const [root, ready] = await Promise.all([
    getJson<{ service: string; version: string }>(`${origin}/`, headers),
    getJson<{ status: string }>(`${origin}/health/ready`, headers),
  ]);

  if (!root) return null;

  return {
    service: root.service ?? "Flint",
    version: root.version ?? "unknown",
    ready: ready?.status === "ready",
  };
}

export async function DeploymentFacts() {
  const facts = await loadFacts();

  if (!facts) {
    return (
      <div className="border-t border-line pt-5">
        <div className="flex items-center gap-2 font-mono text-[12px] text-faint">
          <span className="size-2 rounded-full bg-cancelled" />
          API not attached
        </div>
        <p className="mt-2 max-w-[42ch] text-[13.5px] leading-6 text-faint">
          Set <span className="font-mono text-muted">API_URL</span> and{" "}
          <span className="font-mono text-muted">API_KEY</span> at runtime to
          show this deployment&rsquo;s service facts here.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-line pt-5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 font-mono text-[12px]">
        <span
          className={`size-2 rounded-full ${
            facts.ready ? "bg-completed" : "bg-failed"
          }`}
        />
        <span className="text-ink">{facts.service}</span>
        <span className="text-faint">{facts.version}</span>
        <span className="text-line-strong">/</span>
        <span className={facts.ready ? "text-completed" : "text-failed"}>
          {facts.ready ? "ready" : "not ready"}
        </span>
      </div>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
        Live from API_URL
      </p>
    </div>
  );
}
