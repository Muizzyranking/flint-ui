# API Reference

The complete reference for every HTTP endpoint: conventions, request/response
shapes, error surface, and the behavioural guarantees behind them. Flint is
API-only — this is the contract any client codes against. See also the
[Usage Guide](./02-usage-guide.md) for flowing narratives and the
[default handlers](./handlers/00-default-handlers.md) for full payload rules.

- **Base URL:** `http://127.0.0.1:8000` in development
- **API prefix:** `/api/v1`
- **Content type:** `application/json` for every endpoint except the SSE
  stream
- **OpenAPI UI:** `/api/v1/docs` (interactive, generated from the running API)

## 1. Conventions

### 1.1 Authentication

Every `/api/v1/*` endpoint requires an API key. The one exception is the SSE
endpoint, which additionally accepts the key as a query parameter because the
browser `EventSource` API cannot set custom headers.

```http
X-API-Key: dev-api-key
```

```http
GET /api/v1/sse/stream?api_key=dev-api-key
```

Keys are configured with `API_KEY` and optional additional `API_KEYS`
(comma-separated) in the environment, and compared in constant time. A missing
or invalid key returns `401` with the standard error envelope.

### 1.2 Response envelope

All JSON endpoints return the same envelope:

```json
{
  "message": "Human-readable result.",
  "data": {},
  "errors": [],
  "meta": null
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `message` | string | Always present. |
| `data` | object / array / null | Endpoint-specific payload. |
| `errors` | array | Empty on success. |
| `meta` | object / null | Pagination metadata for list endpoints: `{"page": 1, "limit": 20, "total": 137}`. |

### 1.3 Errors

All errors are produced by one global exception pipeline — endpoints raise
domain exceptions and never hand-build error responses. Validation errors
carry `field` paths:

```json
{
  "message": "Validation failed.",
  "data": null,
  "errors": [
    {"field": "body.payload.url", "message": "Field required", "type": "missing"}
  ],
  "meta": null
}
```

Domain errors carry the reason in `message` and `errors[].message`:

```json
{
  "message": "Job '8f14e45f...' not found.",
  "data": null,
  "errors": [
    {"field": null, "message": "Job '8f14e45f...' not found.", "type": null}
  ],
  "meta": null
}
```

| Status | Meaning |
| --- | --- |
| `400` | Generic domain error. |
| `401` | Missing/invalid API key. |
| `404` | Job, dependency, worker, setting or DLQ/bin item not found. |
| `409` | Invalid state transition (e.g. cancelling a completed job). |
| `422` | Request validation failure, unknown job type, or payload schema failure. |
| `500` | Unhandled server error — details are logged, never returned. |
| `503` | Readiness failure (database unavailable). |

Validation errors include FastAPI/Pydantic request-shape errors, `JobCreate`
model errors (unknown handler type, payload size, interval format), and
handler payload schema errors. Everything is validated **before** the job
row is inserted — an accepted job is always a valid job.

### 1.4 Timestamps

All timestamps are ISO 8601 UTC with a trailing `Z`:
`2026-10-24T10:15:30.123456Z`.

### 1.5 Pagination

List endpoints accept:

| Query | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | integer | `1` | 1-indexed. |
| `limit` | integer | `20` | 1–100. |

### 1.6 Job statuses

```
pending ──claim──> processing ──success──> completed
   │                    │
   │                    ├──failure + retries left──> pending (available_at = now + backoff)
   │                    ├──failure + no retries────> failed (is_dlq = true)
   │                    └──cancellation requested──> cancelled
   └──cancel while pending────────────────────────> cancelled
