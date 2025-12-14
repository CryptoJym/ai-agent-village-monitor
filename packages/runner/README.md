# @ai-agent-village-monitor/runner

Multi-provider AI agent runner service for the AI Agent Village Monitor system.

## Overview

The Runner package provides the core orchestration layer for managing AI agent sessions across multiple providers (Codex, Claude Code, Gemini CLI, Omnara). It handles:

- Session lifecycle management
- Provider adapter abstraction
- Workspace isolation
- Terminal PTY streaming
- Resource monitoring
- Policy enforcement

## Installation

```bash
pnpm add @ai-agent-village-monitor/runner
```

## Usage

### Basic Runner Setup

```typescript
import { RunnerService, RunnerConfig } from '@ai-agent-village-monitor/runner';

const config: RunnerConfig = {
  maxConcurrentSessions: 10,
  sessionTimeout: 3600000, // 1 hour
  heartbeatInterval: 30000,
  workspacePath: '/var/lib/ai-agent-runner/workspaces',
  providers: ['codex', 'claude_code'],
};

const runner = new RunnerService(config);

// Start the runner
await runner.start();

// Listen for events
runner.on('session_started', (session) => {
  console.log(`Session ${session.sessionId} started`);
});

runner.on('session_completed', (session) => {
  console.log(`Session ${session.sessionId} completed`);
});
```

### Creating Sessions

```typescript
const session = await runner.createSession({
  sessionId: 'unique-session-id',
  orgId: 'organization-id',
  providerId: 'codex',
  repo: {
    url: 'https://github.com/example/repo',
    branch: 'main',
  },
  task: 'Implement user authentication',
});
```

### Session Manager

```typescript
import { SessionManager } from '@ai-agent-village-monitor/runner';

const manager = new SessionManager({
  maxConcurrentSessions: 20,
  sessionTimeout: 3600000,
  cleanupInterval: 60000,
});

// Create a session
const session = manager.createSession({
  sessionId: 'session-001',
  orgId: 'org-1',
  providerId: 'claude_code',
  repo: {
    url: 'https://github.com/example/repo',
    branch: 'main',
    commit: 'abc123',
  },
  workspacePath: '/tmp/workspace/session-001',
});

// Transition state
manager.transitionState('session-001', 'running');

// Update usage
manager.updateUsage('session-001', {
  tokensIn: 1000,
  tokensOut: 500,
  apiCalls: 5,
});

// List sessions
const sessions = manager.listSessions({
  orgId: 'org-1',
  state: 'running',
});
```

## Session States

Sessions follow this state machine:

```
CREATED -> RUNNING -> COMPLETED
                   -> FAILED
           RUNNING -> PAUSED_BY_HUMAN -> RUNNING
           RUNNING -> WAITING_FOR_APPROVAL -> RUNNING
```

Valid state transitions:
- `created` -> `running`
- `running` -> `paused_by_human`
- `running` -> `waiting_for_approval`
- `running` -> `completed`
- `running` -> `failed`
- `paused_by_human` -> `running`
- `waiting_for_approval` -> `running`

## Events

The runner emits the following events:

| Event | Description |
|-------|-------------|
| `started` | Runner service started |
| `stopped` | Runner service stopped |
| `session_created` | New session created |
| `session_started` | Session began execution |
| `session_completed` | Session finished successfully |
| `session_failed` | Session encountered an error |
| `state_changed` | Session state transitioned |
| `approval_required` | Session needs human approval |
| `output` | Terminal output received |

## Provider Adapters

The runner supports multiple AI providers through adapters:

```typescript
import { AdapterRegistry, createAdapter } from '@ai-agent-village-monitor/runner';

// Create an adapter for a provider
const adapter = createAdapter('claude_code', {
  apiKey: process.env.ANTHROPIC_API_KEY,
  modelVersion: 'claude-3-opus',
});

// Register with the runner
runner.registerAdapter(adapter);
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxConcurrentSessions` | number | 10 | Maximum simultaneous sessions |
| `sessionTimeout` | number | 3600000 | Session timeout in ms |
| `heartbeatInterval` | number | 30000 | Heartbeat interval in ms |
| `workspacePath` | string | `/tmp/workspaces` | Base path for workspaces |
| `providers` | ProviderId[] | `['codex']` | Enabled providers |

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## License

MIT
