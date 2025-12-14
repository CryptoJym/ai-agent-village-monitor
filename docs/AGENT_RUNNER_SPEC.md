# Agent Runner Spec

Execution Plane for AI Agent Village Monitor (multi-provider, revenue-aware)

## 0) Summary

The Agent Runner is the **execution plane** that runs AI coding sessions next to codebases and streams:

- live terminal output
- structured events (file edits, status, approvals, tool requests)

back to the Control Plane + Village UI.

It must support:

- Codex CLI, Claude Code, Gemini CLI (via provider adapters)
- bidirectional leadership (human ↔ agent; agent ↔ agent via orchestration tools)
- continuous repo review patrol jobs (scheduled + webhook-triggered)
- rapid CLI updates with safe rollout (via Update Pipeline spec)
- revenue enablement (metering, concurrency limits, hosted runner billing)

**Core idea:** The Village UI never talks to providers directly. It talks to the Control Plane, which talks to Runners.

---

## 1) Goals

### Functional goals

1. Spawn a session bound to:
   - org/user identity
   - repo (and branch/worktree)
   - "room" (subpath/module focus)
   - task spec + policy
2. Stream a **live PTY terminal** to the UI (click sprite → terminal).
3. Emit **structured events** so the UI can:
   - move sprites into rooms
   - show "needs approval" states
   - render health bars / smoke / bug bots
4. Support multiple simultaneous sessions with isolation:
   - workspace isolation per session
   - secrets isolation per org
5. Support **two deployment modes**:
   - Hosted Runner (you run it)
   - Customer-Hosted Runner (enterprise; data stays inside their infra)

### Product + revenue goals

6. Usage metering primitives:
   - agent-minutes/agent-hours
   - session concurrency
   - repo patrol minutes
   - provider invocation counts
7. Plan enforcement hooks:
   - free tier caps
   - paid tier concurrency
   - enterprise allowlists, SSO, audit logs

---

## 2) Non-goals (for MVP)

