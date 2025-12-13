/**
 * AgentBridge - Core class for bridging terminal AI agents to Village Monitor
 *
 * This class wraps CLI commands (claude, aider, codex, etc.) and:
 * 1. Intercepts stdout/stderr to parse agent activity
 * 2. Streams events to the Village Monitor server via WebSocket
 * 3. Persists events via REST API for history
 * 4. Updates agent visual state in real-time
 */

import { spawn, ChildProcess } from 'child_process';
import { io, Socket } from 'socket.io-client';
import { v4 as uuid } from 'uuid';
import { getParserForAgent, parseOutput } from './parsers.js';
import type {
  AgentBridgeConfig,
  AgentSession,
  WorkStreamEvent,
  WorkStreamEventType,
  AgentState,
  AgentParserConfig,
} from './types.js';

export class AgentBridge {
  private socket: Socket | null = null;
  private session: AgentSession;
  private parser: AgentParserConfig;
  private process: ChildProcess | null = null;
  private isConnected = false;
  private eventQueue: WorkStreamEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private lastState: AgentState = 'idle';

  constructor(private config: AgentBridgeConfig) {
    this.session = {
      id: uuid(),
      agentId: uuid(),
      agentType: config.agentType,
      repoPath: config.repoPath,
      villageId: config.villageId,
      startedAt: new Date(),
      status: 'connecting',
    };
    this.parser = getParserForAgent(config.agentType);

    if (config.verbose) {
      console.log(`[bridge] Session ID: ${this.session.id}`);
      console.log(`[bridge] Agent ID: ${this.session.agentId}`);
      console.log(`[bridge] Agent Type: ${config.agentType}`);
      console.log(`[bridge] Repository: ${config.repoPath}`);
    }
  }

