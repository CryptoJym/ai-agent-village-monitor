# Claude Code Integration Guide

## Overview

The AI Agent Village Monitor can connect to **Claude Code** sessions using the official **Model Context Protocol (MCP)** SDK. This allows you to visualize real AI agents working in your village interface, similar to how Omnara monitors agent activity.

**What this enables:**

- 🎯 **Real-time monitoring** of Claude Code agent sessions
- 📊 **Live work streams** displayed in the village ThreadTab UI
- 🐛 **Bug bot progress tracking** as Claude fixes issues
- 🏘️ **Multi-agent visualization** across different repositories

---

## Architecture

```
Claude Code Session (MCP Server)
         ↕ stdio (MCP Protocol)
AI Agent Village Monitor (MCP Client)
         ↓ WebSocket
Village Frontend UI
         ↓
ThreadTab displays real-time agent activity
```

**How it works:**

1. **Village spawns MCP client** - When you create an agent in the village, the backend spawns an MCP client
2. **Client connects to Claude session** - Uses stdio transport to connect to Claude Code's MCP server
3. **Listens for activity** - Receives notifications about tool calls, progress updates, and messages
4. **Broadcasts to UI** - Streams events via WebSocket to the village interface
5. **Real-time visualization** - ThreadTab shows what Claude is doing in real-time

---

## Quick Start

### 1. Configure Environment

Create or update your `.env` file:

```bash
# Enable MCP Client Mode (for Claude Code integration)
MCP_CLIENT_MODE=true

# Specify the MCP server command to spawn
# This should be the command that starts your MCP server
MCP_SERVER_COMMAND=npx

# Arguments for the MCP server
# These are passed to the command above
MCP_SERVER_ARGS=-y,@modelcontextprotocol/server-everything

# Optional: For Claude Code specifically
# MCP_SERVER_COMMAND=claude-code-mcp-server
# MCP_SERVER_ARGS=--session,{AGENT_ID}
```

### 2. Install Dependencies

The MCP SDK is already installed:

```bash
cd packages/server
pnpm install  # Includes @modelcontextprotocol/sdk
```

### 3. Start the Backend

```bash
cd packages/server
pnpm dev
```

You should see:

```
[MCP] Using MCP Client with command: npx -y @modelcontextprotocol/server-everything
```

### 4. Create an Agent in the Village

1. Open the village UI
2. Click "Create Agent"
3. The backend will spawn an MCP client and connect to Claude
4. Open the DialogueUI → ThreadTab to see real-time agent activity

---

## Configuration Options

### MCP Client Mode

When `MCP_CLIENT_MODE=true`, the village acts as an **MCP client** that connects to Claude Code or other MCP servers.

#### Environment Variables

| Variable             | Description                     | Default                                      | Example                  |
| -------------------- | ------------------------------- | -------------------------------------------- | ------------------------ |
| `MCP_CLIENT_MODE`    | Enable MCP client mode          | `false`                                      | `true`                   |
| `MCP_SERVER_COMMAND` | Command to spawn MCP server     | `npx`                                        | `claude-code-mcp-server` |
| `MCP_SERVER_ARGS`    | Comma-separated args for server | `-y,@modelcontextprotocol/server-everything` | `--session,{AGENT_ID}`   |

**Note:** The `{AGENT_ID}` placeholder is automatically replaced with the actual agent ID when spawning.

### Example Configurations

#### For Claude Code

```bash
MCP_CLIENT_MODE=true
MCP_SERVER_COMMAND=claude-code-mcp-server
MCP_SERVER_ARGS=--session,{AGENT_ID},--workspace,/path/to/repo
```

#### For Generic MCP Server

```bash
MCP_CLIENT_MODE=true
MCP_SERVER_COMMAND=npx
MCP_SERVER_ARGS=-y,@modelcontextprotocol/server-everything
```

#### For Custom MCP Server

```bash
MCP_CLIENT_MODE=true
MCP_SERVER_COMMAND=node
MCP_SERVER_ARGS=./my-mcp-server.js,--agent-id,{AGENT_ID}
```

---

## How It Works Internally

### MCPClientController

The `MCPClientController` class (in `packages/server/src/agents/mcp-client.ts`) implements the `MCPAgentController` interface:

**Key methods:**

1. **`start(agentId)`** - Spawns an MCP server via stdio and connects the client

   ```typescript
   const transport = new StdioClientTransport({
     command: 'claude-code-mcp-server',
     args: ['--session', agentId],
   });
   const client = new Client({ name: 'village-monitor', version: '1.0.0' });
   await client.connect(transport);
   ```

2. **`runCommand(agentId, command, args, opts)`** - Calls tools on the MCP server

   ```typescript
   const result = await client.callTool({
     name: command,
     arguments: args || {},
   });
   ```

3. **Event Streaming** - Listens for notifications and forwards to AgentManager

   ```typescript
   client.setNotificationHandler({
     method: 'notifications/message',
     handler: (notification) => {
       opts?.onEvent({ type: 'log', message: notification.params.message });
     },
   });
   ```

4. **`stop(agentId)`** - Closes the MCP client and transport
   ```typescript
   await client.close();
   await transport.close();
   ```

