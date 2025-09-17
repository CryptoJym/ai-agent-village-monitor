MCP Agent Controller Design (Task 51.1)

Overview
- Provide a stable abstraction (MCPAgentController) to manage agent connections and command execution against MCP servers.
- Separate transport-specific details (HTTP/SSE, native SDK) from app logic via controller implementations and an AgentManager that handles lifecycle and broadcasting.

Key Interfaces
- MCPAgentController (controller.ts)
  - start(agentId): Promise<{ ok, sessionToken? }>
  - stop(agentId): Promise<{ ok }>
  - runCommand(agentId, command, args?, { onEvent? }): Promise<{ ok, output?, error? }>
- Implementations:
  - MockMCPAgentController: in-memory, deterministic events (tests/dev)
  - HttpMCPAgentController (mcp-http.ts): HTTP+SSE endpoints for start/stop/command

Lifecycle & State
- AgentManager (manager.ts)
  - Holds Map<agentId, AgentRuntime> with fields: state, lastError, sessionToken, connectedAt, updatedAt
  - connectAgent():
    1) ensureActiveSession in DB (prisma) with optional restart
    2) controller.start(agentId)
    3) update runtime → connected
  - disconnectAgent(): controller.stop + endActiveSession + set state → disconnected
  - runTool/runTask(): controller.runCommand(..., { onEvent }) to stream events
    - onEvent persists via appendEvent(sessionId, type, content)
    - broadcasts via Socket.IO to rooms `agent:{id}` using `work_stream`/`agent_update`

Events
- Stream events normalized to:
  - log: work_stream(message)
  - progress: work_stream("progress X%")
  - status: work_stream(message)
  - error: work_stream("error: ...") + agent_update(state=error)

Next Steps (follow-up subtasks)
- 51.2 Reconnect/backoff: exponential backoff, jitter, circuit breakers, transient detection
- 51.3 Streaming runTool/runTask against real MCP SDK
- 51.4 Event normalization & mapping (tool-start, tool-end, token/chunk, stderr)
- 51.5 WS broadcasting helpers for village rooms, correlation ids
- 51.6 Persist full work_stream payload with correlation/session id
- 51.7 Error taxonomy and state transitions; degraded modes
- 51.8 Cleanup & shutdown; draining inflight jobs
- 51.9 Metrics, structured logging, timing/bytes counters
- 51.10 Mockable interfaces and unit/integration tests (controller + manager)

