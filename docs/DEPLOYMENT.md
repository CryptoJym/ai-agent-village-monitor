# Deployment Guides and Runbooks

## Overview

Deploy the server behind HTTPS with a reverse proxy (NGINX/Caddy), configure environment variables, run DB migrations, and monitor metrics.

## Steps

1. Build artifacts: `pnpm -C packages/server build && pnpm -C packages/frontend build`
2. Set environment variables (see `docs/ENVIRONMENT.md`).
3. Database: point `DATABASE_URL` to production DB and run migrations.
4. Start server with a process manager (PM2/systemd/Docker). Example (PM2):
   - `pm2 start packages/server/dist/index.js --name village-server`
5. Serve frontend from a static CDN or any static host.
6. Configure proxy:
   - Forward `/api/*` and `/socket.io/*` to the Node server
   - Serve `/` and static assets from the frontend build

## Security

- Restrict CORS to the known frontend origin(s).
- Set `JWT_SECRET` and avoid defaulting permissive auth.
- Keep `helmet` defaults and tune CSP as needed for /api/docs.

## Observability

- Metrics: scrape `GET /metrics` (Prometheus format) and/or `GET /api/metrics`.
- Logs: forward structured JSON logs from stdout to your log aggregator.

## Runbooks

- Websocket issues: check `connection_status` and latency events in UI; inspect server logs for auth failures.
- GitHub API errors: verify tokens and rate limits.
- DB migrations: rollback using Prisma migrate or restore from backup.

