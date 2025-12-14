/**
 * Update Pipeline Types
 *
 * Defines all type definitions for version tracking, canary testing,
 * rollouts, and compatibility management.
 */
import { z } from 'zod';
/** Default channel configurations */
export const CHANNEL_CONFIGS = {
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
export function isRuntimeVersion(obj) {
    return RuntimeVersionSchema.safeParse(obj).success;
}
/** Type guard for ReleaseChannel */
export function isReleaseChannel(value) {
    return ReleaseChannelSchema.safeParse(value).success;
}
