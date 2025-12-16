# Control-Plane Integration Plan

## Executive Summary

**Transport Decision: Keep Socket.IO as primary transport with optional Control-Plane WebSocketServer bridging.**

The analysis shows that `packages/server` uses Socket.IO extensively with rooms, Redis adapter, authentication, and metrics already in place. The `packages/control-plane` WebSocketServer provides a cleaner, typed WebSocket API designed for runner-to-control-plane streaming.

**Recommendation**: Use Socket.IO for client-facing realtime (village/repo/agent rooms) and optionally bridge Control-Plane WebSocketServer for dedicated runner connections. This provides a coherent runtime story without breaking existing UI contracts.

---

## Current State Analysis

### Socket.IO Layer (packages/server)

**File**: `/packages/server/src/realtime/server.ts`

**Capabilities**:

- Socket.IO server with WebSocket + polling transports
- JWT-based authentication via `socketAuth` middleware
- Redis adapter support for multi-replica deployments
- Room-based pub/sub: `village:*`, `repo:*`, `agent:*`
- Connection state recovery (2-minute max disconnection)
- Rate limiting on join events
- Built-in metrics (Prometheus integration)
- CORS origin allowlisting
- Heartbeat/ping tracking with RTT observability

**Event Emission Pattern**:

```typescript
// Current UI events emitted by server
socket.emit('work_stream', { agentId, message, ts });
socket.emit('agent_update', { agentId, status, ts });
socket.emit('bug_bot_spawn', { id });
socket.emit('bug_bot_resolved', { id });
socket.emit('house.activity', snapshot);
```

**Room Subscriptions**:

- `join_village` -> `village:<villageId>`
- `join_agent` -> `agent:<agentId>`
- `join_repo` -> `repo:<repoId>`

**Security**:

- DB-backed authorization checks (`canJoinVillageSecure`, `canJoinRepoSecure`, `canJoinAgentSecure`)
- Anonymous read-only access for public villages
- Connection limits per user

### Control-Plane WebSocketServer

**File**: `/packages/control-plane/src/websocket/WebSocketServer.ts`

**Capabilities**:

- Pure WebSocket server (no Socket.IO compatibility)
- Session subscription model (`subscribe`, `unsubscribe`)
- Terminal input/output streaming
- Approval request broadcasting
- Per-client authentication tracking
- Connection timeout with configurable ping intervals
- Typed message contracts (`WebSocketSessionMessage`, `WebSocketTerminalMessage`, `WebSocketEventMessage`, `WebSocketErrorMessage`)

**Event Types**:

```typescript
type: 'session' -> { action: 'output' | 'state_change' | 'approval_request' | 'completed' }
type: 'terminal' -> { action: 'output' | 'input' | 'resize' }
type: 'event' -> { event: string, data: object }
type: 'error' -> { code, message }
```

**Methods**:

- `broadcastSessionOutput(sessionId, output, stream)`
- `broadcastSessionStateChange(sessionId, state, data)`
- `broadcastApprovalRequest(sessionId, requestId, action, details)`
- `broadcastTerminalOutput(sessionId, data)`
- `broadcastEvent(event, data)` - global broadcast
- `broadcastToUser(userId, message)` - user-specific

---

## Event Contract Comparison

### Runner Events (packages/shared/src/runner/events.ts)

| Event Type            | Payload                                                          | Directionality         | Ack Needed     |
| --------------------- | ---------------------------------------------------------------- | ---------------------- | -------------- |
| SESSION_STARTED       | providerId, providerVersion, workspacePath, roomPath             | Runner → Control Plane | No             |
| SESSION_STATE_CHANGED | previousState, newState, reason                                  | Runner → Control Plane | No             |
| SESSION_ENDED         | finalState, exitCode, totalDurationMs, totalUsage                | Runner → Control Plane | No             |
| TERMINAL_CHUNK        | data, stream ('stdout' \| 'stderr')                              | Runner → Control Plane | No             |
| FILE_TOUCHED          | path, roomPath, reason ('read' \| 'write' \| 'delete' \| 'diff') | Runner → Control Plane | No             |
| DIFF_SUMMARY          | filesChanged, linesAdded, linesRemoved, files[]                  | Runner → Control Plane | No             |
| TEST_RUN_STARTED      | command, testFiles[]                                             | Runner → Control Plane | No             |
| TEST_RUN_FINISHED     | exitCode, passed, failed, skipped, duration                      | Runner → Control Plane | No             |
| APPROVAL_REQUESTED    | approval (ApprovalRequest)                                       | Runner → Control Plane | Yes (blocking) |
| APPROVAL_RESOLVED     | approvalId, decision, resolvedBy, note                           | Control Plane → Runner | No             |
| ALERT_RAISED          | alertId, severity, category, title, description, context         | Runner → Control Plane | No             |
| USAGE_TICK            | providerId, units (UsageMetrics), intervalMs                     | Runner → Control Plane | No             |