- Perfect parsing of every CLI's output into a rich AST event stream.
- Fully autonomous "auto-merge to main" by default.
- On-chain settlement / marketplace / NFT mechanics (future phases; design for it but don't block MVP).

---

## 3) Architecture Overview

### Components

- **Village UI** (frontend): renders world, sprites, and a Terminal Panel.
- **Control Plane** (server): auth, org/repo registry, policies, orchestration, audit, billing.
- **Agent Runner** (this spec): spawns and manages sessions, streams PTY + events, executes repo patrols.
- **Provider Adapters**: unify Codex/Claude/Gemini under one contract.

### High-level flow

1. User clicks "Spawn Agent" in a room.
2. Control Plane validates permissions + plan limits.
3. Control Plane selects a Runner (hosted pool or customer runner).
4. Runner:
   - prepares workspace
   - launches provider session (via adapter)
   - streams terminal + events
5. UI shows a sprite in the room; clicking it opens the terminal.

---

## 4) Runner Responsibilities

### 4.1 Workspace Management

Each session runs in a **workspace**:

- `workspace_id`
- `repo_ref` (provider: GitHub; owner/name; default branch)
- `checkout` (commit sha or branch)
- `worktree_path`
- `room_path` (subdirectory focus for navigation + sprite placement)

**Rules**

- Session workspace is isolated:
  - unique directory per session OR git worktree per branch
- Must support:
  - clean teardown on session end
  - reusable cached clone (per repo) to accelerate startups
- Must support:
  - read-only mode for audits
  - write mode for PR creation

### 4.2 Session Lifecycle

Runner must implement session states:

- `CREATED`
- `PREPARING_WORKSPACE`
- `STARTING_PROVIDER`
- `RUNNING`
- `WAITING_FOR_APPROVAL`
- `PAUSED_BY_HUMAN`
- `STOPPING`
- `COMPLETED`
- `FAILED`

### 4.3 Terminal Streaming

- Use PTY-based spawning (Node PTY or OS-level PTY).
- Stream:
  - stdout/stderr chunks
  - exit codes
  - timing
- Bidirectional input:
  - UI sends keystrokes/commands
  - Runner forwards to PTY stdin

### 4.4 Structured Event Emission

Runner emits structured events independent of provider:

- file touched
- diff summary
- tests started/finished
- approval requested
- errors/warnings
- repo patrol alerts

(See section 6: Event Schema)

### 4.5 Policy Enforcement (local safety layer)

Runner must enforce **hard blocks** even if an agent attempts forbidden actions:

- forbidden shell commands (configurable)
- forbidden filesystem paths
- secret redaction
- network egress policies (enterprise)
- "no auto-merge" unless explicitly enabled

Control Plane policy decides what's allowed. Runner enforces it.

### 4.6 Repo Patrol Jobs

Runner executes scheduled or webhook-triggered patrols:

- `lint/test/build`
- dependency checks
- security checks (where configured)
- "generate PR suggestions" (draft PRs)

Patrol results become:

- world state updates (building health)
- bug sprites (alerts)
- quests (actionable tasks with approvals)

---

## 5) Deployment Modes

### 5.1 Hosted Runner (Default SaaS)

- You run the runner pool.
- Revenue: usage-based compute + concurrency tiering.
- Security: per-tenant workspace isolation + strict secret boundaries.

### 5.2 Customer-Hosted Runner (Enterprise)

- Customer runs runner in their infra:
  - Kubernetes
  - VM
  - on-prem
- Data never leaves their environment:
  - private repos and secrets remain local
- Control Plane can be:
  - your SaaS (hybrid)
  - or fully self-hosted (future enterprise tier)

**Important:** Customer-hosted runner is also the foundation of Phase 3 enterprise data products.

---

## 6) Runner ↔ Control Plane API

### 6.1 Authentication

- Control Plane issues a short-lived **Runner Session Token**:
  - scoped to org_id
  - scoped to repo_id (optional)
  - scoped to session_id

Runner uses mTLS or HTTPS + token.

### 6.2 Transport

- Preferred: WebSocket for streaming multiplexed sessions
- Alternative: gRPC streaming
- Minimum: HTTP for control + WS for stream

### 6.3 Control Plane → Runner commands

#### `POST /runner/v1/sessions`

Creates a session.

Body:

```json
{
  "org_id": "org_123",
  "repo": { "provider": "github", "owner": "X", "name": "Y" },
  "checkout": { "type": "branch", "ref": "main" },
  "room_path": "packages/server",
  "provider": "codex|claude|gemini",
  "task": {
    "title": "Fix failing tests in auth module",
    "goal": "Make tests pass without changing API",
    "constraints": ["no new deps", "keep behavior stable"],
    "acceptance": ["tests pass", "lint clean", "PR created"]
  },
  "policy": {
    "shell_allowlist": ["git", "npm", "pnpm", "node", "pytest"],
    "shell_denylist": ["rm -rf /", "curl http://", "scp", "ssh"],
    "network": { "mode": "restricted|open" },
    "requires_approval_for": ["merge", "secrets", "deploy", "deps_add"]
  },
  "billing": {
    "plan": "free|team|enterprise",
    "limits": { "max_concurrency": 2 }
  }
}
```

#### `POST /runner/v1/sessions/{session_id}/input`

```json
{ "data": "text or keystrokes", "mode": "raw|line" }
```

#### `POST /runner/v1/sessions/{session_id}/stop`

Graceful termination.

#### `POST /runner/v1/sessions/{session_id}/pause`

Pauses provider tool actions until resumed.

#### `POST /runner/v1/sessions/{session_id}/resume`

#### `POST /runner/v1/sessions/{session_id}/approve`

```json
{ "approval_id": "appr_789", "decision": "allow|deny", "note": "ok to proceed" }
```

### 6.4 Runner → Control Plane streaming events

```
WS /runner/v1/stream?token=...
```

Multiplex events:

```json
{ "type": "TERMINAL_CHUNK", "session_id": "...", "data": "...", "ts": 123 }
```

---

## 7) Event Schema (Runner → Control Plane)

All events must include:

- `type`
- `session_id` (optional for repo-level alerts)
- `org_id`
- `repo_id` or `repo_ref`
- `ts` (epoch ms)
- `seq` (monotonic per session)

### Required event types

- `SESSION_STARTED`
- `SESSION_STATE_CHANGED`
- `TERMINAL_CHUNK`
- `FILE_TOUCHED`
- `DIFF_SUMMARY`
- `TEST_RUN_STARTED`
- `TEST_RUN_FINISHED`
- `APPROVAL_REQUESTED`
- `APPROVAL_RESOLVED`
- `ALERT_RAISED`
- `USAGE_TICK`

### Examples

#### FILE_TOUCHED

```json
{
  "type": "FILE_TOUCHED",
  "session_id": "sess_123",
  "repo_ref": { "provider": "github", "owner": "X", "name": "Y" },
  "path": "packages/server/src/auth/token.ts",
  "room_path": "packages/server/src/auth",
  "reason": "write|read|diff",
  "ts": 1730000000000,
  "seq": 54
}
```

#### APPROVAL_REQUESTED

```json
{
  "type": "APPROVAL_REQUESTED",
  "session_id": "sess_123",
  "approval_id": "appr_789",
  "category": "merge|deps_add|secrets|deploy",
  "summary": "Request to open PR and merge to main",
  "risk": "high",
  "context": { "branch": "ai/fix-auth-tests", "changed_files": 7 },
  "ts": 1730000000000,
  "seq": 88
}
```

#### USAGE_TICK (revenue-critical)

```json
{
  "type": "USAGE_TICK",
  "session_id": "sess_123",
  "org_id": "org_123",
  "provider": "codex",
  "units": {
    "agent_seconds": 30,
    "terminal_kb": 12,
    "files_touched": 3
  },
  "ts": 1730000000000,
  "seq": 101
}
```

---

## 8) Security Model

### Baseline

- Runner runs as non-root.
- Workspaces are isolated directories.
- Secrets are injected per session (never written to logs).
- Redact tokens from terminal stream (regex + structured provider hints where available).

### Enterprise hardening

- Containerize each session (rootless containers).
- Restrict network egress by default.
- Mandatory approvals for:
  - merges
  - dependency additions
  - secret access
  - deployment commands

---

## 9) Observability & Audit (also revenue)

Runner must emit:

- session lifecycle events
- command execution logs (sanitized)
- diffs and test outcomes
- approval history
- usage ticks

Control Plane stores audit logs per org for enterprise tier.

---

## 10) Acceptance Criteria

MVP "click sprite → terminal" complete when:

1. Spawn session succeeds for at least one provider adapter.
2. Terminal stream is visible in UI within 2 seconds of start.
3. User input reaches the running process.
4. Runner can compute `git diff --name-only` and emit FILE_TOUCHED/DIFF_SUMMARY.
5. USAGE_TICK events occur at least every 30 seconds.
6. Approval workflow blocks a "merge" action until approved.

---

## 11) Implementation Tickets (handoff to agents)

### Runner core

- [ ] Create packages/runner service scaffolding (config, logging, healthcheck)
- [ ] Implement workspace manager (cached clone + per-session worktree)
- [ ] Implement PTY process manager (spawn/stream/input/stop)
- [ ] Implement WS stream multiplexing
- [ ] Implement policy enforcement layer (denylist, path guards)
- [ ] Implement event emitter + seq ids
- [ ] Implement USAGE_TICK scheduler

### Integrations

- [ ] Add Control Plane endpoints for runner registration and session routing
- [ ] Add auth tokens / mTLS option
- [ ] Add UI Terminal Panel (xterm.js) and sprite click binding

### Patrols

- [ ] Implement patrol job runner with BullMQ hooks
- [ ] Emit ALERT_RAISED and building health updates

---

## 12) Open Questions (do not block MVP)

- Sandbox strategy: rootless container per session vs per runner
- Multi-runner scheduling: round-robin vs load-aware
- Storing diffs: DB vs object store
- Enterprise offline mode (no SaaS dependency)

---

_Document Version: 1.0_
_Last Updated: December 2025_
