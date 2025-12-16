# Kickoff — PRD Eval Task #9 (Gemini)

## Mission

Complete **Task #9: Refactor Phaser scene structure and camera system** under the canonical PRD-eval tag, with high fidelity to the task spec.

This repo already contains `BootScene`, `PreloadScene`, `VillageScene`, `HouseScene`, and a `CameraController`. Your job is to **verify vs the Task #9 requirements**, close any gaps, and then **mark Task #9 done with evidence** (file paths + tests run).

## Repo + canonical Task Master tag

- Repo root: `/Users/jamesbrady/Projects/utlyze/ai-agent-village/canonical/ai-agent-village-monitor`
- Canonical tag: `prd-gpt52-eval-20251216`
- Base branch for PRs: `tm-prd-gpt52-eval-20251216`

## Hard rules

- Do **NOT** run `task-master init`
- Do **NOT** hand-edit `.taskmaster/**.json` (use Task Master CLI only)
- Stay in scope: `packages/frontend/src/game/**` (avoid server/shared unless explicitly required)
- If you make changes: create a branch, commit, push, and open a PR

## Preflight (run exactly)

```bash
cd /Users/jamesbrady/Projects/utlyze/ai-agent-village/canonical/ai-agent-village-monitor
task-master tags use prd-gpt52-eval-20251216
task-master show 9
task-master validate-dependencies
```

## Task #9 acceptance criteria (must verify)

- Scenes exist and are wired: `BootScene`, `PreloadScene`, `VillageScene`, `HouseScene`
- Camera supports:
  - zoom range **0.5x–2x**
  - smoothing/lerp **0.1** (or equivalent)
  - pan via drag and/or edge-scroll
  - bounds checking
  - follow mode for a target
- Uses Phaser built-in camera smoothing APIs where appropriate
- Tests:
  - Vitest unit tests cover camera math + behavior
  - Scene transition coverage exists (Vitest ok; if Playwright exists in repo, add/extend E2E)

## Work plan

1. **Audit existing implementation** (likely already present):
   - `packages/frontend/src/game/scenes/*.ts`
   - `packages/frontend/src/game/systems/CameraController.ts`
   - `packages/frontend/src/game/__tests__/CameraController.test.ts`
   - `packages/frontend/src/game/__tests__/SceneTransition.test.ts`
2. If everything matches: **no refactor required** → update Task Master with an evidence note and mark Task #9 done.
3. If gaps exist: implement the smallest changes needed + update/add tests.

## Branch + PR

- Branch name: `prd-eval/task-9-phaser-scenes-camera`
- PR title: `feat(frontend): Task 9 phaser scenes + camera system`
- Target base: `tm-prd-gpt52-eval-20251216`

## Required verification commands

```bash
pnpm -C packages/frontend test
pnpm -C packages/frontend typecheck
```

## Task Master logging (required)

```bash
task-master set-status 9 in-progress
task-master update-task --append 9 "Progress: <what you found, what you changed, file paths>"
# when complete:
task-master set-status 9 done
task-master update-task --append 9 "Done: Requirements met. Evidence: <files> | Tests: pnpm -C packages/frontend test + typecheck"
```
