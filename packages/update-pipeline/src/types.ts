/**
 * Update Pipeline Types
 *
 * Defines all type definitions for version tracking, canary testing,
 * rollouts, and compatibility management.
 */

import { z } from 'zod';
import type { ProviderId } from '@ai-agent-village-monitor/shared';

// =============================================================================
// PROVIDER & RUNTIME VERSION TYPES
// =============================================================================

/** Runtime version for a provider CLI */
export interface RuntimeVersion {
  /** Provider identifier (codex, claude_code, gemini_cli) */
  providerId: ProviderId;
  /** Semantic version string */
  version: string;
  /** When this version was released upstream */
  releasedAt: Date;
  /** URL to release notes or source */
  sourceUrl?: string;
  /** SHA256 hash for verification (enterprise) */
  checksum?: string;
  /** Whether this version has passed canary tests */
  canaryPassed: boolean;
  /** When canary tests passed */
  canaryPassedAt?: Date;
}

/** Adapter version bundled with runner */
export interface AdapterVersion {
  /** Adapter identifier */
  adapterId: string;
  /** Semantic version */
  version: string;
  /** Compatible provider versions (semver ranges) */
  compatibleProviders: Record<ProviderId, string>;
}

/** A complete runner build with all bundled components */
export interface RunnerBuild {
  /** Unique build identifier */
  buildId: string;
  /** Runner version */
  runnerVersion: string;
  /** Bundled adapter versions */
  adapters: AdapterVersion[];
  /** Bundled runtime versions */
  runtimeVersions: Record<ProviderId, string>;
  /** Build timestamp */
  builtAt: Date;
  /** Build metadata */
  metadata: {
    /** Git commit SHA */
    commitSha: string;
    /** Build environment */
    buildEnv: string;
    /** Additional tags */
    tags: string[];
  };
}

// =============================================================================
// RELEASE CHANNEL TYPES
// =============================================================================

/** Available release channels */
export type ReleaseChannel = 'stable' | 'beta' | 'pinned';

/** Channel configuration */
export interface ChannelConfig {
  /** Channel identifier */
  channel: ReleaseChannel;
  /** Human-readable description */
  description: string;
  /** Whether canary testing is required before promotion */
  requiresCanary: boolean;
  /** Minimum canary pass threshold (0-1) */
  canaryThreshold: number;
  /** Rollout percentage stages */
  rolloutStages: number[];
  /** Hours to wait between rollout stages */
  rolloutDelayHours: number;
}

/** Default channel configurations */
export const CHANNEL_CONFIGS: Record<ReleaseChannel, ChannelConfig> = {
  stable: {
    channel: 'stable',
    description: 'Production-ready releases, fully tested',
    requiresCanary: true,
    canaryThreshold: 0.95,
    rolloutStages: [1, 10, 50, 100],
    rolloutDelayHours: 24,
  },
  beta: {
    channel: 'beta',
    description: 'Early access releases, canary tested',
    requiresCanary: true,
    canaryThreshold: 0.80,
    rolloutStages: [10, 50, 100],
    rolloutDelayHours: 6,
  },
  pinned: {
    channel: 'pinned',
    description: 'Enterprise pinned version, manual updates only',
    requiresCanary: false,
    canaryThreshold: 0,
    rolloutStages: [100],
    rolloutDelayHours: 0,
  },
};

// =============================================================================
// COMPATIBILITY TESTING TYPES
// =============================================================================

/** Canary test suite definition */
export interface CanaryTestSuite {
  /** Unique test suite identifier */
  suiteId: string;
  /** Human-readable name */
  name: string;
  /** Test cases in this suite */
  testCases: CanaryTestCase[];
  /** Timeout for entire suite (ms) */
  timeoutMs: number;
}

/** Individual canary test case */
export interface CanaryTestCase {
  /** Test case identifier */
  testId: string;
  /** Description of what this tests */
  description: string;
  /** Provider(s) this test applies to */
  providers: ProviderId[];
  /** Test type */
  type: 'adapter_contract' | 'golden_path' | 'approval_gate' | 'metering';
  /** Test configuration */
  config: {
    /** Repository to use for test */
    repoUrl?: string;
    /** Task/prompt to execute */
    prompt?: string;
    /** Expected outcome */
    expectedOutcome?: 'success' | 'blocked' | 'diff_generated';
    /** Timeout (ms) */
    timeoutMs?: number;
  };
}

/** Result of a canary test run */
export interface CanaryTestResult {
  /** Build being tested */
  buildId: string;
  /** Test suite that was run */
  suiteId: string;
  /** Overall status */
  status: 'passed' | 'failed' | 'error' | 'timeout';
  /** When test started */
  startedAt: Date;
  /** When test completed */
  completedAt: Date;
  /** Individual test results */
  testResults: TestCaseResult[];
  /** Aggregated metrics */
  metrics: CanaryMetrics;
}

