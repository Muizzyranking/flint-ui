export const lifecycle = [
  {
    status: "pending",
    label: "Pending",
    color: "var(--color-pending)",
    detail:
      "A committed row with a due time. Claimable once available_at passes.",
  },
  {
    status: "processing",
    label: "Processing",
    color: "var(--color-processing)",
    detail: "One worker holds the lease and heartbeats it while the work runs.",
  },
  {
    status: "completed",
    label: "Completed",
    color: "var(--color-completed)",
    detail:
      "The work returned. The next recurring run is inserted in the same commit.",
  },
  {
    status: "failed",
    label: "Failed / DLQ",
    color: "var(--color-failed)",
    detail:
      "Attempts exhausted. The job parks in the DLQ with its last error kept.",
  },
  {
    status: "cancelled",
    label: "Cancelled",
    color: "var(--color-cancelled)",
    detail:
      "Dropped while pending, or cooperatively at the worker's next checkpoint.",
  },
];

export const quickstartTabs = [
  {
    id: "stack",
    label: "Start the stack",
    hint: "Docker Compose runs Postgres, Redis, the API, a worker and MailHog.",
    lang: "bash",
    code: `git clone https://github.com/muizzyraning/flint.git
cd flint
cp .env.example .env
docker compose up -d --build`,
  },
  {
    id: "schedule",
    label: "Schedule a job",
    hint: "A 201 means the job is a durable Postgres row. Workers own it from there.",
    lang: "bash",
    code: `curl -s -H "X-API-Key: dev-api-key" \\
  -H "Content-Type: application/json" \\
  http://127.0.0.1:8000/api/v1/jobs \\
  -d '{
    "type": "send_email",
    "payload": {
      "to": "you@example.com",
      "subject": "Hello from Flint",
      "body": "First job scheduled."
    }
  }'`,
  },
  {
    id: "inspect",
    label: "Inspect the result",
    hint: "Completed jobs stay queryable. The detail view keeps the full event timeline.",
    lang: "bash",
    code: `curl -s -H "X-API-Key: dev-api-key" \\
  "http://127.0.0.1:8000/api/v1/jobs?status=completed&limit=5"`,
  },
];
