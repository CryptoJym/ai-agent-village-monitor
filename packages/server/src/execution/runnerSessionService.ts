import { randomUUID } from 'node:crypto';
import type { ProviderId, RunnerEvent, SessionConfig, SessionRuntimeState } from '@shared/index';
import { emitToAgent, emitToVillage } from '../realtime/io';
import { prisma } from '../db/client';

type ManagedSession = {
  sessionId: string;
  agentId: string;
  villageId: string;
  providerId: ProviderId;
};

function providerToAgentType(providerId: ProviderId): 'claude' | 'codex' | 'custom' {
  if (providerId === 'codex') return 'codex';
  if (providerId === 'claude_code') return 'claude';
  return 'custom';
}

export type StartRunnerSessionInput = {
  villageId: string;
  agentName?: string;
  providerId: ProviderId;
  repoRef: SessionConfig['repoRef'];
  checkout: SessionConfig['checkout'];
  roomPath?: string;
  task: SessionConfig['task'];
  policy: SessionConfig['policy'];
  env?: Record<string, string>;
  orgId: string;
  userId?: string;
};

export class RunnerSessionService {
  private initPromise: Promise<void> | null = null;
  private runner: any | null = null;
  private sessionManager: any | null = null;
  private sessions: Map<string, ManagedSession> = new Map();

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    this.runner = await import('@ai-agent-village-monitor/runner');

    // Configure workspace manager before SessionManager initializes.
    const baseDir = process.env.RUNNER_WORKSPACE_DIR || '/tmp/ai-village-workspaces';
    const cacheDir = process.env.RUNNER_CACHE_DIR || '/tmp/ai-village-cache';
    this.runner.getWorkspaceManager({
      baseDir,
      cacheDir,
      shallowClone: true,
      maxCacheAge: 24 * 60 * 60 * 1000,
      maxCachedRepos: 50,
    });

    this.sessionManager = new this.runner.SessionManager({
      maxSessions: Number(process.env.RUNNER_MAX_SESSIONS || 10),
      usageTickIntervalMs: 30_000,
      sessionTimeoutMs: 60 * 60 * 1000,
    });

    await this.sessionManager.initialize();

