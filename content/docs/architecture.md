# Flint Architecture

Flint is a standalone distributed job scheduling service, not a library. It has
three process roles — **API**, **worker** (many), and the shared state stores
**PostgreSQL** (source of truth) and **Redis** (best-effort presence, control
and events).

```
                    ┌────────────────────────────────────────────┐
   clients ──HTTP──▶│ API: admission, validation, CRUD, control  │
                    └────────────────────────────────────────────┘
                                   │ writes jobs read-only otherwise
                                   ▼
                    ┌────────────────────────────────────────────┐
                    │ PostgreSQL: durable queue & state          │
                    │  jobs · job_dependencies · job_logs ·      │
                    │  settings                                  │
                    └────────────────────────────────────────────┘
                        ▲ claim/heartbeat/complete/requeue   ▲ poll eligible rows
                        │                                    │
        ┌───────────────┴───────────┐        ┌───────────────┴────────────┐
        │ Worker A                  │        │ Worker B … N (identical)   │
        │ poller → local heap →     │        │ poller → local heap →      │
        │ executor → retry/DLQ/next │        │ executor → retry/DLQ/next  │
        └───────────────┬───────────┘        └───────────────┬────────────┘
                        └────────────── Redis ───────────────┘
                          presence keys · control channel · SSE fan-out
                          (optional: dispatch never depends on it)
```

---

## 1. Job lifecycle

```
pending ──claim──▶ processing ──success──▶ completed
   │                 │
   │                 ├──failure + retries left──▶ pending (available_at = now + backoff)
   │                 ├──failure + no retries ───▶ failed (is_dlq = true)
   │                 └──cancellation requested──▶ cancelled at next checkpoint
   └──cancel while pending─────────────────────▶ cancelled
```

`available_at` (UTC) is the single eligibility clock:

* equals `scheduled_at` for newly created jobs,
* is advanced by `now + backoff` on each retry,
* is what every poller and claim filters on.

`next_retry_at` is kept only for visibility; it never decides dispatch.

---

## 2. Durable dispatch (PostgreSQL)

`app/queues/postgres.py` owns the durable primitives.

### 2.1 Eligibility

A job is dispatchable when:

```sql
status = 'pending'
AND deleted_at IS NULL
AND is_dlq = false
AND available_at <= now()
AND NOT EXISTS (            -- DAG: all dependencies completed
      SELECT 1
      FROM job_dependencies d
      JOIN jobs deps ON deps.id = d.depends_on_id
      WHERE d.job_id = jobs.id AND deps.status <> 'completed'
)
```

A partial index `(status, available_at, effective_priority, created_at)` with
the same predicate (`idx_jobs_dispatch`) keeps this scan cheap.

### 2.2 Claim

Ordering is done by a single locked read per claimed job:

```sql
SELECT … FROM jobs
WHERE <eligibility> AND type IN (<capability filter>)
ORDER BY effective_priority ASC, available_at ASC, created_at ASC, id ASC
LIMIT 1
FOR UPDATE SKIP LOCKED
```

The selected row is transitioned to `processing`, stamped with the worker id,
claim time, lease expiry, and committed. Because the caller holds the row lock
until it commits, and every other worker's claim uses `SKIP LOCKED`, no two
workers can transition the same row concurrently. A worker's executor also
pops a *specific* `job_id` from its buffer and claims by id — if the row is no
longer eligible (cancelled, dependency broken, backoff moved, lease reaped) the
same predicate returns no row and the ticket is dropped instead of executed.
One lease owner per job is therefore a database property, not a convention.

### 2.3 Leases and heartbeats

A claim takes a lease of `WORKER_LEASE_SECONDS` (default 60 s). While a handler
runs, the owning worker heartbeats:

```sql
UPDATE jobs SET lease_expires_at = now() + :lease
WHERE id = … AND status='processing' AND worker_id = :wid
```

If a worker dies (SIGKILL, OOM-kill, network loss), the lease lapses and the
maintenance reaper requeues the row:

```sql
UPDATE jobs
SET status='pending', worker_id=NULL, lease_expires_at=NULL
WHERE status='processing' AND lease_expires_at <= now()
```

Delivery is therefore **at-least-once per lease**: handlers must be idempotent,
because a crash after an external side effect (but before completion) will be
retried on a new lease.

### 2.4 Maintenance coalescing

