# Master Implementation Plan

## AI Agent Village Monitor - Runner, Adapters, Update Pipeline

**Version**: 1.0
**Created**: December 2025
**Status**: Active Implementation

---

## Executive Summary

This plan orchestrates the implementation of three interconnected systems:

1. **Agent Runner** - Execution plane for AI coding sessions
2. **Provider Adapters** - Multi-vendor CLI abstraction layer
3. **Update Pipeline** - Version management and safe rollouts

### Design Philosophy

- **Reliability First**: Every component must degrade gracefully
- **Revenue-Aware**: Metering and billing hooks from day one
- **Multi-Tenant**: Isolation guarantees for enterprise customers
- **Observable**: Rich telemetry for debugging and optimization
- **Testable**: Contract tests gate all integrations

---

## Part 1: Domain Decomposition

### 1.1 Domain Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONTROL PLANE (packages/server)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Auth &     │  │   Session    │  │   Billing    │  │   Update     │    │
│  │   Policy     │  │   Routing    │  │   Metering   │  │   Control    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│           │                │                │                │              │
│           └────────────────┴────────────────┴────────────────┘              │
│                                    │                                        │
│                            WebSocket / HTTP                                 │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                         RUNNER (packages/runner)                            │
│                                    │                                        │
│  ┌──────────────┐  ┌──────────────┴──────────────┐  ┌──────────────┐       │
│  │  Workspace   │  │      Session Manager        │  │   Policy     │       │
│  │  Manager     │──│   (State Machine + Events)  │──│   Enforcer   │       │
│  └──────────────┘  └──────────────┬──────────────┘  └──────────────┘       │
│                                   │                                         │
│  ┌──────────────┐  ┌──────────────┴──────────────┐  ┌──────────────┐       │
│  │    PTY       │  │     Provider Adapter        │  │   Metering   │       │
│  │   Manager    │──│    (pluggable driver)       │──│   Ticker     │       │
│  └──────────────┘  └─────────────────────────────┘  └──────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                    ADAPTERS (packages/shared/src/adapters)                  │
│                                    │                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Claude     │  │   Codex      │  │   Gemini     │  │   Omnara     │    │
│  │   Adapter    │  │   Adapter    │  │   Adapter    │  │   Adapter    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│           │                │                │                │              │
│           └────────────────┴────────────────┴────────────────┘              │
│                              Shared Utils                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │
│  │ FileWatcher  │  │DiffSummarizer│  │CapabilityDet │                      │
│  └──────────────┘  └──────────────┘  └──────────────┘                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Dependency Graph

```
Foundation (Phase 3)
    │
    ├── packages/shared/src/adapters/types.ts (interfaces)
    ├── packages/shared/src/runner/types.ts (session, events)
    └── packages/shared/src/runner/schemas.ts (Zod validation)
           │
           ▼
Provider Adapters (Phase 5) ◄──────┐
    │                              │
    ├── BaseAdapter                │
    ├── ClaudeCodeAdapter          │
    ├── FileWatcher                │
    └── DiffSummarizer             │
           │                       │
           ▼                       │
Runner Service (Phase 4)           │
    │                              │
    ├── WorkspaceManager           │
    ├── PTYManager                 │
    ├── SessionManager ────────────┘ (uses adapters)
    ├── EventEmitter
    ├── PolicyEnforcer
    └── UsageTicker
           │
           ▼
Update Pipeline (Phase 6)
    │
    ├── VersionWatcher
    ├── CompatibilityLab
    ├── RolloutController
    └── RunnerHeartbeat
           │
           ▼
Integration Layer (Phase 7)
    │
    ├── Control Plane APIs
    ├── Socket.io events
    └── UI Terminal Tab
```

---

## Part 2: Risk Assessment & Mitigations

### 2.1 Technical Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| PTY streaming drops under load | High | Medium | Implement backpressure, message batching, reconnection |
| CLI version breaks adapter | High | High | Dynamic capability detection, fallback modes, canary testing |
| Workspace cleanup fails (orphan dirs) | Medium | Medium | Scheduled cleanup job, lease-based expiration |
| Session state desync | High | Low | Checkpointing, event sourcing, reconciliation on reconnect |
| Metering accuracy drift | High | Low | Monotonic counters, cross-validation, audit logs |
| Multi-tenant isolation breach | Critical | Low | Separate processes, namespaced paths, secret redaction |

