# Update-Pipeline Integration Plan

> Task #4 from `execution-plane` tag
> Status: Draft v1.0
> Created: 2024-12-16

## Executive Summary

This document defines how the `@ai-agent-village-monitor/update-pipeline` package integrates with the server and execution plane. The update-pipeline provides version watching, canary testing, progressive rollouts, and post-update sweep capabilities for AI provider runtimes.

## Table of Contents

1. [Architecture Decision](#1-architecture-decision)
2. [Component Placement](#2-component-placement)
3. [Integration Points](#3-integration-points)
4. [API Surface](#4-api-surface)
5. [Data Storage](#5-data-storage)
6. [Safety & Rollback](#6-safety--rollback)
7. [Canary Metrics Storage](#7-canary-metrics-storage)
8. [Implementation Phases](#8-implementation-phases)
9. [Minimal Code Path](#9-minimal-code-path)

---

## 1. Architecture Decision

### Where Should VersionWatcher/RolloutController Run?

| Option                              | Pros                                                                 | Cons                                                  | Verdict                  |
| ----------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------ |
| **A. Server Worker (same process)** | Simple deployment, shared DB connection, immediate event propagation | Crashes affect main server, resource contention       | **Selected for Phase 1** |
| **B. Dedicated Microservice**       | Isolation, independent scaling, fault tolerance                      | Complex deployment, network latency, additional infra | Phase 2+                 |
| **C. Background Job Worker**        | Uses existing BullMQ infrastructure, scheduled execution             | Less real-time, requires queue infrastructure         | Hybrid possible          |

### Decision: Server Worker (Phase 1)

For the initial implementation, run `UpdatePipeline` as a server-side singleton with:

- **Lazy initialization**: Start only when `UPDATE_PIPELINE_ENABLED=true`
- **Graceful shutdown**: Clean timer teardown on SIGTERM
- **Non-blocking**: All operations async with timeouts
- **Feature-flagged**: No production impact when disabled

**Future consideration**: As scale increases, migrate to dedicated service with message queue for inter-service communication.

---

## 2. Component Placement

```
packages/
├── server/
│   └── src/
│       └── update-pipeline/
│           ├── bootstrap.ts      # Singleton initialization
│           ├── router.ts         # REST API endpoints
│           └── service.ts        # Business logic wrapper
│
├── update-pipeline/              # Core library (existing)
│   └── src/
│       ├── UpdatePipeline.ts     # Main orchestrator
│       ├── version/              # VersionWatcher
│       ├── rollout/              # RolloutController
│       ├── canary/               # CanaryRunner
│       ├── registry/             # KnownGoodRegistry
│       └── sweep/                # SweepManager
```

### Bootstrap Flow

```typescript
// packages/server/src/update-pipeline/bootstrap.ts

import { UpdatePipeline } from '@ai-agent-village-monitor/update-pipeline';

let pipeline: UpdatePipeline | null = null;

export async function initUpdatePipeline(): Promise<UpdatePipeline | null> {
  if (process.env.UPDATE_PIPELINE_ENABLED !== 'true') {
    console.log('[update-pipeline] Disabled via env flag');
    return null;
  }

  pipeline = new UpdatePipeline({
    autoCanary: process.env.UPDATE_PIPELINE_AUTO_CANARY === 'true',
    autoRollout: false, // Always manual approval
    autoSweep: false, // Always manual trigger
  });

  await pipeline.start();
  console.log('[update-pipeline] Started');

  return pipeline;
}

export function getUpdatePipeline(): UpdatePipeline | null {
  return pipeline;
}

export function shutdownUpdatePipeline(): void {
  if (pipeline) {
    pipeline.stop();
    pipeline = null;
  }
}
```

---

## 3. Integration Points

### 3.1 Server Startup

```typescript
// packages/server/src/index.ts (modification)

import { initUpdatePipeline, shutdownUpdatePipeline } from './update-pipeline/bootstrap';

async function main() {
  const app = createApp();

  // Initialize update pipeline (if enabled)
  await initUpdatePipeline();

  const server = app.listen(PORT);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    shutdownUpdatePipeline();
    server.close();
  });
}
```

### 3.2 Event Integration with Socket.IO

The update-pipeline emits events that should propagate to connected frontends:

| UpdatePipeline Event   | Socket.IO Event            | Room    |
| ---------------------- | -------------------------- | ------- |
| `new_version_detected` | `update_version_detected`  | `admin` |
| `canary_started`       | `update_canary_started`    | `admin` |
| `canary_completed`     | `update_canary_completed`  | `admin` |
| `rollout_initiated`    | `update_rollout_started`   | `admin` |
| `rollout_completed`    | `update_rollout_completed` | `admin` |
| `rollback_initiated`   | `update_rollback`          | `admin` |

### 3.3 Runner Heartbeat Integration

Runners report their installed runtime versions via heartbeat. This feeds into VersionWatcher:

```typescript
// In runner heartbeat handler
pipeline
  .getVersionWatcher()
  .registerHeartbeatVersion(runtimeReport.providerId, runtimeReport.version);
```

---

## 4. API Surface

### 4.1 Read-Only Status API (Phase 1)

```
GET /api/update-pipeline/status
Authorization: Bearer <token>
Role: admin

Response 200:
{
  "running": true,
  "versionWatcherActive": true,
  "activeCanaryTests": 0,
  "activeRollouts": 1,
  "activeSweeps": 0,
  "knownVersions": {
    "claude_code": "1.2.3",
    "codex": "2.0.0",
    "gemini_cli": null
  },
  "recommendedBuilds": {
    "stable": "build-abc123",
    "beta": "build-def456"
  }
}
```

### 4.2 Version Discovery API

```
GET /api/update-pipeline/versions
Authorization: Bearer <token>
Role: admin

Response 200:
{
  "items": [
    {
      "providerId": "claude_code",
      "version": "1.2.3",
      "releasedAt": "2024-12-16T00:00:00Z",
      "sourceUrl": "https://npmjs.com/package/@anthropic-ai/claude-code",
      "canaryPassed": true,
      "canaryPassedAt": "2024-12-15T12:00:00Z"
    }
  ]
}
```

### 4.3 Rollout Management API (Phase 2)

```
POST /api/update-pipeline/rollouts
Authorization: Bearer <token>
Role: admin

Body:
{
  "buildId": "build-abc123",
  "channel": "stable"
}

Response 201:
{
  "rolloutId": "uuid",
  "state": "rolling_out",
  "currentPercentage": 1,
  "startedAt": "2024-12-16T00:00:00Z"
}
```

```
POST /api/update-pipeline/rollouts/:id/pause
POST /api/update-pipeline/rollouts/:id/resume
POST /api/update-pipeline/rollouts/:id/advance
POST /api/update-pipeline/rollouts/:id/rollback

Body (rollback only):
{
  "reason": "Critical bug in new version"
}
```

---

## 5. Data Storage

### 5.1 In-Memory State (Phase 1)

For Phase 1, all state is in-memory within the UpdatePipeline singleton:

- Known versions (Map)
- Active rollouts (Map)
- Event log (Array, last 10K events)

**Limitation**: State lost on server restart.

### 5.2 Persistent Storage (Phase 2)

Add Prisma models for durability:

```prisma
model RuntimeVersion {
  id            String   @id @default(uuid())
  providerId    String   // claude_code, codex, gemini_cli
  version       String
  releasedAt    DateTime
  sourceUrl     String?
  canaryPassed  Boolean  @default(false)
  canaryPassedAt DateTime?
  createdAt     DateTime @default(now())

  @@unique([providerId, version])
  @@index([providerId])
}

model RunnerBuild {
  id              String   @id @default(uuid())
  buildId         String   @unique
  runnerVersion   String
  builtAt         DateTime
  runtimeVersions Json     // { claude_code: "1.2.3", codex: "2.0.0" }
  knownGoodFor    String[] // providers this build is known-good for
  createdAt       DateTime @default(now())

  @@index([buildId])
}

model ActiveRollout {
  id                String   @id @default(uuid())
  rolloutId         String   @unique
  targetBuildId     String
  channel           String   // stable, beta, pinned
  state             String   // pending, rolling_out, paused, completed, rolled_back
  currentPercentage Int      @default(0)
  startedAt         DateTime
  lastUpdatedAt     DateTime
  affectedOrgIds    String[]
  error             String?
  createdAt         DateTime @default(now())

  @@index([channel])
  @@index([state])
}
```

---

## 6. Safety & Rollback

### 6.1 Automatic Rollback Thresholds

```typescript
const ROLLBACK_THRESHOLDS = {
  maxFailureRate: 0.1, // 10% session failures
  maxDisconnectRate: 0.15, // 15% unexpected disconnects
  minSessionCount: 100, // Wait for statistical significance
};
```

### 6.2 Rollout Stages (Stable Channel)

| Stage | Percentage | Duration | Gate          |
| ----- | ---------- | -------- | ------------- |
| 1     | 1%         | 1 hour   | Metrics check |
| 2     | 10%        | 2 hours  | Metrics check |
| 3     | 50%        | 4 hours  | Metrics check |
| 4     | 100%       | -        | Complete      |

### 6.3 Manual Override

Admins can:

- **Pause**: Halt rollout at current percentage
- **Resume**: Continue paused rollout
- **Rollback**: Revert all affected orgs to previous build

### 6.4 Enterprise Org Handling

Organizations with `enterprise.approvalRequired = true`:

- Only receive 100% deployments (skip progressive stages)
- Require explicit approval before deployment
- Can maintain pinned versions indefinitely

---

## 7. Canary Metrics Storage

### 7.1 Metrics Schema

```typescript
interface CanaryMetrics {
  totalTests: number;
  passed: number;
  failed: number;
  errored: number;
  skipped: number;
  passRate: number; // 0.0 - 1.0
  avgSessionStartMs: number; // Latency
  avgTimeToFirstOutputMs: number;
  disconnectRate: number; // 0.0 - 1.0
}
```

### 7.2 Storage Options

| Option         | Phase | Notes                                    |
| -------------- | ----- | ---------------------------------------- |
| **In-memory**  | 1     | Simple, loses data on restart            |
| **Redis**      | 2     | Fast, supports TTL for automatic cleanup |
| **PostgreSQL** | 2     | Full history, complex queries            |

### 7.3 Metrics API

```
GET /api/update-pipeline/canary/:buildId/metrics
Authorization: Bearer <token>
Role: admin

Response 200:
{
  "buildId": "build-abc123",
  "status": "passed",
  "startedAt": "2024-12-16T00:00:00Z",
  "completedAt": "2024-12-16T01:00:00Z",
  "metrics": {
    "totalTests": 50,
    "passed": 48,
    "failed": 2,
    "passRate": 0.96,
    "avgSessionStartMs": 450,
    "disconnectRate": 0.02
  }
}
```

---

## 8. Implementation Phases

### Phase 1: Read-Only Foundation (This Task)

**Scope:**

- [x] Integration plan document
- [ ] Bootstrap module (`server/src/update-pipeline/bootstrap.ts`)
- [ ] Status API endpoint (`GET /api/update-pipeline/status`)
- [ ] Environment variable gating (`UPDATE_PIPELINE_ENABLED`)
- [ ] Basic tests

**Deliverables:**

- `docs/UPDATE_PIPELINE_INTEGRATION_PLAN.md` (this file)
- `packages/server/src/update-pipeline/bootstrap.ts`
- `packages/server/src/update-pipeline/router.ts`

### Phase 2: Version Discovery

**Scope:**

- Wire VersionWatcher to upstream sources
- Versions API endpoints
- Socket.IO event integration
- Persistent storage (Prisma)

### Phase 3: Canary Infrastructure

**Scope:**

- CanaryRunner integration
- Test suite execution
- Metrics collection and storage
- Pass/fail automation

### Phase 4: Rollout Management

**Scope:**

- Full RolloutController API
- Org assignment logic
- Automatic progression with metrics gates
- Rollback flows

### Phase 5: Post-Update Sweeps

**Scope:**

- SweepManager integration
- Repo opt-in management
- GitHub workflow triggers

---

## 9. Minimal Code Path

### 9.1 Files to Create

```
packages/server/src/update-pipeline/
├── bootstrap.ts      # Pipeline singleton management
├── router.ts         # Express router with /status endpoint
└── index.ts          # Re-exports
```

### 9.2 Minimal Bootstrap Implementation

```typescript
// packages/server/src/update-pipeline/bootstrap.ts

import { UpdatePipeline, PipelineStatus } from '@ai-agent-village-monitor/update-pipeline';

let pipeline: UpdatePipeline | null = null;

export async function initUpdatePipeline(): Promise<void> {
  if (process.env.UPDATE_PIPELINE_ENABLED !== 'true') {
    console.log('[update-pipeline] Disabled (set UPDATE_PIPELINE_ENABLED=true to enable)');
    return;
  }

  try {
    pipeline = new UpdatePipeline({
      autoCanary: process.env.UPDATE_PIPELINE_AUTO_CANARY === 'true',
      autoRollout: false,
      autoSweep: false,
      versionWatcher: {
        enablePolling: process.env.UPDATE_PIPELINE_POLLING === 'true',
      },
    });

    await pipeline.start();
    console.log('[update-pipeline] Initialized and running');
  } catch (err) {
    console.error('[update-pipeline] Failed to initialize:', err);
    pipeline = null;
  }
}

export function getUpdatePipelineStatus(): PipelineStatus | null {
  return pipeline?.getStatus() ?? null;
}

export function shutdownUpdatePipeline(): void {
  if (pipeline) {
    pipeline.stop();
    pipeline = null;
    console.log('[update-pipeline] Shutdown complete');
  }
}

export function isUpdatePipelineEnabled(): boolean {
  return pipeline !== null;
}
```

### 9.3 Minimal Router Implementation

```typescript
// packages/server/src/update-pipeline/router.ts

import { Router } from 'express';
import { getUpdatePipelineStatus, isUpdatePipelineEnabled } from './bootstrap';

export const updatePipelineRouter = Router();

/**
 * GET /api/update-pipeline/status
 *
 * Returns current update pipeline status.
 * Requires admin role.
 */
updatePipelineRouter.get('/status', (req, res) => {
  if (!isUpdatePipelineEnabled()) {
    return res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Update pipeline is not enabled',
      },
    });
  }

  const status = getUpdatePipelineStatus();
  if (!status) {
    return res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Update pipeline status unavailable',
      },
    });
  }

  return res.json(status);
});

/**
 * GET /api/update-pipeline/health
 *
 * Simple health check for the update pipeline.
 */
updatePipelineRouter.get('/health', (req, res) => {
  const enabled = isUpdatePipelineEnabled();
  const status = enabled ? getUpdatePipelineStatus() : null;

  return res.json({
    enabled,
    running: status?.running ?? false,
    timestamp: new Date().toISOString(),
  });
});
```

---

## Appendix A: Environment Variables

| Variable                           | Default   | Description                           |
| ---------------------------------- | --------- | ------------------------------------- |
| `UPDATE_PIPELINE_ENABLED`          | `false`   | Enable update pipeline                |
| `UPDATE_PIPELINE_AUTO_CANARY`      | `false`   | Auto-run canary tests on new versions |
| `UPDATE_PIPELINE_POLLING`          | `false`   | Enable upstream version polling       |
| `UPDATE_PIPELINE_POLL_INTERVAL_MS` | `3600000` | Polling interval (1 hour)             |

## Appendix B: Related Documents

- [CONTROL_PLANE_INTEGRATION_PLAN.md](./CONTROL_PLANE_INTEGRATION_PLAN.md) - Control plane WebSocket integration
- [EXECUTION_PLANE_TRACE_MATRIX.md](./EXECUTION_PLANE_TRACE_MATRIX.md) - Spec implementation status
- [packages/update-pipeline/README.md](../packages/update-pipeline/README.md) - Core library documentation

## Appendix C: Risk Assessment

| Risk                                    | Likelihood | Impact | Mitigation                                    |
| --------------------------------------- | ---------- | ------ | --------------------------------------------- |
| Version watcher overloads upstream APIs | Low        | Medium | Rate limiting, exponential backoff            |
| Bad rollout affects production          | Medium     | High   | Canary testing, staged rollout, auto-rollback |
| Memory leak in long-running pipeline    | Low        | Medium | Periodic restart, event log pruning           |
| Stale version data after restart        | Medium     | Low    | Immediate version check on startup            |

---

**Document Status**: Draft - Pending review
**Last Updated**: 2024-12-16
**Author**: AI Agent (Task #4 Execution)
