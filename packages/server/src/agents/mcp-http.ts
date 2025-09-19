import type {
  CommandArgs,
  CommandResult,
  MCPAgentController,
  RunCommandOptions,
  StreamEvent,
} from './controller';

export class HttpMCPAgentController implements MCPAgentController {
  constructor(
    private endpoint: string,
    private apiKey?: string,
  ) {}

  private async post(path: string, body: unknown): Promise<any> {
    const url = this.endpoint.replace(/\/$/, '') + path;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`MCP HTTP ${res.status}: ${txt || res.statusText}`);
    }
    return res.json().catch(() => ({}));
  }

  async start(agentId: string | number): Promise<{ ok: boolean; sessionToken?: string }> {
    const out = await this.post('/agents/start', { agentId });
    return { ok: !!out?.ok, sessionToken: out?.sessionToken };
  }
  async stop(agentId: string | number): Promise<{ ok: boolean }> {
    const out = await this.post('/agents/stop', { agentId });
    return { ok: !!out?.ok };
  }
  async runCommand(
    agentId: string | number,
    command: string,
    args?: CommandArgs,
    opts?: RunCommandOptions,
  ): Promise<CommandResult> {
    // Prefer SSE/streaming if listener provided
    if (opts?.onEvent) {
      const url = this.endpoint.replace(/\/$/, '') + '/agents/command/stream';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ agentId, command, args }),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('text/event-stream') && (res as any).body) {
        // Try to parse basic SSE: lines like 'data: {json}\n\n'
        const reader = (res as any).body.getReader?.();
        if (reader) {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += new TextDecoder().decode(value);
            let idx: number;
            while ((idx = buffer.indexOf('\n\n')) >= 0) {
              const chunk = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 2);
              const line = chunk.split('\n').find((l) => l.startsWith('data:')) || '';
              const json = line.replace(/^data:\s*/, '');
              try {
                const evt = JSON.parse(json) as StreamEvent;
                opts.onEvent?.(evt);
              } catch {
                // Ignore malformed SSE chunks; stream continues.
              }
            }
          }
          return { ok: true };
        }
      }
      // Fallback to non-stream if SSE is unavailable
    }
    const out = await this.post('/agents/command', { agentId, command, args });
    if (Array.isArray(out?.events) && opts?.onEvent) {
      for (const e of out.events) opts.onEvent(e as StreamEvent);
    }
    return { ok: !!out?.ok, output: out?.output, error: out?.error };
  }

  async runTool(
    agentId: string | number,
    tool: string,
    params?: Record<string, unknown>,
    opts?: RunCommandOptions,
  ): Promise<CommandResult> {
    return this.runCommand(agentId, 'run_tool', { tool, params }, opts);
  }

  async runTask(
    agentId: string | number,
    description: string,
    opts?: RunCommandOptions,
  ): Promise<CommandResult> {
    return this.runCommand(agentId, 'run_task', { description }, opts);
  }
}
