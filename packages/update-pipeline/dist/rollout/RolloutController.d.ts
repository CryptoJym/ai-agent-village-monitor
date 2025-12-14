/**
 * Rollout Controller
 *
 * Manages staged rollouts of new builds across organizations,
 * with support for percentage-based deployments and rollback.
 */
import { EventEmitter } from 'events';
import type { ReleaseChannel, ChannelConfig, ActiveRollout, RolloutEvent, RunnerBuild, CanaryTestResult, OrgRuntimeConfig } from '../types';
/** Rollout controller configuration */
export interface RolloutControllerConfig {
    /** Channel configurations */
    channelConfigs: Record<ReleaseChannel, ChannelConfig>;
    /** Maximum concurrent rollouts */
    maxConcurrentRollouts: number;
    /** Rollout check interval (ms) */
    checkIntervalMs: number;
    /** Enable automatic rollout progression */
    autoProgress: boolean;
    /** Metrics threshold for automatic rollback */
    rollbackThresholds: {
        /** Maximum failure rate before rollback */
        maxFailureRate: number;
        /** Maximum disconnect rate before rollback */
        maxDisconnectRate: number;
        /** Minimum session count before evaluating */
        minSessionCount: number;
    };
}
/** Organization assignment for rollout */
export interface OrgAssignment {
    orgId: string;
    currentBuildId: string | null;
    targetBuildId: string;
    percentage: number;
    assignedAt: Date;
    channel: ReleaseChannel;
}
/** Rollout metrics for decision making */
export interface RolloutMetrics {
    /** Total sessions started */
    sessionsStarted: number;
    /** Sessions completed successfully */
    sessionsCompleted: number;
    /** Sessions failed */
    sessionsFailed: number;
    /** Total disconnects */
    disconnects: number;
    /** Average session start latency (ms) */
    avgStartLatencyMs: number;
    /** Average session duration (ms) */
    avgDurationMs: number;
    /** Failure rate (0-1) */
    failureRate: number;
    /** Disconnect rate (0-1) */
    disconnectRate: number;
}
/**
 * RolloutController manages staged rollouts of new builds.
 *
 * Emits:
 * - 'rollout_started': When a new rollout begins
 * - 'stage_advanced': When rollout progresses to next stage
 * - 'rollout_completed': When rollout reaches 100%
 * - 'rollout_paused': When rollout is paused
 * - 'rollback_initiated': When rollback begins
 * - 'rollback_completed': When rollback finishes
 */
export declare class RolloutController extends EventEmitter {
    private config;
    private activeRollouts;
    private orgConfigs;
    private orgAssignments;
    private eventLog;
    private checkTimer;
    constructor(config?: Partial<RolloutControllerConfig>);
    /**
     * Start the rollout controller.
     */
    start(): void;
    /**
     * Stop the rollout controller.
     */
    stop(): void;
    /**
     * Initiate a new rollout for a build.
     */
    initiateRollout(build: RunnerBuild, channel: ReleaseChannel, canaryResult?: CanaryTestResult): Promise<ActiveRollout>;
    /**
     * Advance a rollout to the next stage.
     */
    advanceRollout(rolloutId: string): Promise<ActiveRollout>;
    /**
     * Pause a rollout.
     */
    pauseRollout(rolloutId: string, reason?: string): ActiveRollout;
    /**
     * Resume a paused rollout.
     */
    resumeRollout(rolloutId: string): ActiveRollout;
    /**
     * Rollback a rollout to previous version.
     */
    rollback(rolloutId: string, reason: string): Promise<ActiveRollout>;
    /**
     * Check and progress rollouts automatically.
     */
    private checkAndProgressRollouts;
    /**
     * Assign organizations to a rollout percentage.
     */
    private assignOrgsToPercentage;
    /**
     * Revert org assignments for a rolled-back rollout.
     */
    private revertOrgAssignments;
    /**
     * Collect metrics for a rollout.
     */
    private collectRolloutMetrics;
    /**
     * Check if metrics warrant a rollback.
     */
    private shouldRollback;
    /**
     * Get count of active rollouts for a channel.
     */
    private getActiveRolloutCount;
    /**
     * Log a rollout event.
     */
    private logEvent;
    /**
     * Register an organization's runtime config.
     */
    registerOrgConfig(config: OrgRuntimeConfig): void;
    /**
     * Get an organization's current assignment.
     */
    getOrgAssignment(orgId: string): OrgAssignment | undefined;
    /**
     * Get an active rollout.
     */
    getRollout(rolloutId: string): ActiveRollout | undefined;
    /**
     * Get all active rollouts.
     */
    getAllActiveRollouts(): ActiveRollout[];
    /**
     * Get rollout events for audit.
     */
    getEventLog(filter?: {
        orgId?: string;
        channel?: ReleaseChannel;
        since?: Date;
    }): RolloutEvent[];
}
export default RolloutController;
//# sourceMappingURL=RolloutController.d.ts.map