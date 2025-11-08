import { getAgentController } from './controller';
import type { MCPAgentController, RunCommandOptions } from './controller';
import type { AgentLifecycleState, AgentRuntime, AgentStreamEvent } from './types';
import { ensureActiveSession, endActiveSession, appendEvent } from './session';
import { emitToAgent } from '../realtime/io';
import { WorkStreamEventDTO } from '../events/dto';
import { jsonSafe } from '../utils/json';
import { inc, observe } from '../metrics';
import { audit } from '../audit/logger';

export class AgentManager {
  private controller: MCPAgentController;
  private runtimes = new Map<string, AgentRuntime>();

  constructor(controller?: MCPAgentController) {
    this.controller = controller ?? getAgentController();
  }

  get(agentId: string | number): AgentRuntime {
    const id = String(agentId);
    const existing = this.runtimes.get(id);
    if (existing) return existing;
    const rt: AgentRuntime = {
      agentId: id,
      state: 'disconnected',
      updatedAt: Date.now(),
      backoffAttempt: 0,
      retryTimer: null,
    };
    this.runtimes.set(id, rt);
    return rt;
  }

  private setState(id: string, next: AgentLifecycleState, extra?: Partial<AgentRuntime>) {
    const rt = this.get(id);
    rt.state = next;
    rt.updatedAt = Date.now();
    Object.assign(rt, extra || {});
    emitToAgent(id, 'agent_update', { agentId: id, state: next });
  }

  private clearRetryTimer(id: string) {
    const rt = this.get(id);
    if (rt.retryTimer) {
      clearTimeout(rt.retryTimer);
      rt.retryTimer = null;
    }
  }

  async connectAgent(agentId: string | number, opts?: { restart?: boolean }) {
    const id = String(agentId);
    const rt = this.get(id);
    this.clearRetryTimer(id);
    this.setState(id, rt.state === 'disconnected' ? 'connecting' : 'reconnecting');
    inc('agent_connect_attempt_total');
    const t0 = Date.now();
    try {
      // Fetch and cache villageId for work stream broadcasting
      if (!rt.villageId) {
        const villageId = await this.getAgentVillageId(id);
        if (villageId) rt.villageId = villageId;
      }

      const session = await ensureActiveSession(id, { restart: opts?.restart });
      const { ok, sessionToken } = await this.controller.start(id);
      if (!ok) throw new Error('start failed');
      this.setState(id, 'connected', {
        sessionToken,
        connectedAt: Date.now(),
        backoffAttempt: 0,
        sessionId: String(session.id),
      });
      observe('agent_connect_ms', Date.now() - t0);
      inc('agent_connected_total');
      audit.log('agent.connected', { agentId: id, sessionId: String(session.id) });
      return { ok: true as const, sessionId: String(session.id), sessionToken };
    } catch (e: any) {
      const lastError = e?.message || String(e);
      this.setState(id, 'reconnecting', { lastError });
      inc('agent_connect_error_total');
      audit.log('agent.connect_error', { agentId: id, error: lastError });
      // schedule retry with exponential backoff + jitter
      const attempt = (rt.backoffAttempt ?? 0) + 1;
      rt.backoffAttempt = attempt;
      const base = 500; // ms
      const cap = 10000; // 10s
      const backoff = Math.min(cap, Math.floor(base * Math.pow(2, attempt - 1)));
      const jitter = Math.floor(Math.random() * 200);
      this.clearRetryTimer(id);
      rt.retryTimer = setTimeout(() => {
        // Only retry if still not connected
        const cur = this.get(id);
        if (cur.state === 'connected' || cur.state === 'disconnected') return;
        inc('agent_reconnect_attempt_total');
        void this.connectAgent(id).catch(() => {});
      }, backoff + jitter);
      return { ok: false as const, error: lastError };
    }
  }

  async disconnectAgent(agentId: string | number) {
    const id = String(agentId);
    try {
      await this.controller.stop(id);
    } finally {
      await endActiveSession(id).catch(() => {});
      this.clearRetryTimer(id);
      this.setState(id, 'disconnected', { backoffAttempt: 0 });
      inc('agent_disconnected_total');
      audit.log('agent.disconnected', { agentId: id });
    }
    return { ok: true as const };
  }

