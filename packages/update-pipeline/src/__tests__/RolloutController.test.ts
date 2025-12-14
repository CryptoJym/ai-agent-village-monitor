/**
 * RolloutController Tests
 *
 * Tests for progressive rollout management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RolloutController } from '../rollout/RolloutController';
import type { RunnerBuild, CanaryTestResult, OrgRuntimeConfig } from '../types';
import { CHANNEL_CONFIGS } from '../types';

describe('RolloutController', () => {
  let controller: RolloutController;

  const mockBuild: RunnerBuild = {
    buildId: 'build-001',
    runnerVersion: '2.0.0',
    adapters: [],
    runtimeVersions: {
      codex: '1.0.0',
      claude_code: '2.0.0',
      gemini_cli: '3.0.0',
      omnara: '1.0.0',
    },
    builtAt: new Date(),
    metadata: {
      commitSha: 'abc123',
      buildEnv: 'test',
      tags: ['test'],
    },
  };

  const mockCanaryResult: CanaryTestResult = {
    buildId: 'build-001',
    suiteId: 'suite-001',
    status: 'passed',
    startedAt: new Date(),
    completedAt: new Date(),
    testResults: [],
    metrics: {
      totalTests: 10,
      passed: 10,
      failed: 0,
      errored: 0,
      skipped: 0,
      passRate: 1.0,
      avgSessionStartMs: 100,
      avgTimeToFirstOutputMs: 200,
      disconnectRate: 0,
    },
  };

  const mockOrgConfig: OrgRuntimeConfig = {
    orgId: 'org-001',
    channel: 'stable',
    betaOptIn: false,
    autoUpgrade: true,
    notifications: {
      emailOnNewVersion: true,
      emailOnRolloutStart: true,
    },
    updatedAt: new Date(),
    updatedBy: 'test-user',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new RolloutController({
      channelConfigs: CHANNEL_CONFIGS,
      maxConcurrentRollouts: 3,
      checkIntervalMs: 60000,
      autoProgress: false, // Disable auto-progress for tests
      rollbackThresholds: {
        maxFailureRate: 0.1,
        maxDisconnectRate: 0.15,
        minSessionCount: 100,
      },
    });
  });

  afterEach(() => {
    controller.stop();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should create a rollout controller', () => {
      expect(controller).toBeDefined();
      // Verify controller is created with no active rollouts
      expect(controller.getAllActiveRollouts()).toHaveLength(0);
    });

    it('should start controller', () => {
      controller.start();
      expect(controller).toBeDefined();
      // Controller should still have no active rollouts after start
      expect(controller.getAllActiveRollouts()).toHaveLength(0);
    });

    it('should stop controller', () => {
      controller.start();
      controller.stop();
      expect(controller).toBeDefined();
      // After stop, controller should still function for queries
      expect(controller.getAllActiveRollouts()).toHaveLength(0);
    });

  });

  describe('initiateRollout', () => {
    it('should initiate a rollout with canary result', async () => {
      controller.registerOrgConfig(mockOrgConfig);

      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);

      expect(rollout).toBeDefined();
      expect(rollout.rolloutId).toBeDefined();
      expect(rollout.state).toBe('rolling_out');
      expect(rollout.targetBuildId).toBe('build-001');
      expect(rollout.channel).toBe('stable');
    });

    it('should reject rollout without canary for stable channel', async () => {
      await expect(
        controller.initiateRollout(mockBuild, 'stable')
      ).rejects.toThrow('requires canary testing');
    });

    it('should reject rollout with failed canary', async () => {
      const failedCanary: CanaryTestResult = {
        ...mockCanaryResult,
        status: 'failed',
      };

      await expect(
        controller.initiateRollout(mockBuild, 'stable', failedCanary)
      ).rejects.toThrow('did not pass');
    });

    it('should reject rollout with low canary pass rate', async () => {
      const lowPassRate: CanaryTestResult = {
        ...mockCanaryResult,
        metrics: {
          ...mockCanaryResult.metrics,
          passRate: 0.5, // Below stable threshold of 0.95
        },
      };

      await expect(
        controller.initiateRollout(mockBuild, 'stable', lowPassRate)
      ).rejects.toThrow('below threshold');
    });

    it('should allow pinned channel without canary', async () => {
      const rollout = await controller.initiateRollout(mockBuild, 'pinned');

      expect(rollout).toBeDefined();
      expect(rollout.state).toBe('rolling_out');
      expect(rollout.currentPercentage).toBe(100); // Pinned goes directly to 100%
    });

    it('should emit rollout_started event', async () => {
      const handler = vi.fn();
      controller.on('rollout_started', handler);
      controller.registerOrgConfig(mockOrgConfig);

      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);

      expect(handler).toHaveBeenCalledTimes(1);
      // Event emits the ActiveRollout object directly
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          rolloutId: rollout.rolloutId,
          targetBuildId: 'build-001',
          channel: 'stable',
          state: 'rolling_out',
          currentPercentage: expect.any(Number),
        })
      );
    });

    it('should reject when max concurrent rollouts reached', async () => {
      controller.registerOrgConfig(mockOrgConfig);

      // Create max rollouts
      for (let i = 0; i < 3; i++) {
        await controller.initiateRollout(
          { ...mockBuild, buildId: `build-${i}` },
          'stable',
          { ...mockCanaryResult, buildId: `build-${i}` }
        );
      }

      // Try one more
      await expect(
        controller.initiateRollout(
          { ...mockBuild, buildId: 'build-4' },
          'stable',
          { ...mockCanaryResult, buildId: 'build-4' }
        )
      ).rejects.toThrow('Maximum concurrent rollouts');
    });
  });

  describe('advanceRollout', () => {
    it('should advance rollout to next stage', async () => {
      controller.registerOrgConfig(mockOrgConfig);
      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);

      // Initial should be at first stage (1%)
      expect(rollout.currentPercentage).toBe(1);

      // Advance to next stage (10%)
      const advanced = await controller.advanceRollout(rollout.rolloutId);
      expect(advanced.currentPercentage).toBe(10);
    });

    it('should emit stage_advanced event', async () => {
      const handler = vi.fn();
      controller.on('stage_advanced', handler);
      controller.registerOrgConfig(mockOrgConfig);

      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);
      const advanced = await controller.advanceRollout(rollout.rolloutId);

      expect(handler).toHaveBeenCalledTimes(1);
      // Event emits the ActiveRollout object directly
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          rolloutId: rollout.rolloutId,
          targetBuildId: 'build-001',
          channel: 'stable',
          state: 'rolling_out',
          currentPercentage: advanced.currentPercentage, // Advanced to 10%
        })
      );
    });

    it('should complete rollout at final stage', async () => {
      const handler = vi.fn();
      controller.on('rollout_completed', handler);
      controller.registerOrgConfig(mockOrgConfig);

      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);

      // Advance through all stages: 1% -> 10% -> 50% -> 100%
      await controller.advanceRollout(rollout.rolloutId);
      await controller.advanceRollout(rollout.rolloutId);
      const completed = await controller.advanceRollout(rollout.rolloutId);

      expect(completed.currentPercentage).toBe(100);

      // One more advance should mark as completed
      const final = await controller.advanceRollout(rollout.rolloutId);
      expect(final.state).toBe('completed');
      expect(handler).toHaveBeenCalled();
    });

    it('should reject advancing non-existent rollout', async () => {
      await expect(
        controller.advanceRollout('non-existent')
      ).rejects.toThrow('not found');
    });

    it('should reject advancing paused rollout', async () => {
      controller.registerOrgConfig(mockOrgConfig);
      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);
      controller.pauseRollout(rollout.rolloutId);

      await expect(
        controller.advanceRollout(rollout.rolloutId)
      ).rejects.toThrow('Cannot advance rollout in state paused');
    });
  });

  describe('pauseRollout', () => {
    it('should pause a rolling out rollout', async () => {
      controller.registerOrgConfig(mockOrgConfig);
      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);

      const paused = controller.pauseRollout(rollout.rolloutId, 'Testing pause');
      expect(paused.state).toBe('paused');
    });

    it('should emit rollout_paused event', async () => {
      const handler = vi.fn();
      controller.on('rollout_paused', handler);
      controller.registerOrgConfig(mockOrgConfig);

      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);
      controller.pauseRollout(rollout.rolloutId, 'Testing pause functionality');

      expect(handler).toHaveBeenCalledTimes(1);
      // Event emits the ActiveRollout spread with reason
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          rolloutId: rollout.rolloutId,
          targetBuildId: 'build-001',
          channel: 'stable',
          state: 'paused',
          currentPercentage: 1, // Paused at initial 1%
          reason: 'Testing pause functionality',
        })
      );
    });

    it('should reject pausing non-existent rollout', () => {
      expect(() =>
        controller.pauseRollout('non-existent')
      ).toThrow('not found');
    });
  });

  describe('resumeRollout', () => {
    it('should resume a paused rollout', async () => {
      controller.registerOrgConfig(mockOrgConfig);
      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);
      controller.pauseRollout(rollout.rolloutId);

      const resumed = controller.resumeRollout(rollout.rolloutId);
      expect(resumed.state).toBe('rolling_out');
    });

    it('should emit rollout_resumed event', async () => {
      const handler = vi.fn();
      controller.on('rollout_resumed', handler);
      controller.registerOrgConfig(mockOrgConfig);

      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);
      controller.pauseRollout(rollout.rolloutId, 'Temporary pause');
      controller.resumeRollout(rollout.rolloutId);

      expect(handler).toHaveBeenCalledTimes(1);
      // Event emits the ActiveRollout object directly
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          rolloutId: rollout.rolloutId,
          targetBuildId: 'build-001',
          channel: 'stable',
          state: 'rolling_out', // Back to rolling_out after resume
          currentPercentage: 1, // Still at 1%
        })
      );
    });

    it('should reject resuming non-paused rollout', async () => {
      controller.registerOrgConfig(mockOrgConfig);
      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);

      expect(() =>
        controller.resumeRollout(rollout.rolloutId)
      ).toThrow('Cannot resume rollout in state rolling_out');
    });
  });

  describe('rollback', () => {
    it('should rollback a rollout', async () => {
      controller.registerOrgConfig(mockOrgConfig);
      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);

      const rolledBack = await controller.rollback(rollout.rolloutId, 'Critical bug found');
      expect(rolledBack.state).toBe('rolled_back');
      expect(rolledBack.error).toBe('Critical bug found');
    });

    it('should emit rollback events', async () => {
      const initiatedHandler = vi.fn();
      const completedHandler = vi.fn();
      controller.on('rollback_initiated', initiatedHandler);
      controller.on('rollback_completed', completedHandler);
      controller.registerOrgConfig(mockOrgConfig);

      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);
      await controller.rollback(rollout.rolloutId, 'Critical issue detected');

      expect(initiatedHandler).toHaveBeenCalledTimes(1);
      expect(initiatedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          rolloutId: rollout.rolloutId,
          targetBuildId: 'build-001',
          channel: 'stable',
          reason: 'Critical issue detected',
        })
      );

      expect(completedHandler).toHaveBeenCalledTimes(1);
      expect(completedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          rolloutId: rollout.rolloutId,
          channel: 'stable',
        })
      );
    });

    it('should track rollback in event log', async () => {
      controller.registerOrgConfig(mockOrgConfig);
      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);
      await controller.rollback(rollout.rolloutId, 'Bug found');

      const log = controller.getEventLog();
      const rollbackEvent = log.find((e) => e.eventType === 'rollback_initiated');
      expect(rollbackEvent).toBeDefined();
      // For rollbacks, fromBuildId is the target being rolled back, toBuildId is null
      expect(rollbackEvent?.fromBuildId).toBe('build-001');
      expect(rollbackEvent?.toBuildId).toBeNull();
      expect(rollbackEvent?.channel).toBe('stable');
    });
  });

  describe('getRollout', () => {
    it('should get a rollout by ID', async () => {
      controller.registerOrgConfig(mockOrgConfig);
      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);

      const retrieved = controller.getRollout(rollout.rolloutId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.rolloutId).toBe(rollout.rolloutId);
    });

    it('should return undefined for non-existent rollout', () => {
      const retrieved = controller.getRollout('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllActiveRollouts', () => {
    it('should get all active rollouts', async () => {
      controller.registerOrgConfig(mockOrgConfig);

      await controller.initiateRollout(
        { ...mockBuild, buildId: 'build-1' },
        'stable',
        { ...mockCanaryResult, buildId: 'build-1' }
      );
      await controller.initiateRollout(
        { ...mockBuild, buildId: 'build-2' },
        'stable',
        { ...mockCanaryResult, buildId: 'build-2' }
      );

      const active = controller.getAllActiveRollouts();
      expect(active).toHaveLength(2);
    });

    it('should include paused rollouts', async () => {
      controller.registerOrgConfig(mockOrgConfig);

      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);
      controller.pauseRollout(rollout.rolloutId);

      const active = controller.getAllActiveRollouts();
      expect(active).toHaveLength(1);
      expect(active[0].state).toBe('paused');
    });

    it('should not include completed rollouts', async () => {
      controller.registerOrgConfig(mockOrgConfig);

      const rollout = await controller.initiateRollout(mockBuild, 'pinned');
      // Pinned goes straight to 100%, advance once more to complete
      await controller.advanceRollout(rollout.rolloutId);

      const active = controller.getAllActiveRollouts();
      expect(active).toHaveLength(0);
    });
  });

  describe('organization config', () => {
    it('should register org config', () => {
      controller.registerOrgConfig(mockOrgConfig);
      // Verify org is registered by checking assignment
      const assignment = controller.getOrgAssignment(mockOrgConfig.orgId);
      // Before rollout, assignment may be undefined or have no build
      expect(assignment === undefined || assignment.targetBuildId === undefined).toBe(true);
    });

    it('should get org assignment', async () => {
      controller.registerOrgConfig(mockOrgConfig);
      await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);

      const assignment = controller.getOrgAssignment(mockOrgConfig.orgId);
      expect(assignment).toBeDefined();
      expect(assignment?.targetBuildId).toBe('build-001');
      expect(assignment?.channel).toBe('stable');
    });

    it('should respect org channel preference', async () => {
      const betaOrgConfig: OrgRuntimeConfig = {
        ...mockOrgConfig,
        orgId: 'org-beta',
        channel: 'beta',
        betaOptIn: true,
      };
      controller.registerOrgConfig(betaOrgConfig);

      // Beta channel also requires canary (with 0.80 threshold)
      const betaCanaryResult: CanaryTestResult = {
        ...mockCanaryResult,
        metrics: {
          ...mockCanaryResult.metrics,
          passRate: 0.85, // Above beta threshold of 0.80
        },
      };
      const rollout = await controller.initiateRollout(mockBuild, 'beta', betaCanaryResult);
      expect(rollout.channel).toBe('beta');

      const assignment = controller.getOrgAssignment('org-beta');
      expect(assignment?.channel).toBe('beta');
    });
  });

  describe('event log', () => {
    it('should record events in event log', async () => {
      controller.registerOrgConfig(mockOrgConfig);
      const rollout = await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);
      await controller.advanceRollout(rollout.rolloutId);

      const log = controller.getEventLog();
      expect(log.length).toBeGreaterThanOrEqual(2); // started + advanced
    });

    it('should filter event log by channel', async () => {
      controller.registerOrgConfig(mockOrgConfig);
      await controller.initiateRollout(mockBuild, 'stable', mockCanaryResult);
      await controller.initiateRollout(
        { ...mockBuild, buildId: 'build-pinned' },
        'pinned'
      );

      const stableEvents = controller.getEventLog({ channel: 'stable' });
      const pinnedEvents = controller.getEventLog({ channel: 'pinned' });

      expect(stableEvents.every((e) => e.channel === 'stable')).toBe(true);
      expect(pinnedEvents.every((e) => e.channel === 'pinned')).toBe(true);
    });
  });
});
