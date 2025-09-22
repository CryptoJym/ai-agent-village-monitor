# Repository Guidelines

## Project Overview

AI-powered task management and monitoring in a pnpm monorepo. Tasks are orchestrated with Task Master using `.taskmaster/` artifacts and PRD sources in `docs/`.

## Quick Start

- Install: `pnpm install`
- Dev (all workspaces): `pnpm -w dev`
- View tasks: `task-master list`
- Optional: initialize Task Master first run: `task-master init`

## Project Structure & Modules

- `packages/frontend` (Vite + React + Phaser): app UI. Source in `src/`, tests in `test/`.
- `packages/server` (Express + TypeScript + Prisma): API + websockets. Source in `src/`; DB in `prisma/` (schema, migrations, seed); tests in `src/__tests__/`.
- `packages/shared`: shared types/utilities. `docs/`: PRD and docs. `.taskmaster/`: Task Master state.

## Build, Test, and Dev Commands

- Build all: `pnpm -w build`
- Lint/format: `pnpm -w lint`, `pnpm -w format`
- Tests (Vitest): `pnpm -r test`
- Server DB: `cd packages/server && pnpm prisma:generate && pnpm db:migrate && pnpm start`
- Frontend preview: `pnpm --filter @ai-agent-village-monitor/frontend preview`

## Coding Standards

- TypeScript everywhere. ESLint + Prettier (single quotes, semicolons, trailing commas, width 100).
- Names: components `PascalCase`; variables/functions `camelCase`; env vars `UPPER_SNAKE_CASE`.
- Keep modules small; colocate tests with code or under package `test/`.

## Testing Guidelines

- Framework: Vitest. Frontend uses jsdom (`packages/frontend/test/setup.ts`); server uses Node.
- Naming: `*.test.ts` / `*.test.tsx`. Run: `pnpm -r test`.

## Task Execution Protocol (Task Master)

1. Get next task: `task-master next`
2. Review file in `.taskmaster/tasks/task-<id>.md`
3. Set status: `task-master set-status --id=<id> --status=in-progress`
4. Implement + tests; update docs if APIs change
5. Verify: `pnpm -w lint` • `pnpm -r test` • `pnpm -w build`
6. Complete: `task-master set-status --id=<id> --status=done`

## Commits & PRs

- Conventional Commits (e.g., `feat(server): add villages API (task 43.2)`).
- PRs include description, scope, test plan, and UI screenshots when relevant.
- Ensure lint, tests, and build pass before requesting review.

## Git Workflow

- Branch from `main`: `git checkout -b task-<id>`
- Commit frequently with Task Master IDs (e.g., `task 43.2`)
- PR title: `[Task #<id>] <description>`; prefer squash merge after review

## Security & Config

- Never commit secrets. Use root `.env`. Server requires `DATABASE_URL`. For local Postgres, run migrations and enable `citext` before `db:migrate`.

## Automation & Permissions

- Auto-approved: file read/list, running tests, code generation, Task Master status updates
- Requires confirmation: package installs, file deletion, DB migrations, production deployments

## Example Task Flow

```bash
# 1) Review and claim
task-master show 43.2
task-master set-status --id=43.2 --status=in-progress

# 2) Work and log notes
pnpm -w dev
task-master update-subtask --id=43.2 --prompt="Added Prisma models; chose BigInt for GitHub IDs"

# 3) Verify
pnpm -w lint && pnpm -r test && pnpm -w build

# 4) Complete and reference task
task-master set-status --id=43.2 --status=done
# commit suggestion: feat(server): model PRD tables (task 43.2)

# 5) Next
task-master next

# If blocked
task-master set-status --id=43.3 --status=blocked
task-master add-dependency --id=43.3 --depends-on=43.2
```

## Codex Orchestrator Workflow

- **Use the NVM-installed CLI**: run Task Master via `~/.nvm/versions/node/v22.15.0/bin/task-master …` (or update your `PATH`/aliases) so the Codex provider with `TaskOrchestrator` is available. The Homebrew binary falls back to OpenAI and will not spawn subagents.
- **Configuration**: `.taskmaster/config.json` already sets the main model to `codex/gpt-5` and enables `orchestratorConfig` with `autoStart=true`, `enableSubagentSpawning=true`, `maxConcurrentExecutors=3`, and GitHub/cloud integration.
- **Automatic orchestration**: any command that routes through the main provider (`parse-prd`, `expand`, `update-task`, etc.) now triggers the Codex orchestrator. You’ll see a “Task Orchestration Complete” summary if subagents run.
- **Manual trigger (optional)**: leave `autoStart` as-is for automatic runs; otherwise include `codex-orchestrate` or a `taskmaster_orchestration` JSON payload in the prompt to launch orchestration on demand.
- **Debugging**: set `CODEX_DEBUG_LOG=true` when needed to log raw Codex responses, then unset it for normal runs.
- **CLI auth**: ensure the `codex` CLI is authenticated before kicking off long orchestrated sessions (the provider shells out to it directly).