```

`failed` jobs with `is_dlq = true` are addressable through the DLQ endpoints
(§5).

## 2. Job object

The `JobResponse` shape is returned by the job, DLQ and bin endpoints.

```json
{
  "id": "0f5f2f5e-6f0e-4d7f-9a1a-2f9d7a1e5c11",
  "type": "webhook_delivery",
  "payload": {"url": "https://example.com/hook", "body": {"event": "user.created"}},
  "priority": 2,
  "status": "pending",
  "scheduled_at": "2026-10-24T10:15:30.123456Z",
  "available_at": "2026-10-24T10:15:30.123456Z",
  "interval_seconds": null,
  "retry_count": 0,
  "max_retries": 3,
  "last_error": null,
  "effective_priority": 2.0,
  "cancellation_requested": false,
  "worker_id": null,
  "started_at": null,
  "completed_at": null,
  "lease_expires_at": null,
  "recurrence_id": null,
  "recurrence_run": 0,
  "is_dlq": false,
  "created_at": "2026-10-24T10:15:30.123456Z",
  "dependencies": null,
  "logs": null
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Job identifier. |
| `type` | string | Registered handler name. |
| `payload` | object | Validated handler payload. |
| `priority` | integer | `1` high, `2` medium, `3` low. |
| `status` | string | `pending`, `processing`, `completed`, `failed`, `cancelled`. |
| `scheduled_at` | datetime | Requested run time. |
| `available_at` | datetime | Earliest claim time: `scheduled_at` for new jobs, `now + backoff` for retries. |
| `interval_seconds` | integer / null | Recurrence interval (recurring jobs only). |
| `retry_count` | integer | Attempts already made. |
| `max_retries` | integer | Maximum attempts before DLQ (`0`–`10`). |
| `last_error` | string / null | Last handler error, `ExceptionType: reason` format. |
| `effective_priority` | float | Priority after aging; lower is more urgent. |
| `cancellation_requested` | boolean | Cooperative cancellation flag for running jobs. |
| `worker_id` | string / null | Worker that owns the current lease. |
| `started_at` | datetime / null | When the current lease was claimed. |
| `completed_at` | datetime / null | Success time. |
| `lease_expires_at` | datetime / null | Lease expiry; expired jobs are requeued by maintenance. |
| `recurrence_id` | UUID / null | Recurring chain identifier. |
| `recurrence_run` | integer | Run number in the chain (`1` for the first run of a recurring chain, `0` for non-recurring jobs). |
| `is_dlq` | boolean | Failed and parked in the dead letter queue. |
| `created_at` | datetime | Insert time. |
| `dependencies` | UUID[] / null | Jobs that must complete first. Populated **only by the detail endpoint**; `null` elsewhere. |
| `logs` | JobLog[] / null | Chronological event log. Populated **only by the detail endpoint**; `null` elsewhere. |

### Job log entry

```json
{
  "id": "6e2a19c4-6d0e-4f75-8b2e-0c1b6f9a0f22",
  "job_id": "0f5f2f5e-6f0e-4d7f-9a1a-2f9d7a1e5c11",
  "event": "job_completed",
  "message": "Job completed by worker host-123 in 42ms.",
  "metadata": {"worker_id": "host-123", "duration_ms": 42},
  "created_at": "2026-10-24T10:15:31.000000Z"
}
```

Event names: `job_created`, `job_started`, `job_completed`, `job_failed`,
`job_cancelled`, `job_retry_attempted`, `recurring_job_scheduled`.

## 3. Handler catalogue

Job types are **not hard-coded enums**. A handler is code in the Flint
repository, registered at process start with the `register_handler`
decorator. The API exposes the catalogue with each handler's JSON Schema so
clients know what is schedulable in this deployment and can render
scheduling forms.

### `GET /api/v1/handlers`

Response `200`:

```json
{
  "message": "Handlers retrieved successfully.",
  "data": {
    "handlers": [
      {
        "name": "send_email",
        "description": "Send a transactional email over SMTP.",
        "tags": ["email", "notifications"],
        "version": "1",
        "payload_schema": {
          "type": "object",
          "properties": {"to": {"type": "string"}, "subject": {"type": "string"}},
          "required": ["to", "subject"]
        }
      }
    ]
  },
  "errors": [],
  "meta": null
}
```

`payload_schema` is a standard JSON Schema (Pydantic `model_json_schema()`).

### `GET /api/v1/handlers/{name}`

Returns a single handler entry in `data`; unknown names return `404`.

### Built-in handlers

Payload rules, examples and result metadata for every handler are documented
in [Default Handlers](./handlers/00-default-handlers.md). Summary:

| Handler | Required payload | Optional payload |
| --- | --- | --- |
| `send_email` | `to` (valid email, ≤ 320), `subject` (1–200) | `body`, `html` (≤ 512 KiB each) |
| `webhook_delivery` | `url` (public `http`/`https`, ports 80/443) | `method` (default `POST`), `headers` (≤ 20, allowlisted names), `body` (JSON ≤ 256 KiB) |
| `http_ping` | `url` (public `http`/`https`) | `expected_status` (default `200`) |
| `http_fetch` | `url` (public `http`/`https`) | `expected_status` (default `200`), `include_body` (default `true`) |
| `slack_notification` | `webhook_url` (public `https`), `text` (1–4,000) | — |
| `log_processing` | `lines` (1–10,000 lines, each ≤ 8,000 chars) | `source` (default `unknown`) |
| `echo` | — | anything — the whole payload is echoed back |
| `job_retention` | `max_age_days` (1–3,650) | `include_bin` (default `true`) |

## 4. Jobs

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/jobs` | Schedule a job |
| `GET /api/v1/jobs` | List jobs |
| `GET /api/v1/jobs/{id}` | Job detail (with `dependencies` + `logs`) |
| `PATCH /api/v1/jobs/{id}/cancel` | Cancel (pending: instant; processing: cooperative) |
| `DELETE /api/v1/jobs/{id}` | Soft-delete a terminal job to the bin |

### `POST /api/v1/jobs`

Request body:

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `type` | string | yes | — | Must be a registered handler. |
| `payload` | object | no | `{}` | Validated against the handler schema; total JSON ≤ 256 KiB. |
| `priority` | integer | no | `2` | `1` high, `2` medium, `3` low. |
| `scheduled_at` | datetime / null | no | now | ISO 8601. |
| `interval` | string / null | no | null | `<number><unit>`, unit ∈ `s`, `m`, `h`, `d`, `mo`, `y` — makes the job recurring. |
| `dependency_ids` | UUID[] / null | no | null | Must exist, no duplicates, no cycles. |
| `max_retries` | integer | no | `3` | `0`–`10`. |

Example — a recurring webhook every hour:

```json
{
  "type": "webhook_delivery",
  "payload": {
    "url": "https://example.com/hooks/flint",
    "body": {"event": "user.created"}
  },
  "priority": 1,
  "scheduled_at": "2026-10-24T12:00:00Z",
  "interval": "1h",
  "dependency_ids": [],
  "max_retries": 3
}
```

Response `201` (the job is durable at this point):

```json
{
  "message": "Job created successfully.",
  "data": {"...": "JobResponse"},
  "errors": [],
  "meta": null
}
```

Validation happens before the row is inserted, in this order:

1. Request shape and bounds.
2. Handler name exists in this deployment.
3. Payload matches the handler's schema.
4. Payload size limit.
5. Interval format and dependency graph checks.

| Status | Example message |
| --- | --- |
| `422` | `Unknown job type 'foo'. Types available in this deployment: …` |
| `422` | `Invalid payload for job type 'webhook_delivery': url: Field required` |
| `422` | `Invalid interval '5x'. …` |
| `404` | `Dependency job '…' not found.` |
| `422` | `Adding dependency '…' … would create a cycle …` |

### `GET /api/v1/jobs`

```http
GET /api/v1/jobs?page=1&limit=20&status=pending&type=send_email&priority=2&search=webhook
```

| Query | Type | Notes |
| --- | --- | --- |
| `page` / `limit` | integer | Pagination (§1.5). |
| `status` | string | One of the job statuses. |
| `type` | string | Registered handler name. |
| `priority` | integer | `1`, `2` or `3`. |
| `search` | string | Partial job ID or type (e.g. UUID prefix). |

Response `200`: `data` is `JobResponse[]` with `meta.total`.
Soft-deleted jobs and DLQ jobs are excluded.

### `GET /api/v1/jobs/{id}`

Response `200`: a `JobResponse` with `dependencies` and `logs` populated —
this is the only endpoint that returns them. `404` if the job does not exist
or is soft-deleted.

### `PATCH /api/v1/jobs/{id}/cancel`

No request body.

- `pending`: immediately transitions to `cancelled`.
- `processing`: sets `cancellation_requested = true`; the worker marks it
  `cancelled` at its next execution checkpoint. The response still shows the
  job as `processing`.
- Terminal (`completed`, `failed`, `cancelled`): `409`.

Response `200`: the updated `JobResponse`.

### `DELETE /api/v1/jobs/{id}`

Only terminal jobs can be deleted. Moves the job to the bin (`deleted_at`
is set).

- `200`: `{"message": "Job moved to bin.", "data": null, …}`.
- `409`: the job is still pending/processing.
- `404`: job not found.

## 5. Dead letter queue

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/dlq` | List DLQ jobs (newest failure first; `meta.total` = DLQ size) |
| `POST /api/v1/dlq/{id}/retry` | Replay a DLQ job |
| `DELETE /api/v1/dlq/{id}` | Discard a DLQ job to the bin |

### `GET /api/v1/dlq`

Response `200`: `data` is `JobResponse[]`, newest failure first; `meta.total`
is the DLQ size (this is what alerting compares against `dlq_threshold`).

### `POST /api/v1/dlq/{id}/retry`

Resets the job to `pending`, clears `is_dlq` and `last_error`, sets
`retry_count = 0` and `available_at = now`, and restores downstream jobs that
were auto-cancelled by the original failure. No queue push is needed — any
eligible worker observes the row on its next poll.

Response `200`: updated `JobResponse`. `404` if the job is not in the DLQ or
is soft-deleted.

### `DELETE /api/v1/dlq/{id}`

Soft-deletes the job (moves it to the bin). `200` with `data: null`; `404` if
the job is not in the DLQ.

## 6. Bin (soft-deleted jobs)

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/bin` | List soft-deleted jobs (deletion time descending) |
| `PATCH /api/v1/bin/{id}/restore` | Clear `deleted_at`; the job keeps its previous status |
| `DELETE /api/v1/bin/{id}` | Hard delete — cascades to logs and dependency edges |

`PATCH …/restore` returns the updated `JobResponse`; permanent delete returns
`200` with `data: null`. `404` if the job is not in the bin.

## 7. Settings

Runtime settings are stored as strings in PostgreSQL and read live by the
alerting pipeline.

### `GET /api/v1/settings`

```json
{
  "message": "Settings retrieved successfully.",
  "data": {
    "dlq_threshold": "5",
    "alert_emails": "[\"oncall@example.com\"]"
  },
  "errors": [],
  "meta": null
}
```

### `PATCH /api/v1/settings`

Body fields are optional but at least one is required (`422` otherwise):

```json
{
  "dlq_threshold": "10",
  "alert_emails": "[\"oncall@example.com\",\"lead@example.com\"]"
}
```

| Key | Validation |
| --- | --- |
| `dlq_threshold` | Positive integer string — the DLQ size that triggers an alert email. |
| `alert_emails` | JSON array of email-like strings — alert recipients. |

Response `200`: the full settings map after the update.

## 8. Workers

Workers register presence in Redis with a 60-second TTL. Presence is
best-effort: job execution and durability never depend on Redis.

### `GET /api/v1/workers`

```json
{
  "message": "Workers retrieved successfully.",
  "data": [
    {
      "worker_id": "ip-10-0-1-24-1234-a1b2c3",
      "status": "busy",
      "capabilities": ["send_email", "webhook_delivery"],
      "ttl_seconds": 47
    }
  ],
  "errors": [],
  "meta": null
}
```

`status` is `idle` or `busy`; `ttl_seconds` shows how long until the presence
entry lapses without another heartbeat.

### `POST /api/v1/workers/{id}/stop`

Publishes a `stop` control command: the worker finishes in-flight jobs and
exits gracefully. Response `200` with `{"worker_id": "...", "command": "stop"}`;
`404` if the worker is not currently registered. See
[Operations](./05-operations.md#stopping-and-restarting-workers) for
deployment-specific behaviour.

### `POST /api/v1/workers/{id}/restart`

Publishes a `restart` command: the worker stops accepting work and exits so
the orchestrator can bring up a replacement. Response `200` with
`{"worker_id": "...", "command": "restart"}`; `404` if not registered.

## 9. Logs

### `GET /api/v1/logs`

```http
GET /api/v1/logs?page=1&limit=20&event=job_completed&job_id=<uuid>
```

| Query | Type | Notes |
| --- | --- | --- |
| `page` / `limit` | integer | Pagination (§1.5). |
| `event` | string | Exact event name. |
| `job_id` | UUID | Filter to one job. |

Response `200`: event log entries across all jobs, newest first.

```json
{
  "message": "Logs retrieved successfully.",
  "data": [
    {
      "id": "6e2a19c4-6d0e-4f75-8b2e-0c1b6f9a0f22",
      "job_id": "0f5f2f5e-6f0e-4d7f-9a1a-2f9d7a1e5c11",
      "event": "job_completed",
      "message": "Job completed by worker host-123 in 42ms.",
      "metadata": {"duration_ms": 42},
      "created_at": "2026-10-24T10:15:31.000000Z"
    }
  ],
  "errors": [],
  "meta": {"page": 1, "limit": 20, "total": 1}
}
```

## 10. Dashboard

### `GET /api/v1/dashboard/stats`

```json
{
  "message": "Dashboard stats retrieved successfully.",
  "data": {
    "pending": 12,
    "processing": 2,
    "completed": 980,
    "failed": 4,
    "cancelled": 1,
    "dlq": 3
  },
  "errors": [],
  "meta": null
}
```

DLQ jobs are excluded from `failed` and counted under `dlq`.

## 11. Server-Sent Events

```http
GET /api/v1/sse/stream?api_key=dev-api-key
Content-Type: text/event-stream
```

Every job transition is pushed as one JSON data line; exact fields depend on
the transition:

```
data: {"job_id":"0f5f2f5e-…","status":"processing","worker_id":"host-123"}

data: {"job_id":"0f5f2f5e-…","status":"completed","worker_id":"host-123","duration_ms":42}

data: {"job_id":"0f5f2f5e-…","status":"pending","retry_count":1,"available_at":"…"}

data: {"job_id":"0f5f2f5e-…","status":"failed","is_dlq":true}
```

Auth: `X-API-Key` header or `?api_key=` query parameter (the query parameter
exists for browser `EventSource`, which cannot set headers). The stream emits
a `: keepalive` comment every 15 seconds when idle. Delivery is best-effort —
clients should reconnect and reconcile state from the jobs/logs endpoints.

## 12. Health

Health endpoints are not under `/api/v1`, are unauthenticated, and do not use
the response envelope.

| Endpoint | Purpose | Response |
| --- | --- | --- |
| `GET /health/live` | Liveness | `200 {"status":"alive"}` |
| `GET /health/ready` | Readiness | `200` (ready / degraded) or `503` |
| `GET /health` | Liveness alias | `200 {"status":"ok"}` |

Ready:

```json
{"status": "ready", "components": {"database": "ok", "redis": "ok"}}
```

Redis degraded — still `200`:

```json
{"status": "ready", "components": {"database": "ok", "redis": "degraded"}}
```

Database unavailable — `503`:

```json
{"status": "not_ready", "components": {"database": "unavailable"}}
```

Redis failure never makes the API unready: Redis is used for presence/control
and SSE only, while durable dispatch lives in PostgreSQL.

## 13. Root

```http
GET /
```

Unauthenticated, no envelope:

```json
{"service": "Flint", "version": "0.2.0", "docs": "/api/v1/docs"}
```

## 14. Behavioural guarantees

| Concern | Guarantee |
| --- | --- |
| Durability | A job is durable once `POST /jobs` returns `201`; it is a PostgreSQL row. |
| Dispatch | Workers claim with `FOR UPDATE SKIP LOCKED`; one lease owner per job. |
| Retry backoff | Dispatch uses `available_at`, so a retry cannot run before its backoff. |
| Handler failure | A raising handler never takes the worker down: every attempt captures `ExceptionType: reason` in `last_error` and the event log, and the job continues through retry → DLQ. Unexpected infrastructure errors are fenced inside the job boundary and logged; lease recovery requeues the job. |
| Worker crash | Leases expire and maintenance requeues the job. |
| Shutdown | Workers stop accepting work, wait for in-flight handlers, then requeue unfinished jobs. |
| Timeout | Handlers run with `JOB_TIMEOUT_SECONDS` (default `300`). |
| Cancellation | Completion is conditional on `status='processing'` and the owning `worker_id`; a late completion cannot overwrite a cancellation. |
| Recurrence | The next run is inserted in the same transaction as completion and is protected by a unique `(recurrence_id, recurrence_run)` constraint. |
| Payload validation | At admission time against the registered handler schema — never after insert. |
| Handler registration | Static, at process start via the in-repo `register_handler` decorator. The API cannot register executable code at runtime. |
| Ordering | Global priority ordering is approximated by DB claim order; each worker keeps a bounded local heap for ordering its batch. |
| Delivery | At-least-once per lease. Handlers should be idempotent. |