    this.sessionManager.on('event', (evt: RunnerEvent) => {
      void this.handleRunnerEvent(evt);
    });
  }

  async shutdown(): Promise<void> {
    if (!this.sessionManager) return;
    await this.sessionManager.shutdown();
    this.sessions.clear();
  }

  async startSession(
    input: StartRunnerSessionInput,
  ): Promise<{ sessionId: string; agentId: string }> {
    await this.initialize();
    if (!this.runner || !this.sessionManager) throw new Error('Runner not initialized');

    if (input.providerId !== 'codex' && input.providerId !== 'claude_code') {
      throw new Error(`Provider not yet supported by server runner: ${input.providerId}`);
    }

    const sessionId = randomUUID();
    const agentId = `runner_${sessionId.slice(0, 8)}`;

    const sessionConfig: SessionConfig = {
      sessionId,
      orgId: input.orgId,
      userId: input.userId,
      providerId: input.providerId,
      repoRef: input.repoRef,
      checkout: input.checkout,
      roomPath: input.roomPath,
      task: input.task,
      policy: input.policy,
      billing: {
        plan: 'team',
        orgId: input.orgId,
        limits: { maxConcurrency: 5 },
      },
      env: input.env,
      metadata: {
        villageId: input.villageId,
        agentId,
      },
    };

    this.sessions.set(sessionId, {
      sessionId,
      agentId,
      villageId: input.villageId,
      providerId: input.providerId,
    });

    // Create/Upsert agent + session for persistence (best-effort).
    try {
      await prisma.agent.upsert({
        where: { id: agentId },
        update: {
          name: input.agentName || agentId,
          status: 'connected',
          updatedAt: new Date(),
          config: {
            providerId: input.providerId,
            repoRef: input.repoRef,
            lastSessionId: sessionId,
          } as any,
        },
        create: {
          id: agentId,
          name: input.agentName || agentId,
          status: 'connected',
          config: {
            providerId: input.providerId,
            repoRef: input.repoRef,
          } as any,
        },
      });

      await prisma.agentSession.create({
        data: {
          id: sessionId,
          agentId,
          state: JSON.stringify({
            providerId: input.providerId,
            repoRef: input.repoRef,
            status: 'active',
          }),
        },
      });
    } catch {
      // DB is optional in minimal deployments; continue without persistence.
    }

    // Notify clients in the village so the UI can render a sprite immediately.
    emitToVillage(input.villageId, 'agent_spawn', {
      agentId,
      sessionId,
      agentType: providerToAgentType(input.providerId),
      agentName: input.agentName || agentId,
      repoPath:
        input.repoRef.provider === 'local'
          ? input.repoRef.path
          : `${input.repoRef.provider}:${input.repoRef.owner}/${input.repoRef.name}`,
      timestamp: new Date().toISOString(),
    });

    // Start session + attach adapter
    await this.sessionManager.startSession(sessionConfig);

    const adapter =
      input.providerId === 'codex'
        ? new this.runner.CodexAdapter()
        : new this.runner.ClaudeCodeAdapter();

    await this.sessionManager.setProviderAdapter(sessionId, adapter);

    return { sessionId, agentId };
  }

  getSessionState(sessionId: string): SessionRuntimeState | undefined {
    return this.sessionManager?.getSessionState(sessionId);
  }

  async sendInput(sessionId: string, data: string): Promise<void> {
    if (!this.sessionManager) throw new Error('Runner not initialized');
    await this.sessionManager.sendInput(sessionId, data);
  }

  async stopSession(sessionId: string, graceful = true): Promise<void> {
    if (!this.sessionManager) throw new Error('Runner not initialized');
    await this.sessionManager.stopSession(sessionId, graceful);
  }

  resolveApproval(
    sessionId: string,
    approvalId: string,
    decision: 'allow' | 'deny',
    note?: string,
  ): void {
    if (!this.sessionManager) throw new Error('Runner not initialized');
    this.sessionManager.resolveApproval(sessionId, approvalId, decision, note);
  }

  private async handleRunnerEvent(evt: RunnerEvent): Promise<void> {
    const managed = this.sessions.get(evt.sessionId);
    if (!managed) return;

    const timestamp = new Date(evt.ts).toISOString();

    const emitWorkStreamEvent = (type: string, payload: Record<string, unknown>) => {
      const msg = {
        agentId: managed.agentId,
        sessionId: managed.sessionId,
        type,
        payload,
        timestamp,
      };
      emitToAgent(managed.agentId, 'work_stream_event', msg);
      emitToVillage(managed.villageId, 'work_stream_event', msg);
    };

    switch (evt.type) {
      case 'SESSION_STARTED':
        emitWorkStreamEvent('session_start', {
          providerId: evt.providerId,
          providerVersion: evt.providerVersion,
          workspacePath: evt.workspacePath,
          roomPath: evt.roomPath,
        });
        break;

      case 'SESSION_STATE_CHANGED':
        emitWorkStreamEvent('status_change', {
          previousState: evt.previousState,
          newState: evt.newState,
          reason: evt.reason,
        });
        break;

      case 'TERMINAL_CHUNK':
        emitWorkStreamEvent('output', { data: evt.data, stream: evt.stream });
        break;

      case 'FILE_TOUCHED': {
        const kind =
          evt.reason === 'delete'
            ? 'file_delete'
            : evt.reason === 'write'
              ? 'file_edit'
              : 'file_read';
        emitWorkStreamEvent(kind, {
          path: evt.path,
          roomPath: evt.roomPath,
          reason: evt.reason,
        });
        break;
      }

      case 'DIFF_SUMMARY':
        emitWorkStreamEvent('file_edit', {
          filesChanged: evt.filesChanged,
          linesAdded: evt.linesAdded,
          linesRemoved: evt.linesRemoved,
          files: evt.files,
        });
        break;

      case 'APPROVAL_REQUESTED':
        emitWorkStreamEvent('status_change', {
          approval: evt.approval,
          newState: 'WAITING_FOR_APPROVAL',
        });
        break;

      case 'APPROVAL_RESOLVED':
        emitWorkStreamEvent('status_change', {
          approvalId: evt.approvalId,
          decision: evt.decision,
          note: evt.note,
        });
        break;

      case 'SESSION_ENDED': {
        emitWorkStreamEvent('session_end', {
          finalState: evt.finalState,
          exitCode: evt.exitCode,
          totalDurationMs: evt.totalDurationMs,
          totalUsage: evt.totalUsage,
        });

        emitToVillage(managed.villageId, 'agent_disconnect', {
          agentId: managed.agentId,
          sessionId: managed.sessionId,
          timestamp,
        });

        try {
          await prisma.agentSession.update({
            where: { id: managed.sessionId },
            data: { endedAt: new Date(evt.ts), state: JSON.stringify({ status: 'ended' }) },
          });
          await prisma.agent.update({
            where: { id: managed.agentId },
            data: { status: 'disconnected' },
          });
        } catch {
          // Ignore persistence failures.
        }

        // Stop tracking once ended.
        this.sessions.delete(evt.sessionId);
        break;
      }

      default:
        // Ignore other events for now (tests/usage ticks/alerts can be mapped later).
        break;
    }
  }
}

export const runnerSessionService = new RunnerSessionService();
