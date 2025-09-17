# [Tasks #81, #86, #88, #99, #100] MVP close-out: tests, CI/CD, feedback/help, privacy, launch runbook

## Summary

Closes final MVP tasks: unit test coverage enforcement, CI/CD workflows, in-app Feedback + Help Center, privacy & compliance, launch runbook and comms.

## Changes

- Tests/coverage
  - Enforce server coverage thresholds in CI (80% lines/functions/statements, 70% branches)
- CI/CD
  - ci.yml for lint, typecheck, unit/integration/e2e (with pnpm caching)
  - deploy-frontend.yml (Vercel PR preview + prod), deploy-backend.yml (Railway/Fly + migrations)
  - docs/operations/ci-cd.md
- Feedback & Help
  - Frontend FeedbackModal (validation, optional NPS, draft save) and HelpMenu
  - Backend POST /api/feedback with Redis-backed rate limits, Slack/GitHub forwarding
  - Test: feedback.modal.test.tsx
- Privacy & Compliance
  - Token encryption at rest (AES-256-GCM) when TOKEN_ENCRYPTION_KEY is set; salted hash fallback (no plaintext)
  - Account deletion endpoint anonymizes and revokes provider tokens
  - Logging redaction; metrics respect DNT and GPC/Sec-GPC
  - docs/PRIVACY.md updated
- Launch Materials
  - Runbook, rollback/migrations, observability, incident response, demo, comms plan (linked from README)

## Config

- Feedback: FEEDBACK_STORE, FEEDBACK_SLACK_WEBHOOK_URL, FEEDBACK_GITHUB_REPO, FEEDBACK_IP_SALT
- Privacy: TOKEN_ENCRYPTION_KEY (32 bytes)
- CI/CD: Vercel (VERCEL\_\*), Railway/Fly, DATABASE_URL/REDIS_URL, optional BACKEND_HEALTH_URL

## Test Plan

- Local: pnpm -w lint; pnpm -w build; VITEST_COVERAGE=true pnpm -C packages/server test
- CI: ci.yml runs lint/typecheck/unit/integration/e2e; server coverage gates enforced

## Risk & Rollback

- Feature flags per runbook; rollback/migration procedures documented; health checks & synthetics

## Docs

- README links to ops/launch docs; CHANGELOG.md added

## Checklist

- [x] CI green (lint, typecheck, unit/integration/e2e)
- [x] Coverage thresholds met (server)
- [x] Docs updated
- [x] Feature flags documented
- [x] Privacy checks (no secrets, redaction, DNT/GPC)
- [x] Linked tasks (#81, #86, #88, #99, #100) and reviewers