### Socket.IO Events (Current UI Contract)

| Event Name        | Payload                                                       | Directionality  | Emitted To            |
| ----------------- | ------------------------------------------------------------- | --------------- | --------------------- |
| agent_spawn       | agentId, sessionId, agentType, agentName, repoPath, timestamp | Server → Client | village room          |
| agent_disconnect  | agentId, sessionId, timestamp                                 | Server → Client | village room          |
| work_stream_event | agentId, sessionId, type, payload, timestamp                  | Server → Client | village + agent rooms |
| agent_update      | agentId, status, ts                                           | Server → Client | Broadcast demo        |
| bug_bot_spawn     | id                                                            | Server → Client | Broadcast demo        |
| bug_bot_resolved  | id                                                            | Server → Client | Broadcast demo        |
| house.activity    | snapshot                                                      | Server → Client | repo room             |

**work_stream_event.type** variants (from runnerSessionService):

- `session_start` (SESSION_STARTED)
- `status_change` (SESSION*STATE_CHANGED, APPROVAL*\*)
- `output` (TERMINAL_CHUNK)
- `file_read`, `file_edit`, `file_delete` (FILE_TOUCHED)
- `session_end` (SESSION_ENDED)

### Control-Plane WebSocket Events

| Message Type | Action           | Directionality  | Purpose                   |
| ------------ | ---------------- | --------------- | ------------------------- |
| session      | output           | Server → Client | Stream terminal output    |
| session      | state_change     | Server → Client | Notify state transitions  |
| session      | approval_request | Server → Client | Block for human approval  |
| session      | completed        | Server → Client | Session finished          |
| terminal     | output           | Server → Client | PTY output                |
| terminal     | input            | Client → Server | User keystrokes           |
| terminal     | resize           | Client → Server | Terminal dimension change |
| event        | connected        | Server → Client | Welcome message           |
| event        | authenticated    | Server → Client | Auth success              |
| event        | subscribed       | Server → Client | Subscription confirmed    |
| error        | \*               | Server → Client | Error notification        |

---

## Alignment Gaps and Proposed Mappings

### Gap 1: Event Name Conventions

**Issue**: Runner uses uppercase `SESSION_STARTED`, Socket.IO/UI uses lowercase `session_start`.

**Proposed Fix**: Keep the translation layer in `runnerSessionService.ts` (already implemented).

```typescript
// packages/server/src/execution/runnerSessionService.ts:290-340
switch (evt.type) {
  case 'SESSION_STARTED':
    emitWorkStreamEvent('session_start', { ... })
  case 'TERMINAL_CHUNK':
    emitWorkStreamEvent('output', { data: evt.data, stream: evt.stream })
  // ...
}
```

**Status**: ✅ Already handled.

---

### Gap 2: Payload Shapes

**Issue**: Runner events have flat payloads (`evt.data`, `evt.stream`), UI expects nested structure with `agentId`, `sessionId`, `type`, `payload`, `timestamp`.

**Current Mapping** (in `runnerSessionService`):

```typescript
const emitWorkStreamEvent = (type: string, payload: Record<string, unknown>) => {
  const msg = {
    agentId: managed.agentId,
    sessionId: managed.sessionId,
    type,
    payload,
    timestamp,
  };
  emitToAgent(managed.agentId, 'work_stream_event', msg);
  emitToVillage(managed.villageId, 'work_stream_event', msg);
};
```

**Status**: ✅ Already handled.

---

### Gap 3: Room Routing

**Issue**: Runner emits per-session events. UI needs per-village and per-agent routing.

**Current Solution**:

- `runnerSessionService` maintains `sessions: Map<sessionId, { agentId, villageId, ... }>`
- Events are emitted to both `village:<villageId>` and `agent:<agentId>` rooms

**Status**: ✅ Already handled.

---

### Gap 4: Approval Workflow Directionality

**Issue**: Runner emits `APPROVAL_REQUESTED` expecting a response. Socket.IO doesn't have built-in RPC-style blocking.

