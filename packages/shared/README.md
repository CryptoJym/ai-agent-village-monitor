# @ai-agent-village-monitor/shared

Shared types, events, schemas, and utilities for the AI Agent Village Monitor monorepo.

## Overview

The shared package provides the foundation layer that all other packages depend on:

- **Provider Adapter Types** - Interfaces and types for multi-provider CLI abstraction
- **Runner Types** - Session lifecycle, workspace, and command types
- **Events** - Typed event definitions for provider and runner events
- **Schemas** - Zod validation schemas
- **State Machine** - XState-based agent state machine
- **Generation** - Tilemap and village generation utilities
- **Utilities** - Common helpers like `nowIso()`

## Installation

```bash
pnpm add @ai-agent-village-monitor/shared
```

## Provider Adapter Types

Types for building multi-provider CLI abstractions (Codex, Claude Code, Gemini CLI, Omnara).

```typescript
import type {
  ProviderId,
  ProviderAdapter,
  Capability,
  TaskSpec,
  PolicySpec,
  StartSessionArgs,
  DetectionResult,
  AdapterConfig,
} from '@ai-agent-village-monitor/shared';

// Provider identifiers
const provider: ProviderId = 'codex';  // 'codex' | 'claude_code' | 'gemini_cli' | 'omnara'

// Capability declaration
const caps: Capability = {
  ptyStreaming: true,
  structuredEdits: 'diff',
  supportsMCP: true,
  supportsNonInteractive: true,
  supportsPlanAndExecute: true,
  supportsPRFlow: 'full',
  maxContextHint: '200k tokens',
};

// Task specification
const task: TaskSpec = {
  title: 'Add authentication',
  goal: 'Implement JWT-based authentication',
  constraints: ['Do not modify existing tests'],
  acceptance: ['All tests pass', 'JWT tokens are validated'],
  roomPath: 'src/auth',
  branchName: 'feature/auth',
};

// Policy specification
const policy: PolicySpec = {
  shellAllowlist: ['npm', 'git', 'node'],
  shellDenylist: ['rm -rf', 'sudo'],
  requiresApprovalFor: ['merge', 'deps_add'],
  networkMode: 'restricted',
};
```

### Implementing a Provider Adapter

```typescript
import type { ProviderAdapter, ProviderId, DetectionResult, Capability, StartSessionArgs, ProviderEvent } from '@ai-agent-village-monitor/shared';

class MyAdapter implements ProviderAdapter {
  readonly id: ProviderId = 'codex';

  async detect(): Promise<DetectionResult> {
    return { installed: true, version: '1.0.0' };
  }

  async capabilities(): Promise<Capability> {
    return {
      ptyStreaming: true,
      structuredEdits: 'diff',
      supportsMCP: true,
      supportsNonInteractive: true,
      supportsPlanAndExecute: true,
      supportsPRFlow: 'full',
    };
  }

  async startSession(args: StartSessionArgs): Promise<{ sessionPid: number }> {
    // Start the CLI process
    return { sessionPid: 12345 };
  }

  async sendInput(data: string): Promise<void> {
    // Send input to the running process
  }

  async stop(): Promise<void> {
    // Stop the process gracefully
  }

  onEvent(cb: (evt: ProviderEvent) => void): void {
    // Subscribe to events
  }

  offEvent(cb: (evt: ProviderEvent) => void): void {
    // Unsubscribe from events
  }
}
```

## Runner Types

Types for the execution plane that runs AI coding sessions.

