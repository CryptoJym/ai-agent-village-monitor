# Gemini Kickoff — PRD Eval Task #9 (Phaser scenes + camera)

Repo root:

- /Users/jamesbrady/Projects/utlyze/ai-agent-village/canonical/ai-agent-village-monitor

Objective:

- Validate (and only if needed, finish) Task Master tag `prd-gpt52-eval-20251216` Task `#9`:
  “Refactor Phaser scene structure and camera system”.

Important context:

- An audit indicates Task `#9` already exists in baseline code. Your job is to confirm by locating the files and running the targeted tests. Only open a PR if you find a real gap vs the checklist.

Hard rules:

- Do NOT run `task-master init`.
- Do NOT hand-edit `.taskmaster/*.json` (use Task Master CLI only).
- Keep changes limited to `packages/frontend/src/game/**` (and optionally docs under `docs/` if you add notes).

Preflight (run in repo root):

1. `task-master tags use prd-gpt52-eval-20251216`
2. `task-master show 9`

What to verify (files should exist):

- Scenes:
  - `packages/frontend/src/game/scenes/BootScene.ts`
  - `packages/frontend/src/game/scenes/PreloadScene.ts`
  - `packages/frontend/src/game/scenes/VillageScene.ts`
  - `packages/frontend/src/game/scenes/HouseScene.ts`
- Wiring:
  - `packages/frontend/src/game/config.example.ts` (scene list includes the four scenes)
- Camera system:
  - `packages/frontend/src/game/systems/CameraController.ts`
  - `packages/frontend/src/game/systems/InputHandler.ts`
- Tests:
  - `packages/frontend/src/game/__tests__/CameraController.test.ts`
  - `packages/frontend/src/game/__tests__/scenes.test.ts`
  - `packages/frontend/src/game/__tests__/SceneTransition.test.ts`

Targeted tests (run these; keep it small):

- `pnpm -C packages/frontend exec vitest run src/game/__tests__/CameraController.test.ts src/game/__tests__/scenes.test.ts src/game/__tests__/SceneTransition.test.ts`

Acceptance checklist:

- [ ] Scenes exist with keys: `BootScene`, `PreloadScene`, `VillageScene`, `HouseScene`
- [ ] Boot → Preload transition exists; Preload → Village transition exists; Village enters House
- [ ] Camera supports:
  - zoom clamp (0.5–2.0) with smooth transitions
  - drag-to-pan
  - edge scrolling
  - world-bounds constraint
  - follow mode (lerp ~0.1)
- [ ] Targeted tests pass

If everything is already correct:

- No PR required.
- If Task `#9` is not already `done`, append an audit note and mark done:
  - `task-master update-task --append 9 "Verified Task #9 is already implemented (scenes + CameraController) and tests pass (CameraController/scenes/SceneTransition)."`
  - `task-master set-status 9 done`

If you find gaps:

- Create branch: `prd-eval/task-9-phaser-camera-polish`
- Implement the minimum fix (keep changes local to `packages/frontend/src/game/**`)
- Re-run the targeted tests above
- Open PR targeting `main`
- Update Task Master:
  - `task-master update-task --append 9 "Opened PR #<n> for Task #9; includes <short summary>; tests: <command>"`
  - `task-master set-status 9 review`
