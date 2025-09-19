# Lint Cleanup Plan

The frontend now runs lint cleanly after the asset refresh/refactors. Remaining warnings live almost entirely in backend scripts and legacy test scaffolding. To eliminate the noise and prevent regressions, tackle the cleanup in small batches:

1. **Server scripts and utilities**
   - Remove unused `eslint-disable` directives in `packages/server/scripts/`.
   - Fix minor unused-variable findings (`ms`, `i`, etc.) or convert them to intentionally ignored names (`_ms`).

2. **Legacy Vitest suites**
   - Update skipped/placeholder tests to avoid unused captures (e.g., `b`, `vi`).
   - Convert lingering `.only`/`.skip` patterns into documented TODOs.

3. **Express routers and realtime modules**
   - Replace empty `catch`/`finally` bodies with logging or inline comments that justify intentional no-ops.
   - Normalize error-handling utilities so we can drop redundant disables (e.g., `no-console`).

4. **Tracking progress**
   - Enable `pnpm -w lint` in CI once the warnings reach zero. Until then, add a weekly check in Team Tasks.
   - Keep this document updated so contributors know which areas are already handled.

## Completed (first pass)

- Cleaned up Socket.IO load scripts (`scripts/load-test.js`, `scripts/ws-load.js`, `scripts/ws-load.mjs`) and monitoring helpers so they compile without unused ignores.
- Removed obsolete `no-console` disables in the CLI utilities.

Outcome: clean lint output across the monorepo, clearer CI logs, and less time spent ignoring legacy warnings.
