# Execution Plane Trace Matrix

## Overview

This document maps specification sections to implementation status across the execution plane. It traces requirements from the AGENT_RUNNER_SPEC and PROVIDER_ADAPTERS_SPEC to actual code implementations, tests, and runtime behavior.

**Last Updated:** 2025-12-15
**Scope:** Execution Plane (Agent Runner + Provider Adapters + Runtime Glue)

---

## AGENT_RUNNER_SPEC Trace

| Section                                  | Spec Location                                                                 | Implementation Files                                                                                  | Test Files                                                                                                   | Status         |
| ---------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------- |
| **1) Goals - Functional**                | [docs/AGENT_RUNNER_SPEC.md#L27-L45](../docs/AGENT_RUNNER_SPEC.md#L27-L45)     | packages/runner/src/Runner.ts<br/>packages/runner/src/session/SessionManager.ts                       | packages/runner/src/**tests**/SessionManager.test.ts<br/>packages/runner/src/**tests**/RunnerService.test.ts | ✅ Implemented |
| **1) Goals - Product/Revenue**           | [docs/AGENT_RUNNER_SPEC.md#L47-L57](../docs/AGENT_RUNNER_SPEC.md#L47-L57)     | packages/runner/src/session/SessionManager.ts#L499-L545 (USAGE_TICK)                                  | packages/runner/src/**tests**/SessionManager.test.ts                                                         | ⚠️ Partial     |
| **4.1) Workspace Management**            | [docs/AGENT_RUNNER_SPEC.md#L93-L113](../docs/AGENT_RUNNER_SPEC.md#L93-L113)   | packages/runner/src/workspace/WorkspaceManager.ts<br/>packages/runner/src/workspace/index.ts          | None                                                                                                         | ✅ Implemented |
| **4.2) Session Lifecycle**               | [docs/AGENT_RUNNER_SPEC.md#L114-L127](../docs/AGENT_RUNNER_SPEC.md#L114-L127) | packages/runner/src/session/sessionMachine.ts<br/>packages/runner/src/session/SessionManager.ts       | packages/runner/src/**tests**/SessionManager.test.ts                                                         | ✅ Implemented |
| **4.3) Terminal Streaming**              | [docs/AGENT_RUNNER_SPEC.md#L129-L138](../docs/AGENT_RUNNER_SPEC.md#L129-L138) | packages/runner/src/pty/PTYManager.ts<br/>packages/runner/src/pty/index.ts                            | None                                                                                                         | ✅ Implemented |
| **4.4) Structured Event Emission**       | [docs/AGENT_RUNNER_SPEC.md#L140-L150](../docs/AGENT_RUNNER_SPEC.md#L140-L150) | packages/runner/src/events/EventStream.ts<br/>packages/runner/src/session/SessionManager.ts#L662-L664 | packages/runner/src/**tests**/Instrumentation.test.ts                                                        | ✅ Implemented |
| **4.5) Policy Enforcement**              | [docs/AGENT_RUNNER_SPEC.md#L152-L162](../docs/AGENT_RUNNER_SPEC.md#L152-L162) | packages/runner/src/policy/PolicyEnforcer.ts<br/>packages/runner/src/policy/index.ts                  | None                                                                                                         | ⚠️ Partial     |
| **4.6) Repo Patrol Jobs**                | [docs/AGENT_RUNNER_SPEC.md#L164-L178](../docs/AGENT_RUNNER_SPEC.md#L164-L178) | None                                                                                                  | None                                                                                                         | ❌ Not Started |
| **5.1) Hosted Runner**                   | [docs/AGENT_RUNNER_SPEC.md#L183-L188](../docs/AGENT_RUNNER_SPEC.md#L183-L188) | packages/server/src/execution/runnerSessionService.ts                                                 | packages/server/src/**tests**/runner-sessions.router.test.ts                                                 | ✅ Implemented |
| **5.2) Customer-Hosted Runner**          | [docs/AGENT_RUNNER_SPEC.md#L190-L202](../docs/AGENT_RUNNER_SPEC.md#L190-L202) | packages/runner/src/Runner.ts (mode: RunnerMode)                                                      | None                                                                                                         | ⚠️ Partial     |
| **6.1) Authentication**                  | [docs/AGENT_RUNNER_SPEC.md#L207-L214](../docs/AGENT_RUNNER_SPEC.md#L207-L214) | packages/runner/src/events/EventStream.ts#L95-L102 (authToken)                                        | None                                                                                                         | ⚠️ Partial     |
| **6.2) Transport**                       | [docs/AGENT_RUNNER_SPEC.md#L216-L221](../docs/AGENT_RUNNER_SPEC.md#L216-L221) | packages/runner/src/events/EventStream.ts (WebSocket)                                                 | None                                                                                                         | ✅ Implemented |
| **6.3) Control Plane → Runner Commands** | [docs/AGENT_RUNNER_SPEC.md#L223-L276](../docs/AGENT_RUNNER_SPEC.md#L223-L276) | packages/server/src/execution/router.ts<br/>packages/server/src/execution/runnerSessionService.ts     | packages/server/src/**tests**/runner-sessions.router.test.ts                                                 | ✅ Implemented |
| **6.4) Runner → Control Plane Events**   | [docs/AGENT_RUNNER_SPEC.md#L278-L290](../docs/AGENT_RUNNER_SPEC.md#L278-L290) | packages/runner/src/events/EventStream.ts                                                             | None                                                                                                         | ✅ Implemented |
| **7) Event Schema**                      | [docs/AGENT_RUNNER_SPEC.md#L292-L367](../docs/AGENT_RUNNER_SPEC.md#L292-L367) | packages/shared/src/adapters/events.ts<br/>packages/runner/src/session/SessionManager.ts#L547-L605    | None                                                                                                         | ✅ Implemented |
| **8) Security Model**                    | [docs/AGENT_RUNNER_SPEC.md#L369-L388](../docs/AGENT_RUNNER_SPEC.md#L369-L388) | packages/runner/src/policy/PolicyEnforcer.ts                                                          | None                                                                                                         | ⚠️ Partial     |
| **9) Observability & Audit**             | [docs/AGENT_RUNNER_SPEC.md#L390-L402](../docs/AGENT_RUNNER_SPEC.md#L390-L402) | packages/runner/src/session/SessionManager.ts#L516-L545 (usage ticks)                                 | None                                                                                                         | ⚠️ Partial     |
| **10) Acceptance Criteria**              | [docs/AGENT_RUNNER_SPEC.md#L404-L416](../docs/AGENT_RUNNER_SPEC.md#L404-L416) | All of the above                                                                                      | Integration tests needed                                                                                     | ⚠️ Partial     |

---

## PROVIDER_ADAPTERS_SPEC Trace

| Section                                        | Spec Location                                                                           | Implementation Files                                                                                                                           | Test Files                                            | Status         |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------- |
| **3) Adapter Interface**                       | [docs/PROVIDER_ADAPTERS_SPEC.md#L52-L118](../docs/PROVIDER_ADAPTERS_SPEC.md#L52-L118)   | packages/shared/src/adapters/types.ts<br/>packages/shared/src/adapters/events.ts                                                               | None                                                  | ✅ Implemented |
| **4.1) PTY Session as Truth**                  | [docs/PROVIDER_ADAPTERS_SPEC.md#L126-L131](../docs/PROVIDER_ADAPTERS_SPEC.md#L126-L131) | packages/runner/src/adapters/BaseAdapter.ts<br/>packages/runner/src/pty/PTYManager.ts                                                          | None                                                  | ✅ Implemented |
| **4.2) Structured Events via Instrumentation** | [docs/PROVIDER_ADAPTERS_SPEC.md#L133-L141](../docs/PROVIDER_ADAPTERS_SPEC.md#L133-L141) | packages/runner/src/adapters/FileWatcher.ts<br/>packages/runner/src/adapters/DiffSummarizer.ts                                                 | packages/runner/src/**tests**/Instrumentation.test.ts | ✅ Implemented |
| **4.3) Dynamic Flag Detection**                | [docs/PROVIDER_ADAPTERS_SPEC.md#L143-L155](../docs/PROVIDER_ADAPTERS_SPEC.md#L143-L155) | packages/runner/src/adapters/CodexAdapter.ts#L61-L74<br/>packages/runner/src/adapters/BaseAdapter.ts                                           | None                                                  | ✅ Implemented |
| **5) Bidirectional Leadership**                | [docs/PROVIDER_ADAPTERS_SPEC.md#L157-L180](../docs/PROVIDER_ADAPTERS_SPEC.md#L157-L180) | packages/runner/src/session/SessionManager.ts#L270-L290 (pause/resume)<br/>packages/runner/src/session/SessionManager.ts#L310-L336 (approvals) | None                                                  | ✅ Implemented |
| **6) Orchestration Patterns**                  | [docs/PROVIDER_ADAPTERS_SPEC.md#L182-L200](../docs/PROVIDER_ADAPTERS_SPEC.md#L182-L200) | None                                                                                                                                           | None                                                  | ❌ Not Started |
| **7.1) Codex CLI Adapter**                     | [docs/PROVIDER_ADAPTERS_SPEC.md#L205-L211](../docs/PROVIDER_ADAPTERS_SPEC.md#L205-L211) | packages/runner/src/adapters/CodexAdapter.ts                                                                                                   | None                                                  | ✅ Implemented |
| **7.2) Claude Code Adapter**                   | [docs/PROVIDER_ADAPTERS_SPEC.md#L213-L218](../docs/PROVIDER_ADAPTERS_SPEC.md#L213-L218) | packages/runner/src/adapters/ClaudeCodeAdapter.ts                                                                                              | None                                                  | ✅ Implemented |
| **7.3) Gemini CLI Adapter**                    | [docs/PROVIDER_ADAPTERS_SPEC.md#L220-L223](../docs/PROVIDER_ADAPTERS_SPEC.md#L220-L223) | None                                                                                                                                           | None                                                  | ❌ Not Started |
| **7.4) Omnara Adapter**                        | [docs/PROVIDER_ADAPTERS_SPEC.md#L225-L228](../docs/PROVIDER_ADAPTERS_SPEC.md#L225-L228) | None                                                                                                                                           | None                                                  | ❌ Not Started |
| **8) Revenue-aware Packaging**                 | [docs/PROVIDER_ADAPTERS_SPEC.md#L230-L246](../docs/PROVIDER_ADAPTERS_SPEC.md#L230-L246) | packages/shared/src/adapters/types.ts#L148-L172 (AdapterConfig)                                                                                | None                                                  | ⚠️ Partial     |
| **9) Contract Test Suite**                     | [docs/PROVIDER_ADAPTERS_SPEC.md#L248-L262](../docs/PROVIDER_ADAPTERS_SPEC.md#L248-L262) | None                                                                                                                                           | None                                                  | ❌ Not Started |
| **10) Acceptance Criteria**                    | [docs/PROVIDER_ADAPTERS_SPEC.md#L264-L271](../docs/PROVIDER_ADAPTERS_SPEC.md#L264-L271) | All of the above                                                                                                                               | None                                                  | ⚠️ Partial     |

---

## Runtime Glue Documentation

### Request/Response Schemas

All API endpoints are implemented in [packages/server/src/execution/router.ts](../packages/server/src/execution/router.ts).

#### POST /api/runner/sessions

Creates a new runner session.

**Request Schema:**

```typescript
{
  villageId: string;           // Default: "demo"
  agentName?: string;          // Optional agent display name
  providerId: "codex" | "claude_code";
  repoRef: {
    provider: "github" | "gitlab" | "bitbucket" | "local";
    owner?: string;            // Required for github/gitlab/bitbucket
    name?: string;             // Required for github/gitlab/bitbucket
    path?: string;             // Required for local
    defaultBranch?: string;
  };
  checkout: {
    type: "branch" | "commit" | "tag";
    ref?: string;              // For branch
    sha?: string;              // For commit
    tag?: string;              // For tag
  };
  roomPath?: string;           // Subdirectory focus
  task: {
    title: string;             // Max 200 chars
    goal: string;              // Max 4000 chars
    constraints?: string[];
    acceptance?: string[];
    roomPath?: string;
    branchName?: string;
  };
  policy?: {
    shellAllowlist?: string[];
    shellDenylist?: string[];
    requiresApprovalFor?: ("merge" | "deps_add" | "secrets" | "deploy")[];
    networkMode?: "restricted" | "open";
  };
  env?: Record<string, string>; // Environment variables (e.g., API keys)
}
```

**Response:**

```typescript
{
  sessionId: string; // UUID
  agentId: string; // "runner_{sessionId_prefix}"
}
```

**Implementation:** [router.ts#L61-L91](../packages/server/src/execution/router.ts#L61-L91)

---

#### GET /api/runner/sessions/:id

Retrieves current runtime state of a session.

**Response:**

```typescript
{
  sessionId: string;
  state: SessionState;        // e.g., "RUNNING", "COMPLETED"
  providerId: ProviderId;
  workspace?: WorkspaceRef;
  startedAt?: number;         // Epoch ms
  providerPid?: number;
  lastEventSeq: number;
  pendingApprovals: string[]; // Approval IDs
  errorMessage?: string;
  exitCode?: number;
}
```

**Implementation:** [router.ts#L94-L98](../packages/server/src/execution/router.ts#L94-L98)

---

#### POST /api/runner/sessions/:id/input

Sends terminal input to a running session.

**Request Schema:**

```typescript
{
  data: string; // Text/keystrokes to send
}
```

**Response:**

```typescript
{
  ok: boolean;
}
```

**Implementation:** [router.ts#L102-L111](../packages/server/src/execution/router.ts#L102-L111)

---

#### POST /api/runner/sessions/:id/stop

Stops a running session.

**Request Schema:**

```typescript
{
  graceful?: boolean;         // Default: true
}
```

**Response:**

```typescript
{
  ok: boolean;
}
```

**Implementation:** [router.ts#L114-L124](../packages/server/src/execution/router.ts#L114-L124)

---

#### POST /api/runner/sessions/:id/approvals/:approvalId

Resolves a pending approval request.

**Request Schema:**

```typescript
{
  decision: "allow" | "deny";
  note?: string;              // Max 2000 chars
}
```

**Response:**

```typescript
{
  ok: boolean;
}
```

**Implementation:** [router.ts#L133-L144](../packages/server/src/execution/router.ts#L133-L144)

---

### Socket.IO Event Mapping

The runner emits `RunnerEvent` objects which are mapped to Socket.IO `work_stream_event` messages for the UI. This mapping is implemented in [runnerSessionService.ts#L272-L387](../packages/server/src/execution/runnerSessionService.ts#L272-L387).

| Runner Event Type              | Socket.IO Event     | work_stream_event.type | Payload Fields                                             | Handler Location                  |
| ------------------------------ | ------------------- | ---------------------- | ---------------------------------------------------------- | --------------------------------- |
| `SESSION_STARTED`              | `work_stream_event` | `session_start`        | `{ providerId, providerVersion, workspacePath, roomPath }` | runnerSessionService.ts#L291-L297 |
| `SESSION_STATE_CHANGED`        | `work_stream_event` | `status_change`        | `{ previousState, newState, reason }`                      | runnerSessionService.ts#L300-L305 |
| `TERMINAL_CHUNK`               | `work_stream_event` | `output`               | `{ data, stream }`                                         | runnerSessionService.ts#L308-L310 |
| `FILE_TOUCHED` (reason=read)   | `work_stream_event` | `file_read`            | `{ path, roomPath, reason }`                               | runnerSessionService.ts#L312-L324 |
| `FILE_TOUCHED` (reason=write)  | `work_stream_event` | `file_edit`            | `{ path, roomPath, reason }`                               | runnerSessionService.ts#L312-L324 |
| `FILE_TOUCHED` (reason=delete) | `work_stream_event` | `file_delete`          | `{ path, roomPath, reason }`                               | runnerSessionService.ts#L312-L324 |
| `DIFF_SUMMARY`                 | `work_stream_event` | `file_edit`            | `{ filesChanged, linesAdded, linesRemoved, files }`        | runnerSessionService.ts#L327-L334 |
| `APPROVAL_REQUESTED`           | `work_stream_event` | `status_change`        | `{ approval, newState: "WAITING_FOR_APPROVAL" }`           | runnerSessionService.ts#L336-L341 |
| `APPROVAL_RESOLVED`            | `work_stream_event` | `status_change`        | `{ approvalId, decision, note }`                           | runnerSessionService.ts#L343-L348 |
| `SESSION_ENDED`                | `work_stream_event` | `session_end`          | `{ finalState, exitCode, totalDurationMs, totalUsage }`    | runnerSessionService.ts#L351-L357 |
| `SESSION_ENDED`                | `agent_disconnect`  | N/A                    | `{ agentId, sessionId, timestamp }`                        | runnerSessionService.ts#L359-L363 |

**Socket.IO Rooms:**

- Events are emitted to both `village:<villageId>` and `agent:<agentId>` rooms
- This allows the UI to subscribe at either the village level (all agents) or agent level (specific agent)

**Event Structure:**

```typescript
{
  agentId: string;
  sessionId: string;
  type: string; // e.g., "session_start", "output", "file_edit"
  payload: Record<string, unknown>;
  timestamp: string; // ISO 8601
}
```

**Additional Village Events:**

| Event Name         | When Emitted            | Payload                                                             | Location                          |
| ------------------ | ----------------------- | ------------------------------------------------------------------- | --------------------------------- |
| `agent_spawn`      | Session creation starts | `{ agentId, sessionId, agentType, agentName, repoPath, timestamp }` | runnerSessionService.ts#L197-L207 |
| `agent_disconnect` | Session ends            | `{ agentId, sessionId, timestamp }`                                 | runnerSessionService.ts#L359-L363 |

---

## Summary Statistics

### AGENT_RUNNER_SPEC Implementation Status

- **Total Sections:** 17
- **✅ Implemented:** 10 (59%)
- **⚠️ Partial:** 6 (35%)
- **❌ Not Started:** 1 (6%)

### PROVIDER_ADAPTERS_SPEC Implementation Status

- **Total Sections:** 13
- **✅ Implemented:** 7 (54%)
- **⚠️ Partial:** 2 (15%)
- **❌ Not Started:** 4 (31%)

### Overall Execution Plane Status

- **Total Requirements:** 30
- **✅ Implemented:** 17 (57%)
- **⚠️ Partial:** 8 (27%)
- **❌ Not Started:** 5 (16%)

---

## Gaps and Recommendations

### Critical Gaps (Blocking Production)

1. **Contract Test Suite** (PROVIDER_ADAPTERS_SPEC §9)
   - Status: ❌ Not Started
   - Impact: No automated verification that adapters comply with the interface contract
   - Recommendation: Create `packages/runner/tests/adapter-contract/` with standardized tests for all adapters
   - Priority: **High**

2. **Policy Enforcement Completeness** (AGENT_RUNNER_SPEC §4.5, §8)
   - Status: ⚠️ Partial
   - Impact: Security controls exist but may not enforce all constraints (shell denylist, network policies)
   - Recommendation: Audit PolicyEnforcer against spec requirements; add comprehensive policy tests
   - Priority: **High**

3. **Repo Patrol Jobs** (AGENT_RUNNER_SPEC §4.6)
   - Status: ❌ Not Started
   - Impact: No scheduled lint/test/build patrols; no webhook-triggered patrols
   - Recommendation: Design patrol job system using BullMQ; integrate with existing event stream
   - Priority: **Medium**

### Important Gaps (Needed for Feature Completeness)

4. **Gemini CLI Adapter** (PROVIDER_ADAPTERS_SPEC §7.3)
   - Status: ❌ Not Started
   - Impact: Cannot use Gemini for second opinion audits or alternative refactors
   - Recommendation: Implement following the same pattern as Codex/Claude adapters
   - Priority: **Medium**

5. **Omnara Adapter** (PROVIDER_ADAPTERS_SPEC §7.4)
   - Status: ❌ Not Started
   - Impact: Cannot use Omnara runtime
   - Recommendation: Evaluate need; implement if Omnara becomes strategic
   - Priority: **Low**

6. **Multi-Provider Orchestration** (PROVIDER_ADAPTERS_SPEC §6)
   - Status: ❌ Not Started
   - Impact: Cannot run "Foreman" workflows with builder + reviewer pattern
   - Recommendation: Design orchestration layer in Control Plane that delegates to multiple runner sessions
   - Priority: **Medium**

### Quality/Observability Gaps

7. **Usage Metering Completeness** (AGENT_RUNNER_SPEC §1 Goals, §9)
   - Status: ⚠️ Partial
   - Impact: USAGE_TICK events fire but metrics calculation is stubbed (terminalKb=0, filesTouched=0)
   - Recommendation: Implement actual metric collection from PTY buffers and file watchers
   - Priority: **Medium**

8. **Integration Tests** (AGENT_RUNNER_SPEC §10)
   - Status: ⚠️ Partial
   - Impact: No end-to-end tests verifying all acceptance criteria
   - Recommendation: Add E2E tests for complete session lifecycle with real adapters
   - Priority: **Medium**

9. **Authentication Security** (AGENT_RUNNER_SPEC §6.1)
   - Status: ⚠️ Partial
   - Impact: Token-based auth exists but no mTLS option; no token rotation
   - Recommendation: Evaluate mTLS for enterprise; implement token expiry/refresh
   - Priority: **Low-Medium**

10. **Customer-Hosted Runner** (AGENT_RUNNER_SPEC §5.2)
    - Status: ⚠️ Partial
    - Impact: Mode detection exists but no deployment packaging or documentation
    - Recommendation: Create customer-hosted runner deployment guide with Docker/K8s examples
    - Priority: **Low** (defer to enterprise phase)

### Quick Wins

11. **Test Coverage**
    - Add unit tests for PolicyEnforcer, WorkspaceManager, PTYManager
    - Add integration tests for full session lifecycle
    - Add contract tests for adapters

12. **Documentation**
    - Document environment variables needed for each adapter
    - Create troubleshooting guide for common adapter failures
    - Add architecture diagrams showing Runner ↔ Control Plane flow

---

## Implementation Priority Roadmap

### Phase 1: Security & Stability (2-3 weeks)

- Complete policy enforcement implementation + tests
- Add contract test suite for adapters
- Implement actual usage metering calculations
- Add integration tests for core workflows

### Phase 2: Feature Completeness (3-4 weeks)

- Implement Gemini CLI adapter
- Design and implement repo patrol jobs system
- Implement multi-provider orchestration
- Add customer-hosted runner deployment guide

### Phase 3: Production Readiness (2-3 weeks)

- Add mTLS authentication option
- Implement advanced security features (container isolation, network restrictions)
- Add comprehensive observability (metrics, traces, audit logs)
- Performance testing and optimization

---

## Related Documentation

- [AGENT_RUNNER_SPEC.md](AGENT_RUNNER_SPEC.md) - Full execution plane specification
- [PROVIDER_ADAPTERS_SPEC.md](PROVIDER_ADAPTERS_SPEC.md) - Provider adapter contract
- [RUNNER_RUNTIME_GLUE.md](RUNNER_RUNTIME_GLUE.md) - Server integration guide
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture overview

---

**Document Version:** 1.0
**Generated:** 2025-12-15
**Maintainer:** Execution Plane Team
