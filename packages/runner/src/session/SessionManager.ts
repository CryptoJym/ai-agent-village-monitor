/**
 * Session Manager
 * Orchestrates session lifecycle, workspace, PTY, and events
 *
 * This is the main coordinator that:
 * - Creates and manages session state machines
 * - Coordinates workspace creation
 * - Manages PTY processes
 * - Emits runner events
 */

import { EventEmitter } from 'node:events';
import { createActor, type Actor, type AnyActorLogic } from 'xstate';
import { v4 as uuidv4 } from 'uuid';
import {
  createSessionMachine,
  mapToSessionState,
  type SessionContext,
  type SessionMachineEvent,
} from './sessionMachine';
import { WorkspaceManager, getWorkspaceManager } from '../workspace/WorkspaceManager';
import { PTYManager, getPTYManager, type PTYDataEvent, type PTYExitEvent } from '../pty/PTYManager';
import type {
  SessionConfig,
  SessionState,
  SessionRuntimeState,
  RunnerEvent,
  SessionStartedEvent,
  SessionStateChangedEvent,
  SessionEndedEvent,
  TerminalChunkEvent,
  UsageTickEvent,
  ApprovalRequest,
  ProviderAdapter,
} from '@ai-agent-village-monitor/shared';

/**
 * Active session tracking
 */
type ActiveSession = {
  config: SessionConfig;
  actor: Actor<ReturnType<typeof createSessionMachine>>;
  adapter?: ProviderAdapter;
  usageTickInterval?: NodeJS.Timeout;
  lastState: SessionState;
  eventSeq: number;
};

/**
 * Session Manager configuration
 */
export type SessionManagerConfig = {
  /** Maximum concurrent sessions */
  maxSessions: number;
  /** Usage tick interval in ms (default: 30000) */
  usageTickIntervalMs: number;
  /** Session timeout in ms (default: 1 hour) */
  sessionTimeoutMs: number;
};

const DEFAULT_CONFIG: SessionManagerConfig = {
  maxSessions: 10,
  usageTickIntervalMs: 30000,
  sessionTimeoutMs: 60 * 60 * 1000,
};

/**
 * Manages all active sessions on this runner
 */
export class SessionManager extends EventEmitter {
  private sessions: Map<string, ActiveSession> = new Map();
  private workspaceManager!: WorkspaceManager;
  private ptyManager!: PTYManager;
  private config: SessionManagerConfig;
  private initialized = false;

  constructor(config: Partial<SessionManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the session manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.workspaceManager = getWorkspaceManager();
    await this.workspaceManager.initialize();

    this.ptyManager = await getPTYManager();

    // Listen to PTY events
    this.ptyManager.on('data', this.handlePTYData.bind(this));
    this.ptyManager.on('exit', this.handlePTYExit.bind(this));

    this.initialized = true;
  }

  /**
   * Start a new session
   */
  async startSession(config: SessionConfig): Promise<SessionRuntimeState> {
    if (!this.initialized) {
      throw new Error('SessionManager not initialized');
    }

    if (this.sessions.size >= this.config.maxSessions) {
      throw new Error(`Maximum sessions (${this.config.maxSessions}) reached`);
    }

    if (this.sessions.has(config.sessionId)) {
      throw new Error(`Session ${config.sessionId} already exists`);
    }

    // Create the state machine
    const machine = createSessionMachine(config);
    const actor = createActor(machine, {
      systemId: config.sessionId,
    });

    const session: ActiveSession = {
      config,
      actor: actor as Actor<ReturnType<typeof createSessionMachine>>,
      lastState: 'CREATED',
      eventSeq: 0,
    };

    // Subscribe to state changes
    actor.subscribe((snapshot) => {
      const newState = mapToSessionState(String(snapshot.value));
      if (newState !== session.lastState) {
        this.emitStateChanged(session, session.lastState, newState);
        session.lastState = newState;
      }
    });

    this.sessions.set(config.sessionId, session);

    // Start the actor
    actor.start();

    // Prepare workspace
    try {
      const workspace = await this.workspaceManager.createWorkspace(
        config.sessionId,
        config.repoRef,
        config.checkout,
        { roomPath: config.roomPath }
      );

      actor.send({ type: 'WORKSPACE_READY', workspace });
    } catch (error) {
      actor.send({
        type: 'WORKSPACE_FAILED',
        error: error instanceof Error ? error.message : 'Workspace creation failed',
      });
    }

    return this.getSessionState(config.sessionId)!;
  }

  /**
   * Set the provider adapter for a session and start it
   */
  async setProviderAdapter(sessionId: string, adapter: ProviderAdapter): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.adapter = adapter;

