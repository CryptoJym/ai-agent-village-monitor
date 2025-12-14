/**
 * Agent Runner Types
 * Core types for the execution plane that runs AI coding sessions
 */

import type { ProviderId, PolicySpec, TaskSpec } from '../adapters/types';

/**
 * Session lifecycle states
 */
export type SessionState =
  | 'CREATED'
  | 'PREPARING_WORKSPACE'
  | 'STARTING_PROVIDER'
  | 'RUNNING'
  | 'WAITING_FOR_APPROVAL'
  | 'PAUSED_BY_HUMAN'
  | 'STOPPING'
  | 'COMPLETED'
  | 'FAILED';

/**
 * Repository reference for workspace creation
 */
export type RepoRef = {
  provider: 'github' | 'gitlab' | 'bitbucket';
  owner: string;
  name: string;
  defaultBranch?: string;
};

/**
 * Checkout specification
 */
export type CheckoutSpec =
  | { type: 'branch'; ref: string }
  | { type: 'commit'; sha: string }
  | { type: 'tag'; tag: string };

/**
 * Workspace reference for session isolation
 */
export type WorkspaceRef = {
  workspaceId: string;
  repoRef: RepoRef;
  checkout: CheckoutSpec;
  worktreePath: string;
  roomPath?: string;
  readOnly: boolean;
  createdAt: number;
};

/**
 * Plan tiers
 */
export type PlanTier = 'free' | 'team' | 'enterprise';

/**
 * Billing/plan information for metering
 */
export type BillingInfo = {
  plan: PlanTier;
  orgId: string;
  limits: {
    maxConcurrency: number;
    maxSessionDurationMs?: number;
    maxDailyMinutes?: number;
  };
};

/**
 * Full session configuration
 */
export type SessionConfig = {
  sessionId: string;
  orgId: string;
  userId?: string;
  repoRef: RepoRef;
  checkout: CheckoutSpec;
  roomPath?: string;
  providerId: ProviderId;
  task: TaskSpec;
  policy: PolicySpec;
  billing: BillingInfo;
  env?: Record<string, string>;
  metadata?: Record<string, unknown>;
};

/**
 * Session runtime state
 */
export type SessionRuntimeState = {
  sessionId: string;
  state: SessionState;
  providerId: ProviderId;
  workspace?: WorkspaceRef;
  startedAt?: number;
  providerPid?: number;
  lastEventSeq: number;
  pendingApprovals: string[];
  errorMessage?: string;
  exitCode?: number;
};

/**
 * Approval categories
 */
export type ApprovalCategory =
  | 'merge'
  | 'deps_add'
  | 'secrets'
  | 'deploy'
  | 'shell'
  | 'network';

/**
 * Approval request tracking
 */
export type ApprovalRequest = {
  approvalId: string;
  sessionId: string;
  category: ApprovalCategory;
  summary: string;
  risk: 'low' | 'med' | 'high';
  context?: Record<string, unknown>;
  requestedAt: number;
  timeoutAt?: number;
  resolvedAt?: number;
  decision?: 'allow' | 'deny';
  resolvedBy?: string;
  note?: string;
};

/**
 * Usage metrics for billing
 */
export type UsageMetrics = {
  agentSeconds: number;
  terminalKb: number;
  filesTouched: number;
  commandsRun: number;
  approvalsRequested: number;
};

/**
 * Runner deployment mode
 */
export type RunnerMode = 'hosted' | 'customer_hosted';

/**
 * Runner registration info
 */
export type RunnerInfo = {
  runnerId: string;
  mode: RunnerMode;
  version: string;
  capabilities: string[];
  activeSessionCount: number;
  maxSessions: number;
  lastHeartbeatAt: number;
  providerVersions: Record<ProviderId, string | null>;
};

/**
 * Input modes for terminal
 */
export type InputMode = 'raw' | 'line';

/**
 * Terminal input command
 */
export type TerminalInput = {
  sessionId: string;
  data: string;
  mode: InputMode;
};

/**
 * Session commands from Control Plane
 */
export type SessionCommand =
  | { type: 'START'; config: SessionConfig }
  | { type: 'INPUT'; input: TerminalInput }
  | { type: 'STOP'; graceful: boolean }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'APPROVE'; approvalId: string; decision: 'allow' | 'deny'; note?: string };

export type SessionCommandType = SessionCommand['type'];
