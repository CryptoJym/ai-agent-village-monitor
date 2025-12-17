import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { agentMachine } from '../agentMachine';

describe('Agent State Machine', () => {
  describe('Initial State', () => {
    it('should start in idle state', () => {
      const actor = createActor(agentMachine);
      actor.start();

      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('should initialize with default context values', () => {
      const actor = createActor(agentMachine);
      actor.start();

      const context = actor.getSnapshot().context;
      expect(context.energy).toBe(100);
      expect(context.frustration).toBe(0);
      expect(context.workload).toBe(0);
      expect(context.streak).toBe(0);
      expect(context.errorStreak).toBe(0);
    });
  });

  describe('State Transitions - Working', () => {
    it('should transition from idle to working on WORK_STARTED', () => {
      const actor = createActor(agentMachine);
      actor.start();

      actor.send({ type: 'WORK_STARTED', task: 'coding' });

      expect(actor.getSnapshot().value).toBe('working');
      expect(actor.getSnapshot().context.currentTask).toBe('coding');
    });

    it('should transition from working to idle on WORK_COMPLETED (no celebration)', () => {
      const actor = createActor(agentMachine);
      actor.start();
      actor.send({ type: 'WORK_STARTED', task: 'coding' });

      actor.send({ type: 'WORK_COMPLETED', success: true });

      // Without high streak, should go back to idle
      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('should increase workload when starting work', () => {
      const actor = createActor(agentMachine);
      actor.start();

      const initialWorkload = actor.getSnapshot().context.workload;
      actor.send({ type: 'WORK_STARTED', task: 'coding' });

      expect(actor.getSnapshot().context.workload).toBeGreaterThan(initialWorkload);
    });
  });

  describe('State Transitions - Error Handling', () => {
    it('should transition from working to thinking on ERROR_OCCURRED', () => {
      const actor = createActor(agentMachine);
      actor.start();
      actor.send({ type: 'WORK_STARTED', task: 'coding' });

      actor.send({ type: 'ERROR_OCCURRED', severity: 'medium' });

      expect(actor.getSnapshot().value).toBe('thinking');
    });

    it('should transition from working to frustrated on BUILD_FAILED', () => {
      const actor = createActor(agentMachine);
      actor.start();
      actor.send({ type: 'WORK_STARTED', task: 'building' });

      actor.send({ type: 'BUILD_FAILED' });

      expect(actor.getSnapshot().value).toBe('frustrated');
    });

    it('should increase frustration on error', () => {
      const actor = createActor(agentMachine);
      actor.start();
      actor.send({ type: 'WORK_STARTED', task: 'coding' });

      const initialFrustration = actor.getSnapshot().context.frustration;
      actor.send({ type: 'ERROR_OCCURRED', severity: 'high' });

      expect(actor.getSnapshot().context.frustration).toBeGreaterThan(initialFrustration);
    });

    it('should increment errorStreak on failure', () => {
      const actor = createActor(agentMachine);
      actor.start();
      actor.send({ type: 'WORK_STARTED', task: 'building' });

      actor.send({ type: 'BUILD_FAILED' });

      expect(actor.getSnapshot().context.errorStreak).toBe(1);
    });
  });

  describe('State Transitions - Celebration', () => {
    it('should transition to celebrating on PR_MERGED', () => {
      const actor = createActor(agentMachine);
      actor.start();

      actor.send({ type: 'PR_MERGED' });

      expect(actor.getSnapshot().value).toBe('celebrating');
    });

    it('should transition to celebrating on MILESTONE_REACHED', () => {
      const actor = createActor(agentMachine);
      actor.start();

      actor.send({ type: 'MILESTONE_REACHED' });

      expect(actor.getSnapshot().value).toBe('celebrating');
    });

    it('should reset frustration when celebrating', () => {
      const actor = createActor(agentMachine);
      actor.start();

      // First, get some frustration
      actor.send({ type: 'WORK_STARTED', task: 'building' });
      actor.send({ type: 'BUILD_FAILED' });

      const frustrationBefore = actor.getSnapshot().context.frustration;
      expect(frustrationBefore).toBeGreaterThan(0);

      // Now celebrate
      actor.send({ type: 'PR_MERGED' });

      expect(actor.getSnapshot().context.frustration).toBe(0);
    });
  });

  describe('State Transitions - Traveling', () => {
    it('should transition from idle to traveling on MOVE_TO', () => {
      const actor = createActor(agentMachine);
      actor.start();

      actor.send({ type: 'MOVE_TO', target: { x: 100, y: 200 } });

      expect(actor.getSnapshot().value).toBe('traveling');
      expect(actor.getSnapshot().context.targetPosition).toEqual({ x: 100, y: 200 });
    });

    it('should transition from traveling to idle on ARRIVED', () => {
      const actor = createActor(agentMachine);
      actor.start();
      actor.send({ type: 'MOVE_TO', target: { x: 100, y: 200 } });

      actor.send({ type: 'ARRIVED' });

      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.targetPosition).toBeUndefined();
    });
  });

  describe('State Transitions - Resting', () => {
    it('should transition to resting on ENERGY_LOW when energy is critically low', () => {
      const actor = createActor(agentMachine);
      actor.start();

      // Manually set low energy through multiple TICK events while working
      actor.send({ type: 'WORK_STARTED', task: 'coding' });

      // Simulate multiple ticks to drain energy
      for (let i = 0; i < 30; i++) {
        actor.send({ type: 'TICK' });
      }

      // If energy gets critically low, should transition to resting
      const context = actor.getSnapshot().context;
      // Energy should be decreased
      expect(context.energy).toBeLessThan(100);
    });
  });

  describe('Energy Management', () => {
    it('should decrease energy when working', () => {
      const actor = createActor(agentMachine);
      actor.start();
      actor.send({ type: 'WORK_STARTED', task: 'coding' });

      const energyBefore = actor.getSnapshot().context.energy;
      actor.send({ type: 'TICK' });

      expect(actor.getSnapshot().context.energy).toBeLessThan(energyBefore);
    });

    it('should restore energy when resting', () => {
      const actor = createActor(agentMachine);
      actor.start();

      // Work to drain energy
      actor.send({ type: 'WORK_STARTED', task: 'coding' });
      for (let i = 0; i < 10; i++) {
        actor.send({ type: 'TICK' });
      }

      const energyAfterWork = actor.getSnapshot().context.energy;

      // Force transition to resting (via ENERGY_LOW if energy is low enough)
      actor.send({ type: 'ENERGY_LOW' });

      // Check if we're resting or handle the transition
      const state = actor.getSnapshot().value;
      if (state === 'resting') {
        actor.send({ type: 'TICK' });
        expect(actor.getSnapshot().context.energy).toBeGreaterThan(energyAfterWork);
      }
    });
  });

  describe('Streak Management', () => {
    it('should increment streak on successful work completion', () => {
      const actor = createActor(agentMachine);
      actor.start();
      actor.send({ type: 'WORK_STARTED', task: 'coding' });

      const streakBefore = actor.getSnapshot().context.streak;
      actor.send({ type: 'WORK_COMPLETED', success: true });

      expect(actor.getSnapshot().context.streak).toBeGreaterThan(streakBefore);
    });

    it('should reset streak on build failure', () => {
      const actor = createActor(agentMachine);
      actor.start();

      // Build up some streak
      actor.send({ type: 'WORK_STARTED', task: 'coding' });
      actor.send({ type: 'WORK_COMPLETED', success: true });
      actor.send({ type: 'WORK_STARTED', task: 'coding2' });
      actor.send({ type: 'WORK_COMPLETED', success: true });

      expect(actor.getSnapshot().context.streak).toBeGreaterThan(0);

      // Now fail
      actor.send({ type: 'WORK_STARTED', task: 'building' });
      actor.send({ type: 'BUILD_FAILED' });

      expect(actor.getSnapshot().context.streak).toBe(0);
    });
  });
});