    const workspace = this.workspaceManager.getWorkspace(sessionId);
    if (!workspace) {
      throw new Error(`Workspace not found for session ${sessionId}`);
    }

    // Start the provider session
    try {
      const { sessionPid } = await adapter.startSession({
        repoPath: workspace.worktreePath,
        task: session.config.task,
        policy: session.config.policy,
        env: session.config.env ?? {},
      });

      const detection = await adapter.detect();

      session.actor.send({
        type: 'PROVIDER_STARTED',
        pid: sessionPid,
        version: detection.version ?? 'unknown',
      });

      // Emit session started event
      this.emitSessionStarted(session, workspace.worktreePath, detection.version ?? 'unknown');

      // Start usage ticker
      this.startUsageTicker(sessionId);

      // Listen for provider events
      adapter.onEvent((evt) => {
        this.handleProviderEvent(sessionId, evt);
      });
    } catch (error) {
      session.actor.send({
        type: 'PROVIDER_FAILED',
        error: error instanceof Error ? error.message : 'Provider start failed',
      });
    }
  }

  /**
   * Send input to a session
   */
  async sendInput(sessionId: string, data: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.adapter) {
      throw new Error(`No adapter for session ${sessionId}`);
    }

    await session.adapter.sendInput(data);
  }

  /**
   * Pause a session
   */
  pauseSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.actor.send({ type: 'PAUSE' });
  }

  /**
   * Resume a paused session
   */
  resumeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.actor.send({ type: 'RESUME' });
  }

  /**
   * Stop a session
   */
  async stopSession(sessionId: string, graceful = true): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return; // Already stopped
    }

    session.actor.send({ type: 'STOP', graceful });

    if (session.adapter) {
      await session.adapter.stop();
    }
  }

  /**
   * Resolve an approval request
   */
  resolveApproval(
    sessionId: string,
    approvalId: string,
    decision: 'allow' | 'deny',
    note?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.actor.send({ type: 'APPROVAL_RESOLVED', approvalId, decision });

    // Emit approval resolved event
    this.emitEvent({
      type: 'APPROVAL_RESOLVED',
      sessionId,
      orgId: session.config.orgId,
      repoRef: session.config.repoRef,
      ts: Date.now(),
      seq: this.nextSeq(session),
      approvalId,
      decision,
      note,
    });
  }

  /**
   * Get the current state of a session
   */
  getSessionState(sessionId: string): SessionRuntimeState | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    const snapshot = session.actor.getSnapshot();
    const context = snapshot.context as SessionContext;

    return {
      sessionId,
      state: session.lastState,
      providerId: session.config.providerId,
      workspace: context.workspace,
      startedAt: context.startedAt,
      providerPid: context.providerPid,
      lastEventSeq: session.eventSeq,
      pendingApprovals: context.pendingApprovals.map((a) => a.approvalId),
      errorMessage: context.errorMessage,
      exitCode: context.exitCode,
    };
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get session count by state
   */
  getSessionStats(): Record<SessionState, number> {
    const stats: Record<SessionState, number> = {
      CREATED: 0,
      PREPARING_WORKSPACE: 0,
      STARTING_PROVIDER: 0,
      RUNNING: 0,
      WAITING_FOR_APPROVAL: 0,
      PAUSED_BY_HUMAN: 0,
      STOPPING: 0,
      COMPLETED: 0,
      FAILED: 0,
    };

    for (const session of this.sessions.values()) {
      stats[session.lastState]++;
    }

    return stats;
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    // Stop all sessions
    const stopPromises = Array.from(this.sessions.keys()).map((id) =>
      this.stopSession(id, false)
    );
    await Promise.all(stopPromises);

    // Cleanup PTY manager
    await this.ptyManager.cleanup();

    this.sessions.clear();
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  private handlePTYData(event: PTYDataEvent): void {
    const session = this.sessions.get(event.sessionId);
    if (!session) return;

    this.emitEvent({
      type: 'TERMINAL_CHUNK',
      sessionId: event.sessionId,
      orgId: session.config.orgId,
      repoRef: session.config.repoRef,
      ts: event.timestamp,
      seq: this.nextSeq(session),
      data: event.data,
      stream: event.stream,
    } as TerminalChunkEvent);
  }

  private handlePTYExit(event: PTYExitEvent): void {
    const session = this.sessions.get(event.sessionId);
    if (!session) return;

    session.actor.send({ type: 'PROVIDER_EXITED', exitCode: event.exitCode });
  }

  private handleProviderEvent(sessionId: string, evt: import('@ai-agent-village-monitor/shared').ProviderEvent): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Forward provider events and handle specific types
    if (evt.type === 'REQUEST_APPROVAL') {
      const approval: ApprovalRequest = {
        approvalId: evt.approvalId,
        sessionId,
        category: evt.category,
        summary: evt.summary,
        risk: evt.risk,
        context: evt.context,
        requestedAt: Date.now(),
        timeoutAt: evt.timeout ? Date.now() + evt.timeout : undefined,
      };

      session.actor.send({ type: 'APPROVAL_REQUESTED', approval });

      this.emitEvent({
        type: 'APPROVAL_REQUESTED',
        sessionId,
        orgId: session.config.orgId,
        repoRef: session.config.repoRef,
        ts: Date.now(),
        seq: this.nextSeq(session),
        approval,
      });
    }

    // Forward all provider events
    this.emitEvent({
      type: 'PROVIDER_EVENT_FORWARDED',
      sessionId,
      orgId: session.config.orgId,
      repoRef: session.config.repoRef,
      ts: Date.now(),
      seq: this.nextSeq(session),
      providerEvent: evt,
    });
  }

  private startUsageTicker(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.usageTickInterval = setInterval(() => {
      this.emitUsageTick(sessionId);
    }, this.config.usageTickIntervalMs);
  }

  private stopUsageTicker(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session?.usageTickInterval) return;

    clearInterval(session.usageTickInterval);
    session.usageTickInterval = undefined;
  }

  private emitUsageTick(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const snapshot = session.actor.getSnapshot();
    const context = snapshot.context as SessionContext;

    // Calculate delta metrics
    const metrics = {
      agentSeconds: this.config.usageTickIntervalMs / 1000,
      terminalKb: 0, // Would be calculated from PTY buffer
      filesTouched: 0,
      commandsRun: 0,
      approvalsRequested: 0,
    };

    session.actor.send({ type: 'USAGE_TICK', metrics });

    this.emitEvent({
      type: 'USAGE_TICK',
      sessionId,
      orgId: session.config.orgId,
      repoRef: session.config.repoRef,
      ts: Date.now(),
      seq: this.nextSeq(session),
      providerId: session.config.providerId,
      units: metrics,
      intervalMs: this.config.usageTickIntervalMs,
    } as UsageTickEvent);
  }

  private emitSessionStarted(session: ActiveSession, workspacePath: string, version: string): void {
    this.emitEvent({
      type: 'SESSION_STARTED',
      sessionId: session.config.sessionId,
      orgId: session.config.orgId,
      repoRef: session.config.repoRef,
      ts: Date.now(),
      seq: this.nextSeq(session),
      providerId: session.config.providerId,
      providerVersion: version,
      workspacePath,
      roomPath: session.config.roomPath,
    } as SessionStartedEvent);
  }

  private emitStateChanged(
    session: ActiveSession,
    previousState: SessionState,
    newState: SessionState
  ): void {
    this.emitEvent({
      type: 'SESSION_STATE_CHANGED',
      sessionId: session.config.sessionId,
      orgId: session.config.orgId,
      repoRef: session.config.repoRef,
      ts: Date.now(),
      seq: this.nextSeq(session),
      previousState,
      newState,
    } as SessionStateChangedEvent);

    // Handle terminal states
    if (newState === 'COMPLETED' || newState === 'FAILED') {
      this.stopUsageTicker(session.config.sessionId);
      this.emitSessionEnded(session, newState);
      this.cleanupSession(session.config.sessionId);
    }
  }

  private emitSessionEnded(session: ActiveSession, finalState: SessionState): void {
    const snapshot = session.actor.getSnapshot();
    const context = snapshot.context as SessionContext;

    this.emitEvent({
      type: 'SESSION_ENDED',
      sessionId: session.config.sessionId,
      orgId: session.config.orgId,
      repoRef: session.config.repoRef,
      ts: Date.now(),
      seq: this.nextSeq(session),
      finalState,
      exitCode: context.exitCode,
      totalDurationMs: context.endedAt
        ? context.endedAt - (context.startedAt ?? context.endedAt)
        : 0,
      totalUsage: context.usage,
    } as SessionEndedEvent);
  }

  private async cleanupSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Cleanup workspace
    await this.workspaceManager.destroyWorkspace(sessionId);

    // Remove from active sessions (after a delay to allow event processing)
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, 5000);
  }

  private nextSeq(session: ActiveSession): number {
    return ++session.eventSeq;
  }

  private emitEvent(event: RunnerEvent): void {
    this.emit('event', event);
  }
}

/**
 * Singleton instance
 */
let sessionManager: SessionManager | null = null;

export async function getSessionManager(
  config?: Partial<SessionManagerConfig>
): Promise<SessionManager> {
  if (!sessionManager) {
    sessionManager = new SessionManager(config);
    await sessionManager.initialize();
  }
  return sessionManager;
}
