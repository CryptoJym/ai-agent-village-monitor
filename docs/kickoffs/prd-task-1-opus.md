# Opus Lead Orchestrator Kickoff — PRD Eval Tag `prd-gpt52-eval-20251216` — Task #1

## Mission

Complete **Task #1: “Migrate database to Prisma with comprehensive schema”** with production‑quality rigor (schema fidelity, migrations, tests, docs), using **Opus orchestration** + **Task Master due‑process**.

This is a **high‑complexity foundation task**: it gates Tasks #2–#8 and #11–#15.

## Repo + Task Master Context

- Repo root: `/Users/jamesbrady/Projects/utlyze/ai-agent-village/canonical/ai-agent-village-monitor`
- Task Master tag: `prd-gpt52-eval-20251216`
- Task: `#1`

## Hard Rules (do not violate)

- **Do NOT** run `task-master init`.
- **Do NOT** hand‑edit `.taskmaster/**/*.json` (use Task Master CLI only).
- Use **one branch + one PR** for this task.
- Keep scope tight: **DB/Prisma/server only** (no frontend/Phaser work).
- Every meaningful change: add/adjust tests where feasible.

## Preflight (run first, then report results)

1. `cd /Users/jamesbrady/Projects/utlyze/ai-agent-village/canonical/ai-agent-village-monitor`
2. `git fetch origin`
3. `git checkout tm-prd-gpt52-eval-20251216 && git pull`
4. Create a work branch from this PRD-eval base:
   - `git checkout -b prd-eval/task-1-prisma-foundation`
5. `task-master tags use prd-gpt52-eval-20251216`
6. `task-master validate-dependencies`
7. `task-master show 1`
8. Inspect current schema + DB docs:
   - `packages/server/prisma/schema.prisma`
   - `docs/DB_SCHEMA.md`

## Expected Reality (important)

This repo already has a Prisma schema with many of these models. Treat Task #1 as:

> **spec/PRD → schema audit → gap‑fix → migration hygiene → tests → docs**
> …not a blind rewrite.

## Orchestration Plan (use Opus multi-agent)

Create **3 subagents** (keep consolidated updates in this lead thread):

### Subagent A — Schema + Relations (Owner: “DB Schema”)

**Goal:** Ensure Prisma schema matches PRD needs and is internally consistent.

- Audit `schema.prisma` for required models/fields:
  - `Village` (id, seed, name, worldMapId, …)
  - `WorldMap` (id, villageId, mapData, …)
  - `House` (id, villageId, githubRepoId, position, footprint, …)
  - `Room` (id, houseId, moduleType, modulePath, position, size, connections, …)
  - `Agent` (id, houseId, name, spriteKey, personality, position, state, energy, …)
- Validate relation cardinality + referential actions.
- Add **indexes** on foreign keys + high‑query fields.
- Produce a concise “delta list” of what changed and why.

### Subagent B — Migrations + Testable DB Harness (Owner: “DB Reliability”)

**Goal:** Make the schema runnable and verifiable locally + in CI.

- Ensure migrations are sane:
  - If migrations already exist: add a new migration only if schema changed.
  - Prefer sqlite‑friendly workflows for CI.
- Add/extend **integration tests** that validate:
  - Prisma client generation
  - Relation integrity (create Village → WorldMap → House → Room → Agent)
  - Constraints/index expectations (where testable)
- Use existing test stack in `packages/server` (don’t introduce a new runner).

### Subagent C — Docs + Developer UX (Owner: “DB Docs/Workflow”)

**Goal:** Make Task #1 understandable and repeatable.

- Update `docs/DB_SCHEMA.md` (or add `docs/PRD_DB_FOUNDATION.md`) with:
  - Current schema overview
  - How to run migrations
  - How to run DB tests
  - Seed/dev data story (if any)

## Task Master Due‑Process (mandatory)

Run these exactly (no hand-edit):

1. `task-master set-status --id=1 --status=in-progress`
2. `task-master update-task --append 1 --prompt="Plan: <short plan + acceptance criteria + branch name>"`
3. During work: `task-master update-task --append 1 --prompt="Progress: <what changed + why>"`
4. After PR is opened: `task-master set-status --id=1 --status=review`
5. After merge: `task-master set-status --id=1 --status=done`

## Implementation Constraints / Targets

- Primary files likely touched:
  - `packages/server/prisma/schema.prisma`
  - `packages/server/prisma/migrations/**` (only if schema changed)
  - `packages/server/src/**` (only if required by schema change)
  - `packages/server/src/**/__tests__/**` or `packages/server/src/**/test/**` (where tests live)
  - `docs/DB_SCHEMA.md` (or new doc as noted)

## Verification Checklist (must run, then paste results)

- Prisma generate/migrate via existing scripts in `packages/server/package.json` (use repo scripts if present).
- Unit/integration tests for server package (use existing commands).
- `pnpm -r -w typecheck` (or repo equivalent) if it exists.

## Deliverables

- A PR that:
  - Improves/aligns Prisma schema for required domain entities
  - Adds migrations only when necessary
  - Adds DB integrity tests
  - Updates DB docs
- In the PR description include:
  - “What changed” + “Why”
  - Commands to verify
  - Follow-up tasks unblocked (list dependent task IDs)
