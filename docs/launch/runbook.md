# Launch Runbook

This runbook governs the process, controls, and communication for product launch. It is the single source of truth for go/no‑go.

## Roles & Ownership

- DRI (Engineering): <name>
- DRI (Product): <name>
- Incident Commander (IC): <name>
- Comms Lead: <name>
- Scribe: <name>
- Backup(s): <names>

## Timeline (Example)

1. T‑14d: Freeze announcement; finalize scope; dry‑run of demo
2. T‑7d: Staging dress rehearsal: migrations + deploy + rollback drill
3. T‑2d: Final pre‑flight checks; comms approvals; on‑call handoff
4. T‑0: Launch window start; progressive rollout; live monitoring
5. T+1d: Post‑launch verification; capture metrics; backlog cleanup

## Go/No‑Go Gates

- CI green on main (lint, typecheck, unit, integration, e2e)
- Staging migrations deployed; rollback tested; integrity checks pass
- SLO dashboards green; alert noise within budget; paging fire drill complete
- Feature flags gated and togglable; kill switches verified
- Comms assets approved; links validated; status page ready
- Support coverage confirmed; escalation tree validated

## Feature Flag Registry

| Flag                | Owner | Default (dev/stage/prod) | Gate    | Kill Switch | Notes                     |
| ------------------- | ----- | ------------------------ | ------- | ----------- | ------------------------- |
| `PROBOT_ENABLED`    | Eng   | off/on/off               | rollout | yes         | Probot webhook app mount  |
| `E2E_TEST_MODE`     | QA    | on/on/off                | testing | yes         | Enables test login helper |
| `FEEDBACK_STORE`    | PM    | redis/redis/slack        | launch  | n/a         | slack/github forwarding   |
| `ANALYTICS_ENABLED` | Data  | on/on/on                 | launch  | yes         | Honor DNT/GPC/user prefs  |

Add additional flags here as needed. All flags must have owners, defaults per environment, and an explicit rollback behavior.

## Pre‑Flight Checklist

- [ ] Backups verified (DB snapshot + Redis persistence) and restore tested
- [ ] Migrations are backward compatible (deploy before activation)
- [ ] Canary/synthetic probes green (core flows)
- [ ] Metrics: error rate, p95 latency, saturation within SLO
- [ ] Logs: PII redaction verified; debug disabled in prod
- [ ] Alert routes and thresholds validated; on‑call paged successfully
- [ ] Comms: landing page PR merged; announcement copy approved; video uploaded
- [ ] Support: macros prepared; FAQ updated

## Cutover Procedure

1. Announce start in #launch channel with link to dashboards
2. Deploy backend (main) → readiness check passes (`/readyz`=200)
3. Deploy frontend (main) → smoke test (login, village view, dialogue open)
4. Enable feature flags (gradual % as applicable)
5. Watch golden signals for 15–30 min; expand rollout if healthy
6. Publish public comms (blog/social/email) once SLOs stable

## Rollback (See rollback-migrations.md)

- Decision tree: feature flag off → deploy rollback → data restore
- Documented commands for Railway/Fly and Vercel
- Post‑rollback verification and comms plan

## Post‑Launch

- [ ] Verify metrics (DAU, engagement, error budget)
- [ ] Review incidents, if any; file follow‑ups
- [ ] Remove unused flags per cleanup plan
- [ ] Share launch notes and links