### 2.2 Operational Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Customer-hosted runner version skew | Medium | High | Version negotiation, graceful degradation |
| Rollout causes widespread failures | High | Low | Gradual rollout, automatic rollback triggers |
| Cost overrun from runaway sessions | High | Medium | Hard timeouts, budget alerts, plan limits |

### 2.3 Business Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Single provider dependency | High | Medium | Multi-adapter architecture from day one |
| Enterprise compliance gaps | High | Low | Audit logging, data residency support |
| Metering disputes | Medium | Medium | Detailed usage ticks, customer-visible logs |

---

## Part 3: Implementation Phases

### Phase 3: Foundation Layer

**Goal**: Establish shared types, interfaces, and validation schemas that all systems depend on.

**Files to Create**:

```
packages/shared/src/
├── adapters/
│   ├── types.ts          # ProviderId, Capability, ProviderAdapter interface
│   ├── events.ts         # ProviderEvent discriminated union
│   └── index.ts          # Re-exports
├── runner/
│   ├── types.ts          # SessionState, SessionConfig, WorkspaceRef
│   ├── events.ts         # RunnerEvent discriminated union (30+ event types)
│   ├── schemas.ts        # Zod schemas for all events
│   ├── policy.ts         # PolicySpec, ApprovalCategory types
│   └── index.ts          # Re-exports
└── index.ts              # Updated to export new modules
```

**Key Design Decisions**:

1. **Discriminated Unions over Enums**: Enables exhaustive pattern matching
2. **Zod Schemas**: Runtime validation at all boundaries
3. **Immutable Event Records**: Events are append-only, timestamped
4. **Provider-Agnostic**: Runner events don't reference provider internals

### Phase 4: Runner Service

**Goal**: Build the execution plane with PTY streaming, session lifecycle, and metering.

**Package Structure**:

```
packages/runner/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Entry point, starts services
│   ├── config.ts             # Environment config with Zod validation
│   ├── workspace/
│   │   ├── WorkspaceManager.ts
│   │   ├── GitOperations.ts
│   │   └── CleanupScheduler.ts
│   ├── pty/
│   │   ├── PTYManager.ts
│   │   ├── OutputBuffer.ts   # Ring buffer for history
│   │   └── InputSanitizer.ts # Security filtering
│   ├── session/
│   │   ├── SessionManager.ts
│   │   ├── SessionMachine.ts # XState state machine
│   │   └── SessionStore.ts   # In-memory + Redis persistence
│   ├── events/
│   │   ├── EventEmitter.ts
│   │   ├── EventSerializer.ts
│   │   └── SequenceManager.ts
│   ├── policy/
│   │   ├── PolicyEnforcer.ts
│   │   ├── CommandFilter.ts
│   │   ├── PathGuard.ts
│   │   └── SecretRedactor.ts
│   ├── metering/
│   │   ├── UsageTicker.ts
│   │   ├── MetricsCollector.ts
│   │   └── BillingBridge.ts
│   ├── transport/
│   │   ├── WSStreamClient.ts  # Connect to Control Plane
│   │   ├── Multiplexer.ts     # Multiple sessions over one WS
│   │   └── Heartbeat.ts
│   └── health/
│       ├── HealthCheck.ts
│       └── ReadinessProbe.ts
└── tests/
    ├── workspace.test.ts
    ├── pty.test.ts
    ├── session.test.ts
    └── integration/
        └── full-session.test.ts
```

**Critical Implementation Notes**:

1. **SessionMachine States**:
   ```typescript
   states: {
     created: { on: { PREPARE: 'preparing_workspace' } },
     preparing_workspace: {
       invoke: { src: 'prepareWorkspace', onDone: 'starting_provider' }
     },
     starting_provider: {
       invoke: { src: 'startProvider', onDone: 'running' }
     },
     running: {
       on: {
         APPROVAL_NEEDED: 'waiting_for_approval',
         PAUSE: 'paused_by_human',
         STOP: 'stopping',
         ERROR: 'failed'
       }
     },
     waiting_for_approval: {
       on: { APPROVED: 'running', DENIED: 'stopping' }
     },
     paused_by_human: {
       on: { RESUME: 'running', STOP: 'stopping' }
     },
     stopping: {
       invoke: { src: 'cleanup', onDone: 'completed' }
     },
     completed: { type: 'final' },
     failed: { type: 'final' }
   }
   ```

