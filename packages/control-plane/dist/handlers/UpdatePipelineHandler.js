/**
 * Update Pipeline Handler
 *
 * Exposes update pipeline functionality through control plane APIs.
 * Handles version queries, build info, and rollout management.
 */
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
const DEFAULT_CONFIG = {
    enableCaching: true,
    cacheTtlMs: 60000, // 1 minute
};
/**
 * UpdatePipelineHandler provides API access to update pipeline operations.
 *
 * Emits:
 * - 'version_queried': When version info is requested
 * - 'rollout_started': When a rollout is initiated
 * - 'rollout_action': When rollout action is taken (pause/resume/rollback)
 */
export class UpdatePipelineHandler extends EventEmitter {
    config;
    pipeline = null;
    versionCache = new Map();
    buildCache = new Map();
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Set the update pipeline instance.
     */
    setPipeline(pipeline) {
        this.pipeline = pipeline;
    }
    /**
     * Get available versions for a provider.
     */
    async getVersions(providerId, options) {
        const requestId = uuidv4();
        try {
            // Check cache
            const cacheKey = `${providerId}-${options?.channel ?? 'all'}`;
            if (this.config.enableCaching) {
                const cached = this.versionCache.get(cacheKey);
                if (cached && Date.now() - cached.cachedAt < this.config.cacheTtlMs) {
                    return {
                        success: true,
                        data: cached.data.slice(0, options?.limit ?? cached.data.length),
                        meta: { requestId, timestamp: new Date().toISOString() },
                    };
                }
            }
            // Get versions from pipeline (placeholder - would query version watcher)
            const versions = await this.fetchVersions(providerId, options?.channel);
            // Convert to VersionInfo
            const versionInfos = versions.map(v => ({
                providerId: v.providerId,
                version: v.version,
                releasedAt: v.releasedAt.toISOString(),
                canaryPassed: v.canaryPassed,
                canaryPassedAt: v.canaryPassedAt?.toISOString(),
                sourceUrl: v.sourceUrl,
            }));
            // Cache results
            if (this.config.enableCaching) {
                this.versionCache.set(cacheKey, {
                    data: versionInfos,
                    cachedAt: Date.now(),
                });
            }
            this.emit('version_queried', { providerId, channel: options?.channel });
            return {
                success: true,
                data: versionInfos.slice(0, options?.limit ?? versionInfos.length),
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'VERSION_QUERY_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
    }
    /**
     * Get build information.
     */
    async getBuild(buildId) {
        const requestId = uuidv4();
        try {
            // Check cache
            if (this.config.enableCaching) {
                const cached = this.buildCache.get(buildId);
                if (cached && Date.now() - cached.cachedAt < this.config.cacheTtlMs) {
                    return {
                        success: true,
                        data: cached.data,
                        meta: { requestId, timestamp: new Date().toISOString() },
                    };
                }
            }
            // Get build from registry (placeholder)
            const build = await this.fetchBuild(buildId);
            if (!build) {
                return {
                    success: false,
                    error: {
                        code: 'BUILD_NOT_FOUND',
                        message: `Build ${buildId} not found`,
                    },
                    meta: { requestId, timestamp: new Date().toISOString() },
                };
            }
            const buildInfo = this.toBuildInfo(build);
            // Cache result
            if (this.config.enableCaching) {
                this.buildCache.set(buildId, {
                    data: buildInfo,
                    cachedAt: Date.now(),
                });
            }
            return {
                success: true,
                data: buildInfo,
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'BUILD_QUERY_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
    }
    /**
     * List builds with filtering.
     */
    async listBuilds(pagination, filters) {
        const requestId = uuidv4();
        try {
            // Fetch builds (placeholder)
            let builds = await this.fetchAllBuilds();
            // Apply filters
            if (filters?.providerId) {
                builds = builds.filter(b => Object.keys(b.runtimeVersions).includes(filters.providerId));
            }
            // Sort by build time (newest first)
            builds.sort((a, b) => b.builtAt.getTime() - a.builtAt.getTime());
            // Paginate
            const page = pagination.page ?? 1;
            const pageSize = pagination.pageSize ?? 20;
            const total = builds.length;
            const start = (page - 1) * pageSize;
            const items = builds.slice(start, start + pageSize);
            return {
                success: true,
                data: {
                    items: items.map(b => this.toBuildInfo(b)),
                    total,
                    page,
                    pageSize,
                    hasMore: start + pageSize < total,
                },
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'BUILD_LIST_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
    }
    /**
     * Get active rollouts.
     */
    async getActiveRollouts() {
        const requestId = uuidv4();
        try {
            const rollouts = await this.fetchActiveRollouts();
            const statuses = rollouts.map(r => this.toRolloutStatus(r));
            return {
                success: true,
                data: statuses,
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'ROLLOUT_QUERY_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
    }
    /**
     * Get a specific rollout.
     */
    async getRollout(rolloutId) {
        const requestId = uuidv4();
        try {
            const rollout = await this.fetchRollout(rolloutId);
            if (!rollout) {
                return {
                    success: false,
                    error: {
                        code: 'ROLLOUT_NOT_FOUND',
                        message: `Rollout ${rolloutId} not found`,
                    },
                    meta: { requestId, timestamp: new Date().toISOString() },
                };
            }
            return {
                success: true,
                data: this.toRolloutStatus(rollout),
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'ROLLOUT_QUERY_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
    }
    /**
     * Start a new rollout.
     */
    async startRollout(buildId, channel, options) {
        const requestId = uuidv4();
        try {
            if (!this.pipeline) {
                return {
                    success: false,
                    error: {
                        code: 'PIPELINE_NOT_CONFIGURED',
                        message: 'Update pipeline not configured',
                    },
                    meta: { requestId, timestamp: new Date().toISOString() },
                };
            }
            // Verify build exists
            const build = await this.fetchBuild(buildId);
            if (!build) {
                return {
                    success: false,
                    error: {
                        code: 'BUILD_NOT_FOUND',
                        message: `Build ${buildId} not found`,
                    },
                    meta: { requestId, timestamp: new Date().toISOString() },
                };
            }
            // Start rollout (placeholder - would use pipeline)
            const rollout = {
                rolloutId: uuidv4(),
                targetBuildId: buildId,
                channel,
                state: 'in_progress',
                currentPercentage: 0,
                targetPercentage: options?.targetPercentage ?? 100,
                startedAt: new Date(),
                lastUpdatedAt: new Date(),
                affectedOrgs: options?.orgIds ?? [],
            };
            this.emit('rollout_started', {
                rolloutId: rollout.rolloutId,
                buildId,
                targetPercentage: rollout.targetPercentage,
            });
            return {
                success: true,
                data: this.toRolloutStatus(rollout),
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'ROLLOUT_START_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
    }
    /**
     * Pause an active rollout.
     */
    async pauseRollout(rolloutId) {
        const requestId = uuidv4();
        try {
            const rollout = await this.fetchRollout(rolloutId);
            if (!rollout) {
                return {
                    success: false,
                    error: {
                        code: 'ROLLOUT_NOT_FOUND',
                        message: `Rollout ${rolloutId} not found`,
                    },
                    meta: { requestId, timestamp: new Date().toISOString() },
                };
            }
            if (rollout.state !== 'rolling_out') {
                return {
                    success: false,
                    error: {
                        code: 'INVALID_ROLLOUT_STATE',
                        message: `Cannot pause rollout in state ${rollout.state}`,
                    },
                    meta: { requestId, timestamp: new Date().toISOString() },
                };
            }
            // Update state (placeholder - cast needed for mutation)
            const mutableRollout = rollout;
            mutableRollout.state = 'paused';
            mutableRollout.lastUpdatedAt = new Date();
            this.emit('rollout_action', {
                rolloutId,
                action: 'pause',
                timestamp: new Date(),
            });
            return {
                success: true,
                data: this.toRolloutStatus(rollout),
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'ROLLOUT_PAUSE_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
    }
    /**
     * Resume a paused rollout.
     */
    async resumeRollout(rolloutId) {
        const requestId = uuidv4();
        try {
            const rollout = await this.fetchRollout(rolloutId);
            if (!rollout) {
                return {
                    success: false,
                    error: {
                        code: 'ROLLOUT_NOT_FOUND',
                        message: `Rollout ${rolloutId} not found`,
                    },
                    meta: { requestId, timestamp: new Date().toISOString() },
                };
            }
            if (rollout.state !== 'paused') {
                return {
                    success: false,
                    error: {
                        code: 'INVALID_ROLLOUT_STATE',
                        message: `Cannot resume rollout in state ${rollout.state}`,
                    },
                    meta: { requestId, timestamp: new Date().toISOString() },
                };
            }
            // Update state
            const mutableRollout = rollout;
            mutableRollout.state = 'rolling_out';
            mutableRollout.lastUpdatedAt = new Date();
            this.emit('rollout_action', {
                rolloutId,
                action: 'resume',
                timestamp: new Date(),
            });
            return {
                success: true,
                data: this.toRolloutStatus(rollout),
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'ROLLOUT_RESUME_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
    }
    /**
     * Rollback a rollout.
     */
    async rollbackRollout(rolloutId, reason) {
        const requestId = uuidv4();
        try {
            const rollout = await this.fetchRollout(rolloutId);
            if (!rollout) {
                return {
                    success: false,
                    error: {
                        code: 'ROLLOUT_NOT_FOUND',
                        message: `Rollout ${rolloutId} not found`,
                    },
                    meta: { requestId, timestamp: new Date().toISOString() },
                };
            }
            if (rollout.state === 'rolled_back' || rollout.state === 'completed') {
                return {
                    success: false,
                    error: {
                        code: 'INVALID_ROLLOUT_STATE',
                        message: `Cannot rollback rollout in state ${rollout.state}`,
                    },
                    meta: { requestId, timestamp: new Date().toISOString() },
                };
            }
            // Update state
            const mutableRollout = rollout;
            mutableRollout.state = 'rolled_back';
            mutableRollout.lastUpdatedAt = new Date();
            mutableRollout.error = reason;
            this.emit('rollout_action', {
                rolloutId,
                action: 'rollback',
                reason,
                timestamp: new Date(),
            });
            return {
                success: true,
                data: this.toRolloutStatus(rollout),
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'ROLLOUT_ROLLBACK_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
    }
    /**
     * Get known-good builds for a provider.
     */
    async getKnownGoodBuilds(providerId) {
        const requestId = uuidv4();
        try {
            const entries = await this.fetchKnownGoodEntries(providerId);
            const buildInfos = entries.map(e => ({
                buildId: e.buildId,
                runnerVersion: 'unknown', // Would fetch from build
                builtAt: e.promotedAt?.toISOString() ?? new Date().toISOString(),
                status: e.status,
                recommendation: e.recommendation,
                runtimeVersions: {
                    codex: 'unknown',
                    claude_code: 'unknown',
                    gemini_cli: 'unknown',
                    omnara: 'unknown',
                }, // Would need to fetch from build
            }));
            return {
                success: true,
                data: buildInfos,
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'KNOWN_GOOD_QUERY_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                meta: { requestId, timestamp: new Date().toISOString() },
            };
        }
    }
    /**
     * Clear caches.
     */
    clearCache() {
        this.versionCache.clear();
        this.buildCache.clear();
    }
    // ==========================================================================
    // Private helpers
    // ==========================================================================
    async fetchVersions(_providerId, _channel) {
        // Would query VersionWatcher
        return [];
    }
    async fetchBuild(_buildId) {
        // Would query KnownGoodRegistry
        return null;
    }
    async fetchAllBuilds() {
        // Would query KnownGoodRegistry
        return [];
    }
    async fetchActiveRollouts() {
        // Would query RolloutController
        return [];
    }
    async fetchRollout(_rolloutId) {
        // Would query RolloutController
        return null;
    }
    async fetchKnownGoodEntries(_providerId) {
        // Would query KnownGoodRegistry
        return [];
    }
    toBuildInfo(build) {
        return {
            buildId: build.buildId,
            runnerVersion: build.runnerVersion,
            builtAt: build.builtAt.toISOString(),
            status: 'testing', // Would be determined by registry lookup
            recommendation: 'acceptable', // Would be determined by registry lookup
            runtimeVersions: build.runtimeVersions,
        };
    }
    toRolloutStatus(rollout) {
        return {
            rolloutId: rollout.rolloutId,
            targetBuildId: rollout.targetBuildId,
            channel: rollout.channel,
            state: rollout.state,
            currentPercentage: rollout.currentPercentage,
            startedAt: rollout.startedAt.toISOString(),
            lastUpdatedAt: rollout.lastUpdatedAt.toISOString(),
            affectedOrgsCount: rollout.affectedOrgs.length,
        };
    }
}
export default UpdatePipelineHandler;
