# Getting Started

This guide covers the fastest way to run Flint (Docker Compose handles the
whole stack), scheduling your first job, and the configuration reference for
local development.

## Prerequisites

- Docker + Docker Compose (the primary way to run Flint)
- `curl` for the examples
- Optional, for bare-metal development: Python 3.13 with
  [uv](https://docs.astral.sh/uv/), plus PostgreSQL 16 and Redis 7 reachable
  from your machine

## 1. Run the stack with Docker Compose

Clone the repository, then start everything from its root:

```bash
git clone https://github.com/muizzyranking/flint.git   # ← your fork/host
cd flint
cp .env.example .env                             # edit if needed; defaults are fine for dev
docker compose up -d --build
```

Compose starts five services:

| Service | What it does | Where to reach it |
| --- | --- | --- |
| `postgres` | Durable job store | Internal (`postgres:5432`) |
| `redis` | Event fan-out, worker presence & control | Internal (`redis:6379`) |
| `migrate` | One-shot schema migration; API/worker wait for it | Runs and exits |
| `api` | The REST API + SSE stream | `http://127.0.0.1:8000` |
| `worker` | Executes jobs | Logs in `./logs` |
| `mailhog` | Catches outgoing email for development | UI at `http://127.0.0.1:8025`, SMTP at 1025 |
| `frontend` *(optional)* | The web dashboard — a CI-built artifact, downloaded from `FRONTEND_RELEASE_URL` in `.env` (a gzip tarball with a runnable site); started with `docker compose --profile frontend up -d`, served on `http://127.0.0.1:3000` with `API_URL`, `API_KEY` and `PORT` injected | |

Verify the deployment is healthy:

```bash
curl http://127.0.0.1:8000/health/ready
# {"status":"ready","components":{"database":"ok","redis":"ok"}}

curl http://127.0.0.1:8000/
# {"service":"Flint","version":"0.2.0","docs":"/api/v1/docs"}
```

Two documentation surfaces exist out of the box:

- `http://127.0.0.1:8000/api/v1/docs` — interactive OpenAPI (Swagger) UI
- the Markdown pages you are reading (this `docs/` directory)

### Auth

Every `/api/v1/*` endpoint requires the API key via the `X-API-Key` header:

```bash
export API="http://127.0.0.1:8000"
export KEY="dev-api-key"   # API_KEY in .env / docker-compose default
curl -H "X-API-Key: $KEY" $API/api/v1/handlers
```

Missing/invalid keys return `401`. Only the SSE stream accepts the key as
`?api_key=` (because browser `EventSource` cannot set headers).

## 2. Schedule your first job

`log_processing` is a good little no-op job. `send_email` produces a visible
result: check `http://127.0.0.1:8025` after it completes.

```bash
curl -s -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  $API/api/v1/jobs \
  -d '{
    "type": "send_email",
    "payload": {
      "to": "you@example.com",
      "subject": "Hello from Flint",
      "body": "First job scheduled."
    }
  }'
```

Response envelope (`201`, abbreviated):

```json
{
  "message": "Job created successfully.",
  "data": {
    "id": "0f5f2f5e-6f0e-4d7f-9a1a-2f9d7a1e5c11",
    "type": "send_email",
    "status": "pending",
    "priority": 2
  },
  "errors": [],
  "meta": null
}
```

Watch it run:

```bash
curl -s -H "X-API-Key: $KEY" "$API/api/v1/jobs?status=completed" | head -40
```

Or connect to the real-time stream and schedule another job:

```bash
curl -N "$API/api/v1/sse/stream?api_key=$KEY"
# data: {"job_id":"…","status":"pending",…}
# data: {"job_id":"…","status":"processing",…}
# data: {"job_id":"…","status":"completed",…}
```

A returned `201` is the durability contract: from that moment the job is a
PostgreSQL row and a worker will process it, even if an instance dies mid-way
(leases expire and healthy workers re-run it — at-least-once semantics).

## 3. Explore the CLI

The `flint` command is useful for quick checks without HTTP:

```bash
uv run flint handlers
uv run flint handlers --json
uv run flint schedule --type send_email --payload '{"to":"you@example.com","subject":"hi"}'
uv run flint schedule --type log_processing --at "2026-12-01T09:00:00Z"
```

## 4. Develop without Docker

If you prefer running API/worker locally against your own Postgres + Redis:

```bash
# Postgres + Redis only; build/run the rest on the host
docker compose up -d postgres redis

cp .env.example .env         # hosts are already localhost-friendly
uv sync --group dev          # installs the project + dev tools into .venv

uv run flint migrate         # apply the schema
uv run flint api --reload    # API on 127.0.0.1:8000
uv run flint worker          # second terminal; jobs execute here
```

All commands are subcommands of the `flint` entry point:

| Command | Purpose |
| --- | --- |
| `flint migrate` | Run database migrations (no-op if up to date) |
| `flint api --host … --port … [--reload]` | Run the API |
| `flint worker [--concurrency N] [--handlers t1,t2] [--worker-id id]` | Run a worker |
| `flint handlers [--json]` | Show the registered handler catalogue |
| `flint schedule --type T [--payload JSON] [--priority 1-3] [--at ISO8601] [--interval 5m] [--max-retries N]` | Create a job directly |

## 5. Scale workers

Workers are identical containers; capacity is a scale flag:

```bash
docker compose up -d --scale worker=5
```

Tune per-worker behaviour with:

| Variable | Default | Meaning |
| --- | --- | --- |
| `WORKER_CONCURRENCY` | `2` | In-flight handlers per worker |
| `WORKER_BATCH_SIZE` | `25` | Rows fetched per poll |
| `WORKER_POLL_INTERVAL` | `0.5` | Seconds between DB polls |
| `WORKER_LEASE_SECONDS` | `60` | Lease duration before a crashed worker's job is requeued |
| `WORKER_HEARTBEAT_INTERVAL` | `15` | Lease heartbeat cadence |
| `WORKER_SHUTDOWN_TIMEOUT` | `30` | Max seconds to drain on shutdown |
| `JOB_TIMEOUT_SECONDS` | `300` | Per-handler timeout |
| `WORKER_HANDLERS` | *(empty = all)* | Capability filter, e.g. `send_email,webhook_delivery` |

## Configuration reference

All configuration is environment-based (`cp .env.example .env`). Highlights:

### Core

| Variable | Default | Meaning |
| --- | --- | --- |
| `APP_ENV` | `development` | In `production`, failures to set `API_KEY` fail startup |
| `API_KEY` / `API_KEYS` | `dev-api-key` / *(empty)* | Primary key; `API_KEYS` adds rotating extras (comma separated) |
| `CORS_ORIGINS` | *(empty)* | Comma-separated list of allowed browser origins |
| `FRONTEND_URL` | `http://localhost:3000` | Convenience metadata |
| `DATABASE_URL` | `postgresql+asyncpg://flint:flint@localhost:5432/flint` | SQLAlchemy async URL |
| `REDIS_URL` | `redis://localhost:6379/0` | Events, presence, control channels |

### Mail / handlers

| Variable | Default | Meaning |
| --- | --- | --- |
| `SMTP_HOST` / `SMTP_PORT` | `localhost` / `1025` | MailHog in Compose |
| `SMTP_FROM` | `flint@flint.local` | Envelope sender for `send_email` |
| `MAX_PAYLOAD_BYTES` | `262144` | Job payload admission limit (256 KiB) |

### Maintenance / logging

| Variable | Default | Meaning |
| --- | --- | --- |
| `MAINTENANCE_INTERVAL` | `15` | Seconds between reaper passes (lease expiry, cleanup) |
| `AGING_INTERVAL` | `30` | Seconds between priority-aging passes |
| `LOG_LEVEL` | `INFO` | `DEBUG`/`INFO`/`WARNING`/`ERROR` |
| `LOG_FILE` | `logs/flint.log` | Rotating JSON log (stdout mirrors it) |

Next: learn everything you can do with jobs in the
[Usage Guide](./02-usage-guide.md).
