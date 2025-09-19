export type CommandArgs = Record<string, unknown> | undefined;

export type CommandResult = {
  ok: boolean;
  output?: unknown;
  error?: string;
};

export type StreamEvent = {
  type: 'log' | 'progress' | 'status' | 'error';
  message?: string;
  progress?: number;
  data?: unknown;
};

export type RunCommandOptions = {
  onEvent?: (evt: StreamEvent) => void;
};

export interface MCPAgentController {
  start(agentId: string | number): Promise<{ ok: boolean; sessionToken?: string }>;
  stop(agentId: string | number): Promise<{ ok: boolean }>;
  runCommand(
    agentId: string | number,
    command: string,
    args?: CommandArgs,
    opts?: RunCommandOptions,
  ): Promise<CommandResult>;
  runTool?(
    agentId: string | number,
    tool: string,
    params?: Record<string, unknown>,
    opts?: RunCommandOptions,
  ): Promise<CommandResult>;
  runTask?(
    agentId: string | number,
    description: string,
    opts?: RunCommandOptions,
  ): Promise<CommandResult>;
  shutdown?(): Promise<void> | void;
}

// Minimal mock controller; replace with real MCP implementation in Task 51
export class MockMCPAgentController implements MCPAgentController {
  async start(_agentId: string | number): Promise<{ ok: boolean; sessionToken?: string }> {
    return { ok: true, sessionToken: Math.random().toString(36).slice(2) };
  }
  async stop(_agentId: string | number): Promise<{ ok: boolean }> {
    return { ok: true };
  }
  async runCommand(
    _agentId: string | number,
    command: string,
    args?: CommandArgs,
    opts?: RunCommandOptions,
  ): Promise<CommandResult> {
    // Simulate a brief operation with lightweight event stream
    opts?.onEvent?.({ type: 'log', message: `running ${command}` });
    await new Promise((r) => setTimeout(r, 5));
    opts?.onEvent?.({ type: 'progress', progress: 0.5, data: { command } });
    await new Promise((r) => setTimeout(r, 5));
    opts?.onEvent?.({ type: 'log', message: `${command} complete` });
    return { ok: true, output: { command, args, echo: true } };
  }
  async runTool(
    _agentId: string | number,
    tool: string,
    params?: Record<string, unknown>,
    opts?: RunCommandOptions,
  ): Promise<CommandResult> {
    opts?.onEvent?.({ type: 'status', message: `tool:${tool} start` });
    await new Promise((r) => setTimeout(r, 5));
    opts?.onEvent?.({ type: 'progress', progress: 0.5, data: params });
    await new Promise((r) => setTimeout(r, 5));
    return { ok: true, output: { tool, params, result: 'ok' } };
  }
  async runTask(
    _agentId: string | number,
    description: string,
    opts?: RunCommandOptions,
  ): Promise<CommandResult> {
    opts?.onEvent?.({ type: 'status', message: 'task: start' });
    await new Promise((r) => setTimeout(r, 5));
    opts?.onEvent?.({ type: 'log', message: description.slice(0, 32) });
    return { ok: true, output: { summary: `done: ${description.slice(0, 32)}` } };
  }
  async shutdown() {
    /* no-op for mock */
  }
}

// Factory that selects a controller implementation based on environment
export function getAgentController(): MCPAgentController {
  const endpoint = process.env.MCP_HTTP_ENDPOINT;
  if (endpoint) {
    // Lazy require to avoid import if unused in tests
    const { HttpMCPAgentController } = require('./mcp-http');
    return new HttpMCPAgentController(endpoint, process.env.MCP_HTTP_API_KEY);
  }
  return new MockMCPAgentController();
}
