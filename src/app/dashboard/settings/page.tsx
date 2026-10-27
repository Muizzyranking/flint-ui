"use client";

import { FloppyDisk } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

import {
  ErrorPanel,
  LoadingRow,
  PageHeading,
  Panel,
  PanelHead,
} from "@/components/dashboard/ui";
import {
  type FlintApiError,
  flint,
  type SettingsMap,
} from "@/lib/flint-client";

/** The contract's known keys only; unknown keys render read-only. */
const KNOWN: { key: string; label: string; hint: string }[] = [
  {
    key: "dlq_threshold",
    label: "DLQ threshold",
    hint: "DLQ size that triggers the alert email (positive integer).",
  },
  {
    key: "alert_emails",
    label: "Alert emails",
    hint: "Comma-separated recipients stored as a JSON array of emails.",
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [draft, setDraft] = useState<{
    dlq_threshold: string;
    alert_emails: string;
  }>({
    dlq_threshold: "",
    alert_emails: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setSettings(null);
    flint<SettingsMap>("/settings")
      .then((payload) => {
        setSettings(payload.data);
        setDraft({
          dlq_threshold: payload.data.dlq_threshold ?? "",
          alert_emails: parseEmails(payload.data.alert_emails),
        });
        setError(null);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    const emails = draft.alert_emails
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    try {
      const payload = await flint<SettingsMap>("/settings", {
        method: "PATCH",
        body: {
          dlq_threshold: draft.dlq_threshold.trim(),
          alert_emails: JSON.stringify(emails),
        },
      });
      setSettings(payload.data);
      setDraft({
        dlq_threshold: payload.data.dlq_threshold ?? "",
        alert_emails: parseEmails(payload.data.alert_emails),
      });
      setNotice("Settings saved — the API validated and stored both keys.");
    } catch (reason) {
      const apiError = reason as FlintApiError;
      const fieldPaths = apiError.errors
        .filter((entry) => entry.field)
        .map((entry) => `${entry.field}: ${entry.message}`);
      setError(
        fieldPaths.length > 0
          ? `${apiError.message} (${fieldPaths.join(", ")})`
          : apiError.message,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading
        kicker="Settings"
        title="Ops settings"
        description="Runtime configuration stored in Postgres; the API validates every write."
      />

      {error ? (
        <div className="mt-6">
          <ErrorPanel message={error} onDismiss={() => setError(null)} />
        </div>
      ) : null}
      {notice ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-completed/30 bg-completed/[0.06] px-4 py-3">
          <p className="text-[14px] leading-6 text-completed">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded-md border border-completed/40 px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.08em] text-completed transition-colors hover:text-white"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {settings === null && !error ? (
        <div className="mt-8">
          <LoadingRow label="loading settings…" />
        </div>
      ) : settings !== null ? (
        <form onSubmit={save}>
          <Panel className="mt-7">
            <PanelHead title="Edit" />
            <div className="flex flex-col gap-4 px-4 py-4">
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[12.5px] text-faint">
                  {KNOWN[0].label} —{" "}
                  <span className="text-faint/70">{KNOWN[0].hint}</span>
                </span>
                <input
                  type="number"
                  min={1}
                  value={draft.dlq_threshold}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      dlq_threshold: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-line bg-canvas px-3 py-2 font-mono text-[13.5px] text-ink-soft outline-none transition-colors hover:border-line-strong focus:border-accent"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[12.5px] text-faint">
                  {KNOWN[1].label} —{" "}
                  <span className="text-faint/70">{KNOWN[1].hint}</span>
                </span>
                <input
                  type="text"
                  value={draft.alert_emails}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      alert_emails: event.target.value,
                    }))
                  }
                  placeholder="oncall@example.com, lead@example.com"
                  className="w-full rounded-md border border-line bg-canvas px-3 py-2 font-mono text-[13.5px] text-ink-soft placeholder:text-faint outline-none transition-colors hover:border-line-strong focus:border-accent"
                />
              </label>
            </div>
          </Panel>

          <Panel className="mt-4">
            <PanelHead title="Raw values as stored" />
            <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2 px-4 py-4 text-[13px]">
              {Object.entries(settings).map(([key, value]) => (
                <div key={key} className="col-span-2 grid grid-cols-subgrid">
                  <dt className="font-mono text-[12.5px] text-faint">{key}</dt>
                  <dd
                    className="truncate font-mono text-[12.5px] text-ink-soft"
                    title={value}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-black transition-colors hover:bg-white/85 active:translate-y-px disabled:opacity-50"
            >
              <FloppyDisk className="size-4" weight="bold" />
              {saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function parseEmails(raw: string | undefined): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String).join(", ");
  } catch {
    // Stored value was not valid JSON; surface it raw in the input.
  }
  return raw;
}
