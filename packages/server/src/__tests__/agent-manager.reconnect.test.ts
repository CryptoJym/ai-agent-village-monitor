import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentManager } from '../agents/manager';
import type {
  MCPAgentController,
  CommandArgs,
  CommandResult,
  RunCommandOptions,
} from '../agents/controller';

class FlakyController implements MCPAgentController {
  attempts = 0;
  async start(_agentId: string | number): Promise<{ ok: boolean; sessionToken?: string }> {
    this.attempts += 1;
    if (this.attempts < 3) throw new Error('transient');
    return { ok: true, sessionToken: 'tok' };
  }
  async stop(_agentId: string | number): Promise<{ ok: boolean }> {
    return { ok: true };
  }
  async runCommand(
    _agentId: string | number,
    _command: string,
    _args?: CommandArgs,
    _opts?: RunCommandOptions,
  ): Promise<CommandResult> {
    return { ok: true };
  }
}

describe('AgentManager reconnect/backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0); // no jitter for determinism
  });

  it('retries with exponential backoff and eventually connects', async () => {
    const ctrl = new FlakyController();
    const mgr = new AgentManager(ctrl);
    const id = 'a-1';

    // First connect attempt fails and schedules retry
    const res = await mgr.connectAgent(id);
    expect(res.ok).toBe(false);
    let rt = (mgr as any).get(id);
    expect(rt.state).toBe('reconnecting');
    expect(rt.backoffAttempt).toBe(1);

    // Advance to next retry (500ms)
    await vi.advanceTimersByTimeAsync(500);

    // Second attempt fails -> schedules next
    rt = (mgr as any).get(id);
    expect(rt.backoffAttempt).toBe(2);
    expect(rt.state === 'reconnecting' || rt.state === 'connecting').toBeTruthy();

    // Advance to next retry (1000ms)
    await vi.advanceTimersByTimeAsync(1000);

    // Third attempt succeeds
    rt = (mgr as any).get(id);
    expect(rt.state).toBe('connected');
    expect(ctrl.attempts).toBeGreaterThanOrEqual(3);

    // Disconnect cancels timers and resets state
    await mgr.disconnectAgent(id);
    rt = (mgr as any).get(id);
    expect(rt.state).toBe('disconnected');
    expect(rt.backoffAttempt).toBe(0);
    expect(rt.retryTimer).toBeNull();
  });
});
