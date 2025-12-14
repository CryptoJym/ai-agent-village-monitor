/**
 * Update Pipeline
 *
 * Main orchestrator that coordinates version watching, canary testing,
 * rollouts, and post-update sweeps.
 */
import { EventEmitter } from 'events';
import { VersionWatcher } from './version';
import { CanaryRunner } from './canary';
import { RolloutController } from './rollout';
import { KnownGoodRegistry } from './registry';
import { SweepManager } from './sweep';
const DEFAULT_CONFIG = {
    autoCanary: true,
    autoRollout: false, // Manual approval for rollouts
    autoSweep: false, // Manual trigger for sweeps
};
/**
 * UpdatePipeline orchestrates the entire update lifecycle.
 *
 * Flow:
 * 1. VersionWatcher detects new versions
 * 2. CanaryRunner tests compatibility
 * 3. KnownGoodRegistry records results
 * 4. RolloutController deploys to organizations
 * 5. SweepManager triggers post-update improvements
 *
 * Emits:
 * - 'new_version_detected': When upstream version is found
 * - 'canary_started': When canary testing begins
 * - 'canary_completed': When canary testing completes
 * - 'rollout_initiated': When rollout is started
 * - 'rollout_completed': When rollout finishes
 * - 'sweep_triggered': When post-update sweep starts
 * - 'pipeline_error': When any component errors
 */
