/**
 * Base Provider Adapter
 * Abstract base class for all provider adapters
 *
 * Provides common functionality:
 * - PTY process management
 * - Event emission
 * - Dynamic flag detection via --help
 * - Filesystem watching for structured events
 */

import { EventEmitter } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  ProviderAdapter,
  ProviderId,
  Capability,
  DetectionResult,
  StartSessionArgs,
  ProviderEvent,
} from '@ai-agent-village-monitor/shared';
import { PTYManager, getPTYManager, type PTYDataEvent } from '../pty';

const execAsync = promisify(exec);

/**
 * Base adapter configuration
 */
export type BaseAdapterConfig = {
  /** Command to run for this provider */
  command: string;
  /** Default arguments */
  defaultArgs?: string[];
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Timeout for detection in ms */
  detectionTimeout?: number;
  /** Working directory */
  cwd?: string;
};

/**
 * Abstract base class for provider adapters
 */
export abstract class BaseAdapter implements ProviderAdapter {
  abstract readonly id: ProviderId;

  protected config: BaseAdapterConfig;
  protected eventEmitter: EventEmitter;
  protected ptyManager: PTYManager | null = null;
  protected currentSessionId: string | null = null;
  protected detectedCapabilities: Capability | null = null;
  protected detectedVersion: string | null = null;

  constructor(config: BaseAdapterConfig) {
    this.config = {
      detectionTimeout: 5000,
      ...config,
    };
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Detect if the provider CLI is installed
   */
  async detect(): Promise<DetectionResult> {
    try {
      // Try to get version
      const { stdout, stderr } = await execAsync(`${this.config.command} --version`, {
        timeout: this.config.detectionTimeout,
        env: { ...process.env, ...this.config.env },
      });

      const output = stdout || stderr;
      const version = this.parseVersion(output);

      this.detectedVersion = version;

      return {
        installed: true,
        version: version ?? undefined,
        details: `Found at: ${this.config.command}`,
      };
    } catch (error) {
      // Try which/where to find the command
      try {
        const whichCmd = process.platform === 'win32' ? 'where' : 'which';
        const { stdout } = await execAsync(`${whichCmd} ${this.config.command}`, {
          timeout: this.config.detectionTimeout,
        });

        return {
          installed: true,
          details: `Found at: ${stdout.trim()}`,
        };
      } catch {
        return {
          installed: false,
          details: error instanceof Error ? error.message : 'Command not found',
        };
      }
    }
  }

  /**
   * Get provider capabilities
   * Subclasses should override to provide accurate capabilities
   */
  async capabilities(): Promise<Capability> {
    if (this.detectedCapabilities) {
      return this.detectedCapabilities;
    }

    // Default capabilities - subclasses should override
    this.detectedCapabilities = {
      ptyStreaming: true,
      structuredEdits: 'none',
      supportsMCP: false,
      supportsNonInteractive: false,
      supportsPlanAndExecute: false,
      supportsPRFlow: 'none',
    };

    return this.detectedCapabilities;
  }

  /**
   * Start a provider session
   */
  async startSession(args: StartSessionArgs): Promise<{ sessionPid: number }> {
    if (this.currentSessionId) {
      throw new Error('Session already active');
    }

    // Get or initialize PTY manager
    this.ptyManager = await getPTYManager();

    // Build command arguments
    const cmdArgs = this.buildCommandArgs(args);

    // Generate session ID
    this.currentSessionId = `${this.id}_${Date.now()}`;

    // Spawn PTY process
    const pid = this.ptyManager.spawn(this.currentSessionId, {
      command: this.config.command,
      args: cmdArgs,
      cwd: args.repoPath,
      env: {
        ...this.config.env,
        ...args.env,
      },
    });

    // Set up event forwarding
    this.ptyManager.on('data', this.handlePTYData.bind(this));
    this.ptyManager.on('exit', this.handlePTYExit.bind(this));

    // Emit started event
    this.emitEvent({
      type: 'PROVIDER_STARTED',
      providerId: this.id,
      timestamp: Date.now(),
      sessionId: this.currentSessionId,
      version: this.detectedVersion ?? 'unknown',
    });

    return { sessionPid: pid };
  }

  /**
   * Send input to the running session
   */
  async sendInput(data: string): Promise<void> {
    if (!this.currentSessionId || !this.ptyManager) {
      throw new Error('No active session');
    }

    this.ptyManager.write(this.currentSessionId, data);
  }

  /**
   * Stop the running session
   */
  async stop(): Promise<void> {
    if (!this.currentSessionId || !this.ptyManager) {
      return;
    }

    this.ptyManager.kill(this.currentSessionId, 'SIGTERM');

    // Wait briefly for graceful shutdown
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Force kill if still running
    if (this.ptyManager.isActive(this.currentSessionId)) {
      this.ptyManager.kill(this.currentSessionId, 'SIGKILL');
    }
  }

  /**
   * Subscribe to provider events
   */
  onEvent(cb: (evt: ProviderEvent) => void): void {
    this.eventEmitter.on('event', cb);
  }

  /**
   * Unsubscribe from provider events
   */
  offEvent(cb: (evt: ProviderEvent) => void): void {
    this.eventEmitter.off('event', cb);
  }

  // ============================================================================
  // Protected methods for subclasses
  // ============================================================================

  /**
   * Build command arguments from session args
   * Subclasses should override for provider-specific args
   */
  protected buildCommandArgs(args: StartSessionArgs): string[] {
    return [...(this.config.defaultArgs ?? [])];
  }

  /**
   * Parse version from CLI output
   * Subclasses should override for provider-specific parsing
   */
  protected parseVersion(output: string): string | null {
    // Try common version patterns
    const patterns = [
      /version[:\s]+v?(\d+\.\d+\.\d+)/i,
      /v(\d+\.\d+\.\d+)/,
      /(\d+\.\d+\.\d+)/,
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Parse structured events from terminal output
   * Subclasses should override for provider-specific parsing
   */
  protected parseStructuredEvents(data: string): ProviderEvent[] {
    // Default: no parsing, just emit message
    return [];
  }

  /**
   * Emit a provider event
   */
  protected emitEvent(event: ProviderEvent): void {
    this.eventEmitter.emit('event', event);
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  private handlePTYData(event: PTYDataEvent): void {
    if (event.sessionId !== this.currentSessionId) {
      return;
    }

    // Emit raw message
    this.emitEvent({
      type: 'PROVIDER_MESSAGE',
      providerId: this.id,
      timestamp: event.timestamp,
      sessionId: this.currentSessionId,
      text: event.data,
      source: event.stream,
    });

    // Try to parse structured events
    const structuredEvents = this.parseStructuredEvents(event.data);
    for (const evt of structuredEvents) {
      this.emitEvent(evt);
    }
  }

  private handlePTYExit(event: { sessionId: string; exitCode: number }): void {
    if (event.sessionId !== this.currentSessionId) {
      return;
    }

    this.emitEvent({
      type: 'PROVIDER_STOPPED',
      providerId: this.id,
      timestamp: Date.now(),
      sessionId: this.currentSessionId,
      exitCode: event.exitCode,
      reason: event.exitCode === 0 ? 'completed' : 'error',
    });

    // Cleanup
    this.currentSessionId = null;
  }
}
