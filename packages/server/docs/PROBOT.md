Probot Integration (Skeleton)

Overview
- Optional Probot app is mounted at `/api/webhooks/probot` when `PROBOT_ENABLED=true` and required env vars are present.
- Minimal handlers:
  - `issues.opened` → creates Bug Bot entity (via existing service)
  - `issues.closed` → marks Bug Bot resolved

Environment
- `PROBOT_ENABLED=true`
- `GITHUB_APP_ID=<app-id>`
- `GITHUB_PRIVATE_KEY=<multiline PEM>`
- `GITHUB_WEBHOOK_SECRET=<secret>` (or `WEBHOOK_SECRET`)

Files
- `src/probot/app.ts` — builds Probot instance and returns Express middleware
- `src/app.ts` — conditionally mounts Probot middleware on `/api/webhooks/probot` (with `express.raw` for signature)

Notes
- The existing non-Probot webhook remains at `/api/webhooks/github` for simple payloads and tests.
- Prefer Probot route for production GitHub App integrations.