export class UpdatePipeline extends EventEmitter {
    config;
    versionWatcher;
    canaryRunner;
    rolloutController;
    registry;
    sweepManager;
    running = false;
    // Track pending operations
    pendingCanaries = new Map();
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        // Initialize components
        this.versionWatcher = new VersionWatcher(config.versionWatcher);
        this.canaryRunner = new CanaryRunner(config.canaryRunner);
        this.rolloutController = new RolloutController(config.rolloutController);
        this.registry = new KnownGoodRegistry(config.registry);
        this.sweepManager = new SweepManager(config.sweepManager);
        // Wire up event handlers
        this.setupEventHandlers();
    }
    /**
     * Start the update pipeline.
     */
    async start() {
        if (this.running) {
            return;
        }
        this.running = true;
        // Start version watching
        await this.versionWatcher.start();
        // Start rollout controller
        this.rolloutController.start();
        this.emit('pipeline_started', { timestamp: new Date() });
    }
    /**
     * Stop the update pipeline.
     */
    stop() {
        this.running = false;
        this.versionWatcher.stop();
        this.rolloutController.stop();
        this.emit('pipeline_stopped', { timestamp: new Date() });
    }
    /**
     * Get pipeline status.
     */
    getStatus() {
        const knownVersions = {};
        for (const providerId of ['codex', 'claude_code', 'gemini_cli']) {
            knownVersions[providerId] = this.versionWatcher.getKnownVersion(providerId)?.version;
        }
        return {
            running: this.running,
            versionWatcherActive: this.versionWatcher.isActive(),
            activeCanaryTests: this.pendingCanaries.size,
            activeRollouts: this.rolloutController.getAllActiveRollouts().length,
            activeSweeps: this.sweepManager.getActiveJobs().length,
            knownVersions: knownVersions,
            recommendedBuilds: {
                stable: this.registry.getRecommendedBuild('stable')?.buildId,
                beta: this.registry.getRecommendedBuild('beta')?.buildId,
                pinned: undefined,
            },
        };
    }
    // ===========================================================================
    // MANUAL OPERATIONS
    // ===========================================================================
    /**
     * Manually check for version updates.
     */
    async checkVersions() {
        return this.versionWatcher.checkAllSources();
    }
    /**
     * Manually run canary tests for a build.
     */
    async runCanaryTests(build) {
        this.emit('canary_started', { buildId: build.buildId, timestamp: new Date() });
        const results = await this.canaryRunner.runAllSuites(build);
        this.emit('canary_completed', {
            buildId: build.buildId,
            results,
            timestamp: new Date(),
        });
        return results;
    }
    /**
     * Manually initiate a rollout.
     */
    async initiateRollout(build, channel) {
        // Get canary results from registry
        const entry = this.registry.getBuildEntry(build.buildId);
        const canaryResult = entry?.compatResults[entry.compatResults.length - 1]
            ? this.createCanaryResultFromCompat(entry.compatResults[entry.compatResults.length - 1])
            : undefined;
        const rollout = await this.rolloutController.initiateRollout(build, channel, canaryResult);
        this.emit('rollout_initiated', {
            rolloutId: rollout.rolloutId,
            buildId: build.buildId,
            channel,
            timestamp: new Date(),
        });
        return rollout;
    }
    /**
     * Manually trigger a post-update sweep.
     */
    async triggerSweep(build, repos) {
        const job = await this.sweepManager.triggerPostUpdateSweep(build, repos);
        this.emit('sweep_triggered', {
            jobId: job.jobId,
            buildId: build.buildId,
            repoCount: repos.filter(r => r.optedIn).length,
            timestamp: new Date(),
        });
        return job.jobId;
    }
    /**
     * Register a new build for testing.
     */
    registerBuild(build) {
        this.registry.registerBuild(build);
        // Register runtime versions
        for (const [providerId, version] of Object.entries(build.runtimeVersions)) {
            const existing = this.registry.getVersion(providerId, version);
            if (!existing) {
                this.registry.registerVersion({
                    providerId: providerId,
                    version,
                    releasedAt: new Date(),
                    canaryPassed: false,
                });
            }
        }
    }
    /**
     * Register organization runtime configuration.
     */
    registerOrgConfig(config) {
        this.rolloutController.registerOrgConfig(config);
    }
    // ===========================================================================
    // COMPONENT ACCESS
    // ===========================================================================
    /**
     * Get the version watcher.
     */
    getVersionWatcher() {
        return this.versionWatcher;
    }
    /**
     * Get the canary runner.
     */
    getCanaryRunner() {
        return this.canaryRunner;
    }
    /**
     * Get the rollout controller.
     */
    getRolloutController() {
        return this.rolloutController;
    }
    /**
     * Get the known-good registry.
     */
    getRegistry() {
        return this.registry;
    }
    /**
     * Get the sweep manager.
     */
    getSweepManager() {
        return this.sweepManager;
    }
    // ===========================================================================
    // PRIVATE HELPERS
    // ===========================================================================
    /**
     * Set up event handlers between components.
     */
    setupEventHandlers() {
        // Version discovered → auto-canary
        this.versionWatcher.on('version_discovered', (event) => {
            this.emit('new_version_detected', event);
            if (this.config.autoCanary) {
                // In a real implementation, this would create a build and test it
                // For now, we just register the version
                this.registry.registerVersion({
                    providerId: event.providerId,
                    version: event.version,
                    releasedAt: event.discoveredAt,
                    sourceUrl: event.sourceUrl,
                    canaryPassed: false,
                });
            }
        });
        // Version watcher errors
        this.versionWatcher.on('check_error', (event) => {
            this.emit('pipeline_error', {
                component: 'version_watcher',
                error: event.error,
                timestamp: event.timestamp,
            });
        });
        // Rollout completed → auto-sweep
        this.rolloutController.on('rollout_completed', (rollout) => {
            this.emit('rollout_completed', {
                rolloutId: rollout.rolloutId,
                buildId: rollout.targetBuildId,
                timestamp: new Date(),
            });
            if (this.config.autoSweep) {
                // In production, this would fetch opted-in repos and trigger sweep
                // Left as placeholder since we don't have actual repo data
            }
        });
        // Rollout rollback
        this.rolloutController.on('rollback_completed', (rollout) => {
            this.emit('rollback_completed', {
                rolloutId: rollout.rolloutId,
                buildId: rollout.targetBuildId,
                reason: rollout.error,
                timestamp: new Date(),
            });
        });
        // Sweep completion
        this.sweepManager.on('sweep_completed', (event) => {
            this.emit('sweep_completed', event);
        });
        // Sweep errors
        this.sweepManager.on('sweep_failed', (event) => {
            this.emit('pipeline_error', {
                component: 'sweep_manager',
                error: event.error,
                timestamp: new Date(),
            });
        });
    }
    /**
     * Create a canary result from compatibility result.
     * Used for rollout validation.
     */
    createCanaryResultFromCompat(compat) {
        return {
            buildId: '',
            suiteId: 'compat_check',
            status: compat.status === 'compatible' ? 'passed' : 'failed',
            startedAt: compat.testedAt,
            completedAt: compat.testedAt,
            testResults: [],
            metrics: {
                totalTests: 1,
                passed: compat.status === 'compatible' ? 1 : 0,
                failed: compat.status === 'compatible' ? 0 : 1,
                errored: 0,
                skipped: 0,
                passRate: compat.status === 'compatible' ? 1 : 0,
                avgSessionStartMs: 0,
                avgTimeToFirstOutputMs: 0,
                disconnectRate: 0,
                ...(compat.metricsJson ?? {}),
            },
        };
    }
}
export default UpdatePipeline;
