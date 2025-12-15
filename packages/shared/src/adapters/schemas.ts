/**
 * Zod Schemas for Provider Adapter Types
 * Runtime validation for API boundaries
 */

import { z } from 'zod';

// Provider ID
export const ProviderIdSchema = z.enum(['codex', 'claude_code', 'gemini_cli', 'omnara']);

// Capability
export const CapabilitySchema = z.object({
  ptyStreaming: z.boolean(),
  structuredEdits: z.enum(['none', 'diff', 'fileEvents']),
  supportsMCP: z.boolean(),
  supportsNonInteractive: z.boolean(),
  supportsPlanAndExecute: z.boolean(),
  supportsPRFlow: z.enum(['none', 'draft', 'full']),
  maxContextHint: z.string().optional(),
});

// Task Spec
export const TaskSpecSchema = z.object({
  title: z.string().min(1).max(200),
  goal: z.string().min(1).max(2000),
  constraints: z.array(z.string()),
  acceptance: z.array(z.string()),
  roomPath: z.string().optional(),
  branchName: z.string().optional(),
});

// Approval categories
export const ApprovalCategorySchema = z.enum([
  'merge',
  'deps_add',
  'secrets',
  'deploy',
  'shell',
  'network',
]);

// Policy Spec
export const PolicySpecSchema = z.object({
  shellAllowlist: z.array(z.string()),
  shellDenylist: z.array(z.string()),
  requiresApprovalFor: z.array(z.enum(['merge', 'deps_add', 'secrets', 'deploy'])),
  networkMode: z.enum(['restricted', 'open']),
});

// Start Session Args
export const StartSessionArgsSchema = z.object({
  sessionId: z.string().optional(),
  repoPath: z.string().min(1),
  task: TaskSpecSchema,
  policy: PolicySpecSchema,
  env: z.record(z.string()),
});

// Detection Result
export const DetectionResultSchema = z.object({
  installed: z.boolean(),
  version: z.string().optional(),
  details: z.string().optional(),
});

// Risk level
export const RiskLevelSchema = z.enum(['low', 'med', 'high']);

// Severity
export const SeveritySchema = z.enum(['info', 'warn', 'error']);

// Base Provider Event
const BaseProviderEventSchema = z.object({
  providerId: ProviderIdSchema,
  timestamp: z.number(),
  sessionId: z.string().optional(),
});

// Provider Events
export const ProviderStartedEventSchema = BaseProviderEventSchema.extend({
  type: z.literal('PROVIDER_STARTED'),
  version: z.string(),
  capabilities: z.array(z.string()).optional(),
});

export const ProviderMessageEventSchema = BaseProviderEventSchema.extend({
  type: z.literal('PROVIDER_MESSAGE'),
  text: z.string(),
  severity: SeveritySchema.optional(),
  source: z.enum(['stdout', 'stderr', 'internal']).optional(),
});

export const RequestApprovalEventSchema = BaseProviderEventSchema.extend({
  type: z.literal('REQUEST_APPROVAL'),
  approvalId: z.string(),
  category: ApprovalCategorySchema,
  summary: z.string(),
  risk: RiskLevelSchema,
  context: z.record(z.unknown()).optional(),
  timeout: z.number().optional(),
});

export const HintFilesTouchedEventSchema = BaseProviderEventSchema.extend({
  type: z.literal('HINT_FILES_TOUCHED'),
  paths: z.array(z.string()),
  roomPath: z.string().optional(),
  operation: z.enum(['read', 'write', 'delete']).optional(),
});

export const HintDiffAvailableEventSchema = BaseProviderEventSchema.extend({
  type: z.literal('HINT_DIFF_AVAILABLE'),
  summary: z.string().optional(),
  filesChanged: z.number().optional(),
  linesAdded: z.number().optional(),
  linesRemoved: z.number().optional(),
});

export const ProviderErrorEventSchema = BaseProviderEventSchema.extend({
  type: z.literal('PROVIDER_ERROR'),
  error: z.string(),
  code: z.string().optional(),
  recoverable: z.boolean(),
  stack: z.string().optional(),
});

export const ProviderStoppedEventSchema = BaseProviderEventSchema.extend({
  type: z.literal('PROVIDER_STOPPED'),
  exitCode: z.number().optional(),
  reason: z.enum(['completed', 'error', 'timeout', 'user_stopped', 'policy_violation']),
});

export const ToolRequestEventSchema = BaseProviderEventSchema.extend({
  type: z.literal('TOOL_REQUEST'),
  toolName: z.string(),
  args: z.record(z.unknown()),
  requestId: z.string(),
});

// Discriminated union of all provider events
export const ProviderEventSchema = z.discriminatedUnion('type', [
  ProviderStartedEventSchema,
  ProviderMessageEventSchema,
  RequestApprovalEventSchema,
  HintFilesTouchedEventSchema,
  HintDiffAvailableEventSchema,
  ProviderErrorEventSchema,
  ProviderStoppedEventSchema,
  ToolRequestEventSchema,
]);

// Type inference
export type ProviderIdFromSchema = z.infer<typeof ProviderIdSchema>;
export type CapabilityFromSchema = z.infer<typeof CapabilitySchema>;
export type TaskSpecFromSchema = z.infer<typeof TaskSpecSchema>;
export type PolicySpecFromSchema = z.infer<typeof PolicySpecSchema>;
export type StartSessionArgsFromSchema = z.infer<typeof StartSessionArgsSchema>;
export type ProviderEventFromSchema = z.infer<typeof ProviderEventSchema>;
