# Provider Adapters Spec

Codex CLI + Claude Code + Gemini CLI (+ optional Omnara runtime) under one contract

## 0) Summary

Provider adapters are the **pluggable drivers** that let the Runner start and control an "agent session" regardless of vendor.

Adapters must be:

- stable and versioned
- capability-declared (so orchestration can pick the right tool)
- safe (policy-aware)
- testable via a shared contract test suite

**Key outcome:** A sprite is always an `AgentSession`. The provider is an implementation detail.

---

## 1) Goals

1. Provide a single interface for:
   - starting sessions
   - sending user input
   - collecting terminal output
   - producing structured events (diffs, touched files, approvals)
2. Support:
   - Codex CLI
   - Claude Code
   - Gemini CLI
3. Enable **bidirectional leadership**:
   - human takeover
   - agent requesting approvals
   - agent delegating to other agents via orchestration tools
4. Support rapid CLI changes:
   - dynamic flag detection
   - "capabilities negotiation"
5. Enable revenue products:
   - adapters can be packaged and later monetized (marketplace)
   - usage metering includes provider attribution

---

## 2) Non-goals (MVP)

- Writing a perfect semantic parser for terminal text.
- Deep provider-specific tool APIs beyond "run, stream, input".
- Building an on-chain marketplace (later).

---

## 3) Adapter Interface (TypeScript)

Create in `packages/shared/src/adapters/types.ts` (or equivalent):

```typescript
export type ProviderId = "codex" | "claude_code" | "gemini_cli" | "omnara";

export type Capability = {
  ptyStreaming: boolean;
  structuredEdits: "none" | "diff" | "fileEvents";
  supportsMCP: boolean;
  supportsNonInteractive: boolean;
  supportsPlanAndExecute: boolean;
  supportsPRFlow: "none" | "draft" | "full";
  maxContextHint?: string;
};

export type TaskSpec = {
  title: string;
  goal: string;
  constraints: string[];
  acceptance: string[];
  roomPath?: string;
  branchName?: string;
};

export type PolicySpec = {
  shellAllowlist: string[];
  shellDenylist: string[];
  requiresApprovalFor: Array<"merge" | "deps_add" | "secrets" | "deploy">;
  networkMode: "restricted" | "open";
};

export type StartSessionArgs = {
  repoPath: string;
  task: TaskSpec;
  policy: PolicySpec;
  env: Record<string, string>;
};

export type ProviderEvent =
  | { type: "PROVIDER_STARTED"; version: string }
  | {
      type: "PROVIDER_MESSAGE";
      text: string;
      severity?: "info" | "warn" | "error";
    }
  | {
      type: "REQUEST_APPROVAL";
      category: string;
      summary: string;
      risk: "low" | "med" | "high";
      context?: any;
    }
  | { type: "HINT_FILES_TOUCHED"; paths: string[]; roomPath?: string }
  | { type: "HINT_DIFF_AVAILABLE"; summary?: string };

export interface ProviderAdapter {
  id: ProviderId;
  detect(): Promise<{ installed: boolean; version?: string; details?: string }>;
  capabilities(): Promise<Capability>;
  startSession(args: StartSessionArgs): Promise<{ sessionPid: number }>;
  sendInput(data: string): Promise<void>;
  stop(): Promise<void>;
  onEvent(cb: (evt: ProviderEvent) => void): void;
}
```

---

## 4) Implementation Pattern (CLI-first, structured events via instrumentation)

Most CLIs are "terminal-first". We make them stable by combining:

### 4.1 PTY session as the truth

- spawn provider process in a PTY
- stream output
- accept input

### 4.2 Structured events via repo instrumentation

Even if the provider doesn't emit structured file events, we can generate them:

- watch filesystem changes
- compute `git diff --name-only` on intervals / milestones
- map files to rooms for sprite movement

This gives you durable UX and avoids brittle terminal parsing.

### 4.3 Dynamic flag and mode detection

