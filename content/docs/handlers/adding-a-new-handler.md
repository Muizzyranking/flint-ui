# Adding a New Handler

A **handler** is the code that executes a job. Handlers live inside this
repository — there is no runtime registration and no third-party plugin
mechanism, so the set of schedulable job types is always exactly the set of
handlers in `app/handlers/handlers/`, and the API's catalogue
(`GET /api/v1/handlers`) always matches what workers can actually execute.

This page covers everything you need to add a new handler without reading any
other part of the codebase.

## The mental model

1. A handler declares a unique **name** (the API's `type`), a
   human-readable **description**, optional **tags**, a **version**, and a
   **Pydantic payload model** (declared as the `payload_model` class
   attribute).
2. The payload model is converted to a JSON Schema and published by
   `GET /api/v1/handlers`.
3. When a job is scheduled, the API validates its payload against that model
   **before inserting anything** — a bad payload is a `422` with per-field
   errors and never becomes a broken running job.
4. When a worker claims the job, the payload is validated once more and an
   **instance of the correct model is injected into `execute`**. Handlers
   never receive raw dicts and never call `model_validate` themselves.

## What you write

Everything lives under `app/handlers/handlers/`:

```
app/handlers/
├── base.py          # BaseHandler — generic over its payload type
├── registry.py      # static registry + `register_handler` decorator
├── utils.py         # shared URL/SSRF validation helpers
└── handlers/
    ├── __init__.py  # imports every module below (this is the registration)
    ├── email.py
    ├── webhook.py
    ├── http_ping.py
    ├── http_fetch.py
    ├── slack_notification.py
    ├── job_retention.py
    ├── log_processor.py
    └── echo.py
```

Five steps, in one file:

1. Create `app/handlers/handlers/resize_image.py`.
2. Define a Pydantic payload model — this is the handler's contract:
   types, bounds, defaults, and (optionally) field validators.
3. Subclass `BaseHandler[YourPayload]`, set `payload_model`, implement
   `async def execute(self, payload: YourPayload) -> dict`.
4. Annotate with `@register_handler(name, description=..., tags=...)`.
5. Add the module import to `app/handlers/handlers/__init__.py` — that import
   is what registers the handler at process start.

Template:

```python
from typing import Any

from pydantic import BaseModel, Field

from app.core.logger import get_logger
from app.handlers.base import BaseHandler
from app.handlers.registry import register_handler

logger = get_logger(__name__)


class ImageResizePayload(BaseModel):
    url: str = Field(description="HTTPS image URL")
    width: int = Field(gt=0, le=8192)
    height: int = Field(gt=0, le=8192)


@register_handler(
    "resize_image",
    description="Resize an image hosted over HTTPS.",
    tags=("media", "processing"),
    version="1",  # optional, default "1"
)
class ImageResizeHandler(BaseHandler[ImageResizePayload]):
    payload_model = ImageResizePayload

    async def execute(self, payload: ImageResizePayload) -> dict[str, Any]:
        logger.info("image_resize_started", url=payload.url)

        # ... do the actual work (httpx, files, whatever you need)
        result: dict[str, Any] = {
            "width": payload.width,
            "height": payload.height,
        }

        logger.info("image_resize_completed", url=payload.url)
        return result
```

That's the whole thing. Notice what is *not* written: no payload parsing, no
manual validation, no `parse_payload` call, no wiring into API routes.

## What each piece means

| Piece | Purpose |
| --- | --- |
| Payload model (`BaseModel`) | The contract between API and handler. Field types, bounds and defaults drive admission validation **and** the published JSON Schema |
| `payload_model` class attribute | Carried on the handler and read by the registry. Making it a class attribute is what lets `execute` receive a typed instance |
| `@register_handler(name, ...)` | Registers the class in the static registry at import time; `name` must be unique and trimmed |
| `BaseHandler[P]` | Binds the handler to its payload type so `execute(self, payload: P)` is fully type-checked by your editor |
| `execute` | The only required method. Returns a JSON-serialisable dict, stored as result metadata in the job's event log |
| `tags` | Grouping hints for UIs and worker capability filters |
| `version` | Contract version surfaced by the catalogue endpoint |

## The execution contract

- **Runs asynchronously.** `execute` may `await`. Wrap blocking calls in
  `asyncio.to_thread(...)` (see how `job_retention` and `slack_notification` do it).
- **Timeout.** Every execution is capped by `JOB_TIMEOUT_SECONDS`
  (default 300s) by the worker around your call.
- **Failure == retry.** Raise (or let anything propagate) and the job is
  retried with backoff up to `max_retries`, then sent to the DLQ. A raising
  handler must never take the worker process down: every attempt is captured
  — `ExceptionType: reason` lands in the job's `last_error`, its event log,
  and the DLQ entry — and execution continues. Prefer raising over returning
  fake success, but do return an explicit status when the work is inherently
  tolerant.
- **Guess work will run you twice.** Deliveries are at-least-once (a worker
  crash mid-handler means re-lease and a second attempt), so make side
  effects idempotent (e.g. key results by `job_id`, check-then-write).
- **Return a small JSON-serialisable dict.** It travels into the
  `job_completed` event log entry, and is what operators see in the job
  detail view.
- **Handle cancellation for free.** Cancellation is cooperative and handled
  by the worker at checkpoints; handlers do not special-case it.

## Admission validation errors, rendered for free

A bad payload never reaches a worker. Calling:

```bash
curl -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  $API/api/v1/jobs \
  -d '{"type": "resize_image", "payload": {"url": "https://example.com/a.png", "width": 0}}'
```

returns:

```json
{
  "message": "Validation failed.",
  "errors": [
    {
      "field": "body.payload.width",
      "message": "Input should be greater than 0",
      "type": "greater_than"
    }
  ]
}
```

Everything a user did wrong comes back in one pass — unknown field, wrong
type, out of bounds — with `body.payload.<field>` paths generated by the
global validation pipeline.

## Register the module

In `app/handlers/handlers/__init__.py`:

```python
from app.handlers.handlers import (  # noqa: F401
    echo,
    email,
    http_fetch,
    http_ping,
    job_retention,
    log_processor,
    resize_image,   # ← your new one
    slack_notification,
    webhook,
)
```

## Verify — three commands

```bash
uv run flint handlers
# resize_image   Resize an image hosted over HTTPS.   [media, processing]

uv run flint schedule --type resize_image \
  --payload '{"url": "https://example.com/a.png", "width": 100, "height": 200}'

curl -H "X-API-Key: $KEY" "$API/api/v1/jobs?status=completed&type=resize_image"
```

(For the API to serve it, and for a worker to execute it, both processes need
a restart after the import list above is updated — the registry is loaded at
process start.)

## Reusing shared validation helpers

`app/handlers/utils.py` ships two helpers used by the URL-touching handlers:

- `validate_outbound_url_syntax(url)` — admission-friendly shape checks
  (scheme, hostname, port allowlist, no credentials, non-public literal IPs
  rejected). These raise `ValueError`, which surfaces as a validation error
  during admission if you call it from a Pydantic field validator.
- `await assert_safe_outbound_url(url)` — run-time DNS resolution re-check
  inside `execute`, closing the DNS-rebind gap.

Reuse them for any handler that makes outbound HTTP calls
(`webhook.py`, `http_ping.py` and `http_fetch.py` are the reference implementations).

## Design pointers for good handlers

- Put every constraint into Pydantic (`Field(gt=…)`, `EmailStr`,
  validators). It's one line per constraint and buys rejection at admission.
- Keep `execute` narrow: fetch input, transform, return a result. Long waits
  belong in separate jobs or recurring jobs, not `time.sleep` loops in a
  handler.
- Never block the event loop; use `asyncio.to_thread` for blocking SDKs.
- Log with `get_logger(__name__)` — structured, secret-redacted JSON.
- If a handler needs worker-specific state (paths, mounts), document the
  assumption loudly in the description and validate paths at admission
  (see `job_retention`'s DB access and `slack_notification`'s HTTP call for
  reference).
