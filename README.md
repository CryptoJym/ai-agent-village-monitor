# AI Agent Village Monitor (MVP)

Gamified, spatial UI for managing AI agents across GitHub organizations. Villages represent orgs, houses represent repos, and agent sprites show real‑time activity with full control parity via MCP.

## Repo Layout (initial)

- `docs/PRD.md` — Product Requirements Document (source of truth)
- `task-master/plan.json` — Parsed plan extracted from the PRD
- `task-master/cli.mjs` — Lightweight Task‑master CLI (uses `gh` to open issues)
- `scripts/gantt.py` — Gantt chart generator for 6‑week MVP plan

## Quickstart

1. Ensure prerequisites:
   - Node.js 18+
   - GitHub CLI `gh` authenticated (`gh auth login`)
   - Python 3.10+ (optional for Gantt)

2. Inspect the plan

```
node task-master/cli.mjs list --phase foundation
node task-master/cli.mjs list --week 1
```

3. Open GitHub issues from the plan (creates week/milestone issues)

```
node task-master/cli.mjs issues:create --weeks 1,2,3,4,5,6
```

4. Generate the Gantt chart (optional)

```
python3 -m pip install plotly kaleido pandas
python3 scripts/gantt.py
```

## Database & Prisma

- Configure your database connection in `.env` (see `.env.example`). Example:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_agent_village?schema=public"
```

- Common commands (run from repo root):

```
pnpm prisma:generate   # Generate Prisma Client
pnpm db:migrate        # Run dev migration (packages/server)
pnpm db:push           # Push schema (no migration) for quick prototyping
pnpm db:reset          # Reset database and reapply migrations
pnpm db:studio         # Open Prisma Studio
```

- The Prisma schema lives at `packages/server/prisma/schema.prisma`.

## Documentation

Core docs live under `docs/`:

- Environment & Config: `docs/ENVIRONMENT.md`
- Architecture: `docs/ARCHITECTURE.md`
- DB Schema: `docs/DB_SCHEMA.md`
- WebSockets: `docs/WEBSOCKETS.md`
- MCP Integration: `docs/MCP_INTEGRATION.md`
- Getting Started: `docs/GETTING_STARTED.md`
- Deployment: `docs/DEPLOYMENT.md`

API Reference:

- OpenAPI JSON: `GET /api/openapi.json`
- Swagger UI: `GET /api/docs`

## Load & Latency Testing

Quick local load test against the Socket.IO server with RTT metrics and basic event throughput:

Commands

```
# Start server (dev mode recommended for Prisma engines)
PORT=3001 pnpm -w --filter @ai-agent-village-monitor/server dev

# In another terminal: run 100 clients for 20s
pnpm -C packages/server load:test -- \
  --url http://localhost:3001 --clients 100 --duration 20 --pingInt 500 --village demo \
  --out /tmp/load_100_20.json

# Optional: monitor server CPU/memory (pidusage) while load runs
node packages/server/scripts/monitor-pid.js --pid <SERVER_PID> \
  --duration 65 --interval 1000 --out /tmp/server_metrics_100_20.json
```

Scripts

- `packages/server/scripts/load-test.js` — spawns N clients, measures ping RTT (mean/median/p95), counts events (work_stream, bug_bot_spawn, bug_bot_resolved). Args: `--url`, `--clients`, `--duration`, `--pingInt`, `--village`, `--out`.
- `packages/server/scripts/monitor-pid.js` — samples CPU and memory of a given PID at an interval and writes a JSON summary. Args: `--pid`, `--duration`, `--interval`, `--out`.

## Privacy & Compliance (MVP)

- See `docs/PRIVACY.md` for data inventory, token handling, and user controls.
- Account deletion: `DELETE /api/account` with `{ "confirm": "<your name or email>" }`.
- Metrics honor DNT/GPC (skip when `DNT: 1` or `Sec-GPC: 1`).

### Secure OAuth Token Storage

- Set `TOKEN_ENCRYPTION_KEY` in `.env` to enable AES-256-GCM encryption at rest for OAuth tokens.
- Key must be 32 bytes (256-bit). Examples:

```
# base64 (recommended)
TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)"

# hex (64 hex chars)
TOKEN_ENCRYPTION_KEY="$(openssl rand -hex 32)"
```

- With the key set, tokens are stored in the `oauth_tokens` table encrypted (ciphertext + iv + auth tag).
- Without the key, a hashed reference is stored instead (non-retrievable), sufficient for audit/exchange patterns.
- Helpers live in `packages/server/src/auth/tokenStore.ts`.

## GitHub OAuth Setup

- Create a GitHub OAuth App with callback: `https://<host>/auth/github/callback`.
- Set env vars in `.env` (see `.env.example`):
  - `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `JWT_SECRET`
  - `PUBLIC_SERVER_URL` (e.g., `http://localhost:3000`), `PUBLIC_APP_URL`
  - Optional: `OAUTH_REDIRECT_URI` (overrides derived callback), `COOKIE_DOMAIN`, `OAUTH_SCOPES` (defaults to `read:user read:org workflow` — add `repo` only if private repo access is required), `KMS_KEY_ID`.
- In production, the server validates required values at boot and will fail fast if missing.

### Token Storage

- This MVP stores a salted SHA‑256 hash of the GitHub access token on the `User` record (`accessTokenHash`) and does not persist the plaintext token.
- This aligns with the "hashed reference" approach: the token itself is not retrievable at rest; future integrations should prefer GitHub Apps or short‑lived tokens obtained via OAuth re‑authorization when needed.
- If encryption at rest is required, introduce an `oauth_tokens` table with AES‑256‑GCM envelope encryption using a `KMS_KEY_ID` data key and rotate regularly.

## Next Steps

- Scaffold `apps/web` (Vite + React + Phaser) and `apps/server` (Express + TS)
- Connect MCP SDK and GitHub OAuth
- Stand up Probot app for Bug Bots

## License

TBD

<!-- TASKMASTER_EXPORT_START -->