/** Individual test case result */
export interface TestCaseResult {
  /** Test case identifier */
  testId: string;
  /** Status */
  status: 'passed' | 'failed' | 'error' | 'skipped' | 'timeout';
  /** Duration (ms) */
  durationMs: number;
  /** Error message if failed */
  errorMessage?: string;
  /** Captured logs/output */
  output?: string;
}

/** Aggregated canary metrics */
export interface CanaryMetrics {
  /** Total tests run */
  totalTests: number;
  /** Tests passed */
  passed: number;
  /** Tests failed */
  failed: number;
  /** Tests errored */
  errored: number;
  /** Tests skipped */
  skipped: number;
  /** Pass rate (0-1) */
  passRate: number;
  /** Average session start latency (ms) */
  avgSessionStartMs: number;
  /** Average time to first output (ms) */
  avgTimeToFirstOutputMs: number;
  /** Disconnect rate (0-1) */
  disconnectRate: number;
}

/** Compatibility result stored in registry */
export interface CompatibilityResult {
  /** Unique result identifier */
  resultId: string;
  /** Build tested */
  buildId: string;
  /** Test suite used */
  testSuiteId: string;
  /** Overall status */
  status: 'compatible' | 'incompatible' | 'partial' | 'unknown';
  /** When tested */
  testedAt: Date;
  /** Full metrics JSON */
  metricsJson: Record<string, unknown>;
  /** Recommended configuration flags */
  recommendedFlags?: Record<string, string>;
  /** Notes/warnings */
  notes?: string;
}

// =============================================================================
// ROLLOUT TYPES
// =============================================================================

/** Rollout state */
export type RolloutState =
  | 'pending'
  | 'canary_testing'
  | 'canary_passed'
  | 'canary_failed'
  | 'rolling_out'
  | 'paused'
  | 'completed'
  | 'rolled_back';

