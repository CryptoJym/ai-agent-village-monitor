# Security Hardening Runbook (MVP)

This runbook consolidates the security controls in the AI Agent Village Monitor and provides concrete verification steps before and after releases.

Scope focuses on the backend API and UI, transport and headers, authentication/authorization, rate limiting, input validation, privacy controls, and logging/redaction.

## 1) Threat Model (abridged)

- External threats
  - Token leakage (OAuth/JWT/refresh) and credential stuffing
  - CSRF/XSS/Clickjacking on the UI
  - Injection attempts (SQL/JSON parser abuse)
  - DoS/abuse (command spam, feedback spam)
  - CORS origin abuse, WebSocket handshake abuse
- Internal/operational risks
  - Misconfiguration (missing HSTS/CSP, permissive CORS)
  - Excessive logging of PII/headers/tokens
  - Stale dependencies and unpatched CVEs

## 2) Controls (what’s implemented)

- Transport & headers
  - HTTPS redirect (prod) and HSTS: `Strict-Transport-Security` (preload, includeSubDomains)
  - Helmet defaults incl. `X-Content-Type-Options: nosniff`, and CSP tuned for React/Phaser/Socket.IO
  - CSP: `default-src 'self'`; explicit `script-src`, `style-src`, `connect-src`, `img-src`, `media-src` with dev exceptions
  - Clickjacking mitigated via CSP `frame-ancestors 'self'`
- CORS
  - Strict origin allowlist, credentials only to configured UI origin(s)
- Authentication & sessions
  - JWT access/refresh, rotation with reuse detection; `WWW-Authenticate: Bearer` on 401
  - Cookies HttpOnly, Secure (prod), SameSite=Lax, \_\_Host- prefix where possible
- Rate limiting & abuse
  - express-rate-limit (Redis store when available) on sensitive endpoints (`/api/agents/:id/command` etc.)
  - Feedback endpoint: per-IP sliding window (hour/day) limits, honeypot field, time-to-submit sanity
- Input validation & sanitization
  - Zod schemas for API bodies (analytics, auth, villages, feedback, queues)
  - Sanitization helpers for identifiers
  - JSON parser errors mapped to 400; unified error shapes where applicable
- Privacy controls
  - Analytics: server respects DNT/GPC; user preferences opt-out; `userId`/`clientId` hashed with server salt
  - Auth responses: `Cache-Control: no-store`
- Logging & redaction
  - Request logger scrubs `authorization`, `cookie`, `set-cookie`, and truncates oversized header values
  - Audit logs for agent commands without tokens/PII
- Secrets & tokens
  - GitHub tokens: encrypted-at-rest with `TOKEN_ENCRYPTION_KEY`, otherwise salted hash reference (non-retrievable)
  - JWT secrets via env; missing/weak secret aborts startup in prod

References:

- docs/PRIVACY.md (privacy & analytics)
- docs/security/pen-test-checklist.md (detailed checks)
- docs/deploy-production.md (prod deployment hardening)
- packages/server/src/app.ts (helmet/CORS/headers)

## 3) Verification Checklist (pre-release)

Run automated tests (recommended locally/CI):

- Server security tests (Supertest):
  - `pnpm -C packages/server test -- --run --reporter=dot`
    - Headers: nosniff present, CSP route behavior
    - 401 includes `WWW-Authenticate: Bearer`
    - Unknown origin not echoed in `Access-Control-Allow-Origin`
    - Auth responses include `Cache-Control: no-store`
    - DNT causes analytics collector to return 202 without aggregation
- Frontend tests (Vitest):
  - `pnpm -C packages/frontend test -- --run --reporter=dot`
  - Ensure CSP meta does not break UI in dev doc route

Manual checks (staging/prod-like):

- Transport security
  - `curl -I https://<host>/healthz` → contains `Strict-Transport-Security`
  - HTTP→HTTPS redirect observed for `http://<host>/healthz`
- CSP & headers
  - `curl -I https://<host>/api/docs` → CSP present (via meta or response), `X-Content-Type-Options: nosniff`
  - Confirm `frame-ancestors 'self'` in CSP
- CORS behavior
  - `curl -I -H 'Origin: https://evil.example' https://<host>/healthz` → no `Access-Control-Allow-Origin`
  - `curl -I -H 'Origin: https://<app-origin>' https://<host>/healthz` → ACAO echoes trusted origin
- Rate limit
  - Burst `POST /api/agents/:id/command` → expect 429 after configured threshold; `Retry-After` present
- Analytics privacy
  - `POST /api/analytics/collect` with `DNT: 1` → 202, counters not incremented (check Redis if available)
- Feedback anti-abuse
  - Honeypot or very fast submission (<1.5s) → 400 `bot_detected` / `too_fast`

## 4) Operational Playbook

- Configuration
  - Verify env: `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY` (32-byte), `CORS_ALLOWED_ORIGINS`, `PUBLIC_APP_URL`, `TRUST_PROXY`, `REDIS_URL`
  - Set `HSTS` headers at CDN/ingress if terminating TLS upstream
- Monitoring & alerts
  - Track 401/403 and rate-limit 429 as percentages; alert on spikes
  - Include `http_response_ms` p95; alert on latency regressions
- Logging & SIEM
  - Stream logs to your aggregator; verify secrets never appear
  - Enable audit log file if needed (`AUDIT_LOG_FILE`)
- Patching & deps
  - Weekly dependency scan and patch cycle

## 5) Incident Response (security)

- Identification: investigate anomalies (spikes in 401/403, rate-limit trips, errors)
- Containment: rotate secrets (`JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`) and disable affected endpoints if needed
- Eradication: redeploy with patched dependencies or configuration fixes
- Recovery: validate with pen-test checklist; monitor closely for 24–48h
- Lessons learned: update this runbook and add regression tests

## 6) Release Gate (Go/No‑Go)

- [ ] Automated tests green (server + frontend)
- [ ] CSP and CORS verified in staging
- [ ] HSTS verified at edge/ingress
- [ ] Rate limiting thresholds validated; 429 observed with `Retry-After`
- [ ] Logs reviewed for redaction (no tokens, no cookies)
- [ ] Privacy controls validated (DNT/GPC)
- [ ] Secrets confirmed (non-default, strong)

## 7) Quick Commands

- Nosniff & 401 header check
  - `curl -i https://<host>/api/villages` → `WWW-Authenticate: Bearer`
  - `curl -I https://<host>/healthz` → `X-Content-Type-Options: nosniff`
- HSTS & redirect
  - `curl -I https://<host>/healthz` → `Strict-Transport-Security`
  - `curl -I http://<host>/healthz` → 301/302 to HTTPS
- CORS denial
  - `curl -I -H 'Origin: https://evil.example' https://<host>/healthz` → no ACAO header

## 8) Appendix: Tuning CSP for Phaser/Socket.IO

- Dev builds may require `'unsafe-eval'` in `script-src` for Phaser; ensure it is disabled in prod
- Socket.IO requires `connect-src` to include `wss:`/`ws:` and the app origin
- Avoid wildcards in prod; prefer explicit origins