**Current Implementation**:

- Runner emits event, transitions to `WAITING_FOR_APPROVAL` state
- UI shows approval UI
- User calls `POST /api/runner/sessions/:id/approvals/:approvalId` with decision
- Server calls `runnerSessionService.resolveApproval()`
- Runner resumes execution

**Status**: ✅ Working as designed (HTTP for control commands, WS for streaming).

---

### Gap 5: Terminal PTY Streaming

**Issue**: Control-Plane WebSocketServer has dedicated `terminal.input` / `terminal.output` messages. Socket.IO currently uses `work_stream_event` with `type: 'output'`.

**Options**:

1. Keep current model (all output as `work_stream_event`)
2. Add dedicated `terminal_output` and `terminal_input` events to Socket.IO

**Recommendation**: Keep current model for simplicity. If heavy terminal usage is needed, add optional dedicated terminal events.

**Status**: 🟡 Works but could be enhanced.

---

### Gap 6: Test Events

**Issue**: `TEST_RUN_STARTED` and `TEST_RUN_FINISHED` are not currently mapped.

**Recommendation**: Map to `work_stream_event` with types `test_start` and `test_finish`.

```typescript
case 'TEST_RUN_STARTED':
  emitWorkStreamEvent('test_start', {
    command: evt.command,
    testFiles: evt.testFiles,
  });
  break;

case 'TEST_RUN_FINISHED':
  emitWorkStreamEvent('test_finish', {
    exitCode: evt.exitCode,
    passed: evt.passed,
    failed: evt.failed,
    skipped: evt.skipped,
    duration: evt.duration,
  });
  break;
```

**Status**: ❌ Missing. Needs implementation.

---

### Gap 7: Alert Events

**Issue**: `ALERT_RAISED` is not currently mapped.

**Recommendation**: Map to village-level `alert_raised` event (similar to `bug_bot_spawn`).

```typescript
case 'ALERT_RAISED':
  emitToVillage(managed.villageId, 'alert_raised', {
    alertId: evt.alertId,
    severity: evt.severity,
    category: evt.category,
    title: evt.title,
    description: evt.description,
    context: evt.context,
    timestamp,
  });
  break;
```

**Status**: ❌ Missing. Needs implementation.

---

### Gap 8: Usage Tick Metering

**Issue**: `USAGE_TICK` events are emitted every 30 seconds but not currently forwarded to UI.

**Recommendation**: Optional. If UI needs to show real-time usage stats, emit to village or agent room. Otherwise, log server-side only for billing.

**Status**: 🟡 Not needed for MVP (backend metering sufficient).

---

## Recommended Transport Strategy

### Strategy: Hybrid (Socket.IO + Optional Control-Plane Bridge)

**Primary Transport: Socket.IO**

- All UI clients connect via Socket.IO
- Existing rooms, auth, Redis adapter, and events remain unchanged
- Minimal disruption to current architecture

**Optional Secondary Transport: Control-Plane WebSocketServer**

- Dedicated connections for runner-to-server streaming (future enhancement)
- Provides cleaner typed interface for runner integrations
- Can be used for enterprise runners that prefer pure WebSocket

**Migration Path**:

1. Phase 1 (Current): Runner events → `runnerSessionService` → Socket.IO rooms → UI
2. Phase 2 (Future): Add Control-Plane WebSocketServer as alternative runner connection path
3. Phase 3 (Future): Bridge Control-Plane WS to Socket.IO for enterprise deployments

---

## Integration Architecture

### Current Runtime Flow

```
Runner Session
  ↓ (EventEmitter)
SessionManager.emit('event', runnerEvent)
  ↓
runnerSessionService.handleRunnerEvent(evt)
  ↓ (translate + route)
emitToVillage(villageId, 'work_stream_event', msg)
emitToAgent(agentId, 'work_stream_event', msg)
  ↓ (Socket.IO)
io.to(`village:${villageId}`).emit('work_stream_event', msg)
io.to(`agent:${agentId}`).emit('work_stream_event', msg)
  ↓
UI Clients (subscribed to village/agent rooms)
```

### Future Hybrid Flow (Optional)

```
Runner Session (remote)
  ↓ (WebSocket to Control-Plane)
Control-Plane WebSocketServer.broadcastSessionOutput(...)
  ↓ (bridge)
runnerSessionService.handleControlPlaneEvent(evt)
  ↓ (translate)
Socket.IO rooms → UI
```

**Benefits**:

