# @ai-agent-village-monitor/control-plane

Central API layer for AI Agent Village Monitor, providing handlers for session management, runner fleet coordination, update pipeline control, and real-time WebSocket communication.

## Overview

The Control Plane package serves as the API gateway between:

- **Frontend UI** - Dashboard and session management interfaces
- **External Systems** - CI/CD integrations, monitoring tools
- **Runner Fleet** - Individual runner instances executing AI sessions
- **Update Pipeline** - Version management and rollout coordination

## Installation

```bash
pnpm add @ai-agent-village-monitor/control-plane
```

## Components

### SessionHandler

Manages session lifecycle operations.

```typescript
import { SessionHandler, SessionHandlerConfig } from '@ai-agent-village-monitor/control-plane';

const config: SessionHandlerConfig = {
  maxSessionsPerOrg: 10,
  defaultTimeoutMinutes: 60,
  sessionDataTtlHours: 24,
};

const handler = new SessionHandler(config);

// Create a session
const result = await handler.createSession({
  orgId: 'org-123',
  providerId: 'codex',
  repo: {
    url: 'https://github.com/example/repo',
    branch: 'main',
  },
  task: 'Implement user authentication',
});

if (result.success) {
  console.log(`Session created: ${result.data.sessionId}`);
}

// Get session details
const session = await handler.getSession(sessionId);

// List sessions for an org
const sessions = await handler.listSessions('org-123', { page: 1, pageSize: 20 });

// Session lifecycle operations
await handler.stopSession(sessionId, 'User requested');
await handler.pauseSession(sessionId);
await handler.resumeSession(sessionId);
```

#### Approval Workflow

```typescript
// Request approval from user
handler.requestApproval(
  sessionId,
  'merge',
  'Merge PR #123',
  { prNumber: 123 }
);

// Listen for approval requests
handler.on('approval_requested', ({ sessionId, approval }) => {
  console.log(`Approval needed: ${approval.action}`);
});

// Resolve an approval
await handler.resolveApproval(sessionId, {
  approvalId: 'approval-123',
  decision: 'allow',
  reason: 'Approved after code review',
});
```

### RunnerHandler

Manages runner fleet registration and coordination.

```typescript
import { RunnerHandler, RunnerHandlerConfig } from '@ai-agent-village-monitor/control-plane';

const config: RunnerHandlerConfig = {
  heartbeatTimeoutMs: 30000,
  maxRunnersPerOrg: 10,
  defaultCapacity: 5,
};

const handler = new RunnerHandler(config);

// Register a runner
const result = await handler.registerRunner({
  hostname: 'runner-01.local',
  capabilities: {
    providers: ['codex', 'claude_code', 'gemini_cli'],
    maxConcurrentSessions: 5,
    features: ['gpu', 'sandbox'],
  },
  metadata: { region: 'us-west-2' },
});

// Process heartbeats
await handler.handleHeartbeat({
  runnerId: 'runner-123',
  timestamp: new Date().toISOString(),
  activeSessions: ['session-1', 'session-2'],
  load: {
    cpuPercent: 45,
    memoryPercent: 60,
    diskPercent: 30,
  },
  runtimeVersions: {
    codex: '1.2.0',
    claude_code: '3.5.0',
    gemini_cli: '2.0.0',
    omnara: '1.0.0',
  },
});

// Get fleet status
const fleet = await handler.listRunners({ page: 1, pageSize: 50 });
const runnerInfo = await handler.getRunner('runner-123');

// Manage runner state
await handler.drainRunner('runner-123');
await handler.deregisterRunner('runner-123');
```

### UpdatePipelineHandler

Controls version management and rollout operations.

