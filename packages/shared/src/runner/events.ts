/**
 * Runner Events
 * Discriminated union of all events the Runner emits to Control Plane
 *
 * Per spec section 7: Event Schema
 * All events include: type, session_id, org_id, ts (epoch ms), seq (monotonic)
 */

import type { ProviderId } from '../adapters/types';
import type { ProviderEvent } from '../adapters/events';
import type {
  SessionState,
  RepoRef,
  UsageMetrics,
  ApprovalRequest,
} from './types';

// ============================================================================
// Base Event
// ============================================================================

/**
 * Base event properties - all events must include these
 */
export type BaseRunnerEvent = {
  /** Session this event belongs to */
  sessionId: string;
  /** Organization ID */
  orgId: string;
  /** Repository reference */
  repoRef?: RepoRef;
  /** Unix timestamp in milliseconds */
  ts: number;
  /** Monotonically increasing sequence number per session */
  seq: number;
};

// ============================================================================
// Session Lifecycle Events
// ============================================================================

/**
 * Session started event
 */
export type SessionStartedEvent = BaseRunnerEvent & {
  type: 'SESSION_STARTED';
  /** Provider being used */
  providerId: ProviderId;
  /** Provider version */
  providerVersion: string;
  /** Path to the workspace */
  workspacePath: string;
  /** Room/subpath focus */
  roomPath?: string;
};

/**
 * Session state changed event
 */
export type SessionStateChangedEvent = BaseRunnerEvent & {
  type: 'SESSION_STATE_CHANGED';
  /** Previous state */
  previousState: SessionState;
  /** New state */
  newState: SessionState;
  /** Reason for the transition */
  reason?: string;
};

/**
 * Session ended event
 */
export type SessionEndedEvent = BaseRunnerEvent & {
  type: 'SESSION_ENDED';
  /** Final state */
  finalState: SessionState;
  /** Process exit code */
  exitCode?: number;
  /** Total session duration in ms */
  totalDurationMs: number;
  /** Total usage metrics */
  totalUsage: UsageMetrics;
};

// ============================================================================
// Terminal Events
// ============================================================================

/**
 * Terminal output chunk event
 */
export type TerminalChunkEvent = BaseRunnerEvent & {
  type: 'TERMINAL_CHUNK';
  /** Terminal output data */
  data: string;
  /** Which stream this came from */
  stream: 'stdout' | 'stderr';
};

// ============================================================================
// File & Diff Events
// ============================================================================

/**
 * File touched event - emitted when files are accessed
 */
export type FileTouchedEvent = BaseRunnerEvent & {
  type: 'FILE_TOUCHED';
  /** Path to the file */
  path: string;
  /** Room/module this file belongs to */
  roomPath?: string;
  /** Type of file operation */
  reason: 'read' | 'write' | 'delete' | 'diff';
};

/**
 * Diff summary event - summary of changes made
 */
export type DiffSummaryEvent = BaseRunnerEvent & {
  type: 'DIFF_SUMMARY';
  /** Number of files changed */
  filesChanged: number;
  /** Lines added */
  linesAdded: number;
  /** Lines removed */
  linesRemoved: number;
  /** Per-file details */
  files: Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    additions: number;
    deletions: number;
  }>;
};

// ============================================================================
// Test Events
// ============================================================================

/**
 * Test run started event
 */
export type TestRunStartedEvent = BaseRunnerEvent & {
  type: 'TEST_RUN_STARTED';
  /** Test command being run */
  command: string;
  /** Test files being run */
  testFiles?: string[];
};

/**
 * Test run finished event
 */
export type TestRunFinishedEvent = BaseRunnerEvent & {
  type: 'TEST_RUN_FINISHED';
  /** Exit code of the test command */
  exitCode: number;
  /** Number of passing tests */
  passed: number;
  /** Number of failing tests */
  failed: number;
  /** Number of skipped tests */
  skipped: number;
  /** Test duration in ms */
  duration: number;
};

// ============================================================================
// Approval Events
// ============================================================================

/**
 * Approval requested event
 */
export type ApprovalRequestedEvent = BaseRunnerEvent & {
  type: 'APPROVAL_REQUESTED';
  /** Full approval request details */
  approval: ApprovalRequest;
};

/**
 * Approval resolved event
 */
export type ApprovalResolvedEvent = BaseRunnerEvent & {
  type: 'APPROVAL_RESOLVED';
  /** Approval request ID */
  approvalId: string;
  /** Decision made */
  decision: 'allow' | 'deny';
  /** Who resolved it */
  resolvedBy?: string;
  /** Note from resolver */
  note?: string;
};