- Separation of concerns (runner transport vs UI transport)
- Type-safe runner protocol
- Easier enterprise deployments (pure WS for runners)

---

## Recommended Implementation Phases

### Phase 1: Complete Socket.IO Event Mapping (Current Sprint)

**Goal**: Full feature parity for all Runner events in Socket.IO transport.

**Tasks**:

1. Add `TEST_RUN_STARTED` / `TEST_RUN_FINISHED` mapping in `runnerSessionService.ts`
2. Add `ALERT_RAISED` mapping (emit `alert_raised` to village room)
3. Optionally add dedicated `terminal_output` / `terminal_input` events for better terminal UX
4. Update UI to consume new event types (`test_start`, `test_finish`, `alert_raised`)

**Files to modify**:

- `packages/server/src/execution/runnerSessionService.ts` (add missing event mappings)
- `packages/frontend/src/components/VillageView/` (consume new events)

**Validation**:

- Smoke test with local runner session
- Verify all event types appear in UI
- Check village room receives alerts and test events

---

### Phase 2: Control-Plane WebSocketServer Integration (Future)

**Goal**: Enable runners to connect via Control-Plane WebSocketServer for cleaner protocol.

**Tasks**:

1. Add Control-Plane WebSocketServer to `packages/server` (attach to HTTP server)
2. Implement runner authentication (JWT or mTLS)
3. Bridge Control-Plane events to Socket.IO rooms
4. Update runner to support Control-Plane WS endpoint (optional alternative to direct SessionManager)

**Files to modify**:

- `packages/server/src/index.ts` (attach Control-Plane WS)
- `packages/server/src/execution/controlPlaneBridge.ts` (new adapter)
- `packages/control-plane/src/handlers/SessionHandler.ts` (integrate with SessionManager)

**Validation**:

- Runner can connect to Control-Plane WS endpoint
- Events flow correctly to Socket.IO rooms
- No loss of functionality vs direct SessionManager integration

---

### Phase 3: Enterprise Deployment Support (Future)

**Goal**: Support customer-hosted runners with hybrid Control-Plane mode.

**Tasks**:

1. Package Control-Plane as standalone service
2. Add runner registration API
3. Implement runner heartbeat and health checks
4. Add session routing (multiple runners)

**Files to modify**:

- `packages/control-plane/src/handlers/RunnerHandler.ts` (runner registration)
- `packages/control-plane/src/index.ts` (standalone server mode)
- `packages/server/src/execution/runnerProxy.ts` (route sessions to registered runners)

**Validation**:

- Customer-hosted runner registers with Control-Plane
- Sessions can be routed to remote runners
- Telemetry and usage metering work across hybrid deployment

---

## Event Contract Summary Tables

### Runner → Control Plane Events (Complete)

| Runner Event          | Socket.IO Event                                                       | Payload Mapping                                          | Status                 |
| --------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------- |
| SESSION_STARTED       | work_stream_event (type: 'session_start')                             | providerId, providerVersion, workspacePath, roomPath     | ✅ Implemented         |
| SESSION_STATE_CHANGED | work_stream_event (type: 'status_change')                             | previousState, newState, reason                          | ✅ Implemented         |
| SESSION_ENDED         | work_stream_event (type: 'session_end') + agent_disconnect            | finalState, exitCode, totalDurationMs, totalUsage        | ✅ Implemented         |
| TERMINAL_CHUNK        | work_stream_event (type: 'output')                                    | data, stream                                             | ✅ Implemented         |
| FILE_TOUCHED          | work_stream_event (type: 'file_read' \| 'file_edit' \| 'file_delete') | path, roomPath, reason                                   | ✅ Implemented         |
| DIFF_SUMMARY          | work_stream_event (type: 'file_edit')                                 | filesChanged, linesAdded, linesRemoved, files            | ✅ Implemented         |
| TEST_RUN_STARTED      | work_stream_event (type: 'test_start')                                | command, testFiles                                       | ❌ Not Implemented     |
| TEST_RUN_FINISHED     | work_stream_event (type: 'test_finish')                               | exitCode, passed, failed, skipped, duration              | ❌ Not Implemented     |
| APPROVAL_REQUESTED    | work_stream_event (type: 'status_change' with approval)               | approval (ApprovalRequest)                               | ✅ Implemented         |
| APPROVAL_RESOLVED     | work_stream_event (type: 'status_change')                             | approvalId, decision, note                               | ✅ Implemented         |
| ALERT_RAISED          | alert_raised (village room)                                           | alertId, severity, category, title, description, context | ❌ Not Implemented     |
| USAGE_TICK            | (server-side only)                                                    | providerId, units, intervalMs                            | 🟡 Not forwarded to UI |