/** Rollout event for audit trail */
export interface RolloutEvent {
  /** Unique event identifier */
  eventId: string;
  /** Organization affected */
  orgId: string;
  /** Previous build */
  fromBuildId: string | null;
  /** Target build (null for rollbacks where target varies by org) */
  toBuildId: string | null;
  /** Channel */
  channel: ReleaseChannel;
  /** Event type */
  eventType:
    | 'rollout_started'
    | 'stage_advanced'
    | 'rollout_paused'
    | 'rollout_resumed'
    | 'rollout_completed'
    | 'rollback_initiated'
    | 'rollback_completed';
  /** Current rollout percentage */
  currentPercentage: number;
  /** Timestamp */
  timestamp: Date;
  /** Actor (user or system) */
  actor: {
    type: 'system' | 'user';
    id: string;
    name?: string;
  };
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Active rollout tracking */
export interface ActiveRollout {
  /** Rollout identifier */
  rolloutId: string;
  /** Target build */
  targetBuildId: string;
  /** Channel */
  channel: ReleaseChannel;
  /** Current state */
  state: RolloutState;
  /** Current percentage */
  currentPercentage: number;
  /** Target percentage */
  targetPercentage: number;
  /** Rollout start time */
  startedAt: Date;
  /** Last state change */
  lastUpdatedAt: Date;
  /** Affected organizations */
  affectedOrgs: string[];
  /** Canary result reference */
  canaryResultId?: string;
  /** Error if failed */
  error?: string;
}

// =============================================================================
// ORGANIZATION CONFIGURATION TYPES
// =============================================================================

/** Organization's runtime configuration */
export interface OrgRuntimeConfig {
  /** Organization identifier */
  orgId: string;
  /** Selected channel */
  channel: ReleaseChannel;
  /** Pinned build (only for 'pinned' channel) */
  pinnedBuildId?: string;
  /** Beta opt-in */
  betaOptIn: boolean;
  /** Auto-upgrade enabled */
  autoUpgrade: boolean;
  /** Notification preferences */
  notifications: {
    /** Email on new versions */
    emailOnNewVersion: boolean;
    /** Email on rollout start */
    emailOnRolloutStart: boolean;
    /** Webhook URL for notifications */
    webhookUrl?: string;
  };
  /** Enterprise settings */
  enterprise?: {
    /** Require signed builds */
    requireSignedBuilds: boolean;
    /** Minimum canary threshold */
    minCanaryThreshold: number;
    /** Approval required for upgrades */
    approvalRequired: boolean;
    /** Audit log retention days */
    auditRetentionDays: number;
  };
  /** Last updated */
  updatedAt: Date;
  /** Updated by */
  updatedBy: string;
}

// =============================================================================
// SWEEP TYPES (Post-Update Improvement Sweeps)
// =============================================================================

/** Sweep configuration */
export interface SweepConfig {
  /** Sweep identifier */
  sweepId: string;
  /** Triggered by build */
  triggeredByBuildId: string;
  /** Target repositories */
  targetRepos: SweepRepoTarget[];
  /** Sweep type */
  sweepType: 'maintenance' | 'lint_fix' | 'dependency_update' | 'custom';
  /** Whether to auto-create PRs */
  createPRs: boolean;
  /** Whether to auto-merge (NEVER by default) */
  autoMerge: false; // Explicitly typed as false - safety constraint
  /** Priority */
  priority: 'low' | 'normal' | 'high';
  /** Maximum repos to sweep per run */
  maxReposPerRun: number;
  /** Rate limit (repos per minute) */
  rateLimit: number;
}

/** Individual repo target for sweep */
export interface SweepRepoTarget {
  /** Repository reference */
  repoUrl: string;
  /** Organization owning the repo */
  orgId: string;
  /** Whether sweep is opted-in */
  optedIn: boolean;
  /** Last sweep time */
  lastSweptAt?: Date;
}

/** Sweep execution result */
export interface SweepResult {
  /** Sweep identifier */
  sweepId: string;
  /** Repo that was swept */
  repoUrl: string;
  /** Status */
  status: 'success' | 'failed' | 'skipped' | 'no_changes';
  /** PR created (if any) */
  prUrl?: string;
  /** Changes summary */
  changesSummary?: {
    filesModified: number;
    linesAdded: number;
    linesRemoved: number;
  };
  /** Duration (ms) */
  durationMs: number;
  /** Error if failed */
  error?: string;
  /** Timestamp */
  completedAt: Date;
}

// =============================================================================
// KNOWN-GOOD REGISTRY TYPES
// =============================================================================

/** Known-good registry entry */
export interface KnownGoodEntry {
  /** Entry identifier */
  entryId: string;
  /** Build reference */
  buildId: string;
  /** Status */
  status: 'known_good' | 'known_bad' | 'testing' | 'deprecated';
  /** Promotion date */
  promotedAt?: Date;
  /** Deprecation date */
  deprecatedAt?: Date;
  /** Deprecation reason */
  deprecationReason?: string;
  /** Compatibility results */
  compatResults: CompatibilityResult[];
  /** Recommendation */
  recommendation: 'recommended' | 'acceptable' | 'not_recommended' | 'blocked';
}

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

/** Runtime version schema */
export const RuntimeVersionSchema = z.object({
  providerId: z.enum(['codex', 'claude_code', 'gemini_cli']),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[\w.]+)?$/),
  releasedAt: z.coerce.date(),
  sourceUrl: z.string().url().optional(),
  checksum: z.string().optional(),
  canaryPassed: z.boolean(),
  canaryPassedAt: z.coerce.date().optional(),
});

/** Release channel schema */
export const ReleaseChannelSchema = z.enum(['stable', 'beta', 'pinned']);

/** Canary metrics schema */
export const CanaryMetricsSchema = z.object({
  totalTests: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  errored: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  passRate: z.number().min(0).max(1),
  avgSessionStartMs: z.number().nonnegative(),
  avgTimeToFirstOutputMs: z.number().nonnegative(),
  disconnectRate: z.number().min(0).max(1),
});

/** Rollout state schema */
export const RolloutStateSchema = z.enum([
  'pending',
  'canary_testing',
  'canary_passed',
  'canary_failed',
  'rolling_out',
  'paused',
  'completed',
  'rolled_back',
]);

/** Org runtime config schema */
export const OrgRuntimeConfigSchema = z.object({
  orgId: z.string().uuid(),
  channel: ReleaseChannelSchema,
  pinnedBuildId: z.string().optional(),
  betaOptIn: z.boolean(),
  autoUpgrade: z.boolean(),
  notifications: z.object({
    emailOnNewVersion: z.boolean(),
    emailOnRolloutStart: z.boolean(),
    webhookUrl: z.string().url().optional(),
  }),
  enterprise: z.object({
    requireSignedBuilds: z.boolean(),
    minCanaryThreshold: z.number().min(0).max(1),
    approvalRequired: z.boolean(),
    auditRetentionDays: z.number().int().positive(),
  }).optional(),
  updatedAt: z.coerce.date(),
  updatedBy: z.string(),
});

// =============================================================================
// TYPE GUARDS
// =============================================================================

/** Type guard for RuntimeVersion */
export function isRuntimeVersion(obj: unknown): obj is RuntimeVersion {
  return RuntimeVersionSchema.safeParse(obj).success;
}

/** Type guard for ReleaseChannel */
export function isReleaseChannel(value: unknown): value is ReleaseChannel {
  return ReleaseChannelSchema.safeParse(value).success;
}
