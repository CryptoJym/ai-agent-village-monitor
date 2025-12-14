/**
 * Update Pipeline Handler
 *
 * Exposes update pipeline functionality through control plane APIs.
 * Handles version queries, build info, and rollout management.
 */
import { EventEmitter } from 'events';
import type { ProviderId } from '@ai-agent-village-monitor/shared';
import type { UpdatePipeline, ReleaseChannel } from '@ai-agent-village-monitor/update-pipeline';
import type { ApiResponse, PaginatedResponse, PaginationParams, VersionInfo, BuildInfo, RolloutStatus } from '../types';
/** Update pipeline handler configuration */
export interface UpdatePipelineHandlerConfig {
    /** Enable version caching */
    enableCaching: boolean;
    /** Cache TTL (ms) */
    cacheTtlMs: number;
}
/**
 * UpdatePipelineHandler provides API access to update pipeline operations.
 *
 * Emits:
 * - 'version_queried': When version info is requested
 * - 'rollout_started': When a rollout is initiated
 * - 'rollout_action': When rollout action is taken (pause/resume/rollback)
 */
export declare class UpdatePipelineHandler extends EventEmitter {
    private config;
    private pipeline;
    private versionCache;
    private buildCache;
    constructor(config?: Partial<UpdatePipelineHandlerConfig>);
    /**
     * Set the update pipeline instance.
     */
    setPipeline(pipeline: UpdatePipeline): void;
    /**
     * Get available versions for a provider.
     */
    getVersions(providerId: ProviderId, options?: {
        channel?: 'stable' | 'beta';
        limit?: number;
    }): Promise<ApiResponse<VersionInfo[]>>;
    /**
     * Get build information.
     */
    getBuild(buildId: string): Promise<ApiResponse<BuildInfo>>;
    /**
     * List builds with filtering.
     */
    listBuilds(pagination: PaginationParams, filters?: {
        providerId?: ProviderId;
        status?: 'testing' | 'known_good' | 'known_bad' | 'deprecated';
    }): Promise<ApiResponse<PaginatedResponse<BuildInfo>>>;
    /**
     * Get active rollouts.
     */
    getActiveRollouts(): Promise<ApiResponse<RolloutStatus[]>>;
    /**
     * Get a specific rollout.
     */
    getRollout(rolloutId: string): Promise<ApiResponse<RolloutStatus>>;
    /**
     * Start a new rollout.
     */
    startRollout(buildId: string, channel: ReleaseChannel, options?: {
        targetPercentage?: number;
        orgIds?: string[];
    }): Promise<ApiResponse<RolloutStatus>>;
    /**
     * Pause an active rollout.
     */
    pauseRollout(rolloutId: string): Promise<ApiResponse<RolloutStatus>>;
    /**
     * Resume a paused rollout.
     */
    resumeRollout(rolloutId: string): Promise<ApiResponse<RolloutStatus>>;
    /**
     * Rollback a rollout.
     */
    rollbackRollout(rolloutId: string, reason: string): Promise<ApiResponse<RolloutStatus>>;
    /**
     * Get known-good builds for a provider.
     */
    getKnownGoodBuilds(providerId: ProviderId): Promise<ApiResponse<BuildInfo[]>>;
    /**
     * Clear caches.
     */
    clearCache(): void;
    private fetchVersions;
    private fetchBuild;
    private fetchAllBuilds;
    private fetchActiveRollouts;
    private fetchRollout;
    private fetchKnownGoodEntries;
    private toBuildInfo;
    private toRolloutStatus;
}
export default UpdatePipelineHandler;
//# sourceMappingURL=UpdatePipelineHandler.d.ts.map