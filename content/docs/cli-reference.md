# CLI Reference

Flint ships a single command-line entry point: `flint`. It is the same binary
the Docker images run — every service in Compose is a `flint` subcommand —
and the fastest way to inspect and drive a running (or local) deployment
without HTTP.

```bash
flint --version          # flint 0.2.0
flint <command> --help   # options for any command below
```

The console script is provided by the `flint` package itself (`uv run flint …`
or `.venv/bin/flint …` in a local checkout; plain `flint …` inside the Docker
images).

Configuration comes from the environment (`DATABASE_URL`, `APP_ENV`,
`WORKER_*`, …); see the [config reference](./01-getting-started.md#configuration-reference)
in Getting Started. Every command initialises logging first, so failures show
up as structured log lines.

## `flint migrate`

```bash
flint migrate
```

Applies Alembic migrations up to `head`. Idempotent: on an up-to-date
database it is a no-op. This is what the one-shot `migrate` Compose service
runs, and the API and worker containers wait for it.

Exits `1` and prints `Migration failed: <reason>` on errors.

## `flint handlers`

List every handler registered in the current build (their modules are
imported at start, which triggers each `@register_handler` decorator):

```bash
flint handlers
```

```text
echo [dev, demo] — Echo the job payload back into the result metadata. …
http_fetch [http, data] — Fetch a public HTTP(S) endpoint …
…
```

Options:

- `--json` — emit the full catalogue as JSON, including each handler's
  `payload_schema` (the same data `GET /api/v1/handlers` returns):

```bash
flint handlers --json | jq '.[].name'
```

Useful before scheduling: confirms what exists in *this* deployment and what
each handler expects in its payload. Exits `1` if no handlers are registered.

## `flint schedule`

Enqueue a job directly against the database — no API needed. It goes through
the same `JobCreate` validation path as `POST /api/v1/jobs`, so an accepted
job is every bit as valid and durable.

```bash
flint schedule \
  --type send_email \
  --payload '{"to": "you@example.com", "subject": "Hello", "body": "Sent by the CLI"}'
```

```text
0f5f2f5e-6f0e-4d7f-9a1a-2f9d7a1e5c11
```

The only output is the new job's UUID (exit `0`).

| Option | Default | Notes |
| --- | --- | --- |
| `--type` | *(required)* | Registered handler name. |
| `--payload` | `{}` | JSON object string; validated against the handler schema. |
| `--priority` | `2` | `1` high, `2` medium, `3` low. |
| `--at` | now | ISO 8601 scheduled run time, e.g. `2026-10-27T09:00:00Z`. |
| `--interval` | — | Makes the job recurring, e.g. `5m`, `1h`, `1d`. |
| `--max-retries` | `3` | `0`–`10`. |

Examples:

```bash
# Recurring uptime check every minute
flint schedule --type http_ping \
  --payload '{"url": "https://status.example.com"}' \
  --interval 1m --max-retries 1

# One-off job an hour from now
flint schedule --type webhook_delivery \
  --payload '{"url": "https://example.com/hooks/flint", "body": {"hello": "cli"}}' \
  --at "2026-10-27T18:00:00Z"

# Weekly database housekeeping
flint schedule --type job_retention \
  --payload '{"max_age_days": 90}' --interval 7d
```

Exit codes: `0` created; `2` invalid input (bad JSON payload, bad `--at`,
unknown job type, payload-schema failure — the reason is printed); `1`
unexpected failure (e.g. database unreachable).

Differences from the HTTP API: `flint schedule` covers the common path only —
it does not accept `dependency_ids`. For DAG scheduling use `POST /api/v1/jobs`
(see the [API Reference](./03-api-reference.md#post-apiv1jobs)).

## `flint api`

Run the HTTP API (uvicorn under the hood):

```bash
flint api --host 0.0.0.0 --port 8000
```

| Option | Default | Notes |
| --- | --- | --- |
| `--host` | `0.0.0.0` | Bind address. |
| `--port` | `8000` | Bind port. |
| `--reload` | off | Dev auto-reload on code changes. |
| `--http-workers` | `1` | Number of uvicorn worker processes (ignored with `--reload`). |

The Compose `api` service runs `flint api --host 0.0.0.0 --port 8000`.
For horizontal scaling, run more API containers (rather than many
`--http-workers`) — API processes are stateless apart from a shared
PostgreSQL + Redis connection pool each.

## `flint worker`

Run a job worker process. It registers presence, polls the queue, claims jobs
with `FOR UPDATE SKIP LOCKED`, executes handlers, heartbeats leases, and
shuts down gracefully on `SIGTERM`/`SIGINT` (drains in-flight work, requeues
the rest).

```bash
flint worker
```

| Option | Default | Notes |
| --- | --- | --- |
| `--worker-id` | auto | Defaults to `<hostname>-<pid>-<6 hex chars>`. Set a stable ID if dashboards should track one container over time. |
| `--concurrency` | `WORKER_CONCURRENCY` (default `2`) | Parallel in-flight jobs per worker process. |
| `--handlers` | all | Comma-separated capability filter, e.g. `send_email,webhook_delivery`. The worker claims only jobs whose type it advertises. |

Scale by starting more workers — in Compose that is
`docker compose up -d --scale worker=3`, elsewhere just run the command on
more machines pointed at the same database. See the
[Operations guide](./05-operations.md#stopping-and-restarting-workers) for
stop/restart control over the API.

## In Docker

The Compose services already wrap the commands, so most interaction happens
via `docker compose exec`:

```bash
docker compose exec api flint handlers --json
docker compose exec api flint schedule --type echo --payload '{"note": "smoke test"}'
docker compose exec worker flint worker --handlers send_email
```

Don't run `flint migrate` manually inside a running stack — the one-shot
`migrate` service owns schema changes.