> 🎯 **Taskmaster Export** - 2025-09-16 02:00:03 UTC
> 📋 Export: with subtasks • Status filter: none
> 🔗 Powered by [Task Master](https://task-master.dev?utm_source=github-readme&utm_medium=readme-export&utm_campaign=ai-agent-village-monitor&utm_content=task-export-link)

| Project Dashboard |                          |
| :---------------- | :----------------------- |
| Task Progress     | ████████████░░░░░░░░ 62% |
| Done              | 37                       |
| In Progress       | 11                       |
| Pending           | 12                       |
| Deferred          | 0                        |
| Cancelled         | 0                        |
| -                 | -                        |
| Subtask Progress  | ████████████████░░░░ 78% |
| Completed         | 395                      |
| In Progress       | 1                        |
| Pending           | 108                      |

| ID     | Title                                                                       | Status             | Priority | Dependencies                                                  | Complexity |
| :----- | :-------------------------------------------------------------------------- | :----------------- | :------- | :------------------------------------------------------------ | :--------- |
| 41     | Initialize Monorepo and Tooling                                             | ✓&nbsp;done        | medium   | None                                                          | N/A        |
| 41.1   | Initialize pnpm workspace and repository scaffolding                        | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 41.2   | Configure TypeScript base and path aliases                                  | ✓&nbsp;done        | -        | 41.1                                                          | N/A        |
| 41.3   | Set up ESLint and Prettier at the root                                      | ✓&nbsp;done        | -        | 41.1, 41.2                                                    | N/A        |
| 41.4   | Install Husky and configure lint-staged hooks                               | ✓&nbsp;done        | -        | 41.3                                                          | N/A        |
| 41.5   | Scaffold shared package for types and utilities                             | ✓&nbsp;done        | -        | 41.1, 41.2                                                    | N/A        |
| 41.6   | Scaffold backend server package (Node 18+, Express, TS)                     | ✓&nbsp;done        | -        | 41.2, 41.5                                                    | N/A        |
| 41.7   | Scaffold frontend package (Vite + React 18 + Phaser 3.70+)                  | ✓&nbsp;done        | -        | 41.2, 41.5                                                    | N/A        |
| 41.8   | Implement dotenv and zod-based environment validation                       | ✓&nbsp;done        | -        | 41.5, 41.6, 41.7                                              | N/A        |
| 41.9   | Add CI workflow for lint, typecheck, and build                              | ✓&nbsp;done        | -        | 41.3, 41.6, 41.7, 41.8                                        | N/A        |
| 42     | Backend Scaffold with Express + TypeScript                                  | ✓&nbsp;done        | medium   | 41                                                            | N/A        |
| 42.1   | Project structure and tooling setup                                         | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 42.2   | Typed configuration loader with env validation                              | ✓&nbsp;done        | -        | 42.1                                                          | N/A        |
| 42.3   | Express app and middleware wiring                                           | ✓&nbsp;done        | -        | 42.1, 42.2                                                    | N/A        |
| 42.4   | Health and readiness endpoints                                              | ✓&nbsp;done        | -        | 42.3                                                          | N/A        |
| 42.5   | JSON error and 404 handlers                                                 | ✓&nbsp;done        | -        | 42.3, 42.4                                                    | N/A        |
| 42.6   | Graceful startup/shutdown and Supertest smoke                               | ✓&nbsp;done        | -        | 42.2, 42.3, 42.4, 42.5                                        | N/A        |
| 43     | Database Setup and Migrations (PostgreSQL 15+)                              | ✓&nbsp;done        | medium   | 42                                                            | N/A        |
| 43.1   | Initialize Prisma and configure project                                     | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 43.2   | Model PRD tables in Prisma schema                                           | ✓&nbsp;done        | -        | 43.1                                                          | N/A        |
| 43.3   | Decide and implement Postgres types (citext/JSONB)                          | ✓&nbsp;done        | -        | 43.2                                                          | N/A        |
| 43.4   | Add indexes and foreign keys with cascade rules                             | ✓&nbsp;done        | -        | 43.2, 43.3                                                    | N/A        |
| 43.5   | Generate and apply initial migration                                        | ✓&nbsp;done        | -        | 43.4                                                          | N/A        |
| 43.6   | Implement seed script for demo data                                         | ✓&nbsp;done        | -        | 43.5                                                          | N/A        |
| 43.7   | Local and test database setup scripts                                       | ✓&nbsp;done        | -        | 43.1, 43.5                                                    | N/A        |
| 43.8   | Transaction and rollback test                                               | ✓&nbsp;done        | -        | 43.7, 43.5                                                    | N/A        |
| 44     | Redis and BullMQ Initialization                                             | ✓&nbsp;done        | medium   | 42                                                            | N/A        |
| 44.1   | Create ioredis client factory (shared Redis connection)                     | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 44.2   | Initialize BullMQ queues (agentCommands, githubSync)                        | ✓&nbsp;done        | -        | 44.1                                                          | N/A        |
| 44.3   | Implement worker processes for each queue                                   | ✓&nbsp;done        | -        | 44.2                                                          | N/A        |
| 44.4   | Configure retry/backoff, timeouts, and failure handling                     | ✓&nbsp;done        | -        | 44.2, 44.3                                                    | N/A        |
| 44.5   | Add metrics and structured logging for queues/workers                       | ✓&nbsp;done        | -        | 44.3                                                          | N/A        |
| 44.6   | Implement graceful shutdown for server and workers                          | ✓&nbsp;done        | -        | 44.3                                                          | N/A        |
| 44.7   | Local Redis via docker-compose and enqueue/dequeue test                     | ✓&nbsp;done        | -        | 44.1, 44.2, 44.3, 44.4                                        | N/A        |
| 45     | WebSocket Server with Native WS and Socket.io Fallback                      | ✓&nbsp;done        | medium   | 42                                                            | N/A        |
| 45.1   | Attach Socket.io v4 to Express HTTP server                                  | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 45.2   | JWT authentication middleware for socket connections                        | ✓&nbsp;done        | -        | 45.1                                                          | N/A        |
| 45.3   | Room naming and join/leave handlers                                         | ✓&nbsp;done        | -        | 45.2                                                          | N/A        |
| 45.4   | Event contracts and emit/broadcast APIs                                     | ✓&nbsp;done        | -        | 45.3                                                          | N/A        |
| 45.5   | Heartbeat, ping/timeout, and reconnect-aware handlers                       | ✓&nbsp;done        | -        | 45.1, 45.4                                                    | N/A        |
| 45.6   | Transports and HTTP polling fallback configuration                          | ✓&nbsp;done        | -        | 45.1                                                          | N/A        |
| 45.7   | Centralized error handling and logging                                      | ✓&nbsp;done        | -        | 45.2, 45.3, 45.4                                              | N/A        |
| 45.8   | Local load and latency testing                                              | ✓&nbsp;done        | -        | 45.6, 45.4, 45.5                                              | N/A        |
| 45.9   | Integration tests with socket.io-client                                     | ✓&nbsp;done        | -        | 45.2, 45.3, 45.4, 45.5, 45.6, 45.7                            | N/A        |
| 46     | GitHub OAuth 2.0 Flow                                                       | ✓&nbsp;done        | medium   | 42                                                            | N/A        |
| 46.1   | Configure GitHub OAuth App and environment                                  | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 46.2   | Implement GET /auth/login redirect with state and PKCE                      | ✓&nbsp;done        | -        | 46.1                                                          | N/A        |
| 46.3   | Implement POST /auth/github/callback code exchange                          | ✓&nbsp;done        | -        | 46.1, 46.2                                                    | N/A        |
| 46.4   | Fetch GitHub user and persist user record                                   | ✓&nbsp;done        | -        | 46.3                                                          | N/A        |
| 46.5   | Secure token storage (encrypt or hashed reference)                          | ✓&nbsp;done        | -        | 46.3, 46.4                                                    | N/A        |
| 46.6   | JWT access/refresh issuance and rotation                                    | ✓&nbsp;done        | -        | 46.4, 46.5                                                    | N/A        |
| 46.7   | Implement GET /auth/me and POST /auth/logout                                | ✓&nbsp;done        | -        | 46.6                                                          | N/A        |
| 46.8   | Harden cookies, CORS, CSRF/state, and security headers                      | ✓&nbsp;done        | -        | 46.2, 46.6                                                    | N/A        |
| 46.9   | Error handling, auditing, and PII/token sanitization                        | ✓&nbsp;done        | -        | 46.2, 46.3, 46.4, 46.6                                        | N/A        |
| 46.10  | End-to-end flow test in GitHub test org                                     | ✓&nbsp;done        | -        | 46.1, 46.2, 46.3, 46.4, 46.5, 46.6, 46.7, 46.8, 46.9          | N/A        |
| 47     | JWT Auth Middleware and Access Control                                      | ✓&nbsp;done        | medium   | 46                                                            | N/A        |
| 47.1   | JWT verification utility                                                    | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 47.2   | Request and context typing                                                  | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 47.3   | Standardized 401/403 JSON error responses                                   | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 47.4   | requireAuth middleware for /api/\*                                          | ✓&nbsp;done        | -        | 47.1, 47.2, 47.3                                              | N/A        |
| 47.5   | Village role resolver from village_access                                   | ✓&nbsp;done        | -        | 47.2                                                          | N/A        |
| 47.6   | requireVillageRole authorization helper                                     | ✓&nbsp;done        | -        | 47.2, 47.3, 47.4, 47.5                                        | N/A        |
| 47.7   | WebSocket auth integration                                                  | ✓&nbsp;done        | -        | 47.1, 47.2, 47.3, 47.5, 47.6                                  | N/A        |
| 47.8   | Auth and access control tests                                               | ✓&nbsp;done        | -        | 47.1, 47.4, 47.5, 47.6, 47.7, 47.3, 47.2                      | N/A        |
| 48     | Villages REST Endpoints                                                     | ✓&nbsp;done        | medium   | 47                                                            | N/A        |
| 48.1   | Define Zod schemas for Villages API                                         | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 48.2   | Implement GET /api/villages (list by access)                                | ✓&nbsp;done        | -        | 48.1                                                          | N/A        |
| 48.3   | Implement POST /api/villages (create from GitHub org)                       | ✓&nbsp;done        | -        | 48.1                                                          | N/A        |
| 48.4   | Implement GET/PUT/DELETE /api/villages/:id with access and ownership checks | ✓&nbsp;done        | -        | 48.1                                                          | N/A        |
| 48.5   | Ensure persistence and sanitization of village_config and is_public         | ✓&nbsp;done        | -        | 48.3, 48.4                                                    | N/A        |
| 48.6   | Add last_synced update hook/service                                         | ✓&nbsp;done        | -        | 48.3                                                          | N/A        |
| 48.7   | Supertest integration tests for Villages CRUD and access                    | ✓&nbsp;done        | -        | 48.2, 48.3, 48.4, 48.5, 48.6                                  | N/A        |
| 49     | GitHub Organization and Repositories Sync                                   | ✓&nbsp;done        | medium   | 46                                                            | N/A        |
| 49.1   | GitHubService scaffolding (REST + GraphQL)                                  | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 49.2   | GraphQL repo query and pagination                                           | ✓&nbsp;done        | -        | 49.1                                                          | N/A        |
| 49.3   | REST languages fallback                                                     | ✓&nbsp;done        | -        | 49.1, 49.2                                                    | N/A        |
| 49.4   | Sync endpoint and BullMQ job pipeline                                       | ✓&nbsp;done        | -        | 49.1, 49.2, 49.3                                              | N/A        |
| 49.5   | Upsert houses with deterministic grid layout                                | ✓&nbsp;done        | -        | 49.4, 49.2, 49.3                                              | N/A        |
| 49.6   | Rate limit handling with ETag/If-None-Match                                 | ✓&nbsp;done        | -        | 49.1, 49.3                                                    | N/A        |
| 49.7   | Retries and exponential backoff on limits                                   | ✓&nbsp;done        | -        | 49.1, 49.4, 49.6                                              | N/A        |
| 49.8   | Idempotency and job deduplication                                           | ✓&nbsp;done        | -        | 49.4, 49.5                                                    | N/A        |
| 49.9   | Metrics and structured logging                                              | ✓&nbsp;done        | -        | 49.4, 49.6, 49.7                                              | N/A        |
| 49.10  | Nock-based tests: small/large orgs and idempotency                          | ✓&nbsp;done        | -        | 49.1, 49.2, 49.3, 49.4, 49.5, 49.6, 49.7, 49.8, 49.9          | N/A        |
| 50     | Agents REST Endpoints and Model                                             | ✓&nbsp;done        | medium   | 47                                                            | N/A        |
| 50.1   | DB model and server types for Agent                                         | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 50.2   | Authorization helpers and cross-village guardrails foundation               | ✓&nbsp;done        | -        | 50.1                                                          | N/A        |
| 50.3   | sprite_config, position, current_status validation and normalization        | ✓&nbsp;done        | -        | 50.1                                                          | N/A        |
| 50.4   | GET /api/villages/:id/agents (list by village with role checks)             | ✓&nbsp;done        | -        | 50.1, 50.2                                                    | N/A        |
| 50.5   | POST /api/villages/:id/agents (create with URL/config validation)           | ✓&nbsp;done        | -        | 50.1, 50.2, 50.3                                              | N/A        |
| 50.6   | PUT and DELETE /api/agents/:id (update/delete endpoints)                    | ✓&nbsp;done        | -        | 50.1, 50.2, 50.3                                              | N/A        |
| 50.7   | Integration tests: CRUD, validation, auth, cross-village                    | ✓&nbsp;done        | -        | 50.1, 50.2, 50.3, 50.4, 50.5, 50.6                            | N/A        |
| 51     | MCP Agent Controller Service                                                | ✓&nbsp;done        | medium   | 45, 50                                                        | N/A        |
| 51.1   | Design MCPAgentController class and lifecycle                               | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 51.2   | Implement connectAgent with reconnect/backoff lifecycle                     | ✓&nbsp;done        | -        | 51.1                                                          | N/A        |
| 51.3   | Implement runTool and runTask APIs with streaming support                   | ✓&nbsp;done        | -        | 51.2, 51.4                                                    | N/A        |
| 51.4   | Wire event streaming hooks and normalization                                | ✓&nbsp;done        | -        | 51.2                                                          | N/A        |
| 51.5   | Broadcast events and status to WebSocket rooms                              | ✓&nbsp;done        | -        | 51.4, 51.7                                                    | N/A        |
| 51.6   | Persist work_stream_events in DB via Prisma                                 | ✓&nbsp;done        | -        | 51.4                                                          | N/A        |
| 51.7   | Define error handling and state transitions                                 | ✓&nbsp;done        | -        | 51.2                                                          | N/A        |
| 51.8   | Implement resource cleanup and shutdown                                     | ✓&nbsp;done        | -        | 51.2, 51.4, 51.5, 51.6                                        | N/A        |
| 51.9   | Add metrics and structured logging                                          | ✓&nbsp;done        | -        | 51.1, 51.2, 51.3, 51.4, 51.5, 51.6, 51.7                      | N/A        |
| 51.10  | Create mockable interfaces and tests                                        | ✓&nbsp;done        | -        | 51.1, 51.2, 51.3, 51.4, 51.5, 51.6, 51.7, 51.8, 51.9          | N/A        |
| 52     | Agent Session Management and Command Queue                                  | ✓&nbsp;done        | medium   | 44, 51                                                        | N/A        |
| 52.1   | Session and Event Models & Migrations                                       | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 52.2   | Implement Start/Stop Session Endpoints                                      | ✓&nbsp;done        | -        | 52.1                                                          | N/A        |
| 52.3   | Idempotency Guards and Restart Semantics                                    | ✓&nbsp;done        | -        | 52.1, 52.2                                                    | N/A        |
| 52.4   | BullMQ Command Producer and /command Endpoint                               | ✓&nbsp;done        | -        | 52.1, 52.2, 52.3                                              | N/A        |
| 52.5   | Worker: Execute Commands via MCPAgentController                             | ✓&nbsp;done        | -        | 52.1, 52.4                                                    | N/A        |
| 52.6   | Retry Strategy and Dead-Letter Queue                                        | ✓&nbsp;done        | -        | 52.5                                                          | N/A        |
| 52.7   | WebSocket/SSE Event Emission                                                | ✓&nbsp;done        | -        | 52.1, 52.2, 52.5, 52.6                                        | N/A        |
| 52.8   | Audit Logging for Sessions and Commands                                     | ✓&nbsp;done        | -        | 52.1, 52.2, 52.4, 52.5, 52.7                                  | N/A        |
| 52.9   | Integration Tests: Start → Command → Stop                                   | ✓&nbsp;done        | -        | 52.1, 52.2, 52.3, 52.4, 52.5, 52.6, 52.7, 52.8                | N/A        |
| 53     | Work Stream Events API                                                      | ✓&nbsp;done        | medium   | 51                                                            | N/A        |
| 53.1   | Define Event DTO and JSON Serialization                                     | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 53.2   | Create DB Index for Session Timestamp Ordering                              | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 53.3   | Implement Authorization Checks per Agent and Session                        | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 53.4   | Build Paginated REST Endpoint                                               | ✓&nbsp;done        | -        | 53.1, 53.2, 53.3                                              | N/A        |
| 53.5   | Implement SSE Endpoint with Long-Poll Fallback                              | ✓&nbsp;done        | -        | 53.1, 53.2, 53.3, 53.4                                        | N/A        |
| 53.6   | Performance and Timing Tests                                                | ✓&nbsp;done        | -        | 53.2, 53.4, 53.5                                              | N/A        |
| 53.7   | Pagination Correctness Tests with Large Datasets                            | ✓&nbsp;done        | -        | 53.2, 53.4                                                    | N/A        |
| 54     | Probot App Setup and Webhooks                                               | ►&nbsp;in-progress | medium   | 45, 49                                                        | N/A        |
| 54.1   | Initialize Probot app skeleton and webhook route                            | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 54.2   | Webhook secret configuration and signature validation                       | ✓&nbsp;done        | -        | 54.1                                                          | N/A        |
| 54.3   | Backend bridge abstractions (HTTP + WebSocket)                              | ✓&nbsp;done        | -        | 54.1                                                          | N/A        |
| 54.4   | Implement issues.opened and issues.closed handlers                          | ✓&nbsp;done        | -        | 54.1, 54.2, 54.3                                              | N/A        |
| 54.5   | Implement check_run.completed handler for CI failures                       | ✓&nbsp;done        | -        | 54.1, 54.2, 54.3                                              | N/A        |
| 54.6   | Idempotency and event de-duplication                                        | ✓&nbsp;done        | -        | 54.1, 54.2                                                    | N/A        |
| 54.7   | Security hardening and replay protection                                    | ✓&nbsp;done        | -        | 54.2, 54.6                                                    | N/A        |
| 54.8   | Local runner and tooling for manual testing                                 | ✓&nbsp;done        | -        | 54.1, 54.2, 54.3, 54.4, 54.5, 54.6, 54.7                      | N/A        |
| 54.9   | Probot automated test suite                                                 | ○&nbsp;pending     | -        | 54.1, 54.2, 54.3, 54.4, 54.5, 54.6, 54.7                      | N/A        |
| 55     | Bug Bot Persistence and Lifecycle                                           | ✓&nbsp;done        | medium   | 43, 54                                                        | N/A        |
| 55.1   | Finalize bug_bots DB schema and migration                                   | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 55.2   | Implement core services for Bug Bot lifecycle                               | ✓&nbsp;done        | -        | 55.1                                                          | N/A        |
| 55.3   | WebSocket emissions for spawn/update/resolved                               | ✓&nbsp;done        | -        | 55.2                                                          | N/A        |
| 55.4   | REST endpoints for list/assign/status                                       | ✓&nbsp;done        | -        | 55.2, 55.1                                                    | N/A        |
| 55.5   | Validation and authorization for endpoints                                  | ✓&nbsp;done        | -        | 55.4, 55.2                                                    | N/A        |
| 55.6   | Webhook integration for repository issues/events                            | ✓&nbsp;done        | -        | 55.2, 55.1                                                    | N/A        |
| 55.7   | Repository consistency checks and reconciliation                            | ✓&nbsp;done        | -        | 55.2, 55.1, 55.6                                              | N/A        |
| 55.8   | Lifecycle integration tests and WS verification                             | ✓&nbsp;done        | -        | 55.3, 55.4, 55.5, 55.6, 55.7, 55.1, 55.2                      | N/A        |
| 55.9   | Error handling, retries, and observability                                  | ✓&nbsp;done        | -        | 55.4, 55.6, 55.3, 55.2                                        | N/A        |
| 56     | GitHub Actions Trigger Endpoint                                             | ○&nbsp;pending     | medium   | 46                                                            | N/A        |
| 56.1   | Implement POST /api/github/dispatch endpoint with Zod validation            | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 56.2   | Permission check for repository access (installation or OAuth)              | ○&nbsp;pending     | -        | 56.1                                                          | N/A        |
| 56.3   | Octokit repository_dispatch call implementation                             | ○&nbsp;pending     | -        | 56.1, 56.2                                                    | N/A        |
| 56.4   | WebSocket confirmation event emission                                       | ○&nbsp;pending     | -        | 56.3                                                          | N/A        |
| 56.5   | Error mapping and 403 handling                                              | ○&nbsp;pending     | -        | 56.1, 56.3                                                    | N/A        |
| 56.6   | Nock-based tests for endpoint and flows                                     | ○&nbsp;pending     | -        | 56.1, 56.2, 56.3, 56.4, 56.5                                  | N/A        |
| 57     | Frontend Project Initialization (Vite + React + Phaser)                     | ✓&nbsp;done        | medium   | 41                                                            | N/A        |
| 57.1   | Scaffold Vite React TypeScript project                                      | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 57.2   | Configure path aliases (@, @shared)                                         | ✓&nbsp;done        | -        | 57.1                                                          | N/A        |
| 57.3   | Set up minimal CSS Modules and global styles                                | ✓&nbsp;done        | -        | 57.1                                                          | N/A        |
| 57.4   | Routing setup (React Router)                                                | ✓&nbsp;done        | -        | 57.1                                                          | N/A        |
| 57.5   | Phaser integration via GameProvider                                         | ✓&nbsp;done        | -        | 57.1, 57.4                                                    | N/A        |
| 57.6   | API client with fetch and zod validation                                    | ✓&nbsp;done        | -        | 57.1, 57.2                                                    | N/A        |
| 57.7   | WebSocketService singleton (Socket.IO client stub)                          | ✓&nbsp;done        | -        | 57.1, 57.2                                                    | N/A        |
| 57.8   | Unit tests: Phaser mount and WebSocketService mock                          | ✓&nbsp;done        | -        | 57.5, 57.7                                                    | N/A        |
| 58     | VillageScene: Tilemap and Camera Controls                                   | ✓&nbsp;done        | medium   | 57                                                            | N/A        |
| 58.1   | Isometric grid utilities or plugin integration                              | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 58.2   | Base tilemap render                                                         | ✓&nbsp;done        | -        | 58.1                                                          | N/A        |
| 58.3   | Camera pan via drag                                                         | ✓&nbsp;done        | -        | 58.2                                                          | N/A        |
| 58.4   | Zoom with bounds and cursor anchoring                                       | ✓&nbsp;done        | -        | 58.2, 58.3                                                    | N/A        |
| 58.5   | Responsive resize handling                                                  | ✓&nbsp;done        | -        | 58.4                                                          | N/A        |
| 58.6   | Double-click fast travel to house                                           | ✓&nbsp;done        | -        | 58.2, 58.3, 58.4                                              | N/A        |
| 58.7   | Performance tuning and culling                                              | ✓&nbsp;done        | -        | 58.2, 58.3, 58.4, 58.5                                        | N/A        |
| 58.8   | Mobile input support                                                        | ✓&nbsp;done        | -        | 58.3, 58.4, 58.6                                              | N/A        |
| 58.9   | Performance test harness                                                    | ✓&nbsp;done        | -        | 58.1, 58.2, 58.3, 58.4, 58.5, 58.6, 58.7, 58.8                | N/A        |
| 59     | AssetManager: Load Sprites and Animations                                   | ✓&nbsp;done        | medium   | 57                                                            | N/A        |
| 59.1   | Define atlas manifests and preload lists                                    | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 59.2   | Implement LoadingScene with async preloading and progress UI                | ✓&nbsp;done        | -        | 59.1                                                          | N/A        |
| 59.3   | AssetManager API and loader integration                                     | ✓&nbsp;done        | -        | 59.1                                                          | N/A        |
| 59.4   | Define animations for agents and bug bots (idle/walk/work)                  | ✓&nbsp;done        | -        | 59.1, 59.3                                                    | N/A        |
| 59.5   | Agent tint variations by deterministic ID hashing                           | ✓&nbsp;done        | -        | 59.3, 59.4                                                    | N/A        |
| 59.6   | House variants by language mapping and retrieval                            | ✓&nbsp;done        | -        | 59.1, 59.3                                                    | N/A        |
| 59.7   | Disposal/unload and memory management strategy                              | ✓&nbsp;done        | -        | 59.3, 59.2, 59.4                                              | N/A        |
| 59.8   | Tests and snapshots for manifests and AssetManager                          | ✓&nbsp;done        | -        | 59.1, 59.3, 59.4, 59.5, 59.6, 59.7                            | N/A        |
| 60     | House Entity and Repo Visualization                                         | ○&nbsp;pending     | medium   | 49, 58, 59                                                    | N/A        |
| 60.1   | Implement House Container Class                                             | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 60.2   | Add Label and Hover Tooltip UI                                              | ○&nbsp;pending     | -        | 60.1                                                          | N/A        |
| 60.3   | Map GitHub Repo Stats to Visual States                                      | ○&nbsp;pending     | -        | 60.1                                                          | N/A        |
| 60.4   | Implement Activity Indicators (Window Lights & Chimney Smoke)               | ○&nbsp;pending     | -        | 60.1, 60.3                                                    | N/A        |
| 60.5   | Apply Language-Based Visuals and Styling                                    | ○&nbsp;pending     | -        | 60.1, 60.3                                                    | N/A        |
| 60.6   | Implement Click-to-Zoom Behavior                                            | ○&nbsp;pending     | -        | 60.1                                                          | N/A        |
| 60.7   | Create Mock Data and Event Harness                                          | ○&nbsp;pending     | -        | 60.3, 60.4, 60.5                                              | N/A        |
| 60.8   | Write Interaction and Visual Tests                                          | ○&nbsp;pending     | -        | 60.1, 60.2, 60.3, 60.4, 60.5, 60.6, 60.7                      | N/A        |
| 61     | Agent Entity with Status and Interactions                                   | ✓&nbsp;done        | medium   | None                                                          | N/A        |
| 61.1   | Agent class and state machine                                               | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 61.2   | Status ring rendering                                                       | ✓&nbsp;done        | -        | 61.1                                                          | N/A        |
| 61.3   | Animations per state                                                        | ✓&nbsp;done        | -        | 61.1                                                          | N/A        |
| 61.4   | Hover and tooltip behavior                                                  | ✓&nbsp;done        | -        | 61.1                                                          | N/A        |
| 61.5   | Open Dialogue on click                                                      | ✓&nbsp;done        | -        | 61.4                                                          | N/A        |
| 61.6   | Context menu actions (right-click)                                          | ✓&nbsp;done        | -        | 61.1, 61.4                                                    | N/A        |
| 61.7   | Drag-to-move visuals                                                        | ✓&nbsp;done        | -        | 61.1, 61.4                                                    | N/A        |
| 61.8   | WebSocket-driven state updates                                              | ✓&nbsp;done        | -        | 61.1, 61.2, 61.3                                              | N/A        |
| 61.9   | Interaction tests and QA                                                    | ✓&nbsp;done        | -        | 61.1, 61.2, 61.3, 61.4, 61.5, 61.6, 61.7, 61.8                | N/A        |
| 62     | WebSocket Client Integration                                                | ✓&nbsp;done        | medium   | None                                                          | N/A        |
| 62.1   | Socket.io client wrapper (WebSocketService)                                 | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 62.2   | JWT attachment and auto-reconnect                                           | ✓&nbsp;done        | -        | 62.1                                                          | N/A        |
| 62.3   | Room join flows: village and agent                                          | ✓&nbsp;done        | -        | 62.1, 62.2                                                    | N/A        |
| 62.4   | Event bus dispatch integration                                              | ✓&nbsp;done        | -        | 62.1                                                          | N/A        |
| 62.5   | Event handlers for agent_update, work_stream, bug_bot_spawn/resolved        | ✓&nbsp;done        | -        | 62.3, 62.4                                                    | N/A        |
| 62.6   | Offline handling and REST catch-up                                          | ✓&nbsp;done        | -        | 62.2, 62.3, 62.5                                              | N/A        |
| 62.7   | Latency measurement and metrics                                             | ✓&nbsp;done        | -        | 62.1                                                          | N/A        |
| 62.8   | Unit tests with mocked Socket.io server                                     | ✓&nbsp;done        | -        | 62.1, 62.2, 62.3, 62.4, 62.5, 62.6, 62.7                      | N/A        |
| 63     | Dialogue UI Panel with Tabs and Streaming                                   | ✓&nbsp;done        | medium   | None                                                          | N/A        |
| 63.1   | Panel Container with Slide Animation and Dismissal                          | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 63.2   | Tabbed Navigation: Thread, Control, Info                                    | ✓&nbsp;done        | -        | 63.1                                                          | N/A        |
| 63.3   | ThreadTab Streaming Message List with Auto-Scroll                           | ✓&nbsp;done        | -        | 63.2                                                          | N/A        |
| 63.4   | Input Box with Enter-to-Send                                                | ✓&nbsp;done        | -        | 63.2                                                          | N/A        |
| 63.5   | REST Command Integration for Task Submission                                | ✓&nbsp;done        | -        | 63.4                                                          | N/A        |
| 63.6   | WebSocket Stream Binding to ThreadTab                                       | ✓&nbsp;done        | -        | 63.2, 63.3                                                    | N/A        |
| 63.7   | Responsive Layout and Sizing                                                | ✓&nbsp;done        | -        | 63.1, 63.2                                                    | N/A        |
| 63.8   | Component and Integration Tests                                             | ✓&nbsp;done        | -        | 63.1, 63.2, 63.3, 63.4, 63.5, 63.6, 63.7                      | N/A        |
| 64     | Control Panel Actions: Run Tool, Commit, PR                                 | ✓&nbsp;done        | medium   | None                                                          | N/A        |
| 64.1   | Control Panel UI: Action Buttons and Forms                                  | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 64.2   | Integrate Run Tool API                                                      | ✓&nbsp;done        | -        | 64.1                                                          | N/A        |
| 64.3   | Commit and PR Flows via Backend                                             | ✓&nbsp;done        | -        | 64.1, 64.2                                                    | N/A        |
| 64.4   | Execution States, Confirmations, and Disabled Controls                      | ✓&nbsp;done        | -        | 64.1, 64.2, 64.3                                              | N/A        |
| 64.5   | Error Handling and Toast Notifications                                      | ✓&nbsp;done        | -        | 64.2, 64.3, 64.4                                              | N/A        |
| 64.6   | Optimistic Updates and Result Surfacing                                     | ✓&nbsp;done        | -        | 64.2, 64.3, 64.4, 64.5                                        | N/A        |
| 64.7   | Sandbox E2E Flow (Optional)                                                 | ✓&nbsp;done        | -        | 64.2, 64.3, 64.4, 64.5, 64.6                                  | N/A        |
| 64.8   | Unit and Integration Tests                                                  | ✓&nbsp;done        | -        | 64.1, 64.2, 64.3, 64.4, 64.5, 64.6                            | N/A        |
| 65     | GitHub Integration Middleware and Client                                    | ✓&nbsp;done        | medium   | None                                                          | N/A        |
| 65.1   | Initialize Octokit REST/GraphQL with throttle & retry                       | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 65.2   | Token sourcing and rotation                                                 | ✓&nbsp;done        | -        | 65.1                                                          | N/A        |
| 65.3   | ETag caching and conditional requests                                       | ✓&nbsp;done        | -        | 65.1                                                          | N/A        |
| 65.4   | Backoff and retry policies                                                  | ✓&nbsp;done        | -        | 65.1                                                          | N/A        |
| 65.5   | Error normalization and mapping                                             | ✓&nbsp;done        | -        | 65.1, 65.4                                                    | N/A        |
| 65.6   | Helper methods: repos, languages, dispatch, PRs, issues                     | ✓&nbsp;done        | -        | 65.1, 65.2, 65.3, 65.4, 65.5                                  | N/A        |
| 65.7   | Rate-limit observability and telemetry                                      | ✓&nbsp;done        | -        | 65.1, 65.4, 65.5                                              | N/A        |
| 65.8   | Unit tests with nock                                                        | ✓&nbsp;done        | -        | 65.1, 65.2, 65.3, 65.4, 65.5, 65.6                            | N/A        |
| 65.9   | Minimal scopes and permissions audit                                        | ✓&nbsp;done        | -        | 65.6                                                          | N/A        |
| 65.10  | Documentation and examples                                                  | ✓&nbsp;done        | -        | 65.6, 65.7, 65.8, 65.9                                        | N/A        |
| 66     | Bug Bot UI: Spawn, Assign, Progress, Celebrate                              | ✓&nbsp;done        | medium   | None                                                          | N/A        |
| 66.1   | Bot sprite system and severity styles                                       | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 66.2   | Spawn on WebSocket bug_bot_spawn near target house                          | ✓&nbsp;done        | -        | 66.1                                                          | N/A        |
| 66.3   | Drag-and-drop assignment to agent (UI and interactions)                     | ✓&nbsp;done        | -        | 66.1, 66.2                                                    | N/A        |
| 66.4   | Assign API integration (POST /api/bugs/:id/assign)                          | ✓&nbsp;done        | -        | 66.3                                                          | N/A        |
| 66.5   | Progress visualization and fade behavior                                    | ✓&nbsp;done        | -        | 66.1, 66.2                                                    | N/A        |
| 66.6   | Resolved celebration animation and cleanup                                  | ✓&nbsp;done        | -        | 66.2                                                          | N/A        |
| 66.7   | Performance and batch handling for many bots                                | ✓&nbsp;done        | -        | 66.2, 66.5, 66.6                                              | N/A        |
| 66.8   | Accessibility and UX hints                                                  | ✓&nbsp;done        | -        | 66.3, 66.4                                                    | N/A        |
| 66.9   | Tests, simulations, and visual snapshots                                    | ✓&nbsp;done        | -        | 66.2, 66.3, 66.4, 66.5, 66.6, 66.7, 66.8                      | N/A        |
| 67     | World Map Scene and Multi-Org Navigation                                    | ✓&nbsp;done        | medium   | None                                                          | N/A        |
| 67.1   | WorldMapScene scaffolding and renderer                                      | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 67.2   | Village regions from API and layout mapping                                 | ✓&nbsp;done        | -        | 67.1                                                          | N/A        |
| 67.3   | Lazy asset loading and chunked world assets                                 | ✓&nbsp;done        | -        | 67.1                                                          | N/A        |
| 67.4   | Navigation to VillageScene with instant teleport                            | ✓&nbsp;done        | -        | 67.1, 67.2, 67.3                                              | N/A        |
| 67.5   | Cross-scene state persistence (agents and camera)                           | ✓&nbsp;done        | -        | 67.4                                                          | N/A        |
| 67.6   | Mini-map overlay with current location indicator                            | ✓&nbsp;done        | -        | 67.1, 67.2                                                    | N/A        |
| 67.7   | Loading indicators and 2s travel-time budget                                | ✓&nbsp;done        | -        | 67.3, 67.4                                                    | N/A        |
| 67.8   | Back navigation from VillageScene to WorldMapScene                          | ✓&nbsp;done        | -        | 67.4, 67.5                                                    | N/A        |
| 67.9   | Performance and profiling tests across 10+ orgs                             | ✓&nbsp;done        | -        | 67.2, 67.3, 67.4, 67.5, 67.7, 67.8                            | N/A        |
| 68     | Onboarding Flow and Demo Mode                                               | ✓&nbsp;done        | medium   | None                                                          | N/A        |
| 68.1   | Build Onboarding Stepper UI and Flow Shell                                  | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 68.2   | Integrate GitHub Login                                                      | ✓&nbsp;done        | -        | 68.1                                                          | N/A        |
| 68.3   | Organization Selection UI and Data                                          | ✓&nbsp;done        | -        | 68.2                                                          | N/A        |
| 68.4   | App Install and Scope Grant UX                                              | ✓&nbsp;done        | -        | 68.3                                                          | N/A        |
| 68.5   | Create Village API Integration                                              | ✓&nbsp;done        | -        | 68.4                                                          | N/A        |
| 68.6   | Repo/Houses Sync Progress and Enter                                         | ✓&nbsp;done        | -        | 68.5                                                          | N/A        |
| 68.7   | Demo Mode with Mock Data                                                    | ✓&nbsp;done        | -        | 68.1                                                          | N/A        |
| 68.8   | Error and Recovery States Across Steps                                      | ✓&nbsp;done        | -        | 68.2, 68.3, 68.4, 68.5, 68.6, 68.7                            | N/A        |
| 68.9   | Analytics and Step Timing Instrumentation                                   | ✓&nbsp;done        | -        | 68.1, 68.2, 68.3, 68.4, 68.5, 68.6, 68.7                      | N/A        |
| 69     | Permissions and Access Control UI                                           | ✓&nbsp;done        | medium   | None                                                          | N/A        |
| 69.1   | API linkage for village_access and public flag                              | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 69.2   | Settings page: Permissions section UI                                       | ✓&nbsp;done        | -        | 69.1                                                          | N/A        |
| 69.3   | Invite by GitHub username flow                                              | ✓&nbsp;done        | -        | 69.1, 69.2                                                    | N/A        |
| 69.4   | Role assignment UI                                                          | ✓&nbsp;done        | -        | 69.1, 69.2                                                    | N/A        |
| 69.5   | Public village toggle (is_public)                                           | ✓&nbsp;done        | -        | 69.1, 69.2                                                    | N/A        |
| 69.6   | Badges and role indicators                                                  | ✓&nbsp;done        | -        | 69.1                                                          | N/A        |
| 69.7   | Gating controls in UI based on role                                         | ✓&nbsp;done        | -        | 69.1, 69.6                                                    | N/A        |
| 69.8   | Tests for role-based visibility and flows                                   | ✓&nbsp;done        | -        | 69.3, 69.4, 69.5, 69.6, 69.7                                  | N/A        |
| 70     | Caching and Rate-Limit Backoff for GitHub                                   | ✓&nbsp;done        | medium   | None                                                          | N/A        |
| 70.1   | Define Redis Key Schema                                                     | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 70.2   | Implement Cache Get/Set with TTLs                                           | ✓&nbsp;done        | -        | 70.1                                                          | N/A        |
| 70.3   | Implement 403 Rate-Limit Backoff with Jitter                                | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 70.4   | GraphQL Batching Fetchers                                                   | ✓&nbsp;done        | -        | 70.2, 70.3                                                    | N/A        |
| 70.5   | REST Fallback Fetchers                                                      | ✓&nbsp;done        | -        | 70.4, 70.3                                                    | N/A        |
| 70.6   | Webhook-Based Cache Invalidation                                            | ✓&nbsp;done        | -        | 70.1, 70.2                                                    | N/A        |
| 70.7   | Metrics and Logging for Cache and Backoff                                   | ✓&nbsp;done        | -        | 70.2                                                          | N/A        |
| 70.8   | Configuration Toggles and Policies                                          | ✓&nbsp;done        | -        | 70.2, 70.3, 70.4, 70.5                                        | N/A        |
| 70.9   | Simulated Rate-Limit and Caching Tests                                      | ✓&nbsp;done        | -        | 70.3, 70.4, 70.5, 70.6, 70.7                                  | N/A        |
| 71     | Performance Optimization: Rendering and State                               | ✓&nbsp;done        | medium   | None                                                          | N/A        |
| 71.1   | Spatial Hashing for View Culling                                            | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 71.2   | Sprite Draw Call Batching                                                   | ✓&nbsp;done        | -        | 71.1                                                          | N/A        |
| 71.3   | Throttle WebSocket/UI Updates to requestAnimationFrame                      | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 71.4   | Zoom-based LOD Tuning                                                       | ✓&nbsp;done        | -        | 71.1                                                          | N/A        |
| 71.5   | Reduce GC Pressure in Hot Paths                                             | ✓&nbsp;done        | -        | 71.2, 71.3                                                    | N/A        |
| 71.6   | Optional Web Worker Offload for Layout/Heavy Computation                    | ✓&nbsp;done        | -        | 71.5                                                          | N/A        |
| 71.7   | FPS Overlay via PerformanceManager                                          | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 71.8   | Profiling Scenarios and Load Test Harness                                   | ✓&nbsp;done        | -        | 71.7                                                          | N/A        |
| 71.9   | Performance Regression Guardrails                                           | ✓&nbsp;done        | -        | 71.8                                                          | N/A        |
| 72     | Service Worker and Offline/Retry Logic                                      | ✓&nbsp;done        | medium   | None                                                          | N/A        |
| 72.1   | Initialize Workbox-based Service Worker                                     | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 72.2   | Define Caching Strategies per Route/Asset                                   | ✓&nbsp;done        | -        | 72.1                                                          | N/A        |
| 72.3   | Connectivity Detection and UI Status Indicator                              | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 72.4   | In-app Command Queue with Dedupe and Persistence                            | ✓&nbsp;done        | -        | 72.3                                                          | N/A        |
| 72.5   | Replay and Retry Logic on Reconnect                                         | ✓&nbsp;done        | -        | 72.3, 72.4                                                    | N/A        |
| 72.6   | Service Worker Versioning and Update Flow (skipWaiting)                     | ✓&nbsp;done        | -        | 72.1, 72.2                                                    | N/A        |
| 72.7   | Edge Cases and Partial Failure Handling                                     | ✓&nbsp;done        | -        | 72.4, 72.5                                                    | N/A        |
| 72.8   | Telemetry and Instrumentation                                               | ✓&nbsp;done        | -        | 72.3, 72.4, 72.5, 72.6                                        | N/A        |
| 72.9   | Offline, Replay, and Update Test Suite                                      | ✓&nbsp;done        | -        | 72.1, 72.2, 72.3, 72.4, 72.5, 72.6, 72.7, 72.8                | N/A        |
| 73     | Security Hardening: Validation, Rate Limit, Secrets                         | ►&nbsp;in-progress | medium   | None                                                          | N/A        |
| 73.1   | Define Zod schemas per endpoint                                             | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 73.2   | Input sanitization and unified error shapes                                 | ○&nbsp;pending     | -        | 73.1                                                          | N/A        |
| 73.3   | CORS strict origin configuration                                            | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 73.4   | Helmet CSP for Phaser/WS + HTTPS enforcement                                | ○&nbsp;pending     | -        | 73.3                                                          | N/A        |
| 73.5   | API rate limiting with Redis store                                          | ○&nbsp;pending     | -        | 73.6, 73.2                                                    | N/A        |
| 73.6   | Secret management policy and environment config                             | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 73.7   | Audit logging for agent commands (who, what, when)                          | ○&nbsp;pending     | -        | 73.9, 73.6                                                    | N/A        |
| 73.8   | Security pen-test checklist and automated tests                             | ○&nbsp;pending     | -        | 73.1, 73.2, 73.3, 73.4, 73.5, 73.6, 73.7, 73.9                | N/A        |
| 73.9   | Logging PII scrubbing and redaction                                         | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 73.10  | Security hardening docs and runbooks                                        | ○&nbsp;pending     | -        | 73.1, 73.2, 73.3, 73.4, 73.5, 73.6, 73.7, 73.8, 73.9          | N/A        |
| 74     | GitHub Webhook Handler Endpoint (Express Bridge)                            | ►&nbsp;in-progress | medium   | None                                                          | N/A        |
| 74.1   | Create Express webhook endpoint with raw body capture                       | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 74.2   | Implement HMAC SHA-256 signature validation                                 | ○&nbsp;pending     | -        | 74.1                                                          | N/A        |
| 74.3   | Add Redis-based delivery ID deduplication                                   | ○&nbsp;pending     | -        | 74.1, 74.2                                                    | N/A        |
| 74.4   | Integrate Probot bridge or direct event dispatch                            | ○&nbsp;pending     | -        | 74.1, 74.2, 74.3                                              | N/A        |
| 74.5   | Define retry and idempotency strategy                                       | ○&nbsp;pending     | -        | 74.3, 74.4                                                    | N/A        |
| 74.6   | Optimize performance under burst load                                       | ○&nbsp;pending     | -        | 74.4, 74.5                                                    | N/A        |
| 74.7   | End-to-end tests: signed, tampered, dedupe, and burst                       | ○&nbsp;pending     | -        | 74.2, 74.3, 74.4, 74.5, 74.6                                  | N/A        |
| 75     | GitHub Actions from Dialogue UI                                             | ○&nbsp;pending     | medium   | 56, 57                                                        | N/A        |
| 75.1   | Workflows list API integration and UI dropdown                              | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 75.2   | Trigger workflow dispatch from ControlTab                                   | ○&nbsp;pending     | -        | 75.1                                                          | N/A        |
| 75.3   | In-flight disabled states and progress indicators                           | ○&nbsp;pending     | -        | 75.2                                                          | N/A        |
| 75.4   | Status stream subscription and local state model                            | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 75.5   | Map build statuses to visual indicators (chimney smoke)                     | ○&nbsp;pending     | -        | 75.4                                                          | N/A        |
| 75.6   | Last run status badge and tooltip on houses                                 | ○&nbsp;pending     | -        | 75.4, 75.5                                                    | N/A        |
| 75.7   | Robust error handling and resiliency                                        | ○&nbsp;pending     | -        | 75.1, 75.2, 75.4                                              | N/A        |
| 75.8   | End-to-end validation on test repository                                    | ○&nbsp;pending     | -        | 75.1, 75.2, 75.3, 75.4, 75.5, 75.6, 75.7                      | N/A        |
| 76     | World Map Mini-Map and Fast Travel                                          | ○&nbsp;pending     | medium   | 57, 60                                                        | N/A        |
| 76.1   | Render Texture Mini-Map Overlay                                             | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 76.2   | Viewport Bounds Overlay                                                     | ○&nbsp;pending     | -        | 76.1                                                          | N/A        |
| 76.3   | Click-to-Teleport Mapping                                                   | ○&nbsp;pending     | -        | 76.1                                                          | N/A        |
| 76.4   | Camera Teleport/Transition Handler                                          | ○&nbsp;pending     | -        | 76.2, 76.3                                                    | N/A        |
| 76.5   | UI State Persistence (Selected Agent & Dialogue Tab)                        | ○&nbsp;pending     | -        | 76.4                                                          | N/A        |
| 76.6   | Performance Budget and Instrumentation (<2s travel)                         | ○&nbsp;pending     | -        | 76.4, 76.5                                                    | N/A        |
| 76.7   | Accessibility and Input Alternatives                                        | ○&nbsp;pending     | -        | 76.1, 76.3, 76.4                                              | N/A        |
| 76.8   | Testing: Unit, Integration, E2E                                             | ○&nbsp;pending     | -        | 76.1, 76.2, 76.3, 76.4, 76.5, 76.6, 76.7                      | N/A        |
| 77     | Settings and Preferences                                                    | ►&nbsp;in-progress | medium   | 42                                                            | N/A        |
| 77.1   | Define preferences schema and models                                        | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 77.2   | Database migration for users.preferences (JSONB) and defaults               | ✓&nbsp;done        | -        | 77.1                                                          | N/A        |
| 77.3   | Implement read/write preferences API endpoints                              | ✓&nbsp;done        | -        | 77.2                                                          | N/A        |
| 77.4   | Runtime application of preferences                                          | ✓&nbsp;done        | -        | 77.1, 77.3                                                    | N/A        |
| 77.5   | Settings UI page with live controls                                         | ✓&nbsp;done        | -        | 77.3, 77.4                                                    | N/A        |
| 77.6   | Tests: persistence, defaults, and immediate effect                          | ○&nbsp;pending     | -        | 77.2, 77.3, 77.4, 77.5                                        | N/A        |
| 78     | Keyboard Shortcuts and Accessibility                                        | ✓&nbsp;done        | medium   | 57                                                            | N/A        |
| 78.1   | Implement Shortcut Registry (T/ESC/1-3)                                     | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 78.2   | Dialogue Focus Management                                                   | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 78.3   | Apply ARIA Roles and Labels                                                 | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 78.4   | Screen Reader Announcements for New Messages                                | ✓&nbsp;done        | -        | 78.3                                                          | N/A        |
| 78.5   | Shortcut Conflict Resolution with Browser Defaults                          | ✓&nbsp;done        | -        | 78.1                                                          | N/A        |
| 78.6   | High-Contrast Mode                                                          | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 78.7   | Axe Accessibility Audit and Fixes                                           | ✓&nbsp;done        | -        | 78.2, 78.3, 78.4, 78.6                                        | N/A        |
| 78.8   | Keyboard-Only Navigation Tests                                              | ✓&nbsp;done        | -        | 78.1, 78.2, 78.3, 78.4, 78.5, 78.6                            | N/A        |
| 79     | Monitoring, Logging, and Tracing                                            | ✓&nbsp;done        | medium   | 42, 57                                                        | N/A        |
| 79.1   | Integrate Sentry in backend and frontend with releases                      | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 79.2   | Add pino logger with request-id correlation                                 | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 79.3   | Enrich logs with user and session context                                   | ✓&nbsp;done        | -        | 79.2                                                          | N/A        |
| 79.4   | OpenTelemetry SDK setup and key spans                                       | ✓&nbsp;done        | -        | 79.2                                                          | N/A        |
| 79.5   | Configure OTLP exporters and sampling                                       | ✓&nbsp;done        | -        | 79.4                                                          | N/A        |
| 79.6   | Create sample dashboards for health and tracing                             | ✓&nbsp;done        | -        | 79.1, 79.2, 79.4, 79.5                                        | N/A        |
| 79.7   | Implement error injection tests and validation                              | ✓&nbsp;done        | -        | 79.1, 79.2, 79.3, 79.4, 79.5                                  | N/A        |
| 79.8   | Add privacy and data controls for logs and telemetry                        | ✓&nbsp;done        | -        | 79.1, 79.2, 79.3, 79.4                                        | N/A        |
| 79.9   | Expose optional /metrics endpoint for KPIs                                  | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 80     | Documentation and API Reference                                             | ✓&nbsp;done        | medium   | 42                                                            | N/A        |
| 80.1   | Environment Variables and Configuration Guide                               | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 80.2   | Architecture Overview and Diagrams + README                                 | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 80.3   | Database Schema Reference                                                   | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 80.4   | REST API OpenAPI Spec and Swagger-UI                                        | ✓&nbsp;done        | -        | 80.2, 80.3                                                    | N/A        |
| 80.5   | WebSocket Event Contracts                                                   | ✓&nbsp;done        | -        | 80.2                                                          | N/A        |
| 80.6   | MCP Integration Guide                                                       | ✓&nbsp;done        | -        | 80.1, 80.4, 80.5                                              | N/A        |
| 80.7   | Getting Started and Local Development                                       | ✓&nbsp;done        | -        | 80.1, 80.2, 80.3, 80.4, 80.5                                  | N/A        |
| 80.8   | Deployment Guides and Runbooks                                              | ✓&nbsp;done        | -        | 80.1, 80.2, 80.3, 80.4, 80.5                                  | N/A        |
| 81     | Backend Unit Tests (Jest)                                                   | ○&nbsp;pending     | medium   | 42                                                            | N/A        |
| 81.1   | Jest + ts-jest baseline setup                                               | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 81.2   | Test utilities and mocks for Octokit, MCP, and Redis                        | ✓&nbsp;done        | -        | 81.1                                                          | N/A        |
| 81.3   | Unit tests: GitHubService happy paths, retries, and ETag handling           | ✓&nbsp;done        | -        | 81.1, 81.2                                                    | N/A        |
| 81.4   | Unit tests: MCPAgentController state transitions and streaming              | ✓&nbsp;done        | -        | 81.1, 81.2                                                    | N/A        |
| 81.5   | Unit tests: Redis queues producers and consumers                            | ✓&nbsp;done        | -        | 81.1, 81.2                                                    | N/A        |
| 81.6   | Unit tests: Auth utilities and JWT flow                                     | ✓&nbsp;done        | -        | 81.1, 81.2                                                    | N/A        |
| 81.7   | Coverage configuration and thresholds                                       | ✓&nbsp;done        | -        | 81.1                                                          | N/A        |
| 81.8   | CI integration for unit tests and coverage                                  | ✓&nbsp;done        | -        | 81.1, 81.3, 81.4, 81.5, 81.6, 81.7                            | N/A        |
| 82     | Backend Integration Tests (Supertest + Testcontainers)                      | ►&nbsp;in-progress | medium   | 42                                                            | N/A        |
| 82.1   | Configure Testcontainers for Postgres and Redis                             | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 82.2   | Migration runner for containerized Postgres                                 | ✓&nbsp;done        | -        | 82.1                                                          | N/A        |
| 82.3   | Seed data utilities                                                         | ✓&nbsp;done        | -        | 82.2                                                          | N/A        |
| 82.4   | JWT/auth fixtures                                                           | ✓&nbsp;done        | -        | 82.2, 82.3                                                    | N/A        |
| 82.5   | Supertest suites for key REST endpoints                                     | ✓&nbsp;done        | -        | 82.1, 82.2, 82.3, 82.4                                        | N/A        |
| 82.6   | WebSocket test client for side-effects                                      | ✓&nbsp;done        | -        | 82.1, 82.2, 82.3, 82.4, 82.5                                  | N/A        |
| 82.7   | Isolation and teardown strategy                                             | ✓&nbsp;done        | -        | 82.1, 82.2, 82.3                                              | N/A        |
| 82.8   | CI parallelization configuration                                            | ►&nbsp;in-progress | -        | 82.1, 82.2, 82.7                                              | N/A        |
| 82.9   | Developer docs for running locally                                          | ○&nbsp;pending     | -        | 82.1, 82.2, 82.3, 82.4, 82.5, 82.6, 82.7, 82.8                | N/A        |
| 83     | Frontend Unit and Component Tests (Vitest/RTL)                              | ✓&nbsp;done        | medium   | 57                                                            | N/A        |
| 83.1   | Configure Vitest + React Testing Library with jsdom                         | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 83.2   | Create WebSocketService test mock and helpers                               | ✓&nbsp;done        | -        | 83.1                                                          | N/A        |
| 83.3   | DialogueUI tests: open/close, slide animation triggers, auto-scroll         | ✓&nbsp;done        | -        | 83.1, 83.2                                                    | N/A        |
| 83.4   | ControlTab interaction and content tests                                    | ✓&nbsp;done        | -        | 83.1, 83.2                                                    | N/A        |
| 83.5   | Snapshot important UI states                                                | ✓&nbsp;done        | -        | 83.1, 83.2, 83.3, 83.4                                        | N/A        |
| 83.6   | Keyboard shortcuts and ARIA/accessibility assertions                        | ✓&nbsp;done        | -        | 83.1, 83.2, 83.3, 83.4                                        | N/A        |
| 84     | End-to-End Tests (Playwright)                                               | ✓&nbsp;done        | medium   | 54, 58                                                        | N/A        |
| 84.1   | Playwright configuration and auth stub                                      | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 84.2   | Test data and seeding                                                       | ✓&nbsp;done        | -        | 84.1                                                          | N/A        |
| 84.3   | Village render journey                                                      | ✓&nbsp;done        | -        | 84.1, 84.2                                                    | N/A        |
| 84.4   | Agent click and dialogue streaming                                          | ✓&nbsp;done        | -        | 84.3                                                          | N/A        |
| 84.5   | Webhook-driven bot spawn simulation                                         | ✓&nbsp;done        | -        | 84.3                                                          | N/A        |
| 84.6   | Agent assignment flow                                                       | ✓&nbsp;done        | -        | 84.5                                                          | N/A        |
| 84.7   | World map travel between orgs                                               | ✓&nbsp;done        | -        | 84.3                                                          | N/A        |
| 84.8   | Timing assertions and flake controls                                        | ✓&nbsp;done        | -        | 84.3, 84.4, 84.5, 84.6, 84.7                                  | N/A        |
| 84.9   | CI video and trace artifacts                                                | ✓&nbsp;done        | -        | 84.1                                                          | N/A        |
| 85     | Load and Soak Testing (k6/Artillery)                                        | ►&nbsp;in-progress | medium   | 45                                                            | N/A        |
| 85.1   | Staging environment setup for load/soak                                     | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 85.2   | Synthetic dataset and identity generation                                   | ✓&nbsp;done        | -        | 85.1                                                          | N/A        |
| 85.3   | Performance thresholds and SLAs                                             | ○&nbsp;pending     | -        | 85.1                                                          | N/A        |
| 85.4   | Ramp-up profiles and soak plan                                              | ○&nbsp;pending     | -        | 85.1, 85.3                                                    | N/A        |
| 85.5   | k6 HTTP scenario implementation                                             | ✓&nbsp;done        | -        | 85.1, 85.2, 85.3, 85.4                                        | N/A        |
| 85.6   | Artillery WebSocket broadcast scenarios                                     | ✓&nbsp;done        | -        | 85.1, 85.2, 85.3, 85.4                                        | N/A        |
| 85.7   | Metrics and observability setup                                             | ○&nbsp;pending     | -        | 85.1, 85.5, 85.6                                              | N/A        |
| 85.8   | Execute runs and bottleneck analysis                                        | ✓&nbsp;done        | -        | 85.7                                                          | N/A        |
| 85.9   | Report and remediation plan                                                 | ✓&nbsp;done        | -        | 85.8                                                          | N/A        |
| 86     | CI/CD Pipelines (GitHub Actions)                                            | ○&nbsp;pending     | medium   | 81, 83, 84                                                    | N/A        |
| 86.1   | Define GitHub Environments and Secrets                                      | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 86.2   | Create ci.yml scaffold with pnpm caching                                    | ○&nbsp;pending     | -        | 86.1                                                          | N/A        |
| 86.3   | Add lint and type-check jobs to ci.yml                                      | ○&nbsp;pending     | -        | 86.2                                                          | N/A        |
| 86.4   | Add unit, integration, and e2e test jobs to ci.yml                          | ○&nbsp;pending     | -        | 86.2                                                          | N/A        |
| 86.5   | Artifact uploads and test reporting                                         | ○&nbsp;pending     | -        | 86.3, 86.4                                                    | N/A        |
| 86.6   | Configure deploy-frontend.yml for Vercel                                    | ○&nbsp;pending     | -        | 86.1, 86.3, 86.4                                              | N/A        |
| 86.7   | Configure deploy-backend.yml with migrations                                | ○&nbsp;pending     | -        | 86.1, 86.3, 86.4                                              | N/A        |
| 86.8   | Branch protections and rollback verification                                | ○&nbsp;pending     | -        | 86.6, 86.7                                                    | N/A        |
| 87     | Production Deployment and Environment Configuration                         | ►&nbsp;in-progress | medium   | None                                                          | N/A        |
| 87.1   | Create Vercel project, custom domain, and HSTS                              | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 87.2   | Provision Postgres 15 and Redis on Railway with backups                     | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 87.3   | Deploy backend on Railway with autoscaling                                  | ○&nbsp;pending     | -        | 87.2                                                          | N/A        |
| 87.4   | Set and manage production environment variables                             | ○&nbsp;pending     | -        | 87.1, 87.2, 87.3                                              | N/A        |
| 87.5   | Configure CORS policies and WebSocket origins                               | ○&nbsp;pending     | -        | 87.1, 87.3, 87.4                                              | N/A        |
| 87.6   | Enforce SSL and security headers                                            | ✓&nbsp;done        | -        | 87.1, 87.3                                                    | N/A        |
| 87.7   | Execute production smoke tests (HTTP and WS)                                | ✓&nbsp;done        | -        | 87.5, 87.6                                                    | N/A        |
| 87.8   | Define scaling and WebSocket stickiness strategy                            | ○&nbsp;pending     | -        | 87.2, 87.3, 87.5                                              | N/A        |
| 87.9   | Perform database backup and restore dry run                                 | ○&nbsp;pending     | -        | 87.2                                                          | N/A        |
| 88     | Feedback Collection and Help Center                                         | ○&nbsp;pending     | medium   | None                                                          | N/A        |
| 88.1   | Feedback Modal UI                                                           | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 88.2   | Feedback Backend Endpoint and Storage/Forwarder                             | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 88.3   | Rate Limiting and Abuse Controls                                            | ○&nbsp;pending     | -        | 88.2                                                          | N/A        |
| 88.4   | Help Menu Links and Docs Integration                                        | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 88.5   | Accessibility Tests and Fixes                                               | ○&nbsp;pending     | -        | 88.1, 88.4                                                    | N/A        |
| 89     | Village State Persistence                                                   | ►&nbsp;in-progress | medium   | None                                                          | N/A        |
| 89.1   | Database schema for positions and sprite configs                            | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 89.2   | Autosave throttling and batching logic                                      | ○&nbsp;pending     | -        | 89.1, 89.3                                                    | N/A        |
| 89.3   | REST endpoints for save/load layout                                         | ○&nbsp;pending     | -        | 89.1                                                          | N/A        |
| 89.4   | Scene load and application of persisted layout                              | ○&nbsp;pending     | -        | 89.2, 89.3                                                    | N/A        |
| 89.5   | Reset-to-auto-layout action                                                 | ○&nbsp;pending     | -        | 89.3, 89.4                                                    | N/A        |
| 89.6   | Conflict detection and resolution strategy                                  | ○&nbsp;pending     | -        | 89.2, 89.3                                                    | N/A        |
| 89.7   | Tests for persistence, throttling, reset, and conflicts                     | ○&nbsp;pending     | -        | 89.1, 89.2, 89.3, 89.4, 89.5, 89.6                            | N/A        |
| 90     | Auto Layout and Pathfinding Utilities                                       | ►&nbsp;in-progress | medium   | None                                                          | N/A        |
| 90.1   | Isometric layout generator (grid + Poisson-disk)                            | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 90.2   | Overlap avoidance and boundary enforcement                                  | ✓&nbsp;done        | -        | 90.1                                                          | N/A        |
| 90.3   | Export initial coordinates and isometric transforms                         | ✓&nbsp;done        | -        | 90.2                                                          | N/A        |
| 90.4   | Navigation grid and obstacle map construction                               | ✓&nbsp;done        | -        | 90.2                                                          | N/A        |
| 90.5   | A\* pathfinding utility with obstacle avoidance                             | ✓&nbsp;done        | -        | 90.4                                                          | N/A        |
| 90.6   | Path simplification and smoothing                                           | ✓&nbsp;done        | -        | 90.5, 90.4                                                    | N/A        |
| 90.7   | Agent movement animation along path (Phaser)                                | ✓&nbsp;done        | -        | 90.6, 90.3                                                    | N/A        |
| 90.8   | Public API for reusable layout and pathfinding                              | ✓&nbsp;done        | -        | 90.3, 90.6, 90.7                                              | N/A        |
| 90.9   | Tests and benchmarks on 100+ nodes/agents                                   | ✓&nbsp;done        | -        | 90.8                                                          | N/A        |
| 91     | Error States and Offline UI                                                 | ✓&nbsp;done        | medium   | None                                                          | N/A        |
| 91.1   | React Global Error Boundary                                                 | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 91.2   | Global Toast System for API/WS Errors                                       | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 91.3   | WebSocket Disconnect Overlay with Retry                                     | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 91.4   | Agent Error Visuals (Red Ring)                                              | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 91.5   | Global Offline Banner                                                       | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 91.6   | Failure Mode Simulations and Dev Tools                                      | ✓&nbsp;done        | -        | 91.1, 91.2, 91.3, 91.4, 91.5                                  | N/A        |
| 91.7   | UX Timing, Copy, and Accessibility Polish                                   | ✓&nbsp;done        | -        | 91.1, 91.2, 91.3, 91.4, 91.5, 91.6                            | N/A        |
| 92     | Public Village Mode                                                         | ✓&nbsp;done        | medium   | None                                                          | N/A        |
| 92.1   | Public route handling                                                       | ✓&nbsp;done        | -        | 92.2, 92.4                                                    | N/A        |
| 92.2   | Public GET endpoints without JWT                                            | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 92.3   | Server-side mutation blocking                                               | ✓&nbsp;done        | -        | 92.2                                                          | N/A        |
| 92.4   | WebSocket anonymous read-only join                                          | ✓&nbsp;done        | -        | 92.2, 92.3                                                    | N/A        |
| 92.5   | UI gating of controls in public mode                                        | ✓&nbsp;done        | -        | 92.1, 92.4                                                    | N/A        |
| 92.6   | Settings toggle for is_public                                               | ✓&nbsp;done        | -        | 92.2                                                          | N/A        |
| 92.7   | Cache headers for public content                                            | ✓&nbsp;done        | -        | 92.2                                                          | N/A        |
| 92.8   | Incognito tests for public mode                                             | ✓&nbsp;done        | -        | 92.1, 92.2, 92.3, 92.4, 92.5, 92.6, 92.7                      | N/A        |
| 93     | Activity Indicators from GitHub Events                                      | ○&nbsp;pending     | medium   | None                                                          | N/A        |
| 93.1   | Map GitHub webhook events to activity states                                | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 93.2   | Implement state store with TTL/expiry                                       | ○&nbsp;pending     | -        | 93.1                                                          | N/A        |
| 93.3   | Debounce and flicker prevention                                             | ○&nbsp;pending     | -        | 93.2                                                          | N/A        |
| 93.4   | Concurrency and layering of indicators                                      | ○&nbsp;pending     | -        | 93.2, 93.3                                                    | N/A        |
| 93.5   | WebSocket broadcast integration                                             | ○&nbsp;pending     | -        | 93.1, 93.2, 93.3, 93.4                                        | N/A        |
| 93.6   | Implement visuals: lights, banner, and smoke                                | ○&nbsp;pending     | -        | 93.1, 93.5                                                    | N/A        |
| 93.7   | Synthetic event test harness                                                | ○&nbsp;pending     | -        | 93.1, 93.5                                                    | N/A        |
| 93.8   | Visual validation and acceptance tests                                      | ○&nbsp;pending     | -        | 93.6, 93.7                                                    | N/A        |
| 94     | Command Palette and Quick Actions                                           | ○&nbsp;pending     | medium   | None                                                          | N/A        |
| 94.1   | Context Menu Component for Agents                                           | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 94.2   | Command Palette UI (Ctrl/Cmd+K)                                             | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 94.3   | Search and Index Across Agents/Houses/Actions                               | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 94.4   | Action Execution Wiring and Registry                                        | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 94.5   | Keyboard Accessibility and ARIA                                             | ○&nbsp;pending     | -        | 94.1, 94.2                                                    | N/A        |
| 94.6   | Tests for Filtering and Execution                                           | ○&nbsp;pending     | -        | 94.1, 94.2, 94.3, 94.4, 94.5                                  | N/A        |
| 95     | Data Accuracy and Sync Validation                                           | ○&nbsp;pending     | medium   | None                                                          | N/A        |
| 95.1   | Set up BullMQ repeatable cron for periodic org resync                       | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 95.2   | Implement reconciliation logic for repo archive/delete handling             | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 95.3   | Detect webhook gaps and enqueue catch-up resyncs                            | ✓&nbsp;done        | -        | 95.1                                                          | N/A        |
| 95.4   | Discrepancy logging and auto-repair                                         | ✓&nbsp;done        | -        | 95.2                                                          | N/A        |
| 95.5   | Compute and persist accuracy metrics                                        | ✓&nbsp;done        | -        | 95.4                                                          | N/A        |
| 95.6   | Configure retry and backoff policies                                        | ✓&nbsp;done        | -        | 95.1                                                          | N/A        |
| 95.7   | Admin report/dashboard for sync health                                      | ✓&nbsp;done        | -        | 95.5, 95.4                                                    | N/A        |
| 95.8   | Test suite with simulated gaps and reconciliation                           | ✓&nbsp;done        | -        | 95.1, 95.2, 95.3, 95.4, 95.5, 95.6                            | N/A        |
| 95.9   | Alert thresholds and notifications                                          | ✓&nbsp;done        | -        | 95.5, 95.6, 95.7                                              | N/A        |
| 96     | Analytics and KPI Events                                                    | ►&nbsp;in-progress | medium   | None                                                          | N/A        |
| 96.1   | Define Analytics Event Schema and Privacy Filters                           | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 96.2   | Implement Client Analytics Emitter and Instrumentation                      | ○&nbsp;pending     | -        | 96.1, 96.3                                                    | N/A        |
| 96.3   | Add Opt-Out and Consent Controls                                            | ○&nbsp;pending     | -        | 96.1                                                          | N/A        |
| 96.4   | Build Backend Collector API                                                 | ○&nbsp;pending     | -        | 96.1, 96.3                                                    | N/A        |
| 96.5   | Implement Aggregation to Redis/Time-Series Store                            | ○&nbsp;pending     | -        | 96.4                                                          | N/A        |
| 96.6   | Expose Internal KPI Endpoints                                               | ○&nbsp;pending     | -        | 96.5                                                          | N/A        |
| 96.7   | Prototype Internal Analytics Dashboard                                      | ○&nbsp;pending     | -        | 96.6                                                          | N/A        |
| 96.8   | Validate Pipeline with Sample Events and Tests                              | ○&nbsp;pending     | -        | 96.2, 96.4, 96.5, 96.6, 96.7, 96.3, 96.1                      | N/A        |
| 97     | Internationalization Readiness                                              | ✓&nbsp;done        | medium   | 57                                                            | N/A        |
| 97.1   | i18n library setup                                                          | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 97.2   | Extract core strings to catalogs                                            | ✓&nbsp;done        | -        | 97.1                                                          | N/A        |
| 97.3   | Locale switcher                                                             | ✓&nbsp;done        | -        | 97.1                                                          | N/A        |
| 97.4   | Date/time formatting utilities                                              | ✓&nbsp;done        | -        | 97.1                                                          | N/A        |
| 97.5   | Fallback strategy                                                           | ✓&nbsp;done        | -        | 97.1, 97.2                                                    | N/A        |
| 97.6   | Coverage audit and tests                                                    | ✓&nbsp;done        | -        | 97.2, 97.3, 97.4, 97.5                                        | N/A        |
| 98     | Backup and Disaster Recovery Procedures                                     | ►&nbsp;in-progress | medium   | 43, 44                                                        | N/A        |
| 98.1   | Define RTO/RPO and backup strategy                                          | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 98.2   | Provision encrypted backup storage and access                               | ✓&nbsp;done        | -        | 98.1                                                          | N/A        |
| 98.3   | Implement automated Postgres backups with retention                         | ✓&nbsp;done        | -        | 98.1, 98.2                                                    | N/A        |
| 98.4   | Configure Redis persistence (RDB/AOF) policy                                | ✓&nbsp;done        | -        | 98.1, 98.2                                                    | N/A        |
| 98.5   | Set up monitoring and alerts for backup health                              | ✓&nbsp;done        | -        | 98.3, 98.4                                                    | N/A        |
| 98.6   | Author restore runbook (Postgres and Redis)                                 | ✓&nbsp;done        | -        | 98.3, 98.4                                                    | N/A        |
| 98.7   | Conduct staging restore drill and measure RTO/RPO                           | ✓&nbsp;done        | -        | 98.6                                                          | N/A        |
| 98.8   | Finalize DR documentation and sign-off                                      | ✓&nbsp;done        | -        | 98.5, 98.7                                                    | N/A        |
| 99     | Privacy and Compliance Checklist                                            | ○&nbsp;pending     | medium   | 42                                                            | N/A        |
| 99.1   | Data inventory and classification                                           | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 99.2   | Token minimization and encryption                                           | ✓&nbsp;done        | -        | 99.1                                                          | N/A        |
| 99.3   | Log retention and PII scrubbing                                             | ✓&nbsp;done        | -        | 99.1                                                          | N/A        |
| 99.4   | Account deletion endpoint and verification                                  | ✓&nbsp;done        | -        | 99.1, 99.3                                                    | N/A        |
| 99.5   | DNT and analytics opt-out                                                   | ✓&nbsp;done        | -        | 99.1                                                          | N/A        |
| 99.6   | Privacy notice and policy updates                                           | ✓&nbsp;done        | -        | 99.2, 99.3, 99.4, 99.5                                        | N/A        |
| 99.7   | Access reviews and least privilege                                          | ✓&nbsp;done        | -        | 99.1                                                          | N/A        |
| 99.8   | Audit logging policy and configuration                                      | ✓&nbsp;done        | -        | 99.3, 99.7                                                    | N/A        |
| 99.9   | Incident response for data issues                                           | ✓&nbsp;done        | -        | 99.1, 99.8                                                    | N/A        |
| 99.10  | Compliance checklist and sign-off                                           | ✓&nbsp;done        | -        | 99.1, 99.2, 99.3, 99.4, 99.5, 99.6, 99.7, 99.8, 99.9          | N/A        |
| 99.11  | Data Inventory and Data Flow Mapping                                        | ✓&nbsp;done        | -        | None                                                          | N/A        |
| 99.12  | Token Minimization and Hash/Encrypt Strategy                                | ✓&nbsp;done        | -        | 99.11                                                         | N/A        |
| 99.13  | Account Deletion Endpoint and Verification Workflow                         | ✓&nbsp;done        | -        | 99.11                                                         | N/A        |
| 99.14  | Log Retention Policy and PII Scrubbing                                      | ✓&nbsp;done        | -        | 99.11                                                         | N/A        |
| 99.15  | DNT/GPC and Analytics Opt-Out Enforcement                                   | ✓&nbsp;done        | -        | 99.11                                                         | N/A        |
| 99.16  | Privacy Notice and Policy Updates                                           | ✓&nbsp;done        | -        | 99.12, 99.13, 99.14, 99.15                                    | N/A        |
| 99.17  | Access Reviews and Least-Privilege Enforcement                              | ✓&nbsp;done        | -        | 99.11, 99.14                                                  | N/A        |
| 99.18  | Audit Logging Policy and Secure Audit Trail                                 | ✓&nbsp;done        | -        | 99.11, 99.14                                                  | N/A        |
| 99.19  | Incident Response for Data Issues                                           | ✓&nbsp;done        | -        | 99.14, 99.18                                                  | N/A        |
| 99.20  | Compliance Checklist Validation and Sign-off                                | ✓&nbsp;done        | -        | 99.11, 99.12, 99.13, 99.14, 99.15, 99.16, 99.17, 99.18, 99.19 | N/A        |
| 100    | Launch Runbook and Communications                                           | ○&nbsp;pending     | medium   | 79, 84, 86                                                    | N/A        |
| 100.1  | Launch Checklist and Feature Flags                                          | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 100.2  | Rollback Strategy and Data Migration Plan                                   | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 100.3  | Demo Script and Assets                                                      | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 100.4  | Observability Pre-flight Checks                                             | ○&nbsp;pending     | -        | 100.1                                                         | N/A        |
| 100.5  | Incident Response and Escalation Plan                                       | ○&nbsp;pending     | -        | 100.1, 100.2, 100.4                                           | N/A        |
| 100.6  | Communications Plan (Landing Page, Video, Announcements)                    | ○&nbsp;pending     | -        | 100.3, 100.5                                                  | N/A        |
| 100.7  | Launch Checklist and Feature Flags                                          | ○&nbsp;pending     | -        | 100.8, 100.9, 100.10, 100.11, 100.12                          | N/A        |
| 100.8  | Rollback and Migration Plan                                                 | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 100.9  | Demo Script and Assets                                                      | ○&nbsp;pending     | -        | None                                                          | N/A        |
| 100.10 | Observability Pre-flight Checks                                             | ○&nbsp;pending     | -        | 100.8                                                         | N/A        |
| 100.11 | Incident Response and Escalation Plan                                       | ○&nbsp;pending     | -        | 100.10                                                        | N/A        |
| 100.12 | Communications Plan (Landing Page, Video, Announcements)                    | ○&nbsp;pending     | -        | 100.9                                                         | N/A        |

> 📋 **End of Taskmaster Export** - Tasks are synced from your project using the `sync-readme` command.

<!-- TASKMASTER_EXPORT_END -->
