# WebSocket Event Contracts

Socket.IO is used for realtime updates. Clients join rooms to scope events.

## Rooms

- `village:{villageId}` — events for a village
- `agent:{agentId}` — events for an agent

## Client → Server

- `join_village` `{ villageId: string }`
- `join_agent` `{ agentId: string }`
- `ping` `()` with ack for RTT measurement

## Server → Client Events

- `work_stream` `{ agentId: string, message: string, ts?: number }`
- `agent_update` `{ agentId: string, state: string, x?: number, y?: number }`
- `bug_bot_spawn` `{ id: string, x: number, y: number, severity?: 'low'|'medium'|'high' }`
- `bug_bot_progress` `{ id: string, progress: number }` // 0..1
- `bug_bot_resolved` `{ id: string }`

Notes:

- High-frequency UI events are throttled to `requestAnimationFrame` on the client.
- The server may emit to both `village:{id}` and `agent:{id}` as appropriate.

