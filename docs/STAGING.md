Staging Environment Setup (Load/Soak Ready)

Overview

- Goal: Bring up a staging environment suitable for HTTP and WebSocket load/soak testing.
- Scope: Server + Postgres + Redis, optional Probot webhook integration.

Services

- Postgres 15 (compose: service `postgres`)
- Redis 7 (compose: service `redis`)
- Server (run locally on host or deploy to your platform of choice)

Quick Start (local single-host)

1. Start infra

```
docker compose up -d postgres redis
```

2. Configure env

```
cp .env.staging.example .env
# edit .env: DATABASE_URL, REDIS_URL, PUBLIC_SERVER_URL, JWT_SECRET, etc.
```

3. Apply DB schema & seed (from server package)

```
pnpm -C packages/server db:push
pnpm -C packages/server db:seed
## For larger datasets:
SY_ORGS=5 SY_REPOS_PER_ORG=50 SY_AGENTS_PER_VILLAGE=3 SY_BUGS_PER_REPO=2 pnpm -C packages/server db:seed:synthetic
```

4. Run server

```
pnpm -C packages/server dev
# or: pnpm -C packages/server build && pnpm -C packages/server start
```

5. Verify health

```
curl -s localhost:3000/healthz
curl -s localhost:3000/readyz
```

Webhooks

- Express route (simple): POST /api/webhooks/github
  - Optional signature: `WEBHOOK_SECRET` (HMAC SHA-256) in `.env`
- Probot (GitHub App): POST /api/webhooks/probot
  - Enable via `.env`: `PROBOT_ENABLED=true`, set `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`
  - Probot is mounted automatically when enabled

Idempotency & Replay Protection

- Redis-backed dedupe on `X-GitHub-Delivery` ID with 24h TTL
- In-memory fallback when Redis is unavailable
- Metrics: `webhook_seen_total`, `webhook_duplicate_total`

Seed & Mapping

- Seed creates demo villages/houses with positions
  - Village: `org` (githubOrgId=456)
  - House: `org/repo` (githubRepoId=123) at (300, 200)
- Webhooks map org/repo → village/house; bug spawns near house when known

Manual Webhook Test

```
pnpm -C packages/server webhook:send
# Posts issues.opened to /api/webhooks/github with repo.id=123, owner.id=456
```

Load/Soak Testing

- HTTP (k6):
  - See packages/server/docs/LOAD_RAMP_PLAN.md
  - Example: `BASE_URL=http://localhost:3000 TOKEN=$JWT pnpm -C packages/server load:k6:smoke`
- WebSocket (Artillery):
  - See packages/server/docs/LOAD_RAMP_PLAN.md

Operational Notes

- Staging domain (TLS): Place server behind a reverse proxy (nginx/Caddy) or platform-managed SSL.
- Sticky sessions: If horizontally scaling WS servers, configure Socket.IO Redis adapter and ensure a pub/sub Redis.
- Backups: See docs/DR_RUNBOOK.md for Postgres/Redis backup strategy.