2. **PTY Backpressure**: If consumer is slow, buffer in ring buffer, drop oldest

3. **Event Sequence IDs**: Per-session monotonic counter, persisted in Redis

4. **Workspace Isolation**: Each session gets `workspaces/<session_id>/` directory

### Phase 5: Provider Adapters

**Goal**: Build pluggable drivers for CLI tools with capability detection and instrumentation.

**Files to Create**:

```
packages/shared/src/adapters/
├── types.ts              # (from Phase 3)
├── events.ts             # (from Phase 3)
├── BaseAdapter.ts        # Abstract base with common logic
├── ClaudeCodeAdapter.ts  # Claude Code implementation
├── CodexAdapter.ts       # Codex CLI implementation (stub)
├── GeminiAdapter.ts      # Gemini CLI implementation (stub)
├── utils/
│   ├── FileWatcher.ts    # Chokidar-based file monitoring
│   ├── DiffSummarizer.ts # Git diff analysis
│   ├── CapabilityDetector.ts # Dynamic --help parsing
│   └── ProcessSpawner.ts # PTY spawn wrapper
├── factory.ts            # createAdapter(providerId)
└── index.ts
```

**Adapter Lifecycle**:

```
detect() → capabilities() → startSession() → [sendInput() loop] → stop()
                                    │
                                    └── onEvent() callbacks throughout
```

**FileWatcher Strategy**:

```typescript
// Debounced file change detection
const watcher = chokidar.watch(repoPath, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 500 }
});

watcher.on('change', debounce((path) => {
  emitEvent({ type: 'HINT_FILES_TOUCHED', paths: [path] });
}, 200));
```

**DiffSummarizer Strategy**:

```typescript
// Triggered on HINT_FILES_TOUCHED or interval
async function summarizeDiff(): Promise<DiffSummary> {
  const nameOnly = await exec('git diff --name-only');
  const stat = await exec('git diff --stat');
  const staged = await exec('git diff --cached --name-only');

  return {
    changedFiles: nameOnly.split('\n').filter(Boolean),
    stagedFiles: staged.split('\n').filter(Boolean),
    summary: stat,
    linesAdded: parseStat(stat).added,
    linesRemoved: parseStat(stat).removed
  };
}
```

### Phase 6: Update Pipeline

**Goal**: Safe version management with canary testing and controlled rollouts.

**Files to Create**:

```
packages/server/src/updates/
├── index.ts              # Module exports
├── types.ts              # RuntimeVersion, RunnerBuild types
├── schema.prisma         # Prisma schema additions
├── VersionWatcher.ts     # Scheduled job to check for updates
├── VersionRegistry.ts    # CRUD for versions and builds
├── CompatibilityLab.ts   # Test harness (skeleton)
├── RolloutController.ts  # Gradual rollout logic
├── RunnerHeartbeat.ts    # Runner registration endpoint
├── routes.ts             # REST API endpoints
└── metrics.ts            # Observability
```

**Canary Test Flow**:

```
New Version Detected
        │
        ▼
┌───────────────────┐
│ Run Contract Tests │
│ (adapter-contract) │
└─────────┬─────────┘
          │ PASS
          ▼
┌───────────────────┐
│ Run Golden Path   │
│ (start, edit, PR) │
└─────────┬─────────┘
          │ PASS
          ▼
┌───────────────────┐
│ Run Approval Gate │
│ (risky action)    │
└─────────┬─────────┘
          │ PASS
          ▼
    Mark CANARY
          │
          ▼
┌───────────────────┐
│ Gradual Rollout   │
│ 1% → 10% → 100%   │
└─────────┬─────────┘
          │ No failures
          ▼
    Mark STABLE
```

### Phase 7: Integration Layer

