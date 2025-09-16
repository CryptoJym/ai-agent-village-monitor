# Production Deployment Guide

This project is a monorepo with a Vite/Phaser frontend and an Express/Socket.IO backend.

## Overview
- Frontend: Deploy on Vercel.
- Backend: Deploy on Railway (Node), attach Postgres 15 and Redis 7 with backups.
- Domains: Point custom domain to Vercel; set `PUBLIC_APP_URL` on backend to the Vercel URL, and `PUBLIC_SERVER_URL` to the backend URL.
- Security: HSTS, CSP, cookie security, webhook signature (optional).

## Frontend (Vercel)
1) Import the GitHub repo into Vercel.
2) Root directory: repository root. Vercel will use vercel.json:
   - Build: `pnpm -C packages/frontend build`
   - Output: `packages/frontend/dist`
3) Add domain and enable HTTPS. Vercel handles SSL automatically.

## Backend (Railway)
1) Create a new Railway project and add a service from your repository.
2) Set the service to build using Node (Nixpacks) or Docker. The repository includes `packages/server/Procfile` and a Node start script.
3) Provision Postgres 15 and Redis 7 in Railway and attach to the service.
4) Enable backups for Postgres and configure a retention policy.

## Environment Variables (Backend)
Required in production:
- `NODE_ENV=production`
- `PORT` (Railway sets one automatically; the app uses `config.PORT`)
- `DATABASE_URL` (Railway Postgres)
- `REDIS_URL` (Railway Redis)
- `PUBLIC_APP_URL` (e.g., `https://app.example.com`)
- `PUBLIC_SERVER_URL` (e.g., `https://api.example.com`)
- `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`
- `JWT_SECRET` (strong secret)
Optional:
- `OAUTH_REDIRECT_URI` (otherwise derived from `PUBLIC_SERVER_URL`)
- `COOKIE_DOMAIN` (e.g., `.example.com` for subdomain-wide cookies)
- `OAUTH_SCOPES` (defaults to `read:user read:org workflow`)
- `GITHUB_TOKENS` (comma-separated; for app-level GitHub API access)
- `WEBHOOK_SECRET` (to validate GitHub webhooks)
- `WS_ALLOWED_ORIGINS` (comma-separated permitted origins; otherwise `PUBLIC_APP_URL`)

## CORS and WebSockets
- CORS origin is set from `PUBLIC_APP_URL` (or `WS_ALLOWED_ORIGINS` if present).
- Socket.IO enforces allowed origins at the transport layer and uses JWT authentication.

## SSL and Security Headers
- Helmet is enabled; HSTS is enforced in production (preload, include subdomains).
- CSP is set to `default-src 'self'`. Adjust if you host assets on a CDN.

## Service Worker & Offline
- Frontend registers `public/sw.js` in production: cache-first for static assets; network-first for API GETs.
- Offline command queue persists POSTs and replays on reconnect.

## Smoke Tests
- Verify `/healthz` and `/readyz`.
- Exercise `/auth/login` flow, `/auth/me`, and `/auth/logout`.
- Validate WebSocket connect + ping.
- Confirm webhook HMAC validation if `WEBHOOK_SECRET` is set.

## Scaling / Stickiness
- Prefer stateless design. Socket rooms use server memory; multi-instance requires a pub/sub adapter (e.g., Redis adapter for Socket.IO) to broadcast across nodes.
- On Railway, scale to multiple instances and enable Redis adapter if multi-instance WS is needed.

## Backups
- Use Railway’s Postgres backups; periodically test restore into a staging instance.

## Rollback
- Keep previous successful deployments available; roll back via Railway/Vercel dashboards.

