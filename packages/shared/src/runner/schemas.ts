/**
 * Zod Schemas for Runner Types
 * Runtime validation for API boundaries
 */

import { z } from 'zod';
import { ProviderIdSchema, PolicySpecSchema, TaskSpecSchema, ProviderEventSchema } from '../adapters/schemas';

// Session States
export const SessionStateSchema = z.enum([
  'CREATED',
  'PREPARING_WORKSPACE',
  'STARTING_PROVIDER',
  'RUNNING',
  'WAITING_FOR_APPROVAL',
  'PAUSED_BY_HUMAN',
  'STOPPING',
  'COMPLETED',
  'FAILED',
]);

// Repo Reference
export const RepoRefSchema = z.object({
  provider: z.enum(['github', 'gitlab', 'bitbucket']),
  owner: z.string().min(1),
  name: z.string().min(1),
  defaultBranch: z.string().optional(),
});

// Checkout Spec
export const CheckoutSpecSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('branch'), ref: z.string() }),
  z.object({ type: z.literal('commit'), sha: z.string() }),
  z.object({ type: z.literal('tag'), tag: z.string() }),
]);

// Billing Info
export const BillingInfoSchema = z.object({
  plan: z.enum(['free', 'team', 'enterprise']),
  orgId: z.string(),
  limits: z.object({
    maxConcurrency: z.number().int().positive(),
    maxSessionDurationMs: z.number().int().positive().optional(),
    maxDailyMinutes: z.number().int().positive().optional(),
  }),
});