```typescript
import { UpdatePipelineHandler, UpdatePipelineHandlerConfig } from '@ai-agent-village-monitor/control-plane';

const config: UpdatePipelineHandlerConfig = {
  enableAutoRollout: true,
  defaultChannel: 'stable',
  canaryDurationMinutes: 60,
};

const handler = new UpdatePipelineHandler(config);

// Get available versions
const versions = await handler.getVersions('codex');

// Get builds
const builds = await handler.getBuilds({ status: 'known_good' });

// Register a new build
await handler.registerBuild({
  buildId: 'build-001',
  runnerVersion: '2.0.0',
  builtAt: new Date(),
  runtimeVersions: {
    codex: '1.2.0',
    claude_code: '3.5.0',
    gemini_cli: '2.0.0',
    omnara: '1.0.0',
  },
});

// Manage rollouts
const rollout = await handler.initiateRollout({
  buildId: 'build-001',
  channel: 'stable',
});

await handler.advanceRollout(rollout.data.rolloutId);
await handler.pauseRollout(rollout.data.rolloutId);
await handler.resumeRollout(rollout.data.rolloutId);
await handler.cancelRollout(rollout.data.rolloutId, 'Issue detected');

// Configure org runtime preferences
await handler.updateOrgRuntimeConfig('org-123', {
  channel: 'stable',
  autoUpgrade: true,
  betaOptIn: false,
});
```

### WebSocketServerManager

Provides real-time communication for session monitoring.

```typescript
import { WebSocketServerManager, WebSocketServerConfig } from '@ai-agent-village-monitor/control-plane';
import { createServer } from 'http';

const httpServer = createServer();

const config: WebSocketServerConfig = {
  heartbeatIntervalMs: 30000,
  authRequired: true,
};

const wsManager = new WebSocketServerManager(httpServer, config);

// Handle client connections
wsManager.on('connection', (clientId) => {
  console.log(`Client connected: ${clientId}`);
});

// Handle client authentication
wsManager.on('authenticated', ({ clientId, orgId }) => {
  console.log(`Client ${clientId} authenticated for org ${orgId}`);
});

// Handle session subscriptions
wsManager.on('session_subscribed', ({ clientId, sessionId }) => {
  console.log(`Client ${clientId} subscribed to session ${sessionId}`);
});

// Handle terminal input
wsManager.on('terminal_input', ({ clientId, sessionId, data }) => {
  // Forward input to session
  console.log(`Terminal input for ${sessionId}: ${data}`);
});

// Broadcast session events
wsManager.broadcastSessionEvent(sessionId, 'state_change', {
  previousState: 'RUNNING',
  newState: 'WAITING_FOR_APPROVAL',
});

// Send terminal output
wsManager.sendTerminalData(sessionId, 'Command output...\n');

// Send approval notifications
wsManager.sendApprovalRequest(sessionId, {
  approvalId: 'approval-123',
  action: 'merge',
  description: 'Merge PR #456',
  requestedAt: new Date().toISOString(),
});
```

## API Response Format

All handlers return consistent `ApiResponse<T>` responses:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    duration?: number;
  };
}
```

### Error Handling

```typescript
const result = await handler.createSession(request);

if (!result.success) {
  switch (result.error?.code) {
    case 'SESSION_LIMIT_EXCEEDED':
      console.log('Too many active sessions');
      break;
    case 'INVALID_PROVIDER':
      console.log('Provider not supported');
      break;
    case 'VALIDATION_ERROR':
      console.log('Invalid request:', result.error.details);
      break;
    default:
      console.log('Error:', result.error?.message);
  }
}
```

## Events

### SessionHandler Events

| Event | Description |
|-------|-------------|
| `session_created` | New session created |
| `session_started` | Session execution started |
| `session_completed` | Session finished |
| `session_failed` | Session failed with error |
| `state_changed` | Session state transition |
| `approval_requested` | Approval required for action |
| `approval_resolved` | Approval decision made |

### RunnerHandler Events

| Event | Description |
|-------|-------------|
| `runner_registered` | New runner joined fleet |
| `runner_deregistered` | Runner removed from fleet |
| `runner_online` | Runner came online |
| `runner_offline` | Runner went offline |
| `runner_draining` | Runner entering drain mode |

### UpdatePipelineHandler Events

| Event | Description |
|-------|-------------|
| `version_discovered` | New provider version detected |
| `build_registered` | New build added to registry |
| `rollout_started` | Rollout initiated |
| `rollout_advanced` | Rollout moved to next stage |
| `rollout_completed` | Rollout reached 100% |
| `rollout_cancelled` | Rollout aborted |

### WebSocketServerManager Events

| Event | Description |
|-------|-------------|
| `connection` | Client connected |
| `disconnection` | Client disconnected |
| `authenticated` | Client authenticated |
| `session_subscribed` | Client subscribed to session |
| `session_unsubscribed` | Client unsubscribed |
| `terminal_input` | Terminal input received |

## WebSocket Message Types

### Client to Server

```typescript
// Subscribe to session updates
{ type: 'subscribe_session', sessionId: 'session-123', messageId: '...', timestamp: '...' }

