# PRD Eval Task Audit (Tasks 1–15)

**Tag audited:** `prd-gpt52-eval-20251216`  
**Base branch:** `tm-prd-gpt52-eval-20251216`  
**Audit date:** 2025-12-16

## Summary

- **Done:** 11
- **Review:** 1
- **In-progress (partial / gaps):** 3
- **Pending:** 0

> Notes:
>
> - This audit reflects what is present in the repo **today** (plus explicit links to open PRs where completion work lives).
> - Some task specs reference older tool/library versions (e.g., “Jest”, Prisma v5.x); the repo implements the intent with the current stack (Vitest, Prisma v6.x), called out below when relevant.

## Status Matrix

| Task |     Status      | Evidence (files / PRs)                                                                                                                                            | Gaps / Notes                                                                                                                                                                   |
| ---: | :-------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|    1 |   **review**    | PR **#44** (preferred), PR **#43** (overlap); `packages/server/prisma/schema.prisma`; `packages/server/src/db/client.ts`; `packages/server/package.json` scripts  | Task completion work is in PR #44 (schema refinements, DB relation tests, full `docs/DB_SCHEMA.md` rewrite). Base already has Prisma wired; PR #44 is the “finalization” pass. |
|    2 |    **done**     | `packages/server/src/villages/router.ts`                                                                                                                          | Village CRUD exists (list/get/create/update/delete) plus access + worldmap endpoints.                                                                                          |
|    3 | **in-progress** | `packages/server/src/houses/router.ts`                                                                                                                            | CRUD exists, but **repo analysis trigger is TODO** (no background job wired to create Rooms from repo structure).                                                              |
|    4 |    **done**     | `packages/server/src/rooms/router.ts`; `packages/server/src/agents/router.ts`                                                                                     | CRUD exists for Rooms + Agents. Some legacy comments remain, but endpoints are implemented.                                                                                    |
|    5 |    **done**     | `packages/server/src/__tests__/**`; `packages/server/package.json` (`vitest`)                                                                                     | “Jest” in task text is outdated; backend suite is Vitest and is substantial.                                                                                                   |
|    6 |    **done**     | `packages/server/src/github/client.ts`; `packages/server/src/github/service.ts`; `packages/server/src/github/__tests__/github-integration.test.ts`                | GraphQL wrapper exists with caching/rate-limit handling + tests.                                                                                                               |
|    7 |    **done**     | `packages/server/src/github/tree-fetcher.ts`; `packages/server/src/github/module-classifier.ts`; `packages/server/src/github/dependency-analyzer.ts`              | Repo tree fetch + module classification pipeline exists.                                                                                                                       |
|    8 | **in-progress** | `packages/server/src/github/webhooks.ts` (wired); `packages/server/src/webhooks/github-enhanced.ts` + `packages/server/src/webhooks/processors/*` (not wired)     | Webhook endpoint exists, but **async queue-based pipeline + DLQ is not currently wired** to the live route.                                                                    |
|    9 |    **done**     | `packages/frontend/src/game/scenes/BootScene.ts`; `PreloadScene.ts`; `VillageScene.ts`; `HouseScene.ts`; `packages/frontend/src/game/systems/CameraController.ts` | Meets camera + scene structure requirements (zoom range, drag pan, edge scroll, bounds, follow).                                                                               |
|   10 | **in-progress** | `packages/frontend/src/game/systems/InputHandler.ts`; `packages/frontend/src/game/assets/AssetLoader.ts` + `manifest.json`                                        | Input handler exists (keyboard/mouse/touch) but **no gamepad**. Also `AssetLoader`/manifest exists but is not the primary preload path (scene uses `AssetManager`).            |
|   11 |    **done**     | `packages/shared/src/generation/rng.ts`; `packages/shared/src/generation/bsp.ts`; `packages/shared/src/generation/__tests__/*`                                    | RNG + BSP generator implemented; deterministic seeding is present (not SHA256 as task text states).                                                                            |
|   12 |    **done**     | `packages/shared/src/generation/rooms.ts`; `packages/shared/src/generation/corridors.ts`                                                                          | Delaunay triangulation + MST + corridors implemented (uses `delaunator`, equivalent to task intent).                                                                           |
|   13 |    **done**     | `packages/shared/src/tilemap/*`; `packages/shared/src/tilemap/phaserExport.ts`                                                                                    | Tilemap generation + auto-tiling + decorations + Phaser/Tiled export implemented.                                                                                              |
|   14 |    **done**     | `packages/frontend/src/game/tiles/TilemapRenderer.ts`; `packages/frontend/src/game/ui/RoomLabels.ts`                                                              | Rendering/layering + collision hooks + room labels scaling by zoom implemented.                                                                                                |
|   15 |    **done**     | `packages/shared/src/state/agentMachine.ts`; exports in `packages/shared/src/index.ts`                                                                            | XState v5 state machine exists with guards/actions + tests under `packages/shared/src/state/__tests__`.                                                                        |

## Test Evidence (audit run)

- Shared: `pnpm -C packages/shared test` → **10 files / 326 tests passed**
- Frontend (task-relevant subset):  
  `pnpm -C packages/frontend exec vitest run src/game/__tests__/CameraController.test.ts src/game/__tests__/InputHandler.test.ts src/game/__tests__/scenes.test.ts` → **3 files / 112 tests passed**

## Remaining Work (from audit)

1. **Task #3:** wire repo analysis trigger on house creation (or provide an explicit “analyze repo → create rooms” endpoint + job queue).
2. **Task #8:** wire the async webhook pipeline (`github-enhanced.ts` + processors) into the live webhook route and ensure DLQ/worker path is operational.
3. **Task #10:** add gamepad input support and consolidate asset loading (choose `AssetLoader`+manifest vs `AssetManager`, then integrate consistently).
