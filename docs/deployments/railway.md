# Backend on Railway (Task 87.2)

Provision managed Postgres 15 and Redis on Railway with backups, then connect the backend.

## 1) Create services

- Postgres 15 (Single node): note the `DATABASE_URL` (require SSL).
- Redis: note the `REDIS_URL` (use TLS `rediss://` and require auth).

## 2) Backups & retention

- Postgres: enable daily backups at 02:00 UTC, retain 7–14 days; enable PITR if available.
- Document maintenance window and region.

## 3) Access & users

- Create application DB user (least privilege); avoid superuser in prod.
- Restrict network access to your Railway project services.

## 4) Configure the backend service

- Create a Railway service from `packages/server`.
- Build: `pnpm -w build` (or let Railway run `pnpm install && pnpm --filter @ai-agent-village-monitor/server build`).
- Start: `node dist/index.js`.
- Health check: `/healthz` (liveness), `/readyz` (readiness incl. DB/Redis checks).
- Env vars (copy from `.env.production.template`):
  - `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `WEBHOOK_SECRET`, `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`
  - `PUBLIC_SERVER_URL=https://api.example.com`
  - `WS_ALLOWED_ORIGINS=https://app.example.com,https://<project>.vercel.app`

## 5) Migrations & seed

- Run once after `DATABASE_URL` is set:

```bash
cd packages/server
pnpm prisma:generate
pnpm db:migrate -n init
pnpm db:seed
```

## 6) Autoscaling

- Enable autoscaling (e.g., 1–3 replicas). Ensure graceful shutdown for drains.
- For multi-replica WebSockets, enable the Socket.IO Redis adapter using `REDIS_URL`.

## 7) Smoke tests

- `GET https://api.example.com/healthz` → 200
- `GET https://api.example.com/readyz` → 200 (after services up)
- WebSocket connect from Vercel app; verify room join and broadcast.

> Keep `DATABASE_URL`/`REDIS_URL` secret. Do not commit real values.
