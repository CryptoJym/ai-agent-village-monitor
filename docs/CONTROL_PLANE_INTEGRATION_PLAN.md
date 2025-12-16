# Control-Plane Integration Plan

## Executive Summary

This document outlines the integration strategy between the **packages/control-plane** WebSocket-based execution plane and the **packages/server** Socket.IO-based realtime layer. The goal is to create a coherent runtime that connects the Agent Runner execution environment (via control-plane) with the Village UI realtime updates (via server Socket.IO).

**Key Decision:** We recommend a **hybrid bridge architecture** that preserves both systems while creating a translation layer between them. This allows the execution plane to operate independently while maintaining the Village UI's multiplayer realtime features.

## Current Architecture

### packages/server (Socket.IO Realtime Layer)

**Primary File:** `/packages/server/src/realtime/server.ts`

**Purpose:** Multiplayer realtime communication for the Village UI

**Transport:** Socket.IO with Redis adapter for multi-replica support

**Features:**

- Room-based subscriptions (village:{id}, repo:{id}, agent:{id})
- JWT authentication via middleware
- CORS and origin validation
- Connection state recovery
- Heartbeat/ping monitoring
- Spatial event broadcasting

**Events (Server → Client):**

```typescript
// From docs/WEBSOCKETS.md
- work_stream: { agentId, message, ts }
- agent_update: { agentId, state, x?, y? }
- bug_bot_spawn: { id, x, y, severity? }
- bug_bot_progress: { id, progress }
- bug_bot_resolved: { id }
- house.activity: { /* snapshot */ }
```

**Events (Client → Server):**

```typescript
- join_village: { villageId }
- join_agent: { agentId }
- join_repo: { repoId }
- ping: () // with ack callback
```

**Helper Functions:** `/packages/server/src/realtime/io.ts`

```typescript
-emitToVillage(villageId, event, payload) -
  emitToAgent(agentId, event, payload) -
  emitToRepo(repoId, event, payload);
```

**Configuration:**

- Transport modes: websocket, polling (configurable via WS_TRANSPORTS)
- CORS origins: configurable via WS_ALLOWED_ORIGINS
- Ping interval: 25s, timeout: 60s
- Redis adapter: optional (enabled when REDIS_URL is set)
- Rate limiting: 20 join attempts per 5s per socket

### packages/control-plane (WebSocketServer for Agent Execution)

**Primary File:** `/packages/control-plane/src/websocket/WebSocketServer.ts`

**Purpose:** Agent Runner execution plane streaming (PTY, session events, approval requests)

**Transport:** Native WebSocket (ws library)

**Features:**

- Session-based subscriptions (sessionId, runnerId)
- JWT token authentication
- User connection limits
- Ping/pong heartbeat
- Scoped event broadcasting

**Message Types (Server → Client):**

```typescript
// From packages/control-plane/src/types.ts
- session: { sessionId, action: 'output' | 'state_change' | 'approval_request' | 'completed', data }
- terminal: { sessionId, action: 'output' | 'input' | 'resize', data }
- event: { event, data } // generic events
- error: { code, message }
- pong: { timestamp }
```

**Message Types (Client → Server):**

```typescript
- authenticate: { token, userId }
- subscribe: { sessionId?, runnerId? }
- unsubscribe: { sessionId?, runnerId? }
- terminal: { sessionId, action: 'input', data }
- ping: {}
```

**Broadcasting Methods:**

```typescript
-broadcastSessionOutput(sessionId, output, stream) -
  broadcastSessionStateChange(sessionId, state, data) -
  broadcastApprovalRequest(sessionId, requestId, action, details) -
  broadcastTerminalOutput(sessionId, data) -
  broadcastEvent(event, data) - // to all authenticated clients
  broadcastToUser(userId, message); // to specific user's connections
```

**Configuration:**

- Ping interval: 30s, timeout: 60s
- Max message size: 1MB
- Max connections per user: 10
- Path: /ws (configurable)

## Event Contract Alignment