Adapters should determine flags at runtime:

- run `tool --help`
- detect supported flags/modes
- choose best mode available

**Why this matters:**

- CLIs update frequently
- flags and behaviors change
- static wrappers break (we want the opposite)

---

## 5) Bidirectional Leadership Model

This is implemented at orchestration level but adapters must support it.

### 5.1 Control Modes per session

- **Agent-led**: provider is driving, human intervenes via approvals or input
- **Human-led**: human types; provider offers suggestions (still running)
- **Delegated**: a "Foreman" session spawns other sessions (multi-provider)

### 5.2 Approval handshake (provider → human)

Adapters should emit `REQUEST_APPROVAL` events when:

- provider tries to merge
- provider wants to add dependencies
- provider needs secrets or deploy access

If provider cannot emit such events natively:

- Runner triggers approvals when detecting risky commands, git operations, or diff scope thresholds.

---

## 6) Orchestration Patterns (how we use multiple providers intelligently)

Empirically sound division of labor:

- **Codex**: fast implementation / mechanical edits / scaffolding
- **Claude Code**: deeper reasoning / review / refactor / tests
- **Gemini**: second opinion audits, alternative refactor suggestions, broad scans

Implement orchestration as:

- a "Foreman" workflow in the Control Plane:
  1. plan
  2. assign tasks to builders
  3. review by a different provider
  4. request approvals
  5. produce PR

Adapters only need to reliably "run sessions"; orchestration decides who does what.

---

## 7) Adapter-specific Notes

### 7.1 Codex CLI Adapter

- Start in `repoPath`
- Run with a consistent "agent task" prompt format
- Ensure it uses repo's `AGENTS.md` / guidance files where present
- Emit file touched + diff summary via instrumentation

### 7.2 Claude Code Adapter

- Similar to Codex adapter
- Strong candidate for "Reviewer" role
- May support MCP-based tool access; if so, declare `supportsMCP: true`

### 7.3 Gemini CLI Adapter

- Support interactive PTY mode first
- Provide a fallback strategy:
  - if Gemini changes behavior unexpectedly, degrade gracefully to "non-interactive run with logs + diffs"

### 7.4 Omnara Adapter (optional)

- Treat Omnara as just another runtime
- Do not depend on it for "universal" support (because you need Codex + Gemini too)

---

## 8) Revenue-aware Packaging

Adapters should be treated as installable units:

- `adapter_id`
- `adapter_version`
- `vendor`
- `capabilities`
- `signature` (future marketplace)

This enables:

- a paid "Adapter Pack"
- third-party adapters sold in a marketplace (Phase 2)
- enterprise allowlisting of signed adapters

---

## 9) Contract Test Suite (required)

Create `packages/runner/tests/adapter-contract/`.

Each adapter must pass:

1. `detect()` returns installed/version or clear error
2. `startSession` starts a process and streams output
3. `sendInput` works
4. `stop` terminates session
5. instrumentation emits:
   - at least one `FILE_TOUCHED` within 60s of a known edit task
6. policy enforcement triggers at least one approval gate in a "risky action" test

---

## 10) Acceptance Criteria

1. You can swap providers without changing UI code.
2. Sessions are stable across provider upgrades (or degrade gracefully).
3. Provider attribution is present in usage ticks for billing.
4. Foreman can run a multi-provider workflow (builder + reviewer) end-to-end.

---

## 11) Implementation Tickets (handoff)

- [ ] Implement adapter interface + shared types
- [ ] Implement Codex adapter (PTY spawn + help detection + env)
- [ ] Implement Claude Code adapter (PTY spawn + help detection + env)
- [ ] Implement Gemini adapter (PTY spawn + fallback mode)
- [ ] Add filesystem watcher + diff summarizer (shared utility)
- [ ] Implement contract tests and CI gate
- [ ] Emit provider version/capabilities into session metadata

---

_Document Version: 1.0_
_Last Updated: December 2025_
