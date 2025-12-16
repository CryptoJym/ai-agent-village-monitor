/**
 * Update Pipeline Router
 *
 * REST API endpoints for querying update pipeline status.
 * All endpoints require admin authentication.
 */

import { Router, type Request, type Response } from 'express';
import type { RuntimeVersion, ActiveRollout } from '@ai-agent-village-monitor/update-pipeline';
import { getUpdatePipelineStatus, isUpdatePipelineEnabled, getUpdatePipeline } from './bootstrap';

export const updatePipelineRouter = Router();

/**
 * GET /api/update-pipeline/status
 *
 * Returns comprehensive update pipeline status including:
 * - Running state
 * - Active canary tests count
 * - Active rollouts count
 * - Known provider versions
 * - Recommended builds per channel
 *
 * @returns 200 with PipelineStatus
 * @returns 503 if pipeline is not enabled
 */
updatePipelineRouter.get('/status', (_req: Request, res: Response) => {
  if (!isUpdatePipelineEnabled()) {
    return res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Update pipeline is not enabled',
        hint: 'Set UPDATE_PIPELINE_ENABLED=true to enable',
      },
    });
  }

  const status = getUpdatePipelineStatus();
  if (!status) {
    return res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Update pipeline status unavailable',
      },
    });
  }

  return res.json(status);
});

/**
 * GET /api/update-pipeline/health
 *
 * Simple health check endpoint for the update pipeline.
 * Always returns 200 with enabled/running state.
 *
 * @returns 200 with health status
 */
updatePipelineRouter.get('/health', (_req: Request, res: Response) => {
  const enabled = isUpdatePipelineEnabled();
  const status = enabled ? getUpdatePipelineStatus() : null;

  return res.json({
    enabled,
    running: status?.running ?? false,
    versionWatcherActive: status?.versionWatcherActive ?? false,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/update-pipeline/versions
 *
 * Returns all known runtime versions discovered by the VersionWatcher.
 *
 * @returns 200 with list of known versions
 * @returns 503 if pipeline is not enabled
 */
updatePipelineRouter.get('/versions', (_req: Request, res: Response) => {
  if (!isUpdatePipelineEnabled()) {
    return res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Update pipeline is not enabled',
      },
    });
  }

  const pipeline = getUpdatePipeline();
  if (!pipeline) {
    return res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Update pipeline not available',
      },
    });
  }

  const versionWatcher = pipeline.getVersionWatcher();
  const knownVersions = versionWatcher.getAllKnownVersions();

  const items = Array.from(knownVersions.entries()).map(
    ([providerId, version]: [string, RuntimeVersion]) => ({
      providerId,
      version: version.version,
      releasedAt: version.releasedAt?.toISOString() ?? null,
      sourceUrl: version.sourceUrl ?? null,
      canaryPassed: version.canaryPassed ?? false,
      canaryPassedAt: version.canaryPassedAt?.toISOString() ?? null,
    }),
  );

  return res.json({ items });
});

/**
 * GET /api/update-pipeline/rollouts
 *
 * Returns all active rollouts.
 *
 * @returns 200 with list of active rollouts
 * @returns 503 if pipeline is not enabled
 */
updatePipelineRouter.get('/rollouts', (_req: Request, res: Response) => {
  if (!isUpdatePipelineEnabled()) {
    return res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Update pipeline is not enabled',
      },
    });
  }

  const pipeline = getUpdatePipeline();
  if (!pipeline) {
    return res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Update pipeline not available',
      },
    });
  }

  const rolloutController = pipeline.getRolloutController();
  const activeRollouts = rolloutController.getAllActiveRollouts();

  const items = activeRollouts.map((rollout: ActiveRollout) => ({
    rolloutId: rollout.rolloutId,
    targetBuildId: rollout.targetBuildId,
    channel: rollout.channel,
    state: rollout.state,
    currentPercentage: rollout.currentPercentage,
    targetPercentage: rollout.targetPercentage,
    startedAt: rollout.startedAt?.toISOString() ?? null,
    lastUpdatedAt: rollout.lastUpdatedAt?.toISOString() ?? null,
    affectedOrgsCount: rollout.affectedOrgs?.length ?? 0,
    error: rollout.error ?? null,
  }));

  return res.json({ items });
});

/**
 * POST /api/update-pipeline/versions/check
 *
 * Manually trigger a version check against all upstream sources.
 *
 * @returns 200 with discovered versions
 * @returns 503 if pipeline is not enabled
 */
updatePipelineRouter.post('/versions/check', async (_req: Request, res: Response) => {
  if (!isUpdatePipelineEnabled()) {
    return res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Update pipeline is not enabled',
      },
    });
  }

  const pipeline = getUpdatePipeline();
  if (!pipeline) {
    return res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Update pipeline not available',
      },
    });
  }

  try {
    const versions = await pipeline.checkVersions();

    const items = versions.map((v: RuntimeVersion) => ({
      providerId: v.providerId,
      version: v.version,
      releasedAt: v.releasedAt?.toISOString() ?? null,
      sourceUrl: v.sourceUrl ?? null,
    }));

    return res.json({
      checked: true,
      timestamp: new Date().toISOString(),
      items,
    });
  } catch (err) {
    return res.status(502).json({
      error: {
        code: 'UPSTREAM_ERROR',
        message: err instanceof Error ? err.message : 'Version check failed',
      },
    });
  }
});
