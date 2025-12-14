/**
 * Agent Runner
 * Main orchestrator for the execution plane
 *
 * The Runner is responsible for:
 * - Managing session lifecycle
 * - Connecting to Control Plane
 * - Streaming events
 * - Handling commands
 * - Reporting health/status
 */

import { EventEmitter } from 'node:events';
import { v4 as uuidv4 } from 'uuid';
import { SessionManager, getSessionManager } from './session/SessionManager';
import { EventStream, createEventStream, type EventStreamConfig } from './events/EventStream';
import { createPolicyEnforcer } from './policy/PolicyEnforcer';
import type {
  SessionConfig,
  SessionCommand,
  RunnerEvent,
  RunnerInfo,
  RunnerMode,
  ProviderId,
  ProviderAdapter,
} from '@ai-agent-village-monitor/shared';

/**
 * Runner configuration
 */
export type RunnerConfig = {
  /** Unique runner ID */
  runnerId: string;
  /** Deployment mode */
  mode: RunnerMode;
  /** Runner version */
  version: string;
  /** Control Plane WebSocket URL */
  controlPlaneUrl: string;
  /** Authentication token */
  authToken: string;
  /** Maximum concurrent sessions */
  maxSessions: number;
  /** Heartbeat interval in ms */
  heartbeatIntervalMs: number;
  /** Provider adapter factories */
  adapterFactories: Map<ProviderId, () => ProviderAdapter>;
};

/**
 * Runner state
 */
export type RunnerState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

/**
 * The Agent Runner - execution plane for AI coding sessions
 */
export class Runner extends EventEmitter {
  private config: RunnerConfig;
  private state: RunnerState = 'stopped';
  private sessionManager!: SessionManager;
  private eventStream!: EventStream;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private startedAt: number | null = null;

