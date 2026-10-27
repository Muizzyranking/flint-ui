# Flint frontend

Next.js frontend for Flint (durable job scheduling over HTTP). The backend is
a standalone service; this repo only builds the site — Docker Compose
downloads the released tarball and injects the API configuration at runtime.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

To run against the demo dashboard, set env values for the local API:

```bash
API_URL=http://127.0.0.1:8000/api/v1 API_KEY=dev-api-key pnpm dev
```

No backend? The dashboard renders its "server is probably down" state, which
is expected without a running API.

## Build contract

1. **Build:** `pnpm install && pnpm build` with **no runtime values baked in**
   (no `VITE_API_URL`, no `NEXT_PUBLIC_API_*`).
2. **Artifact:** CI publishes a gzip tarball as a release asset, containing at
   its root the runnable site (Next.js standalone build: `server.js` + static
   assets, run with `node server.js`).
   Artifact URL = `https://github.com/muizzyranking/flint-ui/releases/download/<tag>/flint-frontend.tar.gz`.
3. **Runtime env (injected by Compose):**
   - `API_URL` — host or base URL of the API, e.g. `http://api:8000/api/v1`
     or just `http://api:8000` (the `/api/v1` prefix is applied exactly once
     server-side; health checks target the root paths, `/health/*`, per the
     contract).
   - `API_KEY` — the same key Flint runs with.
   - `PORT` — port to listen on (Compose uses `3000`).
4. **Asset URL:** `https://github.com/muizzyranking/flint-ui/releases/download/latest/flint-frontend.tar.gz`.

These are read **at request time** by server code:

- `src/lib/flint-api.ts` — `API_URL` / `API_KEY` are read inside function
  bodies; `next/server`'s `connection()` keeps the dashboard page dynamic, so
  env changes never require a rebuild.
- Server Components / route handlers call the API server-side.
- The browser only talks to the frontend origin — no CORS flows, no key
  exposure, identical behaviour in dev and prod.
- `src/app/api/flint/[...path]/route.ts` proxies `/api/flint/*` →
  `${API_URL}/*` (method, body, content type; `X-API-Key` injected from env).
- `src/app/api/flint/sse/stream/route.ts` streams the live ticker as a plain
  `Response` (the server injects the key, since `EventSource` cannot set
  headers).## Release flow (CI)

`.github/workflows/release.yml`:

```bash
pnpm install --frozen-lockfile
pnpm build                       # env-free
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
tar -czf flint-frontend.tar.gz -C .next/standalone .
```

Runs on every push to `main` (plus manual dispatch) and republishes the
rolling `latest` release asset — no tag releases. Extra environment
variables or keys never trigger a rebuild; Compose ships env at runtime.

## Compose

Flint's `docker-compose.yml` carries a **frontend** service behind the
`frontend` profile, which runs `node server.js` with `PORT=3000`, `API_URL`,
`API_KEY`:

```bash
docker compose --profile frontend up -d
# dashboard at http://127.0.0.1:3000
```

Routes: landing at `/`, demo dashboard at `/dashboard`, docs at `/docs`.