| Event Concept          | Server (Socket.IO)                                      | Control-Plane (WS)                                                             | Status                | Gap Notes                                                                                                               |
| ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Agent Work Output**  | `work_stream` { agentId, message, ts }                  | `session` { sessionId, action: 'output', data: { output, stream } }            | **Gap**               | Need to map sessionId → agentId; Socket.IO uses simple message string while control-plane uses structured output+stream |
| **Agent State Update** | `agent_update` { agentId, state, x?, y? }               | `session` { sessionId, action: 'state_change', data: { state, ... } }          | **Gap**               | sessionId → agentId mapping needed; Socket.IO includes position (x, y) for sprite movement                              |
| **Terminal Streaming** | _Not implemented_                                       | `terminal` { sessionId, action: 'output', data }                               | **Missing**           | Socket.IO layer has no terminal streaming; this is exclusive to control-plane                                           |
| **Approval Requests**  | _Not implemented_                                       | `session` { action: 'approval_request', data: { requestId, action, details } } | **Missing**           | Socket.IO layer has no approval workflow                                                                                |
| **Authentication**     | JWT via socketAuth middleware                           | `authenticate` { token, userId }                                               | **Aligned**           | Both use JWT but different mechanisms (middleware vs message)                                                           |
| **Subscriptions**      | `join_village`, `join_agent`, `join_repo`               | `subscribe` { sessionId, runnerId }                                            | **Different**         | Different subscription models: room-based vs session-based                                                              |
| **Bug Bot Events**     | `bug_bot_spawn`, `bug_bot_progress`, `bug_bot_resolved` | _Not implemented_                                                              | **Missing**           | Control-plane has no bug bot concept                                                                                    |
| **House Activity**     | `house.activity` snapshot                               | _Not implemented_                                                              | **Missing**           | Control-plane has no house activity concept                                                                             |
| **Heartbeat**          | `ping` with ack callback + `server_ping`                | `ping` / `pong` messages                                                       | **Aligned**           | Both implement heartbeat but different patterns                                                                         |
| **Generic Events**     | Custom emit to rooms                                    | `event` { event, data }                                                        | **Partially Aligned** | Both support generic events but different scoping                                                                       |

## Transport Decision

### Option A: Keep Socket.IO as Primary Transport (RECOMMENDED)

**Rationale:**

- Socket.IO is already deeply integrated into the Village UI multiplayer experience
- Provides superior features for the UI layer: connection recovery, fallback transports, room management
- Redis adapter enables multi-replica horizontal scaling
- Broad browser compatibility (polling fallback)
- The control-plane WebSocketServer is designed for backend-to-backend streaming (Agent Runner → Control Plane)

**Implementation:**

- Keep Socket.IO for Village UI → Server realtime communication
- Keep WebSocketServer for Agent Runner → Control Plane streaming
- Build a **bridge layer** that translates control-plane session events into Socket.IO room events

**Pros:**

- ✅ Minimal changes to existing Socket.IO infrastructure
- ✅ Preserves multiplayer features (presence, spatial filtering, Redis adapter)
- ✅ Maintains separation of concerns (UI layer vs execution layer)
- ✅ Browser-friendly with fallback transports

**Cons:**

- ❌ Requires bridge/adapter layer
- ❌ Two WebSocket systems in production
- ❌ Slight complexity in event translation

### Option B: Migrate to Control-Plane WebSocketServer

**Rationale:**

- Single WebSocket implementation
- Unified message protocol

**Implementation:**

- Replace Socket.IO server with control-plane WebSocketServer
- Rewrite frontend Socket.IO client to use native WebSocket
- Implement room logic in WebSocketServer
- Add Redis pub/sub manually for multi-replica

**Pros:**

- ✅ Single WebSocket codebase
- ✅ Simpler dependency tree

**Cons:**

- ❌ Major rewrite of existing realtime infrastructure
- ❌ Lose Socket.IO features (connection recovery, polling fallback, room management)
- ❌ Requires significant frontend changes
- ❌ Risk to existing multiplayer functionality
- ❌ Delays Agent Runner integration

### Option C: Dual Transport (Coexist Independently)

**Rationale:**

- No integration needed
- Each system operates independently

**Implementation:**

- Socket.IO handles Village UI events
- WebSocketServer handles Agent Runner events
- Frontend connects to both

**Pros:**

- ✅ Zero integration work
- ✅ No risk to existing systems

**Cons:**

