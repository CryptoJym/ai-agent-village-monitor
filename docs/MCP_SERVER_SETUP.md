# MCP Server Setup Guide

## Overview

The AI Agent Village Monitor integrates with MCP (Model Context Protocol) servers to control and monitor AI agents in real-time. This guide explains how to connect your own MCP server to enable live agent work streams in the village interface.

---

## Architecture

```
AI Agent Village Monitor (Frontend)
         ↓ WebSocket
Express Server (Backend)
         ↓ HTTP/SSE
MCP Server (Your Implementation)
         ↓
AI Agents (Claude Code, etc.)
```

**Work Stream Flow:**
1. User triggers agent command via village UI
2. Backend calls MCP server HTTP API
3. MCP server streams events via Server-Sent Events (SSE)
4. Backend broadcasts events to frontend via WebSocket
5. ThreadTab UI displays live agent activity

---

## Quick Start

### 1. Environment Configuration

Add to your `.env` file:

```bash
# MCP Server Configuration
MCP_HTTP_ENDPOINT="http://localhost:4000"    # Your MCP server base URL
MCP_HTTP_API_KEY="your-secret-api-key"       # Optional: Bearer token for auth
```

### 2. Start Your MCP Server

Ensure your MCP server is running and accessible at the configured endpoint.

### 3. Restart the Backend

```bash
cd packages/server
pnpm dev
```

The backend will now use `HttpMCPAgentController` instead of the mock controller.

### 4. Verify Connection

Check logs for:
```
[info] Using MCP HTTP endpoint: http://localhost:4000
```

---

## MCP Server API Contract

Your MCP server must implement the following HTTP endpoints:

### POST /agents/start

Start an agent session.

**Request:**
```json
{
  "agentId": "agent-123"
}
```

**Response:**
```json
{
  "ok": true,
  "sessionToken": "sess_abc123xyz"
}
```

---

### POST /agents/stop

Stop an agent session.

**Request:**
```json
{
  "agentId": "agent-123"
}
```

**Response:**
```json
{
  "ok": true
}
```

---

### POST /agents/command

Execute a command (non-streaming).

**Request:**
```json
{
  "agentId": "agent-123",
  "command": "run_tool",
  "args": {
    "tool": "file_search",
    "params": {
      "query": "authentication"
    }
  }
}
```

**Response:**
```json
{
  "ok": true,
  "output": {
    "files": ["src/auth/middleware.ts"]
  },
  "events": [
    {
      "type": "log",
      "message": "Searching for: authentication"
    },
    {
      "type": "progress",
      "progress": 1.0
    }
  ]
}
```

---

### POST /agents/command/stream (Recommended)

Execute a command with Server-Sent Events streaming.

**Request Headers:**
```
Content-Type: application/json
Accept: text/event-stream
Authorization: Bearer your-api-key  (if MCP_HTTP_API_KEY is set)
```

**Request Body:**
```json
{
  "agentId": "agent-123",
  "command": "run_task",
  "args": {
    "description": "Fix the login form validation"
  }
}
```

**Response (SSE Stream):**
```
data: {"type":"log","message":"Starting task: Fix login form validation"}

data: {"type":"progress","progress":0.2}

data: {"type":"status","message":"Analyzing code..."}

data: {"type":"log","message":"Found validation logic in src/auth/login.ts"}

data: {"type":"progress","progress":0.5}

data: {"type":"log","message":"Applying fix..."}

data: {"type":"progress","progress":0.9}

data: {"type":"status","message":"Task complete"}

data: {"type":"progress","progress":1.0}

```

**SSE Format:**
- Each event is prefixed with `data: `
- Events are separated by double newlines (`\n\n`)
- JSON payload contains event type and data

---

## Event Types

Your MCP server should emit these event types during streaming:

### 1. Log Event
```json
{
  "type": "log",
  "message": "Searching for files matching 'auth'"
}
```

### 2. Progress Event
```json
{
  "type": "progress",
  "progress": 0.75,
  "data": {
    "step": "3 of 4",
    "currentTask": "Running tests"
  }
}
```

### 3. Status Event
```json
{
  "type": "status",
  "message": "Waiting for API response..."
}
```

### 4. Error Event
```json
{
  "type": "error",
  "message": "Failed to connect to database",
  "data": {
    "code": "ECONNREFUSED"
  }
}
```