// Session Config - used for creating sessions
export const SessionConfigSchema = z.object({
  sessionId: z.string().uuid(),
  orgId: z.string(),
  userId: z.string().optional(),
  repoRef: RepoRefSchema,
  checkout: CheckoutSpecSchema,
  roomPath: z.string().optional(),
  providerId: ProviderIdSchema,
  task: TaskSpecSchema,
  policy: PolicySpecSchema,
  billing: BillingInfoSchema,
  env: z.record(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Terminal Input
export const TerminalInputSchema = z.object({
  sessionId: z.string(),
  data: z.string(),
  mode: z.enum(['raw', 'line']),
});

// Approval Decision
export const ApprovalDecisionSchema = z.object({
  approvalId: z.string(),
  decision: z.enum(['allow', 'deny']),
  note: z.string().optional(),
});

// Usage Metrics
export const UsageMetricsSchema = z.object({
  agentSeconds: z.number().nonnegative(),
  terminalKb: z.number().nonnegative(),
  filesTouched: z.number().int().nonnegative(),
  commandsRun: z.number().int().nonnegative(),
  approvalsRequested: z.number().int().nonnegative(),
});

// Base Runner Event
const BaseRunnerEventSchema = z.object({
  sessionId: z.string(),
  orgId: z.string(),
  repoRef: RepoRefSchema.optional(),
  ts: z.number(),
  seq: z.number().int().nonnegative(),
});

// Runner Events
export const SessionStartedEventSchema = BaseRunnerEventSchema.extend({
  type: z.literal('SESSION_STARTED'),
  providerId: ProviderIdSchema,
  providerVersion: z.string(),
  workspacePath: z.string(),
  roomPath: z.string().optional(),
});

export const SessionStateChangedEventSchema = BaseRunnerEventSchema.extend({
  type: z.literal('SESSION_STATE_CHANGED'),
  previousState: SessionStateSchema,
  newState: SessionStateSchema,
  reason: z.string().optional(),
});

export const TerminalChunkEventSchema = BaseRunnerEventSchema.extend({
  type: z.literal('TERMINAL_CHUNK'),
  data: z.string(),
  stream: z.enum(['stdout', 'stderr']),
});

export const FileTouchedEventSchema = BaseRunnerEventSchema.extend({
  type: z.literal('FILE_TOUCHED'),
  path: z.string(),
  roomPath: z.string().optional(),
  reason: z.enum(['read', 'write', 'delete', 'diff']),
});

export const DiffSummaryEventSchema = BaseRunnerEventSchema.extend({
  type: z.literal('DIFF_SUMMARY'),
  filesChanged: z.number().int().nonnegative(),
  linesAdded: z.number().int().nonnegative(),
  linesRemoved: z.number().int().nonnegative(),
  files: z.array(z.object({
    path: z.string(),
    status: z.enum(['added', 'modified', 'deleted', 'renamed']),
    additions: z.number().int().nonnegative(),
    deletions: z.number().int().nonnegative(),
  })),
});

export const TestRunStartedEventSchema = BaseRunnerEventSchema.extend({
  type: z.literal('TEST_RUN_STARTED'),
  command: z.string(),
  testFiles: z.array(z.string()).optional(),
});

export const TestRunFinishedEventSchema = BaseRunnerEventSchema.extend({
  type: z.literal('TEST_RUN_FINISHED'),
  exitCode: z.number().int(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  duration: z.number().nonnegative(),
});

export const ApprovalRequestedEventSchema = BaseRunnerEventSchema.extend({
  type: z.literal('APPROVAL_REQUESTED'),
  approval: z.object({
    approvalId: z.string(),
    sessionId: z.string(),
    category: z.enum(['merge', 'deps_add', 'secrets', 'deploy', 'shell', 'network']),
    summary: z.string(),
    risk: z.enum(['low', 'med', 'high']),
    context: z.record(z.unknown()).optional(),
    requestedAt: z.number(),
    timeoutAt: z.number().optional(),
  }),
});

export const ApprovalResolvedEventSchema = BaseRunnerEventSchema.extend({
  type: z.literal('APPROVAL_RESOLVED'),
  approvalId: z.string(),
  decision: z.enum(['allow', 'deny']),
  resolvedBy: z.string().optional(),
  note: z.string().optional(),
});

export const AlertRaisedEventSchema = BaseRunnerEventSchema.extend({
  type: z.literal('ALERT_RAISED'),
  alertId: z.string(),
  severity: z.enum(['info', 'warn', 'error', 'critical']),
  category: z.enum(['security', 'performance', 'build', 'test', 'dependency', 'policy']),
  title: z.string(),
  description: z.string(),
  context: z.record(z.unknown()).optional(),
});

export const UsageTickEventSchema = BaseRunnerEventSchema.extend({
  type: z.literal('USAGE_TICK'),
  providerId: ProviderIdSchema,
  units: UsageMetricsSchema,
  intervalMs: z.number().positive(),
});

export const SessionEndedEventSchema = BaseRunnerEventSchema.extend({
  type: z.literal('SESSION_ENDED'),
  finalState: SessionStateSchema,
  exitCode: z.number().int().optional(),
  totalDurationMs: z.number().nonnegative(),
  totalUsage: UsageMetricsSchema,
});

export const ProviderEventForwardedEventSchema = BaseRunnerEventSchema.extend({
  type: z.literal('PROVIDER_EVENT_FORWARDED'),
  providerEvent: ProviderEventSchema,
});

// Discriminated union of all runner events
export const RunnerEventSchema = z.discriminatedUnion('type', [
  SessionStartedEventSchema,
  SessionStateChangedEventSchema,
  TerminalChunkEventSchema,
  FileTouchedEventSchema,
  DiffSummaryEventSchema,
  TestRunStartedEventSchema,
  TestRunFinishedEventSchema,
  ApprovalRequestedEventSchema,
  ApprovalResolvedEventSchema,
  AlertRaisedEventSchema,
  UsageTickEventSchema,
  SessionEndedEventSchema,
  ProviderEventForwardedEventSchema,
]);

// Session Command Schemas
export const SessionCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('START'), config: SessionConfigSchema }),
  z.object({ type: z.literal('INPUT'), input: TerminalInputSchema }),
  z.object({ type: z.literal('STOP'), graceful: z.boolean() }),
  z.object({ type: z.literal('PAUSE') }),
  z.object({ type: z.literal('RESUME') }),
  z.object({ type: z.literal('APPROVE'), approvalId: z.string(), decision: z.enum(['allow', 'deny']), note: z.string().optional() }),
]);

// Type inference
export type SessionStateFromSchema = z.infer<typeof SessionStateSchema>;
export type SessionConfigFromSchema = z.infer<typeof SessionConfigSchema>;
export type RunnerEventFromSchema = z.infer<typeof RunnerEventSchema>;
export type SessionCommandFromSchema = z.infer<typeof SessionCommandSchema>;
