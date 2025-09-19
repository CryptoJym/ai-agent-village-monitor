# Beta Trial Checklist

Use this guide to spin up the Agent Village stack against a real GitHub organisation for a controlled beta.

## 1. Prerequisites

- **GitHub App** configured for the organisation you plan to monitor. Collect its `GITHUB_APP_ID`, private key, and webhook secret.
- **GitHub tokens** for REST/GraphQL fallback: set `GITHUB_TOKEN` or `GITHUB_PERSONAL_TOKEN` if the app doesn’t cover every scope you need.
- **PixelLab API key** (already stored locally in `.env` as `PIXELLAB_TOKEN` / `PIXELLAB_API_TOKEN`).
- **Postgres + Redis** instances (local Docker or managed services). Note the connection URIs.
- **Environment file** (`.env` or hosting provider secrets) populated with at least:
  - `DATABASE_URL`
  - `REDIS_URL`
  - `JWT_SECRET`
  - `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`
  - `PIXELLAB_TOKEN` (and `PIXELLAB_API_TOKEN` if both forms are needed)

## 2. Prepare the database

```bash
pnpm --filter @ai-agent-village-monitor/server prisma:generate
pnpm --filter @ai-agent-village-monitor/server db:migrate
```

If you want sample agents or bug bots for demo purposes:

```bash
pnpm --filter @ai-agent-village-monitor/server exec node prisma/seed.synthetic.cjs
```

## 3. Bootstrap the target organisation

Run the helper script to create (or update) the village and owner access record.

```bash
node scripts/bootstrap-village.mjs \
  --org my-github-org \
  --github-org-id 1234567890123 \
  --owner-github-id 9876543210 \
  --owner-username my-owner \
  --owner-email owner@example.com \
  --make-public
```

Notes:

- Use the real numeric GitHub IDs for both the organisation and the owner. If you omit `--github-org-id`, a deterministic ID is generated from the login.
- The script creates the user (if absent), upserts the village, and grants owner access. It prints the new village ID for later steps.

## 4. Kick off the first sync

Send the queueing request as the owner (after authenticating via the app/login flow or by minting a test JWT):

```bash
curl -X POST http://localhost:3000/api/villages/<villageId>/houses/sync \
  -H "Authorization: Bearer <owner-access-token>"
```

Watch the server logs; the sync job should populate houses and analytics metrics for that organisation.

## 5. Launch the stack

In separate terminals:

```bash
pnpm --filter @ai-agent-village-monitor/server dev
pnpm --filter @ai-agent-village-monitor/frontend dev
```

Open the frontend (`http://localhost:5173/` by default), sign in as the owner, and verify:

- World map tiles show the org’s repositories, language badges, and the new analytics line (house count & total stars).
- Actions > “Trigger workflow” hits the GitHub Actions API in your org and reflects in the UI.
- Websocket overlays stream agent updates without errors.

## 6. Invite beta testers

1. Provision accounts for trusted teammates (via the normal invitation flow or the `scripts/bootstrap-village.mjs` script with `--owner-github-id` pointing at each member).
2. Share login instructions, the PixelLab token (if they will regenerate assets), and the feature walkthrough (`docs/launch/demo.md`).
3. Keep an eye on:
   - Server logs (`packages/server/src/middleware/logging.ts` produces structured lines).
   - `metrics` endpoint for sync success and webhook duplicate counters.
   - Lint/test/build status (`pnpm -w lint`, `pnpm -r test`, `pnpm -w build`).

## 7. Rollback / cleanup (optional)

- Revoke GitHub App access from the org if you end the trial.
- Run `node scripts/bootstrap-village.mjs --org <org> --owner-github-id <id> --owner-username <user>` without `--make-public` to toggle visibility back to private.
- Remove trial users with `DELETE /api/users/:id` (or by revoking their tokens in the DB).

---

With the above complete, you can confidently pilot Agent Village on a real organisation and iterate quickly on feedback from the beta cohort.
