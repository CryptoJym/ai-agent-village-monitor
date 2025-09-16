# CI/CD Pipelines

This repository uses GitHub Actions for CI and deployments.

## Workflows

- `.github/workflows/ci.yml` — Lint, type-check, unit/integration tests, Playwright E2E.
- `.github/workflows/deploy-frontend.yml` — Vercel preview on PRs, production deploy on `main`.
- `.github/workflows/deploy-backend.yml` — Backend deploy to Railway (preferred) or Fly.io on `main`.

## Secrets and Environments

Create two GitHub Environments: `staging` and `production`.

Required secrets (repository- or environment-level):

- Frontend (Vercel):
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`

- Backend (choose one platform):
  - Railway: `RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, `RAILWAY_SERVICE_ID`
  - Fly.io: `FLY_API_TOKEN`, `FLY_APP_NAME`

- Shared:
  - `DATABASE_URL` (staging/prod)
  - `REDIS_URL` (staging/prod)
  - Optional: `CODECOV_TOKEN`, `CYPRESS_RECORD_KEY`

Optional repo variables:

- `BACKEND_HEALTH_URL` — Used by deploy workflows for health checks (`/healthz`, `/readyz`).

## Notes

- CI runs on Node 20 with pnpm caching for faster installs.
- Server unit tests enforce coverage thresholds (80% statements/lines/functions, 70% branches) in CI.
- Protect `main` with required checks: `lint`, `typecheck`, `test-unit`, `test-integration`, `test-e2e`.
- Vercel deploys use root `vercel.json`, which builds `packages/frontend` and serves from `packages/frontend/dist`.
