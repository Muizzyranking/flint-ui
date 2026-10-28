# Operations

Running, scaling and maintaining a deployed Flint installation.

## Service topology

| Role | Replicas | Restart policy (Compose) | Notes |
| --- | --- | --- | --- |
| API (`flint api`) | 1 (+ can scale externally; it is stateless) | `unless-stopped` | State lives in Postgres; any API instance is equivalent |
| Worker (`flint worker`) | N | `on-failure` | Identical containers; capacity is a scale flag |
| `migrate` | 1 (one-shot) | `no` | Runs schema migrations, exits; API/worker wait for its success |
| Postgres / Redis | 1 each | `unless-stopped` | Volumes persisted (`postgres_data`, `redis_data`) |

## Health checks

```bash
curl http://127.0.0.1:8000/health/live   # process alive
curl http://127.0.0.1:8000/health/ready  # database ok? redis ok?
```

- `503` on `/health/ready` means the database is unreachable — that is the
  only state that makes the API unready.
- `redis: "degraded"` still yields `200`: the API can read/write jobs without
  Redis. With Redis down you lose live events (SSE), worker presence and
  worker control until it returns — durability is never affected.

Wire the Compose API healthcheck or these endpoints into your orchestrator
of choice (Kubernetes probes, systemd sockets, load-balancer checks).

## Logs

Two sinks, one format (JSON via structlog):

- `stdout` — captured by the container runtime (`docker compose logs -f api`)
- `logs/flint.log` inside the worker/api container — rotating, 10 MiB × 5
  backups (Compose bind-mounts `./logs`)

Key properties:

- One global processor redacts sensitive keys (`api_key`, `password`,
  `token`, `authorization`, cookies, …) before anything reaches either sink.
- Structured fields make log search trivial: filter by `event`, `job_id`,
  `worker_id`.
- Noisy libraries (SQLAlchemy, uvicorn access, httpx, redis, aiosmtplib) are
  pinned to `WARNING` to keep signal high; tune with `LOG_LEVEL`.

## Scaling

```bash
docker compose up -d --scale worker=10
```

- Workers are identical; there is no leader, no partition assignment and no
  coordination step. contention is handled by `FOR UPDATE SKIP LOCKED` claim
  queries.
- Per-worker throughput is governed by `WORKER_CONCURRENCY` (in-flight
  handlers) and `WORKER_BATCH_SIZE` (rows per poll). Increase
  `WORKER_CONCURRENCY` for many fast jobs; add replicas for CPU-heavy or
  IO-heavy work.
- Postgres is the shared bottleneck: at large fleet sizes watch connection
  count and claim-query latency, and tune `WORKER_POLL_INTERVAL` upward if
  you have hundreds of idle workers.
