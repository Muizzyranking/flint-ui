import { connection } from "next/server";
import { type ReactNode, Suspense } from "react";
import { BackendErrorState } from "@/components/dashboard/backend-error-state";
import { DashboardShell } from "@/components/dashboard/dashboard";
import { DashboardChecking } from "@/components/dashboard/dashboard-checking";
import { checkFlintHealth, getApiUrl } from "@/lib/flint-api";

/**
 * Every `/dashboard/*` route is gated by a server-side health check:
 * healthy → the shell with the page inside; anything else → the animated
 * "server is probably down" state with a link to docs.
 *
 * `await connection()` opts the gate out of prerendering, so `API_URL` is
 * read from `process.env` at request time — the build bakes in nothing.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<DashboardChecking />}>
      <DashboardGate>{children}</DashboardGate>
    </Suspense>
  );
}

async function DashboardGate({ children }: { children: ReactNode }) {
  // Wait for the incoming request before doing any work: the health check
  // and env reads below run per request, never at build time.
  await connection();

  const apiUrl = getApiUrl();
  const health = await checkFlintHealth();

  if (!health.ok) {
    return <BackendErrorState apiUrl={apiUrl} reason={health.reason} />;
  }

  return <DashboardShell>{children}</DashboardShell>;
}