// ============================================================================
// Alert Events
// ============================================================================

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warn' | 'error' | 'critical';

/**
 * Alert categories
 */
export type AlertCategory =
  | 'security'
  | 'performance'
  | 'build'
  | 'test'
  | 'dependency'
  | 'policy';

/**
 * Alert raised event - for patrol jobs, errors, etc.
 */
export type AlertRaisedEvent = BaseRunnerEvent & {
  type: 'ALERT_RAISED';
  /** Unique alert ID */
  alertId: string;
  /** Alert severity */
  severity: AlertSeverity;
  /** Alert category */
  category: AlertCategory;
  /** Alert title */
  title: string;
  /** Alert description */
  description: string;
  /** Additional context */
  context?: Record<string, unknown>;
};

// ============================================================================
// Metering Events
// ============================================================================

/**
 * Usage tick event - emitted every 30 seconds (REVENUE CRITICAL!)
 */
export type UsageTickEvent = BaseRunnerEvent & {
  type: 'USAGE_TICK';
  /** Provider being used */
  providerId: ProviderId;
  /** Usage metrics for this interval */
  units: UsageMetrics;
  /** Interval duration in ms */
  intervalMs: number;
};

// ============================================================================
// Provider Forwarding
// ============================================================================

/**
 * Provider event forwarded from adapter
 */
export type ProviderEventForwardedEvent = BaseRunnerEvent & {
  type: 'PROVIDER_EVENT_FORWARDED';
  /** The original provider event */
  providerEvent: ProviderEvent;
};

// ============================================================================
// Union Type
// ============================================================================

/**
 * Discriminated union of all runner events
 */
export type RunnerEvent =
  | SessionStartedEvent
  | SessionStateChangedEvent
  | SessionEndedEvent
  | TerminalChunkEvent
  | FileTouchedEvent
  | DiffSummaryEvent
  | TestRunStartedEvent
  | TestRunFinishedEvent
  | ApprovalRequestedEvent
  | ApprovalResolvedEvent
  | AlertRaisedEvent
  | UsageTickEvent
  | ProviderEventForwardedEvent;

// ============================================================================
// Type Guards
// ============================================================================

export const isSessionStarted = (e: RunnerEvent): e is SessionStartedEvent =>
  e.type === 'SESSION_STARTED';

export const isSessionStateChanged = (
  e: RunnerEvent
): e is SessionStateChangedEvent => e.type === 'SESSION_STATE_CHANGED';

export const isSessionEnded = (e: RunnerEvent): e is SessionEndedEvent =>
  e.type === 'SESSION_ENDED';

export const isTerminalChunk = (e: RunnerEvent): e is TerminalChunkEvent =>
  e.type === 'TERMINAL_CHUNK';

export const isFileTouched = (e: RunnerEvent): e is FileTouchedEvent =>
  e.type === 'FILE_TOUCHED';

export const isDiffSummary = (e: RunnerEvent): e is DiffSummaryEvent =>
  e.type === 'DIFF_SUMMARY';

export const isTestRunStarted = (e: RunnerEvent): e is TestRunStartedEvent =>
  e.type === 'TEST_RUN_STARTED';

export const isTestRunFinished = (e: RunnerEvent): e is TestRunFinishedEvent =>
  e.type === 'TEST_RUN_FINISHED';

export const isApprovalRequested = (
  e: RunnerEvent
): e is ApprovalRequestedEvent => e.type === 'APPROVAL_REQUESTED';

export const isApprovalResolved = (e: RunnerEvent): e is ApprovalResolvedEvent =>
  e.type === 'APPROVAL_RESOLVED';

export const isAlertRaised = (e: RunnerEvent): e is AlertRaisedEvent =>
  e.type === 'ALERT_RAISED';

export const isUsageTick = (e: RunnerEvent): e is UsageTickEvent =>
  e.type === 'USAGE_TICK';

export const isProviderEventForwarded = (
  e: RunnerEvent
): e is ProviderEventForwardedEvent => e.type === 'PROVIDER_EVENT_FORWARDED';

// ============================================================================
// Utilities
// ============================================================================

/**
 * Event type literal union
 */
export type RunnerEventType = RunnerEvent['type'];

/**
 * Extract event by type helper
 */
export type ExtractRunnerEvent<T extends RunnerEventType> = Extract<
  RunnerEvent,
  { type: T }
>;