  /**
   * Connect to the Village Monitor server and register the agent
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socketOpts: any = {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      };

      if (this.config.authToken) {
        socketOpts.auth = { token: this.config.authToken };
      }

      this.socket = io(this.config.serverUrl, socketOpts);

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.socket.on('connect', async () => {
        clearTimeout(timeout);
        this.isConnected = true;
        this.session.status = 'active';

        if (this.config.verbose) {
          console.log(`[bridge] Connected to ${this.config.serverUrl}`);
        }

        try {
          // Register the agent session with the server
          await this.registerSession();

          // Join the village room
          this.socket!.emit('join_village', { villageId: this.config.villageId });
          this.socket!.emit('join_agent', { agentId: this.session.agentId });

          // Emit session start event
          this.emitEvent('session_start', {
            agentType: this.config.agentType,
            agentName: this.config.agentName || `${this.config.agentType}-agent`,
            repoPath: this.config.repoPath,
          });

          resolve();
        } catch (err) {
          reject(err);
        }
      });

      this.socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        if (this.config.verbose) {
          console.error(`[bridge] Connection error: ${err.message}`);
        }
        reject(err);
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        if (this.config.verbose) {
          console.log(`[bridge] Disconnected: ${reason}`);
        }
      });

      this.socket.on('reconnect', () => {
        this.isConnected = true;
        if (this.config.verbose) {
          console.log('[bridge] Reconnected');
        }
        // Re-join rooms after reconnect
        this.socket!.emit('join_village', { villageId: this.config.villageId });
        this.socket!.emit('join_agent', { agentId: this.session.agentId });
      });
    });
  }

  /**
   * Register the agent session with the server via REST API
   */
  private async registerSession(): Promise<void> {
    const url = `${this.config.serverUrl}/api/sessions`;
    const body = {
      sessionId: this.session.id,
      agentId: this.session.agentId,
      agentType: this.config.agentType,
      agentName: this.config.agentName || `${this.config.agentType}-agent`,
      repoPath: this.config.repoPath,
      villageId: this.config.villageId,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to register session: ${res.status} ${text}`);
    }

    if (this.config.verbose) {
      console.log('[bridge] Session registered with server');
    }
  }

  /**
   * Wrap a CLI command and start streaming output
   */
  wrap(command: string, args: string[] = []): void {
    if (this.config.verbose) {
      console.log(`[bridge] Wrapping command: ${command} ${args.join(' ')}`);
    }

    this.process = spawn(command, args, {
      cwd: this.config.repoPath,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env },
    });

    // Handle stdout
    this.process.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      process.stdout.write(data); // Pass through to terminal
      this.processOutput(text);
    });

    // Handle stderr
    this.process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      process.stderr.write(data); // Pass through to terminal
      this.processOutput(text, true);
    });

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      if (this.config.verbose) {
        console.log(`[bridge] Process exited with code ${code}, signal ${signal}`);
      }

      this.emitEvent('session_end', {
        exitCode: code,
        signal,
      });

      this.updateAgentState('idle');
      this.flushEvents();
      this.cleanup();
    });

    this.process.on('error', (err) => {
      console.error(`[bridge] Process error: ${err.message}`);
      this.emitEvent('error', { message: err.message });
      this.cleanup();
    });
  }

  /**
   * Process a chunk of output text
   */
  private processOutput(text: string, isError = false): void {
    const lines = text.split('\n').filter((l) => l.trim());

    for (const line of lines) {
      // Try to parse the line for known patterns
      const parsed = parseOutput(line, this.parser);

      if (parsed) {
        this.emitEvent(parsed.type, parsed.payload);
        this.updateAgentStateFromEvent(parsed.type);
      } else if (isError && line.trim()) {
        // Emit unparsed error output
        this.emitEvent('error', { message: line });
      }
      // Note: We don't emit every line of output to avoid flooding
      // Only parsed events and errors are streamed
    }
  }

  /**
   * Map event types to agent visual states
   */
  private updateAgentStateFromEvent(eventType: WorkStreamEventType): void {
    const stateMap: Partial<Record<WorkStreamEventType, AgentState>> = {
      thinking: 'thinking',
      file_read: 'working',
      file_edit: 'working',
      file_create: 'working',
      file_delete: 'working',
      command: 'working',
      tool_use: 'working',
      search: 'working',
      completed: 'idle',
      error: 'error',
    };

    const newState = stateMap[eventType];
    if (newState && newState !== this.lastState) {
      this.updateAgentState(newState);
    }
  }

  /**
   * Update the agent's visual state
   */
  private updateAgentState(state: AgentState): void {
    this.lastState = state;

    if (this.socket && this.isConnected) {
      this.socket.emit('agent_update', {
        agentId: this.session.agentId,
        state,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Emit a work stream event
   */
  private emitEvent(type: WorkStreamEventType, payload: Record<string, unknown> = {}): void {
    const event: WorkStreamEvent = {
      agentId: this.session.agentId,
      sessionId: this.session.id,
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    // Queue the event for batched persistence
    this.eventQueue.push(event);

    // Emit via WebSocket for real-time updates
    if (this.socket && this.isConnected) {
      this.socket.emit('work_stream_event', event);
    }

    // Schedule batch flush
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flushEvents(), 1000);
    }
  }

  /**
   * Flush queued events to the REST API
   */
  private async flushEvents(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    const url = `${this.config.serverUrl}/api/events/batch`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    try {
      await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ events }),
      });
    } catch (err) {
      if (this.config.verbose) {
        console.error('[bridge] Failed to flush events:', err);
      }
      // Re-queue failed events (with limit to prevent memory issues)
      if (this.eventQueue.length < 100) {
        this.eventQueue.unshift(...events);
      }
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.session.status = 'ended';
  }

  /**
   * Gracefully stop the bridge
   */
  async stop(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
    }

    await this.flushEvents();
    this.cleanup();
  }

  /**
   * Get the current session info
   */
  getSession(): AgentSession {
    return { ...this.session };
  }

  /**
   * Get the agent ID
   */
  getAgentId(): string {
    return this.session.agentId;
  }

  /**
   * Get the session ID
   */
  getSessionId(): string {
    return this.session.id;
  }
}
