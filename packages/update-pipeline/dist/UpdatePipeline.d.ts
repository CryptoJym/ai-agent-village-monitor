/**
 * Update Pipeline
 *
 * Main orchestrator that coordinates version watching, canary testing,
 * rollouts, and post-update sweeps.
 */
import { EventEmitter } from 'events';
import type { ProviderId } from '@ai-agent-village-monitor/shared';
import { VersionWatcher, type VersionWatcherConfig } from './version';
import { CanaryRunner, type CanaryRunnerConfig } from './canary';
import { RolloutController, type RolloutControllerConfig } from './rollout';
import { KnownGoodRegistry, type KnownGoodRegistryConfig } from './registry';
import { SweepManager, type SweepManagerConfig } from './sweep';
import type { RuntimeVersion, RunnerBuild, ReleaseChannel, CanaryTestResult, ActiveRollout, SweepRepoTarget, OrgRuntimeConfig } from './types';
/** Update pipeline configuration */
export interface UpdatePipelineConfig {
    /** Version watcher config */
    versionWatcher?: Partial<VersionWatcherConfig>;
    /** Canary runner config */
    canaryRunner?: Partial<CanaryRunnerConfig>;
    /** Rollout controller config */
    rolloutController?: Partial<RolloutControllerConfig>;
    /** Known-good registry config */
    registry?: Partial<KnownGoodRegistryConfig>;
    /** Sweep manager config */
    sweepManager?: Partial<SweepManagerConfig>;
    /** Auto-canary new versions */
    autoCanary: boolean;
    /** Auto-rollout after canary passes */
    autoRollout: boolean;
    /** Auto-sweep after rollout completes */
    autoSweep: boolean;
}
/** Pipeline status */
export interface PipelineStatus {
    /** Whether pipeline is running */
    running: boolean;
    /** Version watcher active */
    versionWatcherActive: boolean;
    /** Active canary tests */
    activeCanaryTests: number;
    /** Active rollouts */
    activeRollouts: number;
    /** Active sweeps */
    activeSweeps: number;
    /** Known versions per provider */
    knownVersions: Record<ProviderId, string | undefined>;
    /** Recommended builds per channel */
    recommendedBuilds: Record<ReleaseChannel, string | undefined>;
}
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
export declare class UpdatePipeline extends EventEmitter {
    private config;
    private versionWatcher;
    private canaryRunner;
    private rolloutController;
    private registry;
    private sweepManager;
    private running;
    private pendingCanaries;
    constructor(config?: Partial<UpdatePipelineConfig>);
    /**
     * Start the update pipeline.
     */
    start(): Promise<void>;
    /**
     * Stop the update pipeline.
     */
    stop(): void;
    /**
     * Get pipeline status.
     */
    getStatus(): PipelineStatus;
    /**
     * Manually check for version updates.
     */
    checkVersions(): Promise<RuntimeVersion[]>;
    /**
     * Manually run canary tests for a build.
     */
    runCanaryTests(build: RunnerBuild): Promise<CanaryTestResult[]>;
    /**
     * Manually initiate a rollout.
     */
    initiateRollout(build: RunnerBuild, channel: ReleaseChannel): Promise<ActiveRollout>;
    /**
     * Manually trigger a post-update sweep.
     */
    triggerSweep(build: RunnerBuild, repos: SweepRepoTarget[]): Promise<string>;
    /**
     * Register a new build for testing.
     */
    registerBuild(build: RunnerBuild): void;
    /**
     * Register organization runtime configuration.
     */
    registerOrgConfig(config: OrgRuntimeConfig): void;
    /**
     * Get the version watcher.
     */
    getVersionWatcher(): VersionWatcher;
    /**
     * Get the canary runner.
     */
    getCanaryRunner(): CanaryRunner;
    /**
     * Get the rollout controller.
     */
    getRolloutController(): RolloutController;
    /**
     * Get the known-good registry.
     */
    getRegistry(): KnownGoodRegistry;
    /**
     * Get the sweep manager.
     */
    getSweepManager(): SweepManager;
    /**
     * Set up event handlers between components.
     */
    private setupEventHandlers;
    /**
     * Create a canary result from compatibility result.
     * Used for rollout validation.
     */
    private createCanaryResultFromCompat;
}
export default UpdatePipeline;
//# sourceMappingURL=UpdatePipeline.d.ts.map