- ❌ Fragmented architecture
- ❌ Doubled connection overhead for clients
- ❌ No coherent event model
- ❌ Difficult to correlate agent sessions with village state

## Recommended Transport: Option A (Hybrid Bridge)

We recommend **Option A: Keep Socket.IO as Primary Transport** with a bridge layer.

**Decision Factors:**

1. **Minimize risk** to existing multiplayer Village UI
2. **Preserve Socket.IO features** (Redis adapter, connection recovery, room management)
3. **Respect architectural boundaries**: control-plane is designed for Agent Runner ↔ Control Plane, not UI ↔ Server
4. **Faster time to market**: bridge layer is additive, not destructive

## Integration Strategy

### Phase 1: Bridge Layer Design

**File:** `/packages/server/src/control-plane-bridge/SessionEventBridge.ts`

**Purpose:** Translate control-plane session events into Socket.IO village/agent events

**Architecture:**

```typescript
class SessionEventBridge {
  private controlPlaneClient: WebSocketClient; // client to control-plane WS
  private io: SocketIOServer; // reference to Socket.IO server
  private sessionMap: Map<string, { agentId: string; villageId: string }>;

  constructor(controlPlaneWsUrl: string, io: SocketIOServer);

  // Subscribe to control-plane session events
  async subscribeToSession(sessionId: string, agentId: string, villageId: string);

  // Unsubscribe when session ends
  async unsubscribeFromSession(sessionId: string);

  // Handle control-plane events and translate to Socket.IO
  private handleSessionOutput(sessionId: string, output: string, stream: 'stdout' | 'stderr');
  private handleSessionStateChange(sessionId: string, state: string, data: any);
  private handleApprovalRequest(sessionId: string, requestId: string, action: string, details: any);
  private handleTerminalOutput(sessionId: string, data: string);

  // Translate to Socket.IO events
  private emitWorkStream(agentId: string, message: string);
  private emitAgentUpdate(agentId: string, state: string, data: any);
  private emitApprovalNeeded(agentId: string, villageId: string, requestId: string, details: any);
}
```

**Event Translation Map:**

```typescript
// control-plane → Socket.IO
{
  session: {
    action: 'output',
    data: { output, stream }
  }
} → emitToAgent(agentId, 'work_stream', { agentId, message: output, ts: Date.now() })

{
  session: {
    action: 'state_change',
    data: { state, ... }
  }
} → emitToAgent(agentId, 'agent_update', { agentId, state, ...data })

{
  session: {
    action: 'approval_request',
    data: { requestId, action, details }
  }
} → emitToVillage(villageId, 'approval_needed', { agentId, requestId, action, details })

{
  terminal: {
    action: 'output',
    data: string
  }
} → emitToAgent(agentId, 'terminal_output', { agentId, data })
```

### Phase 2: Control-Plane Client Integration

**File:** `/packages/server/src/control-plane-bridge/ControlPlaneClient.ts`

**Purpose:** Server-side WebSocket client to connect to control-plane WebSocketServer

```typescript
import { WebSocket } from 'ws';

class ControlPlaneClient {
  private ws: WebSocket | null;
  private url: string;
  private token: string;
  private subscriptions: Map<string, EventCallback>;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  constructor(url: string, token: string);

  async connect(): Promise<void>;
  async authenticate(userId: string): Promise<void>;
  async subscribe(sessionId: string, callback: EventCallback): Promise<void>;
  async unsubscribe(sessionId: string): Promise<void>;
  async sendTerminalInput(sessionId: string, data: string): Promise<void>;

  private handleMessage(message: WebSocketMessage);
  private handleDisconnect();
  private reconnect();
}
```

### Phase 3: Session Lifecycle Integration

**File:** `/packages/server/src/agents/SessionManager.ts` (new or extend existing)

**Purpose:** Coordinate between agent creation, control-plane sessions, and Socket.IO broadcasting