  async runTool(agentId: string | number, toolName: string, params?: Record<string, unknown>) {
    const id = String(agentId);
    const onEvent = (evt: AgentStreamEvent) => this.handleStreamEvent(id, evt);
    const opts: RunCommandOptions = { onEvent };
    inc('agent_command_total', { kind: 'tool', tool: toolName });
    return this.controller.runCommand(id, 'run_tool', { tool: toolName, params }, opts);
  }

  async runTask(agentId: string | number, description: string) {
    const id = String(agentId);
    const onEvent = (evt: AgentStreamEvent) => this.handleStreamEvent(id, evt);
    const opts: RunCommandOptions = { onEvent };
    inc('agent_command_total', { kind: 'task' });
    return this.controller.runCommand(id, 'run_task', { description }, opts);
  }

  private async handleStreamEvent(agentId: string, evt: AgentStreamEvent) {
    // Persist to DB (best-effort)
    const rtForPersist = this.get(agentId);
    if (rtForPersist.sessionId) {
      await appendEvent(rtForPersist.sessionId, evt.type, evt.message).catch(() => {});
    }

    // Broadcast to both agent room AND village room for UI consumption
    const timestamp = new Date().toISOString();
    const emitWorkStream = (dto: WorkStreamEventDTO) => {
      const payload = jsonSafe({ agentId, ...dto });
      // Emit to agent room for agent-specific subscribers
      emitToAgent(agentId, 'work_stream', payload);
      // Also emit to village room so all village viewers see agent activity
      // Fetch villageId from agent record (cached in runtime if available)
      const rt = this.get(agentId);
      if (rt.villageId) {
        const { emitToVillage } = require('../realtime/io');
        emitToVillage(rt.villageId, 'work_stream', payload);
      } else {
        // Fallback: look up villageId from database
        void this.getAgentVillageId(agentId)
          .then((villageId) => {
            if (villageId) {
              rt.villageId = villageId; // Cache for next time
              const { emitToVillage } = require('../realtime/io');
              emitToVillage(villageId, 'work_stream', payload);
            }
          })
          .catch(() => {});
      }
    };

    if (evt.type === 'progress') {
      const dto: WorkStreamEventDTO = {
        event_type: 'progress',
        content: `${Math.round((evt.progress ?? 0) * 100)}%`,
        metadata: null,
        timestamp,
      };
      emitWorkStream(dto);

      // Update bug bot progress if agent is working on bugs
      if (evt.progress !== undefined) {
        void this.updateAssignedBugProgress(agentId, evt.progress);
      }
    } else if (evt.type === 'status' || evt.type === 'log') {
      const dto: WorkStreamEventDTO = {
        event_type: evt.type,
        content: evt.message ?? evt.type,
        metadata: null,
        timestamp,
      };
      emitWorkStream(dto);
    } else if (evt.type === 'error') {
      const dto: WorkStreamEventDTO = {
        event_type: 'error',
        content: evt.message || 'unknown',
        metadata: null,
        timestamp,
      };
      emitWorkStream(dto);
      this.setState(agentId, 'error', { lastError: evt.message || 'unknown error' });
      inc('agent_error_total');
      audit.log('agent.error', { agentId, error: evt.message || 'unknown' });
    }
  }

  private async getAgentVillageId(agentId: string): Promise<string | null> {
    try {
      const { prisma } = await import('../db/prisma');
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { villageId: true },
      });
      return agent?.villageId ?? null;
    } catch {
      return null;
    }
  }

  private async updateAssignedBugProgress(agentId: string, progress: number): Promise<void> {
    try {
      const { updateBugProgress } = await import('../bugs/service');
      await updateBugProgress(agentId, progress);
    } catch (e) {
      // Best-effort, don't throw
      void e;
    }
  }

  // Graceful resource cleanup: stop all agents, end sessions, clear timers
  async shutdown() {
    const tasks: Array<Promise<any>> = [];
    for (const [id] of this.runtimes.entries()) {
      try {
        this.clearRetryTimer(id);
      } catch {
        // Timer already cleared; nothing to do.
      }
      tasks.push(this.controller.stop(id).catch(() => {}));
      tasks.push(endActiveSession(id).catch(() => {}));
      this.setState(id, 'disconnected', {
        backoffAttempt: 0,
        sessionToken: undefined,
        sessionId: undefined,
      });
    }
    await Promise.allSettled(tasks);
    try {
      await this.controller.shutdown?.();
    } catch {
      // Controller shutdown is best effort during teardown.
    }
  }
}

export const defaultAgentManager = new AgentManager();
