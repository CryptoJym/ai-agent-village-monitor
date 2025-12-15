/**
 * Provider Adapter Types
 * Core types for multi-provider CLI abstraction (Codex, Claude Code, Gemini CLI)
 *
 * These types form the contract that all provider adapters must implement,
 * enabling the Runner to work with any AI coding assistant CLI.
 */

/**
 * Supported AI coding assistant provider identifiers
 */
export type ProviderId = 'codex' | 'claude_code' | 'gemini_cli' | 'omnara';

/**
 * Provider capabilities declaration
 * Used by orchestration to select the right provider for a task
 */
export type Capability = {
  /** Whether the provider supports PTY-based terminal streaming */
  ptyStreaming: boolean;
  /** Type of structured edit output the provider can emit */
  structuredEdits: 'none' | 'diff' | 'fileEvents';
  /** Whether provider supports Model Context Protocol */
  supportsMCP: boolean;
  /** Whether provider can run in non-interactive mode */
  supportsNonInteractive: boolean;
  /** Whether provider supports plan-then-execute workflows */
  supportsPlanAndExecute: boolean;
  /** Level of PR workflow support */
  supportsPRFlow: 'none' | 'draft' | 'full';
  /** Hint about max context window (e.g., "200k tokens") */
  maxContextHint?: string;
};

/**
 * Task specification for an agent session
 */
export type TaskSpec = {
  /** Brief title for the task */
  title: string;
  /** Detailed goal description */
  goal: string;
  /** Constraints the agent must respect */
  constraints: string[];
  /** Acceptance criteria for task completion */
  acceptance: string[];
  /** Optional room/subpath focus within repo */
  roomPath?: string;
  /** Optional branch name for the work */
  branchName?: string;
};

/**
 * Policy specification for safety and governance
 */
export type PolicySpec = {
  /** Commands explicitly allowed to run */
  shellAllowlist: string[];
  /** Commands explicitly blocked from running */
  shellDenylist: string[];
  /** Actions that require human approval before proceeding */
  requiresApprovalFor: Array<'merge' | 'deps_add' | 'secrets' | 'deploy'>;
  /** Network access mode for the session */
  networkMode: 'restricted' | 'open';
};

/**
 * Arguments for starting an adapter session
 */
export type StartSessionArgs = {
  /** Optional runner session ID to correlate PTY + events */
  sessionId?: string;
  /** Absolute path to the repository workspace */
  repoPath: string;
  /** Task specification */
  task: TaskSpec;
  /** Policy specification */
  policy: PolicySpec;
  /** Environment variables to inject */
  env: Record<string, string>;
};

/**
 * Result of provider detection
 */
export type DetectionResult = {
  /** Whether the provider CLI is installed and accessible */
  installed: boolean;
  /** Detected version string if available */
  version?: string;
  /** Additional details (path, config, etc.) */
  details?: string;
};

/**
 * Provider Adapter Interface
 *
 * All provider adapters must implement this interface.
 * The interface is designed to be minimal but complete,
 * allowing for diverse provider implementations.
 */
export interface ProviderAdapter {
  /** Unique identifier for this provider */
  readonly id: ProviderId;

  /**
   * Detect if the provider CLI is installed and get version info
   */
  detect(): Promise<DetectionResult>;

  /**
   * Get the capabilities this provider supports
   */
  capabilities(): Promise<Capability>;

  /**
   * Start a new agent session
   * @returns The PID of the spawned process
   */
  startSession(args: StartSessionArgs): Promise<{ sessionPid: number }>;

  /**
   * Send input data to the running session
   * @param data - Text/keystrokes to send
   */
  sendInput(data: string): Promise<void>;

  /**
   * Stop the running session gracefully
   */
  stop(): Promise<void>;

  /**
   * Subscribe to provider events
   */
  onEvent(cb: (evt: ProviderEvent) => void): void;

  /**
   * Unsubscribe from provider events
   */
  offEvent(cb: (evt: ProviderEvent) => void): void;
}

// Forward declaration - actual type is in events.ts
import type { ProviderEvent } from './events';
export type { ProviderEvent };

/**
 * Registry for available adapters
 */
export type AdapterRegistry = Map<ProviderId, ProviderAdapter>;

/**
 * Factory function type for creating adapters
 */
export type AdapterFactoryFn = () => ProviderAdapter;

/**
 * Configuration for adapter instantiation
 */
export type AdapterConfig = {
  /** Which provider this config is for */
  providerId: ProviderId;
  /** Override path to the CLI executable */
  executablePath?: string;
  /** Default CLI flags to use */
  defaultFlags?: string[];
  /** Session timeout in milliseconds */
  timeout?: number;
  /** Additional environment variables */
  env?: Record<string, string>;
};
