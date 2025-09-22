# Backend on Railway

Railway is our recommended managed host for the server while we’re in beta. It can run the Express API, provision Postgres + Redis, and expose HTTPS without extra infrastructure.

## Prerequisites

- Railway account with the CLI installed (`npm install -g @railway/cli`).
- PAT or GitHub App credentials ready (see `docs/deployments/github-app-setup.md`).
- Local checkout of this repo with pnpm installed (`corepack enable pnpm`).

## Fast path: scripted deployment

Run the helper scripts from the repo root. They live under `scripts/railway/`.

```bash
# 1) Provision project + plugins + first deploy
scripts/railway/deploy.sh

# 2) Capture GitHub credentials & public URLs
scripts/railway/setup-env-vars.sh

# 3) Generate Prisma client + run migrations (optionally seed)
scripts/railway/post-deploy.sh
```

What the scripts do:

- `deploy.sh` installs the Railway CLI, logs you in, initialises the project, adds Postgres + Redis plugins, seeds core env vars (`NODE_ENV`, `PORT`, `JWT_SECRET`, pnpm/Node versions) and triggers the first deploy (`railway up`).
- `setup-env-vars.sh` prompts for GitHub OAuth + App values, webhook secret, and frontend URL, storing them with `railway variables set`. It also drops placeholders for `PUBLIC_SERVER_URL`/`OAUTH_REDIRECT_URI` that you update once you know the live domain.
- `post-deploy.sh` runs Prisma generate, migrations, and optional seed inside the Railway environment via `railway run`.

Use `railway status` or the dashboard to watch the deployment finish. After the service is live, grab the assigned URL (e.g. `https://ai-agent-village.up.railway.app`) and re-run `railway variables set` to update:

```bash
railway variables set PUBLIC_SERVER_URL="https://ai-agent-village.up.railway.app"
railway variables set OAUTH_REDIRECT_URI="https://ai-agent-village.up.railway.app/auth/github/callback"
```

Update the GitHub App’s webhook + OAuth callback URLs to the same host.

## Manual setup (if you prefer clicking in the dashboard)

1. Create a new project → deploy from GitHub or empty template, then connect this repository.
2. Add the Postgres and Redis plugins; Railway injects `DATABASE_URL` and `REDIS_URL`.
3. Under **Deployments → Settings** set:
   - Build: `pnpm install --frozen-lockfile && pnpm --filter @ai-agent-village-monitor/server build`
   - Start: `pnpm --filter @ai-agent-village-monitor/server start`
   - Health check path: `/health` (or `/healthz`)
4. Define env vars (see below). Use `railway variables set KEY="value"` or the UI.
5. Run migrations: `railway run pnpm --filter @ai-agent-village-monitor/server prisma:generate` then `railway run pnpm --filter @ai-agent-village-monitor/server db:migrate`.
6. Optional seed: `railway run pnpm --filter @ai-agent-village-monitor/server db:seed`.

## Environment variables

Use `docs/deployments/railway.env.example` as a template. Required values:

| Key                                                              | Notes                                                       |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `NODE_ENV=production`                                            | Always production in hosted environments                    |
| `PORT=3000`                                                      | Leave default unless you change the start command           |
| `JWT_SECRET`                                                     | Use a 32+ char random string (`openssl rand -base64 32`)    |
| `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`          | OAuth flow for the UI                                       |
| `GITHUB_APP_ID` / `GITHUB_PRIVATE_KEY` / `GITHUB_WEBHOOK_SECRET` | Required once the GitHub App is created                     |
| `PUBLIC_SERVER_URL`                                              | Railway URL, e.g. `https://ai-agent-village.up.railway.app` |
| `PUBLIC_APP_URL`                                                 | Frontend host (Vercel, local tunnel, etc.)                  |
| `OAUTH_REDIRECT_URI`                                             | `<PUBLIC_SERVER_URL>/auth/github/callback`                  |
| `DATABASE_URL`, `REDIS_URL`                                      | Provided by Railway plugins                                 |

Optional but recommended:

- `GITHUB_TOKENS` for fallback PATs while the App is not yet authorised.
- `WS_ALLOWED_ORIGINS` to lock Socket.IO origins (comma-separated).
- AI provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) if you need them server-side.

## GitHub App requirements

See `docs/deployments/github-app-setup.md` for the exact permissions, events, and secrets we expect. You’ll need the App before beta testers can sign in or trigger workflows.

## Checklists & verification

- `docs/deployments/railway-checklist.md` — step-by-step list you can tick off.
- Smoke tests once deployed:
  - `curl https://<host>/health` → 200
  - `curl https://<host>/readyz` → 200 (after DB/Redis connect)
  - Trigger `/api/github/workflows` with an installation token to confirm Actions access.
  - Verify a GitHub webhook delivery returns 202.

## Operations notes

- Railway’s free tier sleeps inactive services. Upgrade when beta testers need 24/7 uptime.
- Enable automated backups on Postgres and confirm retention (7–14 days recommended).
- Redis is optional but enables rate-limiting + Socket.IO scaling; ensure TLS (`rediss://`).
- Scale vertically (larger plan) as load increases; horizontal scaling requires the Socket.IO Redis adapter which the server already supports when `REDIS_URL` is set.
- Monitor logs via `railway logs --follow` and set alerts in the dashboard for restarts or high memory usage.

Keep `DATABASE_URL`, `REDIS_URL`, and all secrets out of commits. Use Railway environment variables or your secrets manager.
