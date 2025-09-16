# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [0.1.0-rc1] - 2025-09-16

### Added

- CI/CD workflows:
  - `.github/workflows/ci.yml` for lint, typecheck, unit/integration/e2e tests with pnpm caching.
  - `.github/workflows/deploy-frontend.yml` for Vercel preview/prod deploys.
  - `.github/workflows/deploy-backend.yml` for Railway/Fly deploys and migrations.
- Feedback & Help Center:
  - `packages/frontend/src/ui/FeedbackModal.tsx` with validation, NPS (optional), draft persistence.
  - `packages/frontend/src/ui/HelpMenu.tsx` with links (Docs, Discord, Discussions) and Submit Feedback.
  - `packages/server/src/app.ts` feedback endpoint: schema validation, Redis-backed rate limits, Slack/GitHub forwarding.
  - Test: `packages/frontend/test/ui/feedback.modal.test.tsx`.
- Launch documentation:
  - `docs/launch/runbook.md`, `rollback-migrations.md`, `observability.md`, `incident-response.md`, `demo.md`, `comms-plan.md`.
  - Linked from README; operations `docs/operations/ci-cd.md` added previously.

### Changed

- Server tests: enforce coverage thresholds in CI via `packages/server/vitest.config.ts` (80% lines/functions/statements, 70% branches).
- Request logging: metrics gated on DNT and both `Sec-GPC`/`GPC` headers.

### Security / Privacy

- Token handling:
  - AES-256-GCM encryption at rest when `TOKEN_ENCRYPTION_KEY` is set; salted hash fallback when absent (no plaintext persisted).
- Account deletion:
  - `DELETE /api/account` anonymizes user and revokes provider tokens.
- Redaction:
  - Structured logging scrubs sensitive headers/fields; long values truncated; email masking.

[0.1.0-rc1]: https://example.com/releases/v0.1.0-rc1