```typescript
import type {
  SessionState,
  SessionConfig,
  SessionRuntimeState,
  WorkspaceRef,
  RepoRef,
  CheckoutSpec,
  ApprovalRequest,
  ApprovalCategory,
  UsageMetrics,
  RunnerInfo,
  SessionCommand,
  TerminalInput,
  BillingInfo,
  PlanTier,
} from '@ai-agent-village-monitor/shared';

// Session states
const state: SessionState = 'RUNNING';
// States: 'CREATED' | 'PREPARING_WORKSPACE' | 'STARTING_PROVIDER' | 'RUNNING' |
//         'WAITING_FOR_APPROVAL' | 'PAUSED_BY_HUMAN' | 'STOPPING' | 'COMPLETED' | 'FAILED'

// Repository reference
const repo: RepoRef = {
  provider: 'github',
  owner: 'example',
  name: 'repo',
  defaultBranch: 'main',
};

// Checkout specification
const checkout: CheckoutSpec = { type: 'branch', ref: 'feature/auth' };
// Or: { type: 'commit', sha: 'abc123' }
// Or: { type: 'tag', tag: 'v1.0.0' }

// Full session configuration
const config: SessionConfig = {
  sessionId: 'session-123',
  orgId: 'org-456',
  userId: 'user-789',
  repoRef: repo,
  checkout: checkout,
  roomPath: 'src/api',
  providerId: 'codex',
  task: {
    title: 'Fix bug',
    goal: 'Fix the authentication bug',
    constraints: [],
    acceptance: ['Tests pass'],
  },
  policy: {
    shellAllowlist: ['npm', 'git'],
    shellDenylist: [],
    requiresApprovalFor: ['merge'],
    networkMode: 'restricted',
  },
  billing: {
    plan: 'team',
    orgId: 'org-456',
    limits: {
      maxConcurrency: 5,
      maxSessionDurationMs: 3600000,
    },
  },
};

// Session commands
const commands: SessionCommand[] = [
  { type: 'START', config },
  { type: 'INPUT', input: { sessionId: 'session-123', data: 'npm test', mode: 'line' } },
  { type: 'PAUSE' },
  { type: 'RESUME' },
  { type: 'APPROVE', approvalId: 'approval-1', decision: 'allow', note: 'Approved' },
  { type: 'STOP', graceful: true },
];
```

## Events

Typed event definitions for observability and state tracking.

### Provider Events

```typescript
import type { ProviderEvent } from '@ai-agent-village-monitor/shared';

const events: ProviderEvent[] = [
  // Terminal output
  { type: 'OUTPUT', stream: 'stdout', data: 'Hello world\n', timestamp: Date.now() },
  { type: 'OUTPUT', stream: 'stderr', data: 'Error\n', timestamp: Date.now() },

  // Session lifecycle
  { type: 'STARTED', pid: 12345, timestamp: Date.now() },
  { type: 'EXITED', code: 0, signal: null, timestamp: Date.now() },
  { type: 'ERROR', error: 'Connection failed', timestamp: Date.now() },

  // Approvals
  {
    type: 'APPROVAL_NEEDED',
    category: 'merge',
    summary: 'Merge PR #123',
    risk: 'low',
    timestamp: Date.now()
  },

  // Progress
  { type: 'PROGRESS', message: 'Running tests...', percent: 50, timestamp: Date.now() },

  // Files and commands
  { type: 'FILE_CHANGED', path: 'src/index.ts', operation: 'modified', timestamp: Date.now() },
  { type: 'SHELL_COMMAND', command: 'npm test', timestamp: Date.now() },
];
```

### Runner Events

```typescript
import type { RunnerEvent } from '@ai-agent-village-monitor/shared';

const runnerEvents: RunnerEvent[] = [
  // Session lifecycle
  { type: 'SESSION_CREATED', sessionId: 'session-123', timestamp: Date.now() },
  { type: 'SESSION_STARTED', sessionId: 'session-123', timestamp: Date.now() },
  { type: 'SESSION_COMPLETED', sessionId: 'session-123', exitCode: 0, timestamp: Date.now() },
  { type: 'SESSION_FAILED', sessionId: 'session-123', error: 'Timeout', timestamp: Date.now() },

  // State changes
  {
    type: 'STATE_CHANGED',
    sessionId: 'session-123',
    from: 'RUNNING',
    to: 'WAITING_FOR_APPROVAL',
    timestamp: Date.now()
  },

  // Approvals
  {
    type: 'APPROVAL_REQUESTED',
    sessionId: 'session-123',
    approvalId: 'approval-1',
    category: 'merge',
    summary: 'Merge PR',
    risk: 'low',
    timestamp: Date.now()
  },
  {
    type: 'APPROVAL_RESOLVED',
    sessionId: 'session-123',
    approvalId: 'approval-1',
    decision: 'allow',
    timestamp: Date.now()
  },

  // Terminal output
  {
    type: 'TERMINAL_OUTPUT',
    sessionId: 'session-123',
    stream: 'stdout',
    data: 'Output data',
    timestamp: Date.now()
  },

  // Workspace operations
  {
    type: 'WORKSPACE_CREATED',
    sessionId: 'session-123',
    workspaceId: 'ws-123',
    path: '/tmp/workspaces/ws-123',
    timestamp: Date.now()
  },

  // Metrics
  {
    type: 'METRICS_UPDATE',
    sessionId: 'session-123',
    metrics: {
      agentSeconds: 120,
      terminalKb: 50,
      filesTouched: 10,
      commandsRun: 5,
      approvalsRequested: 1,
    },
    timestamp: Date.now()
  },
];
```

