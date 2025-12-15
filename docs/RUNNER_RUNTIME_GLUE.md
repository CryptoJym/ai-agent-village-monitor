# Runner Runtime Glue (Server-backed Sessions)

This repo now includes a minimal “vertical slice” that lets the existing `packages/server` start **runner sessions** and stream events into the existing Socket.IO channels used by the UI.

## What’s implemented

- **Server API** for runner sessions:
  - `POST /api/runner/sessions` – start a runner session
  - `GET /api/runner/sessions/:id` – read current runtime state
  - `POST /api/runner/sessions/:id/input` – send terminal input
  - `POST /api/runner/sessions/:id/stop` – stop the session
  - `POST /api/runner/sessions/:id/approvals/:approvalId` – resolve approvals
- **Event bridging** from `@ai-agent-village-monitor/runner` → existing UI events:
  - Emits to `village:<villageId>` so the frontend (which joins the village room) can render activity immediately.
  - Also emits to `agent:<agentId>` for future per-agent views.

Key implementation files:

- `packages/server/src/execution/router.ts`
- `packages/server/src/execution/runnerSessionService.ts`

## Event mapping (runner → UI)

`RunnerEvent` is mapped into `work_stream_event` types already understood by the frontend:

- `SESSION_STARTED` → `work_stream_event.type = "session_start"`
- `TERMINAL_CHUNK` → `work_stream_event.type = "output"`
- `FILE_TOUCHED` → `file_read` / `file_edit` / `file_delete`
- `DIFF_SUMMARY` → `file_edit` (summary payload)
- `SESSION_ENDED` → `session_end` (and `agent_disconnect`)

## Local smoke test (no GitHub OAuth required)

1. Install deps:

`pnpm install`

2. Start server with the test login helper:

`E2E_TEST_MODE=true JWT_SECRET=testsecret pnpm -C packages/server dev`

3. Login and save cookies:

`curl -c cookies.txt -s http://localhost:3000/test/login/1?username=demo > /dev/null`

4. Start a runner session (local repo example):

```bash
curl -b cookies.txt -H "Content-Type: application/json" \
  -d '{
    "villageId": "demo",
    "providerId": "codex",
    "repoRef": { "provider": "local", "path": "/absolute/path/to/a/git/repo" },
    "checkout": { "type": "branch", "ref": "main" },
    "task": { "title": "Smoke", "goal": "Run a quick sanity command and describe the repo." },
    "env": { "OPENAI_API_KEY": "..." }
  }' \
  http://localhost:3000/api/runner/sessions
```

Notes:

- Provider CLIs must be installed on the machine running the server (`codex` for `providerId="codex"`, `claude` for `providerId="claude_code"`).
- Runner workspaces default to `/tmp/ai-village-workspaces` with cache at `/tmp/ai-village-cache`.
  - Override via `RUNNER_WORKSPACE_DIR` / `RUNNER_CACHE_DIR`.