```typescript
class AgentSessionManager {
  private bridge: SessionEventBridge;
  private controlPlaneClient: ControlPlaneClient;

  async startAgentSession(params: {
    agentId: string;
    villageId: string;
    userId: string;
    repoId: string;
    task: string;
  }): Promise<{ sessionId: string; token: string }> {
    // 1. Create session in control-plane
    const { sessionId, token } = await this.controlPlaneClient.createSession({
      orgId: villageId,
      repo: {
        /* ... */
      },
      provider: 'codex', // or claude, gemini
      task: { title: params.task },
    });

    // 2. Subscribe bridge to session events
    await this.bridge.subscribeToSession(sessionId, params.agentId, params.villageId);

    // 3. Store session mapping
    await prisma.agentSession.create({
      data: {
        id: sessionId,
        token,
        agentId: params.agentId,
        userId: params.userId,
        status: 'ACTIVE',
      },
    });

    // 4. Emit initial state to Socket.IO
    emitToAgent(params.agentId, 'agent_update', {
      agentId: params.agentId,
      state: 'starting',
      sessionId,
    });

    return { sessionId, token };
  }

  async stopAgentSession(sessionId: string): Promise<void> {
    // 1. Stop control-plane session
    await this.controlPlaneClient.stopSession(sessionId);

    // 2. Unsubscribe bridge
    await this.bridge.unsubscribeFromSession(sessionId);

    // 3. Update database
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    // 4. Emit final state
    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      include: { agent: true },
    });
    if (session) {
      emitToAgent(session.agentId, 'agent_update', {
        agentId: session.agentId,
        state: 'idle',
      });
    }
  }
}
```

### Phase 4: REST API Endpoints

**File:** `/packages/server/src/agents/router.ts` (extend existing or create new routes)

```typescript
// POST /api/agents/:agentId/start
router.post('/:agentId/start', authRequired, async (req, res) => {
  const { agentId } = req.params;
  const { task, repoId } = req.body;
  const userId = req.user.sub;

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { village: true },
  });

  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const { sessionId, token } = await agentSessionManager.startAgentSession({
    agentId: agent.id,
    villageId: agent.villageId,
    userId,
    repoId,
    task,
  });

  res.json({ sessionId, token });
});

// POST /api/agents/:agentId/stop
router.post('/:agentId/stop', authRequired, async (req, res) => {
  const { agentId } = req.params;

  const session = await prisma.agentSession.findFirst({
    where: { agentId, status: 'ACTIVE' },
    orderBy: { startedAt: 'desc' },
  });

  if (!session) return res.status(404).json({ error: 'No active session' });

  await agentSessionManager.stopAgentSession(session.id);

  res.json({ ok: true });
});

// POST /api/agents/:agentId/terminal/input
router.post('/:agentId/terminal/input', authRequired, async (req, res) => {
  const { agentId } = req.params;
  const { data } = req.body;

  const session = await prisma.agentSession.findFirst({
    where: { agentId, status: 'ACTIVE' },
    orderBy: { startedAt: 'desc' },
  });

  if (!session) return res.status(404).json({ error: 'No active session' });

  await controlPlaneClient.sendTerminalInput(session.id, data);

  res.json({ ok: true });
});

// POST /api/sessions/:sessionId/approve
router.post('/sessions/:sessionId/approve', authRequired, async (req, res) => {
  const { sessionId } = req.params;
  const { approvalId, decision, reason } = req.body;

  await controlPlaneClient.resolveApproval(sessionId, approvalId, decision, reason);

  res.json({ ok: true });
});
```

### Phase 5: Environment Configuration

**File:** `/packages/server/.env.example` and `/packages/server/src/config.ts`

Add control-plane connection configuration:

```bash
# Control Plane Configuration
CONTROL_PLANE_WS_URL=ws://localhost:3001/ws
CONTROL_PLANE_API_URL=http://localhost:3001
CONTROL_PLANE_AUTH_TOKEN=<control-plane-runner-token>

# Feature flags
ENABLE_CONTROL_PLANE_BRIDGE=true
```

### Phase 6: Database Schema Extensions

**File:** `/packages/server/prisma/schema.prisma`

Ensure AgentSession model supports control-plane integration:

```prisma
model AgentSession {
  id           String   @id @default(cuid())
  token        String   @unique @default(cuid())
  status       SessionStatus @default(ACTIVE)

  // Control-plane session ID (may differ from internal ID)
  controlPlaneSessionId  String?  @unique

  // Relations
  agent        Agent    @relation(fields: [agentId], references: [id])
  agentId      String
  user         User     @relation(fields: [userId], references: [id])
  userId       String
  events       WorkStreamEvent[]

  startedAt    DateTime @default(now())
  endedAt      DateTime?
}
```

