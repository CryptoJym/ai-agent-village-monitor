import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentManager } from '../agents/manager';
import type { MCPAgentController, CommandArgs, CommandResult, RunCommandOptions } from '../agents/controller';

class TrackController implements MCPAgentController {
  stopped: Array<string> = [];
  async start(_agentId: string | number) { return { ok: true, sessionToken: 't' }; }
  async stop(agentId: string | number) { this.stopped.push(String(agentId)); return { ok: true }; }
  async runCommand(_agentId: string | number, _command: string, _args?: CommandArgs, _opts?: RunCommandOptions): Promise<CommandResult> { return { ok: true }; }
}

describe('AgentManager.shutdown', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  it('clears timers, stops agents, and ends sessions', async () => {
    const ctrl = new TrackController();
    const mgr = new AgentManager(ctrl);
    const id1 = 's1';
    const id2 = 's2';
    await mgr.connectAgent(id1);
    await mgr.connectAgent(id2);
    // schedule a reconnect timer by forcing error state
    const rt = (mgr as any).get(id1);
    rt.state = 'reconnecting';
    (mgr as any).connectAgent(id1).catch(() => {});
    await vi.advanceTimersByTimeAsync(10);
    await mgr.shutdown();
    const r1 = (mgr as any).get(id1);
    const r2 = (mgr as any).get(id2);
    expect(r1.state).toBe('disconnected');
    expect(r2.state).toBe('disconnected');
    expect(r1.retryTimer).toBeNull();
    expect(ctrl.stopped).toEqual(expect.arrayContaining([id1, id2]));
  });
});

