# Default Handlers

These handlers ship with the repository. Everything here is listed by
`flint handlers` at any time, and by the API:

```bash
curl -H "X-API-Key: $KEY" $API/api/v1/handlers
```

Every handler publishes a JSON Schema (`payload_schema`), so any client can
generate scheduling forms from it. Payloads are validated **when the job is
scheduled** — invalid payloads are rejected with `422` and never stored.

Quick reference:

| Handler | Purpose | Tags |
| --- | --- | --- |
| [`send_email`](#send_email) | Transactional email (SMTP by default, one-seam swap) | email, notifications |
| [`webhook_delivery`](#webhook_delivery) | Call a public HTTP(S) endpoint with JSON | http, integration |
| [`http_ping`](#http_ping) | Status check on a public URL — cron-style monitoring | http, monitoring |
| [`http_fetch`](#http_fetch) | Fetch a public URL and carry its body into the result | http, data |
| [`slack_notification`](#slack_notification) | Post to a Slack-compatible incoming webhook | notification, chat, http |
| [`log_processing`](#log_processing) | Parse/aggregate a batch of log lines | analysis, logs |
| [`echo`](#echo) | Echo the payload back — smoke tests, pipeline heartbeats | dev, demo |
| [`job_retention`](#job_retention) | Purge old terminal/bin jobs in Flint's own database | ops, maintenance |

## `send_email`

Sends an email (plain text plus optional HTML) through Flint's unified
email seam, `app/core/email/`. By default that seam delivers over SMTP:
with the `mailhog` Compose profile enabled (the `.env` default for
development) mail lands in MailHog at `http://127.0.0.1:8025`; set
`SMTP_HOST`/`SMTP_PORT`/`SMTP_FROM` (and drop `mailhog` from
`COMPOSE_PROFILES`) for real relays. The envelope sender is `SMTP_FROM`.

**Not an SMTP user?** The DLQ threshold alerts go through the same seam, so
you can switch *everything* to an HTTP email API (Postmark, Resend, SES,
SendGrid, …) in one place: implement the `EmailSender` contract in a new
module under `app/core/email/` (return the result dict on success, raise on
failure) and return it from `get_email_sender()` in
`app/core/email/__init__.py`. That's the only edit — nothing else in the
codebase touches a transport.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `to` | string | yes | A valid email address (RFC-checked), max 320 chars |
| `subject` | string | yes | 1–200 chars, no line breaks (header-injection guard) |
| `body` | string / null | no | Plain text body; default `""` |
| `html` | string / null | no | HTML alternative body |
| — | — | — | `body`/`html` each bounded at 512 KiB |

Example:

```json
{
  "type": "send_email",
  "payload": {
    "to": "user@example.com",
    "subject": "Welcome to Flint",
    "body": "Your account is ready."
  }
}
```

Result metadata: `to`, `subject`, `delivered`.

## `webhook_delivery`

Performs an HTTP request to a **public** endpoint. Body is JSON, redirects
are **not** followed, and response bodies are capped at 256 KiB.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `url` | string | yes | `http`/`https` only, ports 80/443, no embedded credentials, host must be a public address (literal private/loopback/link-local hosts rejected at admission; DNS resolved again right before delivery) |
| `method` | string / null | no | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. Default `POST` |
| `headers` | object | no | Max 20 headers. Allowlist: `accept`, `content-type`, `user-agent`, `x-request-id`, `x-correlation-id` |
| `body` | object | no | Request body, mapped to JSON ≤ 256 KiB |

Example:

```json
{
  "type": "webhook_delivery",
  "payload": {
    "url": "https://example.com/hooks/flint",
    "method": "POST",
    "headers": {"x-request-id": "evt-42"},
    "body": {"event": "user.created", "id": "u_123"}
  }
}
```

Result metadata: `url`, `method`, `status_code`, `response_body` (truncated).
HTTP ≥ 400 (and redirects) raise — retries/DLQ apply.

## `http_ping`

Requests a public URL, verifies its status code and reports the round-trip
time. Combine with `interval` for cron-like uptime monitoring: a bad status
or a down host triggers retries and, after `max_retries`, lands in the DLQ
(where the alerting settings kick in).

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `url` | string | yes | Same public-URL rules as `webhook_delivery`; GET only; redirects not followed |
| `expected_status` | integer | no | `100`–`599`; default `200` — any other code fails the job |

```json
{
  "type": "http_ping",
  "payload": {"url": "https://status.example.com", "expected_status": 200}
}
```

Example recurring monitor:

```json
{
  "type": "http_ping",
  "interval": "1m",
  "max_retries": 1,
  "payload": {"url": "https://status.example.com"}
}
```

Result metadata: `url`, `status_code`, `expected_status`, `elapsed_ms`.

## `http_fetch`

Fetches a public URL and, optionally, carries the response body (JSON when
parseable) into the result metadata. Useful for data pipelines: a fetch job's
result can be inspected in the job detail view, or simply as the first stage
of a dependency chain.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `url` | string | yes | Same public-URL rules as `http_ping` |
| `expected_status` | integer | no | `100`–`599`; default `200` |
| `include_body` | boolean | no | Default `true`; body capped at 64 KiB (`truncated: true` when cut) |

```json
{
  "type": "http_fetch",
  "payload": {"url": "https://api.example.com/config.json"}
}
```

Result metadata: `url`, `status_code`, `elapsed_ms`, `content_type`,
`body_bytes`, `body`, `truncated`.

## `slack_notification`

Posts a message to a Slack-compatible incoming webhook. Can be triggered
directly, chained after another job (dependency), or scheduled for reminders.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `webhook_url` | string | yes | Slack-compatible incoming webhook URL (public `https` only, same SSRF rules) |
| `text` | string | yes | 1–4,000 chars |

```json
{
  "type": "slack_notification",
  "payload": {
    "webhook_url": "https://hooks.slack.com/services/…",
    "text": "Flint DLQ now holds 6 jobs."
  }
}
```

Result metadata: `delivered`, `text_length`.

## `log_processing`

Parses and aggregates a batch of application log lines.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `lines` | string[] | yes | 1–10,000 lines; each ≤ 8,000 chars |
| `source` | string | no | Default `unknown` |

Line format is `<timestamp> <LEVEL> <message>` where LEVEL ∈ `DEBUG`,
`INFO`, `WARNING`, `ERROR`, `CRITICAL`:

```json
{
  "type": "log_processing",
  "payload": {
    "source": "app-server-01",
    "lines": [
      "2026-10-24T10:00:00Z INFO Request received",
      "2026-10-24T10:00:01Z ERROR Database timeout"
    ]
  }
}
```

Result metadata: per-level counts, top errors, error rate %, parse-error
count. Fails if no line parses.

## `echo`

The simplest possible handler: echoes the payload into the result metadata,
so it shows up in the job's event log. Perfect for:

- verifying a deployment / worker fleet is scheduling and executing,
- exercising a full job pipeline (retries, dependencies, recurrence),
- pipeline heartbeats (recurring `echo` every N minutes proves end-to-end
  health without external side effects).

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `note` | string / null | no | Optional note echoed back |
| *(anything else)* | any | no | Arbitrary JSON — extra keys are preserved |

```json
{
  "type": "echo",
  "payload": {"note": "hello", "any": {"nested": [1, 2, 3]}}
}
```

Result metadata: `{"echoed": true, "payload": {…}}` — the whole payload comes
back.

## `job_retention`

Housekeeping for Flint's own database: permanently removes `completed` and
`cancelled` jobs older than `max_age_days` (and optionally bin items).
Job histories of deleted jobs cascade: log entries and dependency edges are
removed with them. Schedule it as a recurring job — daily or weekly is
typical.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `max_age_days` | integer | yes | 1–3,650 |
| `include_bin` | boolean | no | Default `true`; also hard-delete bin jobs older than the cutoff |

```json
{
  "type": "job_retention",
  "payload": {"max_age_days": 90}
}
```

Result metadata: `cutoff`, `purged_terminal_jobs`, `purged_bin_jobs`.

Notes:

- Only `completed`/`cancelled` (and bin) rows are touched — `failed`/DLQ jobs
  are preserved so failures stay actionable.
- Running `job_retention` on a fresh deployment purges nothing.

---

Missing something? Handlers are meant to be added freely within this repo —
see [Adding a New Handler](./adding-a-new-handler.md).