Every worker runs a maintenance loop under a PostgreSQL **advisory lock**
(`MAINTENANCE_LOCK_KEY`). Only the lock holder performs lease reaping and
priority aging, so hundreds of workers produce exactly one maintenance pass per
interval rather than a storm of duplicate writes.

---

## 3. Local heap (per worker)

`app/queues/heapq.py` implements a **bounded, time-aware priority buffer**.
It is explicitly *not* durable storage — the rows in PostgreSQL are.

Entries are ordered by:

1. `effective_priority` — lower is more urgent (1.0 HIGH … floored by aging),
2. `available_at` — earlier is more urgent,
3. `created_at` — older is more urgent,
4. `job_id` — deterministic tiebreaker.

Design notes:

* **Ready vs delayed.** `_ready` holds due jobs; `_delayed` holds rows whose
  `available_at` is in the future and are promoted lazily, so a future job can
  never be popped early.
* **Re-scoring is lazy.** Updating a job's score marks the old entry removed
  (O(1)) and pushes a new one (O(log n)); stale entries are skipped on pop.
* **Bounded memory with urgent-insert.** The buffer caps live entries
  (`max(100, batch × 8)`). When full, a *more urgent* arrival evicts the least
  urgent buffered entry; only a less-urgent one is rejected (dropped, not
  lost — the row stays in PostgreSQL and is polled again).
* **Opportunistic compaction.** Tombstones accumulate while a long-lived buffer
  is continuously re-scored by aging; when dead entries outnumber live ones by
  4×, both heaps are rebuilt from the live set.
* **Async safety.** An `asyncio.Lock` serialises cross-task access within a
  process. Cross-*process* correctness never relies on the heap — the DB claim
  does. At worst two workers buffer the same row and one claim simply loses.

The poller (`worker/poller.py`) refreshes the buffer every
`WORKER_POLL_INTERVAL`: pushes new rows and re-scores rows whose priority or
availability changed. Rows that have vanished from the query (cancelled,
dependency broken) are not actively struck from the buffer; when such a stale
ticket is popped, the claim predicate returns no row and the ticket is
discarded — the database stays the arbiter.

---

## 4. Worker process

`worker/worker.py` supervises a single process and starts:

| Task | Cadence | Purpose |
| --- | --- | --- |
| N executors (`WORKER_CONCURRENCY`) | loop | pop → claim → execute |
| poller | poll interval | DB → local heap |
| heartbeat | `WORKER_HEARTBEAT_INTERVAL` | extend leases for in-flight rows |
| maintenance | `MAINTENANCE_INTERVAL` | lease reaper + aging (advisory-locked) |
| control | pub/sub | `stop`/`restart` commands |

Presence is a Redis key `flint:workers:<id>` with a TTL (60 s). The API lists
workers from this key; the control channel
`flint:worker:control:<id>` carries `stop`/`restart`. A worker losing Redis
still processes jobs; it just becomes invisible to the API and `stop`.

**Graceful shutdown.** On `stop` (channel or SIGTERM/SIGINT): stop claiming →
wait up to `WORKER_SHUTDOWN_TIMEOUT` for in-flight handlers → requeue any
remaining processing rows it still owns (`release`) → verify/reap its own leases
as belt-and-braces → delete presence → close Redis/engine. Compose uses
`restart: on-failure`, so the clean exit an API-issued stop produces is *not*
auto-restarted; a crash is.

---

## 5. Execution

`worker/processor.py` executes one claimed job:

1. **Cancellation check** — a job that was cancelled between poll and claim is
   marked `cancelled` instead of started.
2. **Admission log** — `job_started` with worker id.
3. **Timeout** — `handler.execute(payload)` runs under
   `asyncio.wait_for(JOB_TIMEOUT_SECONDS)`; a `JobTimeoutError` is treated like
   any handler failure.
4. **Completion is conditional.** The success update only lands when the row is
   still `status='processing' AND worker_id = :me`; the same guard checks
   `cancellation_requested = false`. A late completion from a reaped worker, or
   one racing a cancel, is simply lost — whichever state won the database race
   stands.
5. **Retry path.** On failure with retries left: exponential backoff with full
   jitter (`base = 5^(attempt-1)`, `uniform(0.5, 1.5)`), applied to
   `available_at` so no interviewer can execute a retry early; a conditional
   update re-pends only rows this worker still owns and that were not
   cancelled meanwhile.
