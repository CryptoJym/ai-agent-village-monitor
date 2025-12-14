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
import type {
  RuntimeVersion,
  RunnerBuild,
  ReleaseChannel,
  CanaryTestResult,
  ActiveRollout,
  SweepRepoTarget,
  OrgRuntimeConfig,
} from './types';

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

const DEFAULT_CONFIG: UpdatePipelineConfig = {
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
  private config: UpdatePipelineConfig;
  private versionWatcher: VersionWatcher;
  private canaryRunner: CanaryRunner;
  private rolloutController: RolloutController;
  private registry: KnownGoodRegistry;
  private sweepManager: SweepManager;
  private running = false;

  // Track pending operations
  private pendingCanaries: Map<string, Promise<CanaryTestResult[]>> = new Map();

  constructor(config: Partial<UpdatePipelineConfig> = {}) {
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
  async start(): Promise<void> {
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
  stop(): void {
    this.running = false;

    this.versionWatcher.stop();
    this.rolloutController.stop();

    this.emit('pipeline_stopped', { timestamp: new Date() });
  }

  /**
   * Get pipeline status.
   */
  getStatus(): PipelineStatus {
    const knownVersions: Record<string, string | undefined> = {};
    for (const providerId of ['codex', 'claude_code', 'gemini_cli'] as ProviderId[]) {
      knownVersions[providerId] = this.versionWatcher.getKnownVersion(providerId)?.version;
    }

    return {
      running: this.running,
      versionWatcherActive: this.versionWatcher.isActive(),
      activeCanaryTests: this.pendingCanaries.size,
      activeRollouts: this.rolloutController.getAllActiveRollouts().length,
      activeSweeps: this.sweepManager.getActiveJobs().length,
      knownVersions: knownVersions as Record<ProviderId, string | undefined>,
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
  async checkVersions(): Promise<RuntimeVersion[]> {
    return this.versionWatcher.checkAllSources();
  }

  /**
   * Manually run canary tests for a build.
   */
  async runCanaryTests(build: RunnerBuild): Promise<CanaryTestResult[]> {
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
  async initiateRollout(
    build: RunnerBuild,
    channel: ReleaseChannel
  ): Promise<ActiveRollout> {
    // Get canary results from registry
    const entry = this.registry.getBuildEntry(build.buildId);
    const canaryResult = entry?.compatResults[entry.compatResults.length - 1]
      ? this.createCanaryResultFromCompat(entry.compatResults[entry.compatResults.length - 1])
      : undefined;

    const rollout = await this.rolloutController.initiateRollout(
      build,
      channel,
      canaryResult
    );

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
  async triggerSweep(
    build: RunnerBuild,
    repos: SweepRepoTarget[]
  ): Promise<string> {
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
  registerBuild(build: RunnerBuild): void {
    this.registry.registerBuild(build);

    // Register runtime versions
    for (const [providerId, version] of Object.entries(build.runtimeVersions)) {
      const existing = this.registry.getVersion(providerId as ProviderId, version);
      if (!existing) {
        this.registry.registerVersion({
          providerId: providerId as ProviderId,
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
  registerOrgConfig(config: OrgRuntimeConfig): void {
    this.rolloutController.registerOrgConfig(config);
  }

  // ===========================================================================
  // COMPONENT ACCESS
  // ===========================================================================

  /**
   * Get the version watcher.
   */
  getVersionWatcher(): VersionWatcher {
    return this.versionWatcher;
  }

  /**
   * Get the canary runner.
   */
  getCanaryRunner(): CanaryRunner {
    return this.canaryRunner;
  }

  /**
   * Get the rollout controller.
   */
  getRolloutController(): RolloutController {
    return this.rolloutController;
  }

  /**
   * Get the known-good registry.
   */
  getRegistry(): KnownGoodRegistry {
    return this.registry;
  }

  /**
   * Get the sweep manager.
   */
  getSweepManager(): SweepManager {
    return this.sweepManager;
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Set up event handlers between components.
   */
  private setupEventHandlers(): void {
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
    this.rolloutController.on('rollout_completed', (rollout: ActiveRollout) => {
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
    this.rolloutController.on('rollback_completed', (rollout: ActiveRollout) => {
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
  private createCanaryResultFromCompat(compat: { status: string; testedAt: Date; metricsJson?: Record<string, unknown> }): CanaryTestResult {
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
        ...(compat.metricsJson as Record<string, number> ?? {}),
      },
    };
  }
}

export default UpdatePipeline;
