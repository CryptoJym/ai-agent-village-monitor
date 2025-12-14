/**
 * Provider Events
 * Discriminated union of all events that adapters can emit
 *
 * These events provide a unified interface for the Runner to receive
 * structured information from any provider, regardless of the underlying
 * CLI implementation.
 */

import type { ProviderId } from './types';

/**
 * Base event properties shared by all provider events
 */
export type BaseProviderEvent = {
  /** Which provider emitted this event */
  providerId: ProviderId;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Session ID if associated with a session */
  sessionId?: string;
};

/**
 * Provider has started successfully
 */
export type ProviderStartedEvent = BaseProviderEvent & {
  type: 'PROVIDER_STARTED';
  /** Detected provider version */
  version: string;
  /** Detected capabilities list */
  capabilities?: string[];
};

/**
 * Message from provider (logs, status, etc.)
 */
export type ProviderMessageEvent = BaseProviderEvent & {
  type: 'PROVIDER_MESSAGE';
  /** Message text content */
  text: string;
  /** Message severity level */
  severity?: 'info' | 'warn' | 'error';
  /** Source of the message */
  source?: 'stdout' | 'stderr' | 'internal';
};

/**
 * Provider requests human approval for an action
 */
export type RequestApprovalEvent = BaseProviderEvent & {
  type: 'REQUEST_APPROVAL';
  /** Unique identifier for this approval request */
  approvalId: string;
  /** Category of action requiring approval */
  category: 'merge' | 'deps_add' | 'secrets' | 'deploy' | 'shell' | 'network';
  /** Human-readable summary of what's being requested */
  summary: string;
  /** Risk assessment */
  risk: 'low' | 'med' | 'high';
  /** Additional context for the approval decision */
  context?: Record<string, unknown>;
  /** Timeout in milliseconds for this approval */
  timeout?: number;
};

/**
 * Hint about files touched during session
 */
export type HintFilesTouchedEvent = BaseProviderEvent & {
  type: 'HINT_FILES_TOUCHED';
  /** List of file paths that were touched */
  paths: string[];
  /** Room/module path these files belong to */
  roomPath?: string;
  /** Type of file operation */
  operation?: 'read' | 'write' | 'delete';
};

/**
 * Hint that a diff is available
 */
export type HintDiffAvailableEvent = BaseProviderEvent & {
  type: 'HINT_DIFF_AVAILABLE';
  /** Brief summary of changes */
  summary?: string;
  /** Number of files changed */
  filesChanged?: number;
  /** Lines added */
  linesAdded?: number;
  /** Lines removed */
  linesRemoved?: number;
};

/**
 * Provider encountered an error
 */
export type ProviderErrorEvent = BaseProviderEvent & {
  type: 'PROVIDER_ERROR';
  /** Error message */
  error: string;
  /** Error code if available */
  code?: string;
  /** Whether the session can continue after this error */
  recoverable: boolean;
  /** Stack trace if available */
  stack?: string;
};

/**
 * Provider session has stopped
 */
export type ProviderStoppedEvent = BaseProviderEvent & {
  type: 'PROVIDER_STOPPED';
  /** Process exit code */
  exitCode?: number;
  /** Reason for stopping */
  reason: 'completed' | 'error' | 'timeout' | 'user_stopped' | 'policy_violation';
};

/**
 * Provider is requesting tool access (MCP-style)
 */
export type ToolRequestEvent = BaseProviderEvent & {
  type: 'TOOL_REQUEST';
  /** Name of the tool being requested */
  toolName: string;
  /** Arguments for the tool call */
  args: Record<string, unknown>;
  /** Unique request ID for correlating responses */
  requestId: string;
};

/**
 * Discriminated union of all provider events
 */
export type ProviderEvent =
  | ProviderStartedEvent
  | ProviderMessageEvent
  | RequestApprovalEvent
  | HintFilesTouchedEvent
  | HintDiffAvailableEvent
  | ProviderErrorEvent
  | ProviderStoppedEvent
  | ToolRequestEvent;

/**
 * Type guard: Check if event is ProviderStarted
 */
export const isProviderStarted = (e: ProviderEvent): e is ProviderStartedEvent =>
  e.type === 'PROVIDER_STARTED';

/**
 * Type guard: Check if event is ProviderMessage
 */
export const isProviderMessage = (e: ProviderEvent): e is ProviderMessageEvent =>
  e.type === 'PROVIDER_MESSAGE';

/**
 * Type guard: Check if event is RequestApproval
 */
export const isRequestApproval = (e: ProviderEvent): e is RequestApprovalEvent =>
  e.type === 'REQUEST_APPROVAL';

/**
 * Type guard: Check if event is HintFilesTouched
 */
export const isHintFilesTouched = (e: ProviderEvent): e is HintFilesTouchedEvent =>
  e.type === 'HINT_FILES_TOUCHED';

/**
 * Type guard: Check if event is HintDiffAvailable
 */
export const isHintDiffAvailable = (e: ProviderEvent): e is HintDiffAvailableEvent =>
  e.type === 'HINT_DIFF_AVAILABLE';

/**
 * Type guard: Check if event is ProviderError
 */
export const isProviderError = (e: ProviderEvent): e is ProviderErrorEvent =>
  e.type === 'PROVIDER_ERROR';

/**
 * Type guard: Check if event is ProviderStopped
 */
export const isProviderStopped = (e: ProviderEvent): e is ProviderStoppedEvent =>
  e.type === 'PROVIDER_STOPPED';

/**
 * Type guard: Check if event is ToolRequest
 */
export const isToolRequest = (e: ProviderEvent): e is ToolRequestEvent =>
  e.type === 'TOOL_REQUEST';

/**
 * Event type literal union for exhaustive checks
 */
export type ProviderEventType = ProviderEvent['type'];

/**
 * Extract event by type helper
 */
export type ExtractProviderEvent<T extends ProviderEventType> = Extract<
  ProviderEvent,
  { type: T }
>;
