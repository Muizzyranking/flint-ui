# Introduction

## What is Flint

> Flint is an open, self-hostable job scheduling service. Declare work over
> HTTP, run it on a horizontally scalable fleet of workers, and watch every
> job's lifecycle in real time.

Flint is **a standalone service, not a library**. You keep your application
code free of scheduling concerns: the backend (or any client) POSTs jobs to
the API, workers pick them up, and PostgreSQL guarantees that a job that was
accepted is never lost. It ships with retries, dead-letter queueing, job
dependencies, recurring schedules, worker control, and a real-time event
stream out of the box.

## One-line descriptions (pick per audience)

- **Infrastructure:** "A durable, Postgres-backed job queue you can scale by
  adding worker containers."
- **Backend engineers:** "Cron + queues + retries + dependency graphs behind
  one REST API."
- **Everyone else:** "Tell Flint what to do and when — it makes sure it
  happens, retries if it fails, and tells you what went wrong."

## Value propositions

1. **Durable by design** — Every accepted job is a PostgreSQL row. Worker
   crashes, restarts and network blips never lose in-flight work; leases
   expire and the job runs on a healthy worker.
2. **Horizontally scalable workers** — All workers are identical containers.
   Add capacity with `docker compose up -d --scale worker=10`. Jobs are
   claimed with `FOR UPDATE SKIP LOCKED`, so there is exactly one lease owner
   per job and no coordination service to run.
3. **Priority, schedules, recurrence and DAGs** — Three priority levels with
   aging, future scheduling (`scheduled_at`), recurring jobs (`interval:
   "5m"`), and fan-out/fan-in dependency graphs (a job runs only after its
   dependencies complete, cancellations cascade downstream).
4. **Ops built in** — Retries with exponential-style backoff, a dead letter
   queue with alert emails and one-call replay, a soft-delete bin, job event
   logs, dashboard counters, and Server-Sent Events for real-time status.
5. **Typed, static handlers** — Job types are registered code (not runtime
   dispatch). Every handler publishes a JSON Schema, so the API validates
   payloads *at admission* — invalid work is rejected with a precise error
   before it can ever fail in production.
6. **API-only, frontend-agnostic** — One REST contract (`/api/v1/*`), one
   SSE stream, CORS support for web frontends. Build the UI you want against
   the contract in [the API reference](./03-api-reference.md).

## Feature grid

| Feature | What it means | Where to see it |
| --- | --- | --- |
| Durable queue | PostgreSQL is the source of truth; Redis is never required for dispatch | [Architecture](./04-architecture.md) |
| Admission validation | Payloads validated against the handler schema before insert | `POST /api/v1/jobs` error responses |
| Priority + aging | `priority` 1–3; low-priority jobs age up so they are never starved | [Usage guide](./02-usage-guide.md#priority-and-aging) |
| Scheduled jobs | Run at any future `scheduled_at` | [Scheduled jobs](./02-usage-guide.md#scheduled-jobs) |
| Recurring jobs | `interval` like `30s`, `12h`, `1d` chains runs automatically | [Recurring jobs](./02-usage-guide.md#recurring-jobs) |
| Dependencies (DAG) | Jobs wait for dependencies; failures cascade | [Job chains](./02-usage-guide.md#job-chains-dags) |
| Retries & DLQ | Configurable attempts, `available_at` backoff, DLQ with replay | [Retries and the DLQ](./02-usage-guide.md#retries-and-the-dlq) |
| Cancellation | Instant for pending jobs, cooperative for running ones | [Cancellation](./02-usage-guide.md#cancellation) |
| Real-time events | SSE stream of every job transition | [Monitoring](./02-usage-guide.md#monitoring) |
| Worker control | List workers, graceful stop/restart from the API | [Workers](./02-usage-guide.md#workers) |
| Typed handlers | Killer feature for devs: register a handler, get validation + docs for free | [Adding handlers](./handlers/01-adding-a-new-handler.md) |

## How it works

```
   your code ──HTTP──▶  Flint API  ──write──▶  PostgreSQL (durable queue)
                          │                        ▲    │ claim eligible jobs
                          │ events (SSE)           │    ▼
                          ▼                   Flint workers (N ×)
                    your frontend  ◀──── Redis (events, worker presence/control)
```

1. A client POSTs a job with a registered `type`, a validated `payload`, and
   optional scheduling options. The API validates and inserts; `201` means
   *durable*.
2. Every worker continuously polls the database for eligible rows (sorted by
   effective priority), claims them with `SKIP LOCKED`, and leases them
   with heartbeats.
3. The worker executes the handler within a configurable timeout. Successes,
   retries, failures, cancellations and the next recurring run are each
   written with conditional SQL updates.
4. Failures retry with backoff; failures that exhaust attempts land in the
   dead letter queue; operators replay or discard from there.
5. Every transition is appended to the job's event log, published to the SSE
   stream and counted on the dashboard.

## Machine-readable deployment facts

The API exposes its own facts — useful for status pages and automation:

```http
GET /
```

```json
{"service": "Flint", "version": "0.2.0", "docs": "/api/v1/docs"}
```

```http
GET /api/v1/handlers
```

```json
{
  "data": {
    "handlers": [
      {
        "name": "send_email",
        "description": "Send a transactional email over SMTP.",
        "tags": ["email", "notifications"],
        "version": "1",
        "payload_schema": { "...": "JSON Schema" }
      }
    ]
  }
}
```

- Service name, version → `GET /`; deployment health → `GET /health/ready`.
- Schedulable job types and their schemas → `GET /api/v1/handlers`.
- Counters per status → `GET /api/v1/dashboard/stats`.
- Live worker fleet → `GET /api/v1/workers`.

## Who Flint is for

- Teams that need a dependable background-job layer *without* building one:
  emails, webhooks, report generation, data pipelines, fan-out processing.
- Deployments that prefer Postgres-only infra: no Kafka, no RabbitMQ, no
  ZooKeeper, no external coordinator to babysit.
- Frontend teams who want a clean, documented REST + SSE contract to build
  monitoring UIs against.

## Tech stack

| Layer | Choice |
| --- | --- |
| API | Python 3.13, FastAPI, Uvicorn |
| Workers | Same Python image, asyncio, SQLAlchemy async |
| Storage | PostgreSQL (jobs, logs, settings), Redis (events, presence, control) |
| Delivery | Docker / Docker Compose; each role is one command (`flint api`, `flint worker`) |
| Observability | structlog JSON logs, SSE stream, dashboard counters, readiness probes |