- Specialist workers: pin types to sub-fleets with `WORKER_HANDLERS` (see
  [Adding Handlers](./handlers/adding-a-new-handler.md#restricting-which-handlers-a-worker-runs)).

## Stopping and restarting workers

Control commands are delivered over Redis pub/sub to the worker's dedicated
channel `flint:worker:control:{worker_id}` (the worker also long-polls that
channel while otherwise just waiting).

What each command does inside the worker process:

| Command | Worker behaviour |
| --- | --- |
| `stop`  | Sets its shutdown event: stops claiming, waits for in-flight handlers (`WORKER_SHUTDOWN_TIMEOUT`), requeues any unfinished work, deregisters presence, exits with code 0 |
| `restart` | Same graceful shutdown, framed as "so the orchestrator can replace it" |

What the *deployment* does afterwards depends on the supervisor:

- **Docker Compose (current setup):** the worker's restart policy is
  `on-failure`. A clean exit (code 0) is not a failure, so Docker leaves the
  container stopped — which is what makes "stop" stick. Consequence:
  after a `stop` or a `restart`, the fleet is one worker short until you
  bring it back, e.g. `docker compose up -d --scale worker=3`. Crashes and
  non-zero exits *are* restarted automatically.
- **Kubernetes / systemd / Nomad:** the process exiting is an ordinary pod
  termination; the controller replaces it, so `restart` gives you a fresh
  worker automatically and "stop" for real downtime needs the corresponding
  platform action (scale down, etc.).
- **Another option:** if you want Compose-side self-healing for `restart`
  (without resurrecting workers you explicitly stopped), the worker CLI can
  adopt an exit-code protocol — e.g. exit `0` on `stop` and a non-zero
  sentinel (say `42`) on `restart`, keeping `restart: on-failure`: Docker
  then respawns only restarts, an explicit stop stays down.

Workers that are stopped through the API are absent from
`GET /api/v1/workers` immediately after deregistration; pending jobs are
reclaimed by other workers or (if none exist) wait idly — nothing is lost,
and scaling back up resumes exactly where things left off.

## DLQ runbook

1. **Awareness.** When the DLQ crosses `dlq_threshold` settings, an alert
   email goes to every address in `alert_emails`.
   ```bash
   curl -X PATCH -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
     $API/api/v1/settings \
     -d '{"dlq_threshold": "5", "alert_emails": "[\"oncall@example.com\"]"}'
   ```
   Emails are sent with the built-in `send_email` handler — with the
   `mailhog` profile enabled (dev default) they land in MailHog
   (`http://127.0.0.1:8025`), otherwise in the configured relay's inbox.
2. **Triage.** Read `last_error` on `GET /api/v1/dlq`, plus the job's detail
   view (`GET /api/v1/jobs/{id}`) for the retry timeline.
3. **Recover** if the failure was transient (deploy done, dependency fixed):
   ```bash
   curl -X POST -H "X-API-Key: $KEY" $API/api/v1/dlq/<job_id>/retry
   ```
   This also un-cancels the downstream jobs that the failure had
   cascade-cancelled, so dependent chains resume automatically.
4. **Discard** jobs that should never run again:
   ```bash
   curl -X DELETE -H "X-API-Key: $KEY" $API/api/v1/dlq/<job_id>
   ```
   (lands in the bin; purge from there if hard deletion is required).

## Maintenance cadences

Two background maintenance loops run on every worker process (single
leaderless duties executed with conditional updates, safe against overlap):

| Loop | Interval | Work |
| --- | --- | --- |
| Reaper | `MAINTENANCE_INTERVAL` (15s) | Requeues jobs whose lease expired (`WORKER_LEASE_SECONDS`) with no heartbeat; dispatches cancellations that raced a lease; sends DLQ alert emails |
| Aging | `MAINTENANCE_INTERVAL` cadence | Nudges `effective_priority` of pending jobs (thresholds/decrement tuneable) so old low-priority work eventually outranks new higher-priority work |

## Migrations

Schema is owned by Alembic and applied by the one-shot `migrate` service:

```bash
docker compose run --rm migrate   # re-run after pulling a new image
uv run flint migrate              # or on the host during development
```

API/worker services in Compose declare
`depends_on.migrate.condition: service_completed_successfully`, so nothing
boots against a stale schema.

## Storing state safely

- Keep the `postgres_data` volume; jobs are rows, so Postgres *is* your
  queue — back it up like any primary datastore.
- Redis persistence (`redis_data`) is nice-to-have, not required: with a
  flushed/empty Redis, workers re-register presence within a minute and SSE
  simply resumes on new events.
- Set real credentials for production deployments
  (`POSTGRES_PASSWORD`, `API_KEY`) — when `APP_ENV=production`, a missing
  `API_KEY` fails startup instead of silently defaulting.

## Production checklist

- [ ] `APP_ENV=production`, unique `API_KEY` (+ optionally rotating
      `API_KEYS`), set `POSTGRES_PASSWORD`
- [ ] Terminate TLS at a reverse proxy/load balancer in front of the API
      (the API itself serves plain HTTP on `--port`) and only expose the
      health endpoints publicly if you want to share that with:
      `/health/live`, `/health/ready`
- [ ] `CORS_ORIGINS` set to the frontend origin(s) that will call the API
- [ ] Postgres volume + backups configured
- [ ] `/health/ready` wired to probes/load balancer
- [ ] `SMTP_HOST`/`SMTP_PORT`/`SMTP_FROM` aim at a real relay **and**
      `mailhog` removed from `COMPOSE_PROFILES` (so the dev catcher
      container never starts in this deployment)
- [ ] DLQ threshold + `alert_emails` configured
- [ ] Worker scale + `WORKER_CONCURRENCY` sized to your workload
- [ ] `LOG_LEVEL` and log shipping decided (JSON lines are ready for any
      collector)

## CI

The repo ships a GitHub Actions workflow (`.github/workflows/ci.yml`) that
runs on every push/PR to `main`:

- `ruff check .` — lint gate
- `ruff format --check .` — formatting gate

The test suite is not wired into CI yet; lint and format gates keep the
integration surface predictable until it is.
