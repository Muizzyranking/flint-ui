export function DashboardChecking() {
  return (
    <section className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <span className="relative flex size-3">
        <span className="absolute inline-flex size-3 animate-ping rounded-full bg-accent-bright opacity-50" />
        <span className="relative inline-flex size-3 rounded-full bg-accent-bright" />
      </span>
      <p className="mt-6 font-mono text-[13px] text-muted">
        Connecting to the API…
      </p>
    </section>
  );
}