### Control Plane → Runner Commands (via HTTP/WebSocket)

| Command              | HTTP Endpoint                                       | WebSocket Message                | Purpose                           |
| -------------------- | --------------------------------------------------- | -------------------------------- | --------------------------------- |
| Start Session        | POST /api/runner/sessions                           | N/A                              | Create and start a runner session |
| Send Input           | POST /api/runner/sessions/:id/input                 | terminal.input                   | Send terminal input to session    |
| Stop Session         | POST /api/runner/sessions/:id/stop                  | N/A                              | Gracefully stop session           |
| Resolve Approval     | POST /api/runner/sessions/:id/approvals/:approvalId | N/A                              | Approve/deny an action            |
| Subscribe to Session | N/A                                                 | { type: 'subscribe', sessionId } | Receive session events            |

---

## Code Reference Summary

### Key Files

| File Path                                                  | Purpose                                   | Transport   |
| ---------------------------------------------------------- | ----------------------------------------- | ----------- |
| `/packages/server/src/realtime/server.ts`                  | Socket.IO server setup, rooms, auth       | Socket.IO   |
| `/packages/server/src/realtime/io.ts`                      | Emit helpers (emitToVillage, emitToAgent) | Socket.IO   |
| `/packages/server/src/execution/runnerSessionService.ts`   | Runner event → Socket.IO bridge           | Both        |
| `/packages/control-plane/src/websocket/WebSocketServer.ts` | Control-Plane WebSocket server            | Pure WS     |
| `/packages/control-plane/src/handlers/SessionHandler.ts`   | Session CRUD operations                   | N/A (logic) |
| `/packages/shared/src/runner/events.ts`                    | Runner event schemas                      | N/A (types) |
| `/packages/control-plane/src/types.ts`                     | Control-Plane API types                   | N/A (types) |

### Event Names and Source Locations

| Event Name                                                         | Emitted In                      | Consumed In          |
| ------------------------------------------------------------------ | ------------------------------- | -------------------- |
| `work_stream_event`                                                | runnerSessionService.ts:278-340 | Frontend VillageView |
| `agent_spawn`                                                      | runnerSessionService.ts:197-207 | Frontend VillageView |
| `agent_disconnect`                                                 | runnerSessionService.ts:359-363 | Frontend VillageView |
| `house.activity`                                                   | realtime/server.ts:258          | Frontend RepoView    |
| `work_stream`, `agent_update`, `bug_bot_spawn`, `bug_bot_resolved` | realtime/server.ts:269-278      | Frontend (demo loop) |

---

## Acceptance Criteria

### Phase 1 Completion Checklist

- [ ] `TEST_RUN_STARTED` and `TEST_RUN_FINISHED` are mapped and emitted to village/agent rooms
- [ ] `ALERT_RAISED` is mapped and emitted to village room
- [ ] UI displays test run status when runner executes tests
- [ ] UI displays alerts when runner raises alerts
- [ ] Smoke test confirms all Runner event types flow correctly to UI
- [ ] Documentation updated to reflect new event mappings

### Future Phase 2 Checklist

- [ ] Control-Plane WebSocketServer attached to server HTTP server
- [ ] Runner authentication implemented (JWT or mTLS)
- [ ] Events bridged from Control-Plane WS to Socket.IO rooms
- [ ] No regression in existing Socket.IO behavior

### Future Phase 3 Checklist

- [ ] Runner registration API implemented
- [ ] Runner heartbeat and health checks operational
- [ ] Session routing to multiple runners works
- [ ] Customer-hosted runner can connect and execute sessions

---

## Conclusion

The current architecture is **coherent and functional**. Socket.IO provides a solid foundation for village/repo/agent room-based event streaming with authentication, scaling (Redis adapter), and metrics.

The Control-Plane WebSocketServer offers a typed, cleaner protocol for future runner integrations but is **not required for the current execution plane**. The existing `runnerSessionService` successfully bridges runner events to Socket.IO rooms.

**Key Recommendation**: Complete Phase 1 (add missing event mappings) in this sprint. Defer Control-Plane WebSocketServer integration to a future phase when enterprise customer-hosted runners are prioritized.

---

**Document Version**: 1.0
**Last Updated**: December 2025
**Author**: Subagent B (Docs) for Task #3