## Validation Schemas

Zod schemas for runtime validation.

```typescript
import {
  ProviderIdSchema,
  TaskSpecSchema,
  PolicySpecSchema,
  SessionConfigSchema,
  ApprovalRequestSchema,
} from '@ai-agent-village-monitor/shared';

// Validate provider ID
const result = ProviderIdSchema.safeParse('codex');
if (result.success) {
  console.log('Valid provider:', result.data);
}

// Validate session config
const configResult = SessionConfigSchema.safeParse(rawConfig);
if (!configResult.success) {
  console.log('Validation errors:', configResult.error.issues);
}
```

## State Machine

XState-based agent state machine for managing session lifecycle.

```typescript
import { agentMachine, type AgentContext, type AgentEvent } from '@ai-agent-village-monitor/shared';
import { createActor } from 'xstate';

// Create an actor from the machine
const actor = createActor(agentMachine, {
  input: {
    sessionId: 'session-123',
    providerId: 'codex',
  },
});

// Subscribe to state changes
actor.subscribe((state) => {
  console.log('State:', state.value);
});

// Start the actor
actor.start();

// Send events
actor.send({ type: 'START' });
actor.send({ type: 'OUTPUT', data: 'Hello' });
actor.send({ type: 'APPROVAL_NEEDED', category: 'merge', summary: 'Merge PR' });
actor.send({ type: 'APPROVE', decision: 'allow' });
actor.send({ type: 'COMPLETE' });
```

### React Integration

```typescript
import { useAgent } from '@ai-agent-village-monitor/shared';

function SessionComponent({ sessionId }: { sessionId: string }) {
  const { state, send, context } = useAgent({
    sessionId,
    providerId: 'codex',
  });

  return (
    <div>
      <p>State: {state}</p>
      <button onClick={() => send({ type: 'PAUSE' })}>Pause</button>
      <button onClick={() => send({ type: 'RESUME' })}>Resume</button>
    </div>
  );
}
```

## Utilities

Common utility functions.

```typescript
import { nowIso, type HealthStatus } from '@ai-agent-village-monitor/shared';

// Get current timestamp in ISO format
const timestamp = nowIso(); // "2024-01-15T10:30:00.000Z"

// Health status type
const health: HealthStatus = {
  status: 'ok',
  timestamp: nowIso(),
};
```

## Analytics Types

```typescript
import type { AnalyticsEvent, AnalyticsBatch } from '@ai-agent-village-monitor/shared';

const events: AnalyticsEvent[] = [
  { type: 'session_start', ts: Date.now(), userId: 'user-123' },
  { type: 'command_executed', ts: Date.now(), agentId: 'agent-1', command: 'npm test' },
  { type: 'dialogue_open', ts: Date.now(), source: 'toolbar' },
  { type: 'session_end', ts: Date.now(), durationMs: 60000 },
];

const batch: AnalyticsBatch = {
  events,
  clientId: 'client-123',
  consent: true,
};
```

## Generation Module

Village and tilemap generation utilities.

```typescript
import {
  generateBSP,
  generateRooms,
  generateCorridors,
  type RoomType,
  type TilemapData,
} from '@ai-agent-village-monitor/shared';

// Generate a village layout using BSP
const bspTree = generateBSP({
  width: 100,
  height: 100,
  minRoomSize: 10,
  maxDepth: 4,
});

// Generate rooms from BSP partitions
const rooms = generateRooms(bspTree, { padding: 2 });

// Connect rooms with corridors
const corridors = generateCorridors(rooms);
```

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## License

MIT