  constructor(config: RunnerConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the runner
   */
  async start(): Promise<void> {
    if (this.state !== 'stopped') {
      throw new Error(`Cannot start runner in state: ${this.state}`);
    }

    this.state = 'starting';
    this.emit('stateChange', this.state);

    try {
      // Initialize session manager
      this.sessionManager = await getSessionManager({
        maxSessions: this.config.maxSessions,
      });

      // Subscribe to session events
      this.sessionManager.on('event', (event: RunnerEvent) => {
        this.handleSessionEvent(event);
      });

      // Create and connect event stream
      this.eventStream = createEventStream({
        controlPlaneUrl: this.config.controlPlaneUrl,
        authToken: this.config.authToken,
        runnerId: this.config.runnerId,
        reconnectIntervalMs: 5000,
        maxReconnectAttempts: 10,
        maxBufferSize: 10000,
        pingIntervalMs: 30000,
      });

      this.eventStream.on('message', (message) => {
        this.handleControlPlaneMessage(message);
      });

      this.eventStream.on('error', (error) => {
        this.emit('error', error);
      });

      await this.eventStream.connect();

      // Start heartbeat
      this.startHeartbeat();

      this.startedAt = Date.now();
      this.state = 'running';
      this.emit('stateChange', this.state);
      this.emit('started');
    } catch (error) {
      this.state = 'error';
      this.emit('stateChange', this.state);
      throw error;
    }
  }

  /**
   * Stop the runner
   */
  async stop(): Promise<void> {
    if (this.state !== 'running') {
      return;
    }

    this.state = 'stopping';
    this.emit('stateChange', this.state);

    try {
      // Stop heartbeat
      this.stopHeartbeat();

      // Shutdown all sessions
      await this.sessionManager.shutdown();

      // Disconnect from Control Plane
      this.eventStream.disconnect();

      this.state = 'stopped';
      this.emit('stateChange', this.state);
      this.emit('stopped');
    } catch (error) {
      this.state = 'error';
      this.emit('stateChange', this.state);
      throw error;
    }
  }

  /**
   * Handle a command from Control Plane
   */
  async handleCommand(command: SessionCommand & { sessionId?: string }): Promise<void> {
    switch (command.type) {
      case 'START':
        await this.handleStartCommand(command.config);
        break;

      case 'INPUT':
        if (!command.sessionId) throw new Error('Session ID required for INPUT');
        await this.sessionManager.sendInput(command.sessionId, command.input.data);
        break;

      case 'STOP':
        if (!command.sessionId) throw new Error('Session ID required for STOP');
        await this.sessionManager.stopSession(command.sessionId, command.graceful);
        break;

      case 'PAUSE':
        if (!command.sessionId) throw new Error('Session ID required for PAUSE');
        this.sessionManager.pauseSession(command.sessionId);
        break;

      case 'RESUME':
        if (!command.sessionId) throw new Error('Session ID required for RESUME');
        this.sessionManager.resumeSession(command.sessionId);
        break;

      case 'APPROVE':
        if (!command.sessionId) throw new Error('Session ID required for APPROVE');
        this.sessionManager.resolveApproval(
          command.sessionId,
          command.approvalId,
          command.decision,
          command.note
        );
        break;
    }
  }

  /**
   * Get runner info for heartbeat
   */
  getInfo(): RunnerInfo {
    const providerVersions: Record<ProviderId, string | null> = {
      codex: null,
      claude_code: null,
      gemini_cli: null,
      omnara: null,
    };

    // Get versions from adapter factories
    for (const [providerId] of this.config.adapterFactories) {
      providerVersions[providerId] = 'available';
    }

    return {
      runnerId: this.config.runnerId,
      mode: this.config.mode,
      version: this.config.version,
      capabilities: this.getCapabilities(),
      activeSessionCount: this.sessionManager?.getActiveSessions().length ?? 0,
      maxSessions: this.config.maxSessions,
      lastHeartbeatAt: Date.now(),
      providerVersions,
    };
  }

  /**
   * Get runner state
   */
  getState(): RunnerState {
    return this.state;
  }

  /**
   * Get uptime in milliseconds
   */
  getUptime(): number {
    return this.startedAt ? Date.now() - this.startedAt : 0;
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  private async handleStartCommand(config: SessionConfig): Promise<void> {
    // Validate we have an adapter for this provider
    const adapterFactory = this.config.adapterFactories.get(config.providerId);
    if (!adapterFactory) {
      throw new Error(`No adapter available for provider: ${config.providerId}`);
    }

    // Create the session
    await this.sessionManager.startSession(config);

    // Create and set the adapter
    const adapter = adapterFactory();
    await this.sessionManager.setProviderAdapter(config.sessionId, adapter);
  }

  private handleSessionEvent(event: RunnerEvent): void {
    // Send event to Control Plane
    this.eventStream.send(event);

    // Emit locally for monitoring
    this.emit('sessionEvent', event);
  }

  private handleControlPlaneMessage(message: unknown): void {
    // Handle commands from Control Plane
    if (isSessionCommand(message)) {
      this.handleCommand(message as SessionCommand & { sessionId?: string }).catch((error) => {
        this.emit('error', error);
      });
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatIntervalMs);

    // Send initial heartbeat
    this.sendHeartbeat();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendHeartbeat(): void {
    const info = this.getInfo();
    this.eventStream.send({
      type: 'SESSION_STATE_CHANGED',
      sessionId: 'runner_heartbeat',
      orgId: 'system',
      ts: Date.now(),
      seq: 0,
      previousState: 'RUNNING',
      newState: 'RUNNING',
      reason: JSON.stringify(info),
    } as RunnerEvent);
  }

  private getCapabilities(): string[] {
    const caps: string[] = ['pty_streaming', 'workspace_isolation', 'policy_enforcement'];

    if (this.config.adapterFactories.has('codex')) {
      caps.push('codex_provider');
    }
    if (this.config.adapterFactories.has('claude_code')) {
      caps.push('claude_code_provider');
    }
    if (this.config.adapterFactories.has('gemini_cli')) {
      caps.push('gemini_cli_provider');
    }

    return caps;
  }
}

/**
 * Type guard for session commands
 */
function isSessionCommand(message: unknown): message is SessionCommand {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    typeof (message as { type: unknown }).type === 'string' &&
    ['START', 'INPUT', 'STOP', 'PAUSE', 'RESUME', 'APPROVE'].includes(
      (message as { type: string }).type
    )
  );
}

/**
 * Create a runner instance
 */
export function createRunner(config: RunnerConfig): Runner {
  return new Runner(config);
}

/**
 * Create a runner with default configuration
 */
export function createDefaultRunner(
  controlPlaneUrl: string,
  authToken: string,
  adapterFactories: Map<ProviderId, () => ProviderAdapter>
): Runner {
  return new Runner({
    runnerId: `runner_${uuidv4().slice(0, 8)}`,
    mode: 'hosted',
    version: '0.1.0',
    controlPlaneUrl,
    authToken,
    maxSessions: 10,
    heartbeatIntervalMs: 30000,
    adapterFactories,
  });
}