### Integration with AgentManager

The `AgentManager` (in `packages/server/src/agents/manager.ts`):

1. Uses `getAgentController()` factory to create the appropriate controller
2. Calls `controller.start(agentId)` when connecting agents
3. Receives events via `opts.onEvent` callback
4. Broadcasts events to village via WebSocket (`emitToVillage`)
5. Updates bug bot progress automatically

---

## Testing

### Test with Mock MCP Server

```bash
# Install example MCP server
npm install -g @modelcontextprotocol/server-everything

# Configure .env
echo "MCP_CLIENT_MODE=true" >> .env
echo "MCP_SERVER_COMMAND=npx" >> .env
echo "MCP_SERVER_ARGS=-y,@modelcontextprotocol/server-everything" >> .env

# Start backend
cd packages/server && pnpm dev
```

### Test with Claude Code

1. Start a Claude Code session in a repository
2. Find the MCP server process (usually `claude-code-mcp-server`)
3. Configure the village to connect:

   ```bash
   MCP_CLIENT_MODE=true
   MCP_SERVER_COMMAND=claude-code-mcp-server
   MCP_SERVER_ARGS=--session,{AGENT_ID}
   ```

4. Create an agent in the village
5. Watch the ThreadTab for real-time Claude activity

---

## Troubleshooting

### "Agent not connected" Error

**Problem:** `runCommand` fails with "Agent not connected. Call start() first."

**Solution:** Ensure `start(agentId)` is called before running commands. The AgentManager should handle this automatically.

### MCP Server Process Not Spawning

**Problem:** No MCP server process appears

**Solutions:**

- Check `MCP_SERVER_COMMAND` is correct and executable
- Verify `MCP_SERVER_ARGS` syntax (comma-separated, no spaces)
- Check server logs: `cd packages/server && pnpm dev | grep MCP`

### No Events in ThreadTab

**Problem:** ThreadTab remains empty despite agent being "connected"

**Possible causes:**

1. **WebSocket not connected** - Check browser console for WebSocket errors
2. **Agent not in village room** - Ensure agent's `villageId` is set correctly
3. **MCP server not sending notifications** - Check if the server implements `notifications/message` and `notifications/progress`

**Debug steps:**

```bash
# Check backend logs
cd packages/server && pnpm dev

# Look for:
[MCP] Using MCP Client with command: ...
[audit] {"type":"agent.connected", ...}
```

### Performance Issues

**Problem:** High CPU/memory with multiple agents

**Solution:** Each agent spawns its own MCP server process. For many agents, consider:

- Using a shared MCP server with session IDs
- Implementing connection pooling
- Setting a max agent limit per village

---

## Comparison: MCP Client vs HTTP Mode

| Feature       | MCP Client Mode                | HTTP Mode                      |
| ------------- | ------------------------------ | ------------------------------ |
| **Use Case**  | Claude Code, stdio MCP servers | Custom HTTP/SSE servers        |
| **Protocol**  | Official MCP over stdio        | Custom HTTP API                |
| **Transport** | stdio pipes                    | HTTP + Server-Sent Events      |
| **Setup**     | Spawns process per agent       | Connects to running server     |
| **Best For**  | Real agent monitoring          | Distributed/cloud deployments  |
| **Config**    | `MCP_CLIENT_MODE=true`         | `MCP_HTTP_ENDPOINT=http://...` |

**When to use MCP Client Mode:**

- ✅ Monitoring Claude Code sessions
- ✅ Running agents locally
- ✅ Testing with example MCP servers
- ✅ Direct process control

**When to use HTTP Mode:**

- ✅ Production deployments with load balancing
- ✅ Cloud-hosted agent services
- ✅ Multiple village instances sharing agents
- ✅ Centralized agent management

---

## Advanced: Custom MCP Server

Want to create a custom MCP server for the village to monitor?

**Example Server (Node.js):**

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'my-agent-server', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

// Define a tool
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'fix_bug',
      description: 'Fix a bug in the codebase',
      inputSchema: {
        type: 'object',
        properties: {
          issueId: { type: 'string' },
        },
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'fix_bug') {
    // Send progress notification
    await server.notification({
      method: 'notifications/progress',
      params: { progress: 0.5, message: 'Analyzing issue...' },
    });

    // Do work...
    await doWork(request.params.arguments);

    // Send completion
    await server.notification({
      method: 'notifications/message',
      params: { message: 'Bug fixed!' },
    });

    return { content: [{ type: 'text', text: 'Success' }] };
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Connect the village:**

```bash
MCP_CLIENT_MODE=true
MCP_SERVER_COMMAND=node
MCP_SERVER_ARGS=./my-agent-server.js
```

---

## Next Steps

1. **Configure for Claude Code** - Set up `.env` to connect to your Claude sessions
2. **Test with example server** - Use `@modelcontextprotocol/server-everything` for testing
3. **Customize event handling** - Modify `MCPClientController` for your specific needs
4. **Add custom tools** - Create MCP servers with domain-specific tools for your agents

**Questions?** Check the [MCP documentation](https://github.com/modelcontextprotocol/servers) or file an issue.
