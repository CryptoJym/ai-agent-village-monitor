# Changelog

## v0.1.0

### Features

- Mini‑map overlay with scaled render texture, viewport bounds, and click‑to‑teleport fast travel.
- Auto layout and pathfinding utilities (grid + A\*, obstacle map, path smoothing) wired into agent movement.
- Feedback modal + Help menu: in‑app feedback with honeypot/tts checks; pluggable sinks (Redis/Slack/GitHub).
- Analytics pipeline: privacy‑aware collector, Redis KPIs, and internal dashboard endpoints.

### Security

- Helmet headers incl. CSP (prod tuned) and HSTS (prod).
- Strict CORS allowlist and credential handling.
- Auth/401 semantics with `WWW-Authenticate: Bearer`; auth responses use `Cache-Control: no-store`.
- Privacy controls: DNT/GPC and per‑user preferences; hashed identifiers in analytics.
- Pen‑test checklist and automated header/CORS/privacy tests.

### DR/Backups

- Backup heartbeat endpoint with metrics (`backup_last_seconds`) for Postgres/Redis.
- Disaster Recovery runbook with restore verification and alert guidance.

### Testing/DevX

- Developer guide for integration tests (Testcontainers and Docker Compose).
- Mini‑map and camera navigator unit tests; E2E/UI tests passing locally.
- Backend integration testing guide and tests (Supertest + Testcontainers).

### Docs

- Security hardening runbook and pen‑test checklist.
- DR runbook, deployment guides (Vercel/Railway), staging/load testing playbooks.
- Integration testing developer guide.

### Post‑release monitoring

- Metrics: HTTP latency p95; 4xx/5xx rates; backup heartbeat freshness; WS connect success and event throughput.
- Logs: confirm no PII/secret leakage; audit log sampling for agent commands.
- Security: verify CSP/HSTS/CORS in prod; re‑run pen‑test checklist periodically.
- Performance: mini‑map/pathfinding CPU budget; client FPS overlay and server WS RTT p95 under load.

### Next steps

- Tag release `v0.1.0` and publish release notes.
- Schedule a restore drill in staging; document RTO/RPO measurements.
- Optional: expand automated security tests for HSTS in prod‑like env and WS handshake auth in CI.
