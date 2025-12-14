/**
 * PTY Manager
 * Manages pseudo-terminal processes for agent sessions
 *
 * Per spec section 4.3: Terminal Streaming
 * - PTY-based spawning
 * - Stream stdout/stderr chunks
 * - Bidirectional input
 * - Exit code tracking
 */

import { EventEmitter } from 'node:events';
import type { IPty, IEvent } from 'node-pty';

/**
 * PTY spawn options
 */
export type PTYSpawnOptions = {
  /** Command to execute */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Working directory */
  cwd: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Number of columns */
  cols?: number;
  /** Number of rows */
  rows?: number;
  /** Shell to use */
  shell?: string;
};

/**
 * PTY data event
 */
export type PTYDataEvent = {
  sessionId: string;
  data: string;
  stream: 'stdout' | 'stderr';
  timestamp: number;
};

/**
 * PTY exit event
 */
export type PTYExitEvent = {
  sessionId: string;
  exitCode: number;
  signal?: string;
  timestamp: number;
};

/**
 * PTY session state
 */
type PTYSession = {
  pty: IPty;
  sessionId: string;
  pid: number;
  startedAt: number;
  cwd: string;
  command: string;
  dataBuffer: string[];
  maxBufferSize: number;
};

/**
 * Manages PTY processes for terminal streaming
 */
export class PTYManager extends EventEmitter {
  private sessions: Map<string, PTYSession> = new Map();
  private nodePty: typeof import('node-pty') | null = null;

  /**
   * Initialize the PTY manager
   * Dynamically imports node-pty to handle native module loading
   */
  async initialize(): Promise<void> {
    // Dynamic import to handle native module
    this.nodePty = await import('node-pty');
  }

  /**
   * Spawn a new PTY process
   */
  spawn(sessionId: string, options: PTYSpawnOptions): number {
    if (!this.nodePty) {
      throw new Error('PTYManager not initialized. Call initialize() first.');
    }

    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already has an active PTY`);
    }

    const {
      command,
      args = [],
      cwd,
      env = {},
      cols = 120,
      rows = 40,
      shell,
    } = options;

    // Merge with process env
    const fullEnv = {
      ...process.env,
      ...env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    };

    // Spawn the PTY process
    const pty = this.nodePty.spawn(shell ?? command, shell ? ['-c', command] : args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: fullEnv as Record<string, string>,
    });

    const session: PTYSession = {
      pty,
      sessionId,
      pid: pty.pid,
      startedAt: Date.now(),
      cwd,
      command,
      dataBuffer: [],
      maxBufferSize: 10000, // Keep last 10k lines
    };

    // Set up event handlers
    pty.onData((data: string) => {
      // Buffer the data
      session.dataBuffer.push(data);
      if (session.dataBuffer.length > session.maxBufferSize) {
        session.dataBuffer.shift();
      }

      const event: PTYDataEvent = {
        sessionId,
        data,
        stream: 'stdout', // node-pty combines stdout/stderr
        timestamp: Date.now(),
      };

      this.emit('data', event);
    });

    pty.onExit(({ exitCode, signal }) => {
      const event: PTYExitEvent = {
        sessionId,
        exitCode,
        signal: signal !== undefined ? String(signal) : undefined,
        timestamp: Date.now(),
      };

      this.emit('exit', event);
      this.sessions.delete(sessionId);
    });

    this.sessions.set(sessionId, session);
    return pty.pid;
  }

  /**
   * Send input to a PTY session
   */
  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`No active PTY for session ${sessionId}`);
    }

    session.pty.write(data);
  }

  /**
   * Resize a PTY session
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`No active PTY for session ${sessionId}`);
    }

    session.pty.resize(cols, rows);
  }

  /**
   * Kill a PTY session
   */
  kill(sessionId: string, signal: string = 'SIGTERM'): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return; // Already terminated
    }

    session.pty.kill(signal);
  }

  /**
   * Get the PID of a session
   */
  getPid(sessionId: string): number | undefined {
    return this.sessions.get(sessionId)?.pid;
  }

  /**
   * Check if a session is active
   */
  isActive(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Get buffered output for a session
   */
  getBuffer(sessionId: string): string[] {
    return this.sessions.get(sessionId)?.dataBuffer ?? [];
  }

  /**
   * Get session statistics
   */
  getStats(sessionId: string): {
    pid: number;
    startedAt: number;
    cwd: string;
    command: string;
    bufferSize: number;
  } | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    return {
      pid: session.pid,
      startedAt: session.startedAt,
      cwd: session.cwd,
      command: session.command,
      bufferSize: session.dataBuffer.length,
    };
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Cleanup all sessions
   */
  async cleanup(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [sessionId] of this.sessions) {
      promises.push(
        new Promise((resolve) => {
          const session = this.sessions.get(sessionId);
          if (session) {
            session.pty.onExit(() => resolve());
            session.pty.kill('SIGKILL');
          } else {
            resolve();
          }
        })
      );
    }

    await Promise.all(promises);
    this.sessions.clear();
  }
}

/**
 * Singleton instance
 */
let ptyManager: PTYManager | null = null;

export async function getPTYManager(): Promise<PTYManager> {
  if (!ptyManager) {
    ptyManager = new PTYManager();
    await ptyManager.initialize();
  }
  return ptyManager;
}
