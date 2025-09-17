# Architecture Overview

This repository is a pnpm monorepo with a React + Phaser frontend and a Node.js/Express backend. Realtime updates are delivered via Socket.IO. Task Master + MCP are used to orchestrate agentic workflows.

## High-Level Components

- `packages/server` — Express API, Socket.IO server, GitHub integration, in-memory + Prisma persistence.
- `packages/frontend` — React app embedding Phaser scenes (`WorldMapScene`, `MainScene`).
- `packages/shared` — Shared types/utilities.

## Backend

- Express app with security middleware (helmet, CORS, compression, JSON parsing).
- Health endpoints: `GET /healthz`, `GET /readyz`.
- Bug lifecycle API (`/api/villages/:id/bugs`, `/api/bugs/:id/assign`, `/api/bugs/:id/status`).
- GitHub webhooks for issues open/close → bug spawn/resolve.
- Socket.IO namespace broadcasts to rooms `village:{id}` and `agent:{id}`:
  - `work_stream`, `agent_update`, `bug_bot_spawn`, `bug_bot_progress`, `bug_bot_resolved`.
- Prisma (SQLite by default) for `bug_bots` when `DATABASE_URL` is set, otherwise in-memory fallback.
- Metrics: `GET /api/metrics` (JSON), `GET /metrics` (Prometheus text).

## Frontend

- Phaser scenes render an isometric grid village with agents and bug bots.
- WebSocketService batches incoming events onto `requestAnimationFrame` to reduce layout churn.
- Spatial hashing + culling keep draw calls constant under load.
- Role-based UI affords settings access and badges.

## Data Flow

1. Webhooks or GitHub polling create/resolve bugs.
2. Services emit Socket.IO events to `village:{id}` rooms.
3. Frontend receives events and updates sprites; users can assign bugs via drag/click → REST.

## Diagrams

```
Client (React+Phaser) ──WS/HTTP──> Server (Express + Socket.IO) ──> GitHub
                               │                         │
                               └───── Prisma (SQLite) ◄──┘
```