**Goal**: Wire everything together - Control Plane APIs, Socket.io events, UI components.

**Server Additions**:

```
packages/server/src/
├── runners/
│   ├── router.ts         # /api/runners/* endpoints
│   ├── service.ts        # Business logic
│   ├── controller.ts     # Runner fleet abstraction
│   └── types.ts
├── sessions/
│   ├── router.ts         # /api/sessions/* endpoints
│   └── service.ts
└── realtime/
    └── contracts.ts      # Add terminal_output, session_state events
```

**Frontend Additions**:

```
packages/frontend/src/
├── ui/
│   └── TerminalTab.tsx   # New tab in DialogueUI
├── realtime/
│   └── EventBus.ts       # Add terminal event types
└── hooks/
    └── useTerminal.ts    # Terminal state management
```

**Socket.io Events**:

```typescript
// New events to add
terminal_output: {
  sessionId: string;
  agentId: string;
  data: string;        // Raw PTY output
  stream: 'stdout' | 'stderr';
  ts: number;
  seq: number;
}

session_state_changed: {
  sessionId: string;
  agentId: string;
  fromState: SessionState;
  toState: SessionState;
  ts: number;
}

approval_requested: {
  sessionId: string;
  agentId: string;
  approvalId: string;
  category: ApprovalCategory;
  summary: string;
  risk: 'low' | 'medium' | 'high';
  context: Record<string, unknown>;
}
```

### Phase 8: Testing Strategy

**Test Pyramid**:

```
                    ┌─────────────────┐
                    │   E2E Tests     │ (Playwright)
                    │   5-10 tests    │
                    └────────┬────────┘
                             │
               ┌─────────────┴─────────────┐
               │   Integration Tests       │
               │   (API, WebSocket, DB)    │
               │   50+ tests               │
               └─────────────┬─────────────┘
                             │
          ┌──────────────────┴──────────────────┐
          │          Unit Tests                 │
          │   (Services, Adapters, Utils)       │
          │   200+ tests                        │
          └──────────────────┬──────────────────┘
                             │
    ┌────────────────────────┴────────────────────────┐
    │              Contract Tests                      │
    │   (Adapter interface, Event schemas)            │
    │   20+ tests per adapter                         │
    └──────────────────────────────────────────────────┘
```

**Contract Test Suite**:

```typescript
// packages/shared/src/adapters/__tests__/contract.test.ts

describe('ProviderAdapter Contract', () => {
  const adapters = [
    new ClaudeCodeAdapter(),
    // Add others as implemented
  ];

  describe.each(adapters)('%s', (adapter) => {
    it('detect() returns valid detection result', async () => {
      const result = await adapter.detect();
      expect(result).toMatchObject({
        installed: expect.any(Boolean),
      });
      if (result.installed) {
        expect(result.version).toMatch(/^\d+\.\d+/);
      }
    });

    it('capabilities() returns valid capabilities', async () => {
      const caps = await adapter.capabilities();
      expect(caps.ptyStreaming).toBe(true);
      expect(['none', 'diff', 'fileEvents']).toContain(caps.structuredEdits);
    });

    it('emits PROVIDER_STARTED on session start', async () => {
      const events: ProviderEvent[] = [];
      adapter.onEvent(e => events.push(e));

      // Mock or real start
      await adapter.startSession(mockArgs);

      expect(events.some(e => e.type === 'PROVIDER_STARTED')).toBe(true);
    });
  });
});
```

### Phase 9: Documentation

**Documentation Artifacts**:

1. **API Reference** (`docs/api/`)
   - REST endpoints (OpenAPI spec)
   - WebSocket events (AsyncAPI spec)
   - Adapter interface

2. **Architecture Decision Records** (`docs/adr/`)
   - ADR-001: PTY vs subprocess for CLI execution
   - ADR-002: XState vs custom state machine
   - ADR-003: Event sourcing for sessions
   - ADR-004: Workspace isolation strategy

3. **Runbooks** (`docs/operations/`)
   - Runner deployment
   - Version rollout procedure
   - Incident response

4. **Developer Guide** (`docs/developer/`)
   - Adding a new adapter
   - Testing locally
   - Environment setup

