# Village Monitor Agent Bridge

Connect your terminal-based AI agents (Claude Code, Aider, Codex, Cursor) to the Village Monitor for real-time visualization.

## Installation

```bash
# Install globally
npm install -g @ai-agent-village-monitor/bridge

# Or use with npx
npx @ai-agent-village-monitor/bridge
```

## Usage

### CLI

Wrap any AI agent command to stream its activity to Village Monitor:

```bash
# Wrap Claude Code
village-bridge --village my-village --type claude -- claude

# Wrap Aider with a custom name
village-bridge -v my-village -t aider -n "Backend-Aider" -- aider

# Wrap Codex in a specific directory
village-bridge -v prod -t codex -d /path/to/repo -- codex

# Use a custom server URL
village-bridge -s https://monitor.example.com -v my-village -t claude -- claude

# Enable verbose logging
village-bridge -v my-village -t custom --verbose -- ./my-custom-agent.sh
```

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--server` | `-s` | Village Monitor server URL | `http://localhost:4000` |
| `--village` | `-v` | Village ID to join | `default` |
| `--type` | `-t` | Agent type (claude, aider, codex, cursor, custom) | `claude` |
| `--name` | `-n` | Custom agent name | Auto-generated |
| `--dir` | `-d` | Working directory | Current directory |
| `--token` | | JWT auth token | None |
| `--verbose` | | Enable verbose logging | `false` |

### Programmatic API

```typescript
import { AgentBridge } from '@ai-agent-village-monitor/bridge';

const bridge = new AgentBridge({
  serverUrl: 'http://localhost:4000',
  villageId: 'my-village',
  agentType: 'claude',
  agentName: 'My Claude Agent',
  repoPath: process.cwd(),
  verbose: true,
});

// Connect to the server
await bridge.connect();

// Wrap a command
bridge.wrap('claude', ['--help']);

// Or wrap with custom arguments
bridge.wrap('aider', ['--model', 'gpt-4']);
```

## How It Works

1. **CLI Wrapping**: The bridge spawns the AI agent command as a child process
2. **Output Parsing**: stdout/stderr are parsed for activity patterns (file edits, commands, thinking)
3. **Real-time Streaming**: Detected events are streamed via WebSocket to Village Monitor
4. **Persistence**: Events are also batched and persisted via REST API
5. **Visualization**: The Village Monitor displays your agent's activity in real-time

## Supported Agent Types

| Type | CLI | Description |
|------|-----|-------------|
| `claude` | `claude` | Anthropic Claude Code CLI |
| `aider` | `aider` | Aider AI pair programmer |
| `codex` | `codex` | OpenAI Codex CLI |
| `cursor` | `cursor` | Cursor AI |
| `custom` | Any | Custom agents with generic parsing |

## Event Types

The bridge detects and streams these event types:

- `session_start` / `session_end` - Session lifecycle
- `thinking` - Agent is analyzing/planning
- `file_read` / `file_edit` / `file_create` / `file_delete` - File operations
- `command` - Shell command execution
- `tool_use` - Tool/function calls
- `search` - Code search operations
- `error` - Error messages
- `completed` - Task completion

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VILLAGE_SERVER_URL` | Default server URL |
| `VILLAGE_ID` | Default village ID |
| `VILLAGE_AUTH_TOKEN` | JWT authentication token |

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck
```

## License

MIT