---

## Example MCP Server Implementation

### Node.js/Express Example

```typescript
import express from 'express';

const app = express();
app.use(express.json());

// Authentication middleware
app.use((req, res, next) => {
  const apiKey = process.env.MCP_API_KEY;
  if (apiKey) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${apiKey}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  next();
});

// Start agent
app.post('/agents/start', async (req, res) => {
  const { agentId } = req.body;
  console.log(`Starting agent: ${agentId}`);

  // Your logic to start the agent session
  const sessionToken = generateSessionToken();

  res.json({ ok: true, sessionToken });
});

// Stop agent
app.post('/agents/stop', async (req, res) => {
  const { agentId } = req.body;
  console.log(`Stopping agent: ${agentId}`);

  // Your logic to stop the agent session

  res.json({ ok: true });
});

// Execute command with SSE streaming
app.post('/agents/command/stream', async (req, res) => {
  const { agentId, command, args } = req.body;

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send events
  const sendEvent = (event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    sendEvent({ type: 'log', message: `Executing ${command}` });
    sendEvent({ type: 'progress', progress: 0.1 });

    // Execute the actual command
    if (command === 'run_tool') {
      const { tool, params } = args;
      sendEvent({ type: 'status', message: `Running tool: ${tool}` });

      // Call your tool implementation
      const result = await runTool(agentId, tool, params, sendEvent);

      sendEvent({ type: 'log', message: 'Tool execution complete' });
    } else if (command === 'run_task') {
      const { description } = args;
      sendEvent({ type: 'status', message: 'Analyzing task...' });

      // Execute task logic
      await executeTask(agentId, description, sendEvent);

      sendEvent({ type: 'log', message: 'Task complete' });
    }

    sendEvent({ type: 'progress', progress: 1.0 });
    res.end();

  } catch (error) {
    sendEvent({
      type: 'error',
      message: error.message
    });
    res.end();
  }
});

// Non-streaming command endpoint (fallback)
app.post('/agents/command', async (req, res) => {
  const { agentId, command, args } = req.body;

  const events: any[] = [];
  const captureEvent = (evt: any) => events.push(evt);

  try {
    // Execute command and capture events
    const output = await executeCommand(agentId, command, args, captureEvent);

    res.json({
      ok: true,
      output,
      events
    });
  } catch (error) {
    res.json({
      ok: false,
      error: error.message,
      events
    });
  }
});

app.listen(4000, () => {
  console.log('MCP Server listening on http://localhost:4000');
});
```

---

## Integration with Claude Code

If you're using Claude Code as your MCP server:

### 1. Create a Claude Code MCP Server Wrapper

```typescript
// mcp-claude-wrapper.ts
import { spawn } from 'child_process';
import express from 'express';

const app = express();
app.use(express.json());

// Map of agentId -> Claude Code process
const agents = new Map();

app.post('/agents/start', async (req, res) => {
  const { agentId } = req.body;

  // Start Claude Code in headless mode
  const proc = spawn('claude', [
    '--headless',
    '--mcp-mode',
    '--agent-id', agentId
  ]);

  agents.set(agentId, proc);

  res.json({ ok: true, sessionToken: agentId });
});

app.post('/agents/command/stream', async (req, res) => {
  const { agentId, command, args } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  const proc = agents.get(agentId);
  if (!proc) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Agent not started' })}\n\n`);
    return res.end();
  }

  // Send command to Claude Code via stdin
  proc.stdin.write(JSON.stringify({ command, args }) + '\n');

  // Stream stdout as SSE events
  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        try {
          const event = JSON.parse(line);
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch {}
      }
    }
  });

  proc.on('close', () => {
    res.end();
  });
});

app.listen(4000);
```

### 2. Configure in .env

```bash
MCP_HTTP_ENDPOINT="http://localhost:4000"
```

---

## Testing Your MCP Server

### Manual Testing with curl

```bash
# Test start endpoint
curl -X POST http://localhost:4000/agents/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{"agentId":"test-agent-1"}'

# Test streaming command
curl -X POST http://localhost:4000/agents/command/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "agentId":"test-agent-1",
    "command":"run_tool",
    "args":{"tool":"echo","params":{"message":"Hello!"}}
  }'
