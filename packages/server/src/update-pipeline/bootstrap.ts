/**
 * Update Pipeline Bootstrap
 *
 * Manages the singleton lifecycle of the UpdatePipeline within the server process.
 * Only initializes when UPDATE_PIPELINE_ENABLED=true environment variable is set.
 */

import {
  UpdatePipeline,
  type PipelineStatus,
  type UpdatePipelineConfig,
} from '@ai-agent-village-monitor/update-pipeline';

let pipeline: UpdatePipeline | null = null;

/**
 * Initialize the update pipeline singleton.
 *
 * Must be called during server startup. Safe to call multiple times;
 * subsequent calls are no-ops if already initialized.
 *
 * @returns Promise that resolves when initialization is complete
 */
export async function initUpdatePipeline(): Promise<void> {
  // Already initialized
  if (pipeline !== null) {
    return;
  }

  // Check feature flag
  if (process.env.UPDATE_PIPELINE_ENABLED !== 'true') {
    console.log('[update-pipeline] Disabled (set UPDATE_PIPELINE_ENABLED=true to enable)');
    return;
  }

  try {
    const config: Partial<UpdatePipelineConfig> = {
      // Auto-canary new versions when detected (default: false for safety)
      autoCanary: process.env.UPDATE_PIPELINE_AUTO_CANARY === 'true',

      // Never auto-rollout - always require manual approval
      autoRollout: false,

      // Never auto-sweep - always require manual trigger
      autoSweep: false,

      // Version watcher configuration
      versionWatcher: {
        enablePolling: process.env.UPDATE_PIPELINE_POLLING === 'true',
        defaultCheckIntervalMs: parseInt(
          process.env.UPDATE_PIPELINE_POLL_INTERVAL_MS || '3600000',
          10,
        ),
        httpTimeoutMs: 30000,
      },
    };

    pipeline = new UpdatePipeline(config);

    // Wire up event handlers for logging
    setupEventLogging(pipeline);

    await pipeline.start();
    console.log('[update-pipeline] Initialized and running');
  } catch (err) {
    console.error('[update-pipeline] Failed to initialize:', err);
    pipeline = null;
  }
}

/**
 * Get the current pipeline status.
 *
 * @returns PipelineStatus object or null if pipeline is not running
 */
export function getUpdatePipelineStatus(): PipelineStatus | null {
  return pipeline?.getStatus() ?? null;
}

/**
 * Get the UpdatePipeline instance.
 *
 * @returns UpdatePipeline instance or null if not initialized
 */
export function getUpdatePipeline(): UpdatePipeline | null {
  return pipeline;
}

/**
 * Check if the update pipeline is enabled and running.
 *
 * @returns true if pipeline is initialized and running
 */
export function isUpdatePipelineEnabled(): boolean {
  return pipeline !== null && (pipeline.getStatus()?.running ?? false);
}

/**
 * Gracefully shutdown the update pipeline.
 *
 * Should be called during server shutdown to clean up timers and resources.
 */
export function shutdownUpdatePipeline(): void {
  if (pipeline) {
    try {
      pipeline.stop();
      console.log('[update-pipeline] Shutdown complete');
    } catch (err) {
      console.error('[update-pipeline] Error during shutdown:', err);
    } finally {
      pipeline = null;
    }
  }
}

/** Event payload types for pipeline events */
interface NewVersionEvent {
  providerId: string;
  version: string;
  previousVersion?: string;
}

interface CanaryStartedEvent {
  buildId: string;
  timestamp: Date;
}

interface CanaryCompletedEvent {
  buildId: string;
  results?: Array<{ status: string }>;
}

interface RolloutEvent {
  rolloutId: string;
  buildId?: string;
  channel?: string;
  reason?: string;
}

interface PipelineErrorEvent {
  component: string;
  error: unknown;
}

/**
 * Set up event logging for pipeline events.
 *
 * @param p - The UpdatePipeline instance
 */
function setupEventLogging(p: UpdatePipeline): void {
  p.on('new_version_detected', (event: NewVersionEvent) => {
    console.log(
      `[update-pipeline] New version detected: ${event.providerId} ${event.version}`,
      event.previousVersion ? `(was ${event.previousVersion})` : '(first seen)',
    );
  });

  p.on('canary_started', (event: CanaryStartedEvent) => {
    console.log(`[update-pipeline] Canary started for build: ${event.buildId}`);
  });

  p.on('canary_completed', (event: CanaryCompletedEvent) => {
    const passed = event.results?.every((r: { status: string }) => r.status === 'passed');
    console.log(
      `[update-pipeline] Canary completed for build: ${event.buildId}`,
      passed ? '(PASSED)' : '(FAILED)',
    );
  });

  p.on('rollout_initiated', (event: RolloutEvent) => {
    console.log(
      `[update-pipeline] Rollout initiated: ${event.rolloutId}`,
      `build=${event.buildId} channel=${event.channel}`,
    );
  });

  p.on('rollout_completed', (event: RolloutEvent) => {
    console.log(`[update-pipeline] Rollout completed: ${event.rolloutId}`);
  });

  p.on('rollback_completed', (event: RolloutEvent) => {
    console.log(
      `[update-pipeline] Rollback completed: ${event.rolloutId}`,
      event.reason ? `reason: ${event.reason}` : '',
    );
  });

  p.on('pipeline_error', (event: PipelineErrorEvent) => {
    console.error(`[update-pipeline] Error in ${event.component}:`, event.error);
  });
}