6. **DLQ path.** `send_to_dlq` is conditional on worker ownership too. It sets
   `failed/is_dlq/last_error`, cascades failure to downstream pending jobs
   (BFS), writes the `job_failed` log and checks the alert threshold.
7. **Recurrence.** For interval jobs the next run is INSERTed in the **same
   transaction** as completion, protected by the unique
   `(recurrence_id, recurrence_run)` constraint: a crash after side-effects but
   before commit yields a re-executed lease but never a duplicated or missed
   schedule slot. `recurrence_id` identifies the chain; `recurrence_run`
   numbers runs within it (first run is 1).

---

## 6. Dependencies (DAG)

`app/services/dag.py`:

* **Cycle detection** at creation — DFS through the existing graph; a cycle is
  rejected before any rows are written.
* **Eligibility** — encoded directly in the claim query (§2.1), so DAG joining
  costs no extra bookkeeping.
* **Cascade-cancel** — when a job fails to DLQ **or resolves as `cancelled`**
  (both a user cancelling a pending job and a worker resolving a cooperative
  cancellation at its checkpoint), downstream *pending* jobs are cancelled in
  one pass; the recorded reason distinguishes auto-cancellations from user
  cancellations, and the walk continues only through branches it actually
  cancelled — a still-processing dependent keeps ownership of its own subtree
  until it itself resolves.
* **Cascade-reset** — retrying a DLQ root resets rows that were auto-cancelled
  by the *same* root failure to `pending`, re-running the workflow from the
  fixed root. User-cancelled jobs stay cancelled.

---

## 7. Admission and validation

`POST /jobs` validates in this order, before any insert:

1. request shape and bounds (FastAPI/Pydantic),
2. handler type exists in **this deployment's** registry,
3. job payload matches the handler's `payload_model` (Pydantic schema),
4. aggregate payload size ≤ `MAX_PAYLOAD_BYTES`,
5. interval format (`<number><unit>`, unit `s|m|h|d|mo|y`),
6. DAG existence/duplicate/cycle checks.

Errors are raised as domain exceptions. A single global pipeline
(`app/core/exception_handlers.py`) renders every failure — domain errors,
Starlette `HTTPException`s, `RequestValidationError`, stray `ValueError`s
and unknown exceptions — into one envelope:

```json
{"message": "…", "data": null, "errors": [{"field": "…", "message": "…", "type": "…"}], "meta": null}
```

`PayloadValidationException` intentionally subclasses `ValueError` as well, so
Pydantic model validators can raise it directly and the request-validation
handler can expand nested handler-schema errors into per-field entries
(`body.payload.<field>`).

Built-in handler admission is strict: webhook URLs are checked for shape,
credentials, port and literal private addresses at admission; DNS resolution is
re-checked immediately before delivery (response bodies capped, redirects
disabled). Email addresses reject control characters (header-injection).

---

## 8. Redis contract (best-effort only)

| Key / channel | Purpose |
| --- | --- |
| `flint:workers:<worker_id>` (TTL 60) | Presence: JSON with status, capabilities, timestamps. |
| `flint:worker:control:<worker_id>` | Pub/sub control: `stop`, `restart`. |
| `flint:events` | Pub/sub → SSE stream (`/api/v1/sse/stream`). |

The worker's control loop deliberately drains `pubsub.get_message(timeout=…)`
in a finite loop instead of an infinite blocking `listen()`; the pool's
5-second socket timeout would otherwise be misreported as a control error every
few seconds on an idle connection.

If Redis is unavailable: the API still admits and serves jobs (`/health/ready`
reports `redis: degraded`), workers still claim and execute; only presence and
`stop`/`restart` degrade.

---

## 9. Cross-layer guarantees summary

| Guarantee | Mechanism |
| --- | --- |
| Durable admission | Row committed by `POST /jobs` before `201`. |
| One lease owner | `FOR UPDATE SKIP LOCKED` + repeat-everything claim predicate. |
| Crash safety | Leases + reaper + conditional completion/cancellation. |
| Bounded starvation | Aging under advisory lock; floored priorities. |
| DAG integrity | Creation-time cycle DFS; eligibility in claim; cascade ops. |
| Exactly-one recurring run | Unique `(recurrence_id, recurrence_run)`. |
| Schedulable == deployed | Static handler registry; API cannot register code. |
| Predictable memory | Bounded local heap with eviction + compaction. |
| Idempotent API errors | Single global error pipeline. |
