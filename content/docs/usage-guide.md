# Usage Guide

Everything you can do through the API, with examples. The exact wire shapes
and error payloads are in the [API Reference](./03-api-reference.md).

All examples assume:

```bash
export API="http://127.0.0.1:8000"
export KEY="dev-api-key"
```

i.e. every call carries `X-API-Key: $KEY` and targets `$API` (see
[Getting Started](./01-getting-started.md)).

## Core concepts

- **Job type** — the handler that will execute the work. The set of valid
  types is static per deployment; discover it with `GET /api/v1/handlers`.
- **Payload** — a JSON object validated against the handler's schema
  *at admission*. Invalid payloads are rejected with `422` and never stored.
- **Status lifecycle** — `pending → processing → completed | failed |
  cancelled`. A `pending` job is claimable once its `available_at` passes.
- **At-least-once delivery** — a job interrupted by a crash is re-run on the
  lease expiry. Handlers should be idempotent.
- **Guarantee** — a `201` from `POST /jobs` means the job is durable in
  PostgreSQL; from then on Flint owns getting it done or dead-lettering it.

## Scheduling a job

```bash
curl -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  $API/api/v1/jobs -d '{
    "type": "webhook_delivery",
    "payload": {
      "url": "https://example.com/hooks/flint",
      "body": {"event": "user.created"}
    }
  }'
```

### Job options

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `type` | string | — | Registered handler name (required) |
| `payload` | object | `{}` | Validated against the handler schema; ≤ 256 KiB |
| `priority` | integer | `2` | `1` = high, `2` = medium, `3` = low |
| `scheduled_at` | datetime | now | ISO 8601; when the job becomes claimable |
| `interval` | string | null | e.g. `"5m"` — makes the job recurring |
| `dependency_ids` | UUID[] | null | Jobs that must complete first |
| `max_retries` | integer | `3` | 0–10 retries before DLQ |

Every option can be combined — a job can be scheduled, recurring, prioritised
and upstream of other jobs at once.

## Priority and aging

`priority 1` beats `priority 2` beats `priority 3`. To keep low-priority work
from starving, each passing maintenance window nudges an older job's
`effective_priority` down (lower = more urgent). Claim queries order by
`effective_priority, available_at`, so a `priority 3` job that's waited a
long time will overtake a freshly submitted `priority 2` job.

Aging cadence is controlled by `AGING_INTERVAL`.

## Scheduled jobs

Set a future `scheduled_at`; the job sits in `pending` and becomes claimable
when `available_at` (= `scheduled_at` at creation) passes:

```bash
curl -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  $API/api/v1/jobs -d '{
    "type": "webhook_delivery",
    "scheduled_at": "2026-12-01T09:00:00Z",
    "payload": {"url": "https://example.com/morning-report", "method": "GET"}
  }'
```

A scheduled job is an ordinary row: it appears in `pending` listings, can be
cancelled, and survives restarts. Nothing wakes it up — workers simply find
it eligible once it's due.

## Recurring jobs

Pass `interval` to chain runs automatically:

```bash
curl -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  $API/api/v1/jobs -d '{
    "type": "send_email",
    "interval": "1h",
    "payload": {"to": "oncall@example.com", "subject": "hourly heartbeat", "body": "…"}
  }'
```

Interval format is `<number><unit>` with units `s`, `m`, `h`, `d`, `mo`, `y`.

How it works:

1. The first run executes as a normal job (marked
   `recurrence_run: 1` with a `recurrence_id` linking the chain).
2. On successful completion, its *next run* is inserted in the same database
   transaction with `available_at = now + interval`. A unique
   `(recurrence_id, recurrence_run)` constraint means a chain can never
   duplicate itself, even if two workers somehow complete the same lease.
3. Recurring work is therefore durable and restart-safe — there is no
   in-memory clock to lose.

Cancelling the current run cancels only that run; cancel the *next* run
while it is `pending` to stop a chain.

## Job chains (DAGs)

Create the upstream job, then reference its `id` via `dependency_ids`:

```bash
JOB_A=$(curl -s -H "X-API-Key: $KEY" $API/api/v1/jobs -d '{
  "type": "log_processing",
  "payload": {"source": "etl", "lines": ["2026-10-24T10:00:00Z INFO start", "2026-10-24T10:01:00Z INFO done"]}
}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["id"])')

curl -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  $API/api/v1/jobs -d "{
    \"type\": \"send_email\",
    \"payload\": {\"to\": \"team@example.com\", \"subject\": \"ETL finished\", \"body\": \"…\"},
    \"priority\": 1,
    \"dependency_ids\": [\"$JOB_A\"]
  }"
```

Semantics:

- A job becomes eligible for claiming only after **all** dependencies are
  `completed` (satisfaction is written transactionally by the dependency's
  completer).
- If a dependency **fails to DLQ** or is **cancelled**, downstream jobs are
  auto-cancelled — a chain never produces half-results unnoticed.
- Dependencies can be declared transitively (A → B → C), fan-out (one job,
  many dependents), and fan-in (many dependencies, one job).
- Cycles are rejected at admission (`422 … would create a cycle`) — the graph
  is checked against the existing edges before insert.

If a DLQ job is replayed (`POST /api/v1/dlq/{id}/retry`), the downstream jobs
that its failure cancelled are automatically reset to `pending` too, so the
chain resumes without manual repair.

## Retries and the DLQ

- Handlers that raise / time out are retried up to `max_retries`.
- After each attempt the job returns to `pending` with
  `available_at = now + backoff` (the backoff recomputes with the attempt
  number, so `retry_count: 2` comes later than `retry_count: 1`).
- When attempts are exhausted, the job status moves to `failed` with
  `is_dlq = true` and its `last_error` recorded.

Everything on the DLQ:

```bash
curl -H "X-API-Key: $KEY" "$API/api/v1/dlq"
```

Replay (resets `retry_count` to 0, brings the job back to `pending`, revives
cancelled downstream jobs):

```bash
curl -X POST -H "X-API-Key: $KEY" $API/api/v1/dlq/<job_id>/retry
```

Discard (soft-delete to the bin):

```bash
curl -X DELETE -H "X-API-Key: $KEY" $API/api/v1/dlq/<job_id>
```

The DLQ can email you when it grows: set `dlq_threshold` and recipients via
[Settings](#settings) (see deployment notes in
[Operations](./05-operations.md#dlq-runbook) for the full runbook).

## Cancellation

```bash
curl -X PATCH -H "X-API-Key: $KEY" $API/api/v1/jobs/<job_id>/cancel
```

| Current status | Result |
| --- | --- |
| `pending` | Immediately `cancelled`; never claimed afterwards |
| `processing` | Sets `cancellation_requested`; the worker notices at its next checkpoint and cancels the job when the handler yields (or after the timeout) |
| `completed` / `failed` / `cancelled` | `409 Invalid state transition.` |

Completion writes are conditional on the job still being `processing` **and**
owned by the same worker, so a slow handler can never mark a cancelled job
completed.

## Deleting jobs (bin)

Only terminal jobs can be deleted. `DELETE /api/v1/jobs/<id>` sets
`deleted_at` — the row continues to exist so history and dependencies remain
coherent, but it stops appearing in normal listings.

```bash
curl -X DELETE -H "X-API-Key: $KEY" $API/api/v1/jobs/<job_id>   # to bin
curl -H "X-API-Key: $KEY" $API/api/v1/bin                       # view bin
curl -X PATCH -H "X-API-Key: $KEY" $API/api/v1/bin/<job_id>/restore
curl -X DELETE -H "X-API-Key: $KEY" $API/api/v1/bin/<job_id>    # gone forever (hard delete)
```

## Monitoring

### Job detail + event log

```bash
curl -H "X-API-Key: $KEY" $API/api/v1/jobs/<job_id>
```

The detail response includes the full `dependencies` list and a
chronological `logs` array — every `job_created`, `job_started`,
`job_retry_attempted`, `job_completed/failed/cancelled`, and
`recurring_job_scheduled` with structured metadata (worker id, duration,
errors).

You can also query logs globally:

```bash
curl -H "X-API-Key: $KEY" "$API/api/v1/logs?event=job_failed&limit=50"
```

### Dashboard counters

```bash
curl -H "X-API-Key: $KEY" $API/api/v1/dashboard/stats
# {"pending": 12, "processing": 2, "completed": 980, "failed": 4, "cancelled": 1, "dlq": 3}
```

DLQ jobs are counted separately, not inside `failed`.

### Real-time stream (SSE)

```bash
curl -N "$API/api/v1/sse/stream?api_key=$KEY"
```

Every job transition is pushed as a JSON `data:` line (subject, status,
worker id, retry info …). In a browser:

```js
const es = new EventSource(`/api/v1/sse/stream?api_key=${apiKey}`);
es.onmessage = (e) => updateWidgets(JSON.parse(e.data));
```

Deliveries are best-effort (Redis pub/sub): a disconnect can miss events —
reconcile with the jobs/logs endpoints.

## Workers

```bash
curl -H "X-API-Key: $KEY" $API/api/v1/workers
# [{"worker_id":"…-a1b2c3","status":"idle","capabilities":["send_email","webhook_delivery"],"ttl_seconds":47}, …]
```

- Workers announce presence in Redis with a 60s TTL and refresh it
  continuously. A crashed worker's entry disappears by TTL even if it died
  messily.
- `capabilities` shows the handlers that worker is configured to run
  (`WORKER_HANDLERS` or `flint worker --handlers`, default: everything
  registered).

Control:

```bash
curl -X POST -H "X-API-Key: $KEY" $API/api/v1/workers/<worker_id>/stop
curl -X POST -H "X-API-Key: $KEY" $API/api/v1/workers/<worker_id>/restart
```

Both commands make the worker finish draining gracefully (see
[Operations](./05-operations.md#stopping-and-restarting-workers) for what
each means for your deployment).

## Settings

Runtime knobs live in Postgres and are read by the running fleet without a
restart:

```bash
curl -H "X-API-Key: $KEY" $API/api/v1/settings
curl -X PATCH -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  $API/api/v1/settings -d '{
    "dlq_threshold": "10",
    "alert_emails": "[\"oncall@example.com\"]"
  }'
```

| Key | Meaning |
| --- | --- |
| `dlq_threshold` | DLQ size that triggers the alert email |
| `alert_emails` | JSON array of recipient addresses |

## Delivery guarantees (read this once)

- **Durable once admitted.** A `201` means the job is a committed row.
- **At-least-once per job.** Crashed workers' jobs are reclaimed after
  `WORKER_LEASE_SECONDS`. Handlers must tolerate being run twice.
- **No silent loss on a worker crash.** The lease/heartbeat/reaper path
  requeues any job whose worker died; duplicate-execution is bounded by
  idempotent handlers.
- **Ordering is by priority, not FIFO.** Jobs claim in
  `effective_priority`/availability order across the fleet.
- **Exactly one lease owner.** `SKIP LOCKED` claims guarantee a job isn't
  concurrently executed by two workers.

## CLI for humans

```bash
uv run flint handlers                       # registered types + schemas
uv run flint schedule --type send_email \
  --payload '{"to":"you@example.com","subject":"hi"}' \
  --priority 1 --interval 10m
uv run flint schedule --type webhook_delivery \
  --payload '{"url":"https://example.com/hook"}' --at "2026-11-01T10:00:00Z"
```