## Risks and Mitigations

| Risk                                            | Impact                                  | Mitigation                                                                |
| ----------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| **Control-plane WebSocketServer not available** | Agent sessions fail to start            | Add health check endpoint; retry logic; fallback to queued status         |
| **Event translation loses fidelity**            | UI doesn't reflect accurate agent state | Comprehensive event mapping table; unit tests for each translation        |
| **Session → Agent mapping breaks**              | Events broadcast to wrong rooms         | Store mapping in database; validate on every event; add correlation IDs   |
| **Two WebSocket connections increase latency**  | Slower event propagation                | Use local control-plane deployment; consider WebSocket multiplexing       |
| **Bridge crashes**                              | Silent failure, no events reach UI      | Add health monitoring; supervisor process; dead letter queue for events   |
| **Approval workflow not integrated**            | Agents can't request approvals          | Priority implementation in Phase 4; block agent actions until implemented |

## Next Steps

### Immediate Actions (Week 1)

1. **Create bridge layer package**: `packages/server/src/control-plane-bridge/`
   - SessionEventBridge.ts
   - ControlPlaneClient.ts
   - types.ts
   - index.ts

2. **Implement ControlPlaneClient**
   - WebSocket connection management
   - Authentication flow
   - Message serialization/deserialization
   - Reconnection logic

3. **Implement SessionEventBridge**
   - Event subscription/unsubscription
   - Event translation map
   - Integration with Socket.IO emitters

### Short-term Actions (Week 2-3)

4. **Extend Agent API routes**
   - POST /api/agents/:agentId/start
   - POST /api/agents/:agentId/stop
   - POST /api/agents/:agentId/terminal/input
   - POST /api/sessions/:sessionId/approve

5. **Database migrations**
   - Add controlPlaneSessionId field
   - Create session mapping indexes

6. **Environment configuration**
   - Add CONTROL_PLANE_WS_URL and related config
   - Document deployment requirements

### Medium-term Actions (Week 4-6)

7. **Frontend Terminal Panel** (coordinate with frontend team)
   - xterm.js integration
   - Subscribe to terminal_output events
   - Send terminal input via REST API
   - Sprite click → open terminal modal

8. **Approval UI** (coordinate with frontend team)
   - Subscribe to approval_needed events
   - Modal for approval requests
   - Send approval decisions via REST API

9. **Testing & Validation**
   - Unit tests for bridge layer
   - Integration tests for end-to-end flow
   - Load testing (100 concurrent agents)

### Long-term Actions (Week 7+)

10. **Observability**
    - Add metrics for bridge layer (event counts, latencies)
    - Add logging for session lifecycle
    - Create Grafana dashboard for control-plane integration

11. **Deployment Strategy**
    - Docker Compose for local development (server + control-plane)
    - Railway/production deployment guide
    - Health check endpoints

12. **Documentation**
    - Developer guide for control-plane integration
    - API reference for agent session endpoints
    - Troubleshooting guide

## Success Metrics

- ✅ Agent session starts within 2 seconds of user click
- ✅ Terminal output appears in UI with <100ms latency
- ✅ Agent state updates propagate to village sprites in real-time
- ✅ Approval workflow completes without manual intervention
- ✅ Bridge layer handles 100 concurrent agent sessions
- ✅ Zero event loss during normal operation
- ✅ Graceful degradation when control-plane is unavailable

## Conclusion

The hybrid bridge architecture provides the best path forward for integrating the control-plane execution environment with the Village UI realtime layer. By preserving Socket.IO for multiplayer features and building a translation layer to the control-plane WebSocketServer, we achieve:

1. **Low risk**: No major rewrites of existing systems
2. **Clean separation**: UI layer (Socket.IO) vs execution layer (control-plane)
3. **Feature preservation**: Keep Socket.IO advantages (Redis adapter, connection recovery, rooms)
4. **Fast delivery**: Additive changes enable rapid iteration

The bridge layer is the linchpin of this architecture and should be the first implementation priority.

---

**Document Version:** 1.0
**Last Updated:** December 15, 2025
**Author:** Subagent B (Docs) for Task #3
**Status:** Draft - Pending Review