```

### Integration Testing

1. Start your MCP server
2. Start the backend: `cd packages/server && pnpm dev`
3. Start the frontend: `cd packages/frontend && pnpm dev`
4. Open http://localhost:5173
5. Create an agent in a village
6. Click the agent sprite to open dialogue
7. Switch to "Control" tab
8. Run a command - you should see live streaming!

---

## Troubleshooting

### Issue: "Using mock controller"

**Symptom:** Logs show mock controller being used instead of HTTP controller.

**Solution:**
- Verify `MCP_HTTP_ENDPOINT` is set in `.env`
- Restart the backend server
- Check for typos in environment variable name

### Issue: "MCP HTTP 500: Connection refused"

**Symptom:** Backend can't connect to MCP server.

**Solution:**
- Verify MCP server is running: `curl http://localhost:4000/health`
- Check firewall rules
- Verify endpoint URL matches server port

### Issue: "401 Unauthorized"

**Symptom:** MCP server rejects requests.

**Solution:**
- Verify `MCP_HTTP_API_KEY` matches server configuration
- Check Authorization header format: `Bearer your-key-here`

### Issue: "No work stream events in UI"

**Symptom:** ThreadTab doesn't show agent activity.

**Solution:**
- Check browser console for WebSocket errors
- Verify SSE events are properly formatted (`data: {json}\n\n`)
- Enable debug logging: `DEBUG=mcp:* pnpm dev`

### Issue: "Events arrive but UI doesn't update"

**Symptom:** Backend logs show events but UI is static.

**Solution:**
- Check WebSocket connection in Network tab
- Verify frontend is subscribed to `work_stream` events
- Check for JavaScript errors in console

---

## Advanced Configuration

### Custom Event Handlers

Modify `packages/server/src/agents/manager.ts` to customize event handling:

```typescript
private async handleStreamEvent(agentId: string, evt: AgentStreamEvent) {
  // Add custom logic here
  if (evt.type === 'custom_event') {
    // Handle your custom event type
  }

  // Default handling continues...
}
```

### Multiple MCP Servers

To support different MCP servers per agent:

```typescript
// packages/server/src/agents/controller.ts
export function getAgentControllerForAgent(agentId: string): MCPAgentController {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  const endpoint = agent?.config?.mcpEndpoint || process.env.MCP_HTTP_ENDPOINT;

  if (endpoint) {
    return new HttpMCPAgentController(endpoint, process.env.MCP_HTTP_API_KEY);
  }
  return new MockMCPAgentController();
}
```

---

## Production Deployment

### Security Checklist

- ✅ Use HTTPS for MCP server in production
- ✅ Enable API key authentication (`MCP_HTTP_API_KEY`)
- ✅ Implement rate limiting on MCP endpoints
- ✅ Validate all incoming agentId values
- ✅ Use environment-specific endpoints (dev/staging/prod)
- ✅ Monitor MCP server health and uptime
- ✅ Implement request timeouts (30s recommended)

### Example Production Configuration

```bash
# Production .env
MCP_HTTP_ENDPOINT="https://mcp.yourdomain.com"
MCP_HTTP_API_KEY="${SECRET_MCP_API_KEY}"  # Use secrets manager
```

### Health Checks

Add to your MCP server:

```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeAgents: agents.size
  });
});
```

Monitor with:
```bash
curl https://mcp.yourdomain.com/health
```

---

## Reference Implementation

See example MCP server implementations:

- **Node.js/Express:** `examples/mcp-server-node/`
- **Python/FastAPI:** `examples/mcp-server-python/`
- **Go/Chi:** `examples/mcp-server-go/`

(TODO: Create these examples)

---

## Support

- **GitHub Issues:** [Report bugs or request features](https://github.com/CryptoJym/ai-agent-village-monitor/issues)
- **Documentation:** See `docs/ARCHITECTURE.md` for system overview
- **Code Reference:** `packages/server/src/agents/mcp-http.ts` for HTTP client implementation

---

**Next Steps:**
1. Implement your MCP server following the API contract
2. Configure `.env` with your endpoint
3. Test with curl commands
4. Integrate with the village UI
5. Monitor logs and troubleshoot as needed

Happy agent monitoring! 🏡🤖