### Phase 10: Hardening

**Checklist**:

- [ ] Load test: 100 concurrent sessions
- [ ] Chaos test: Kill runner mid-session, verify cleanup
- [ ] Security audit: Secret redaction, path traversal
- [ ] Memory leak check: 24-hour soak test
- [ ] Network partition test: Verify reconnection
- [ ] Rollback test: Verify version rollback works
- [ ] Billing accuracy: Compare metered vs actual
- [ ] Accessibility: Terminal tab keyboard navigation

---

## Part 4: Execution Timeline

### Week 1: Foundation + Runner Core
- Day 1-2: Shared types and schemas
- Day 3-4: WorkspaceManager + GitOperations
- Day 5: PTYManager + OutputBuffer

### Week 2: Runner Completion + Adapters Start
- Day 1-2: SessionManager + SessionMachine
- Day 3: EventEmitter + SequenceManager
- Day 4: PolicyEnforcer (stubs)
- Day 5: UsageTicker + MetricsCollector

### Week 3: Adapters + Update Pipeline
- Day 1-2: BaseAdapter + ClaudeCodeAdapter
- Day 3: FileWatcher + DiffSummarizer
- Day 4-5: VersionWatcher + VersionRegistry

### Week 4: Integration + Testing
- Day 1-2: Control Plane APIs
- Day 3: Socket.io events + UI Terminal
- Day 4-5: Contract tests + Integration tests

### Week 5: Polish + Documentation
- Day 1-2: E2E tests
- Day 3: Documentation
- Day 4-5: Hardening + Review

---

## Part 5: Success Criteria

### MVP Complete When:

1. ✅ Can spawn a Claude Code session from UI
2. ✅ Terminal output streams to UI in real-time
3. ✅ User can type input that reaches the CLI
4. ✅ File changes emit events that move sprites
5. ✅ USAGE_TICK emitted every 30 seconds
6. ✅ Approval gates block risky actions
7. ✅ Session cleanup on stop/error
8. ✅ Version detection for Claude CLI
9. ✅ Contract tests pass for Claude adapter
10. ✅ 80%+ test coverage on critical paths

### Production Ready When:

1. ✅ All MVP criteria
2. ✅ Load tested to 100 concurrent sessions
3. ✅ Canary pipeline operational
4. ✅ Gradual rollout working
5. ✅ Customer-hosted runner documented
6. ✅ Monitoring dashboards live
7. ✅ Runbooks complete
8. ✅ Security audit passed

---

## Appendix A: Key Decisions Log

| Decision | Options Considered | Choice | Rationale |
|----------|-------------------|--------|-----------|
| PTY library | node-pty, pty.js | node-pty | Better maintained, cross-platform |
| State machine | XState, custom | XState v5 | Existing pattern, visualizer, persistence |
| Event transport | gRPC, WebSocket | WebSocket | Existing Socket.io infrastructure |
| Workspace isolation | Docker, directories | Directories | Simpler MVP, Docker later for enterprise |
| Adapter interface | Class, functions | Class with interface | Enables shared BaseAdapter logic |
| Diff detection | Polling, inotify | Chokidar (hybrid) | Cross-platform, battle-tested |

---

## Appendix B: Environment Variables

```bash
# Runner Service
RUNNER_ID=runner_001
RUNNER_VERSION=1.0.0
CONTROL_PLANE_URL=wss://api.example.com
CONTROL_PLANE_TOKEN=secret
WORKSPACE_ROOT=/var/lib/runner/workspaces
MAX_CONCURRENT_SESSIONS=10
USAGE_TICK_INTERVAL_MS=30000

# Adapters
CLAUDE_CODE_PATH=/usr/local/bin/claude
CODEX_PATH=/usr/local/bin/codex
GEMINI_PATH=/usr/local/bin/gemini

# Update Pipeline
VERSION_CHECK_INTERVAL_MS=3600000
CANARY_ENABLED=true
ROLLOUT_PERCENTAGE=0

# Observability
LOG_LEVEL=info
METRICS_ENABLED=true
SENTRY_DSN=https://...
```

---

*This plan is a living document. Update as implementation progresses.*