// Unsubscribe from session
{ type: 'unsubscribe_session', sessionId: 'session-123', messageId: '...', timestamp: '...' }

// Send terminal input
{ type: 'terminal_input', sessionId: 'session-123', data: 'ls -la\n', messageId: '...', timestamp: '...' }
```

### Server to Client

```typescript
// Session state change
{ type: 'session', sessionId: 'session-123', action: 'state_change', data: {...}, timestamp: '...' }

// Terminal output
{ type: 'terminal', sessionId: 'session-123', action: 'output', data: '...', timestamp: '...' }

// Approval required
{ type: 'approval_required', sessionId: 'session-123', approval: {...}, messageId: '...', timestamp: '...' }

// Error
{ type: 'error', code: 'UNAUTHORIZED', message: 'Authentication required', timestamp: '...' }
```

## Validation Schemas

Request validation using Zod schemas:

```typescript
import {
  CreateSessionRequestSchema,
  PaginationParamsSchema,
  RegisterRunnerRequestSchema,
  ResolveApprovalRequestSchema,
  OrgRuntimeConfigRequestSchema,
  RunnerHeartbeatSchema,
} from '@ai-agent-village-monitor/control-plane';

// Validate a request
const result = CreateSessionRequestSchema.safeParse(requestBody);
if (!result.success) {
  console.log('Validation errors:', result.error.issues);
}
```

## Type Guards

```typescript
import {
  isWsMessage,
  isWsTerminalInput,
  isWsSubscribeSession,
  isWsUnsubscribeSession,
} from '@ai-agent-village-monitor/control-plane';

// Handle incoming WebSocket messages
if (isWsMessage(message)) {
  if (isWsTerminalInput(message)) {
    // Handle terminal input
  } else if (isWsSubscribeSession(message)) {
    // Handle subscription
  }
}
```

## Session States

```
CREATED -> QUEUED -> RUNNING -> COMPLETED
                  -> WAITING_FOR_APPROVAL -> RUNNING
                  -> PAUSED_BY_HUMAN -> RUNNING
                  -> FAILED
                  -> TIMED_OUT
```

## Configuration

### SessionHandlerConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxSessionsPerOrg` | number | 10 | Max concurrent sessions per org |
| `defaultTimeoutMinutes` | number | 60 | Default session timeout |
| `sessionDataTtlHours` | number | 24 | Session data retention |

### RunnerHandlerConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `heartbeatTimeoutMs` | number | 30000 | Heartbeat timeout |
| `maxRunnersPerOrg` | number | 10 | Max runners per org |
| `defaultCapacity` | number | 5 | Default session capacity |

### UpdatePipelineHandlerConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableAutoRollout` | boolean | false | Auto-rollout new builds |
| `defaultChannel` | string | 'stable' | Default release channel |
| `canaryDurationMinutes` | number | 60 | Canary testing duration |

### WebSocketServerConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `heartbeatIntervalMs` | number | 30000 | WebSocket heartbeat interval |
| `authRequired` | boolean | true | Require authentication |

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## License

MIT
