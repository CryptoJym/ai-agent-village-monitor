/**
 * Agent Runner Package
 * Execution plane for AI Agent Village Monitor
 *
 * Provides session management, PTY streaming, workspace isolation,
 * policy enforcement, and event streaming to Control Plane.
 */

// Main Runner
export {
  Runner,
  createRunner,
  createDefaultRunner,
  type RunnerConfig,
  type RunnerState,
} from './Runner';

// Session Management
export {
  SessionManager,
  getSessionManager,
  type SessionManagerConfig,
  createSessionMachine,
  mapToSessionState,
  getSessionStateFromContext,
  type SessionContext,
  type SessionMachineEvent,
} from './session';

// Workspace Management
export { WorkspaceManager, getWorkspaceManager, type WorkspaceManagerConfig } from './workspace';

// PTY Management
export {
  PTYManager,
  getPTYManager,
  type PTYSpawnOptions,
  type PTYDataEvent,
  type PTYExitEvent,
} from './pty';

// Event Streaming
export {
  EventStream,
  createEventStream,
  type EventStreamConfig,
  type ConnectionState,
} from './events';

// Policy Enforcement
export {
  PolicyEnforcer,
  createPolicyEnforcer,
  type PolicyViolation,
  type CommandCheckResult,
} from './policy';

// Provider Adapters
export {
  // Base adapter
  BaseAdapter,
  type BaseAdapterConfig,
  // Codex adapter
  CodexAdapter,
  createCodexAdapter,
  type CodexAdapterConfig,
  // Claude Code adapter
  ClaudeCodeAdapter,
  createClaudeCodeAdapter,
  type ClaudeCodeAdapterConfig,
  // File watching instrumentation
  FileWatcher,
  createFileWatcher,
  type FileWatcherConfig,
  type FileChangeEvent,
  // Diff summarization
  DiffSummarizer,
  createDiffSummarizer,
  type DiffSummary,
  type FileDiff,
  type RoomSummary,
} from './adapters';

// Re-export shared types for convenience
export type {
  SessionConfig,
  SessionState,
  SessionRuntimeState,
  SessionCommand,
  RunnerEvent,
  RunnerInfo,
  RunnerMode,
  WorkspaceRef,
  RepoRef,
  CheckoutSpec,
  UsageMetrics,
  ApprovalRequest,
  ProviderId,
  ProviderAdapter,
  Capability,
  TaskSpec,
  PolicySpec,
} from '@ai-agent-village-monitor/shared';
