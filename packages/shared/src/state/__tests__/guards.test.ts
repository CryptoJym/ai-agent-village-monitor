import { describe, it, expect } from 'vitest';
import * as guards from '../guards';
import type { AgentContext } from '../agentMachine';

describe('Agent Guards', () => {
  describe('isHighFrustration', () => {
    it('should return true when frustration > 70', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 75,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isHighFrustration({ context } as any)).toBe(true);
    });

    it('should return false when frustration <= 70', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 70,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isHighFrustration({ context } as any)).toBe(false);
    });

    it('should return false when frustration is 0', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isHighFrustration({ context } as any)).toBe(false);
    });
  });

  describe('isLowEnergy', () => {
    it('should return true when energy < 20', () => {
      const context: AgentContext = {
        energy: 15,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isLowEnergy({ context } as any)).toBe(true);
    });

    it('should return false when energy >= 20', () => {
      const context: AgentContext = {
        energy: 20,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isLowEnergy({ context } as any)).toBe(false);
    });

    it('should return true when energy is 0', () => {
      const context: AgentContext = {
        energy: 0,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isLowEnergy({ context } as any)).toBe(true);
    });
  });

  describe('hasTarget', () => {
    it('should return true when targetPosition is defined', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
        targetPosition: { x: 100, y: 200 },
      };

      expect(guards.hasTarget({ context } as any)).toBe(true);
    });

    it('should return false when targetPosition is undefined', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.hasTarget({ context } as any)).toBe(false);
    });
  });

  describe('shouldRest', () => {
    it('should return true when energy < 30 and no current task', () => {
      const context: AgentContext = {
        energy: 25,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.shouldRest({ context } as any)).toBe(true);
    });

    it('should return false when energy < 30 but has current task', () => {
      const context: AgentContext = {
        energy: 25,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
        currentTask: 'coding',
      };

      expect(guards.shouldRest({ context } as any)).toBe(false);
    });

    it('should return false when energy >= 30', () => {
      const context: AgentContext = {
        energy: 50,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.shouldRest({ context } as any)).toBe(false);
    });
  });

  describe('canCelebrate', () => {
    it('should return true when streak >= 3', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 0,
        workload: 0,
        streak: 3,
        errorStreak: 0,
      };

      expect(guards.canCelebrate({ context } as any)).toBe(true);
    });

    it('should return false when streak < 3', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 0,
        workload: 0,
        streak: 2,
        errorStreak: 0,
      };

      expect(guards.canCelebrate({ context } as any)).toBe(false);
    });

    it('should return true when streak is very high', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 0,
        workload: 0,
        streak: 10,
        errorStreak: 0,
      };

      expect(guards.canCelebrate({ context } as any)).toBe(true);
    });
  });

  describe('isCriticallyLowEnergy', () => {
    it('should return true when energy < 10', () => {
      const context: AgentContext = {
        energy: 5,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isCriticallyLowEnergy({ context } as any)).toBe(true);
    });

    it('should return false when energy >= 10', () => {
      const context: AgentContext = {
        energy: 10,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isCriticallyLowEnergy({ context } as any)).toBe(false);
    });
  });

  describe('isModerateFrustration', () => {
    it('should return true when frustration is between 40 and 70', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 50,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isModerateFrustration({ context } as any)).toBe(true);
    });

    it('should return true at lower boundary (40)', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 40,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isModerateFrustration({ context } as any)).toBe(true);
    });

    it('should return true at upper boundary (70)', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 70,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isModerateFrustration({ context } as any)).toBe(true);
    });

    it('should return false when frustration < 40', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 39,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isModerateFrustration({ context } as any)).toBe(false);
    });

    it('should return false when frustration > 70', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 71,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isModerateFrustration({ context } as any)).toBe(false);
    });
  });

  describe('hasHighErrorStreak', () => {
    it('should return true when errorStreak >= 3', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 3,
      };

      expect(guards.hasHighErrorStreak({ context } as any)).toBe(true);
    });

    it('should return false when errorStreak < 3', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 2,
      };

      expect(guards.hasHighErrorStreak({ context } as any)).toBe(false);
    });
  });

  describe('isHighWorkload', () => {
    it('should return true when workload > 70', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 0,
        workload: 75,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isHighWorkload({ context } as any)).toBe(true);
    });

    it('should return false when workload <= 70', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 0,
        workload: 70,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isHighWorkload({ context } as any)).toBe(false);
    });
  });

  describe('isWellRested', () => {
    it('should return true when energy >= 80', () => {
      const context: AgentContext = {
        energy: 80,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isWellRested({ context } as any)).toBe(true);
    });

    it('should return false when energy < 80', () => {
      const context: AgentContext = {
        energy: 79,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isWellRested({ context } as any)).toBe(false);
    });
  });

  describe('isFrustrationLow', () => {
    it('should return true when frustration < 30', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 25,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isFrustrationLow({ context } as any)).toBe(true);
    });

    it('should return false when frustration >= 30', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 30,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isFrustrationLow({ context } as any)).toBe(false);
    });

    it('should return true when frustration is 0', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.isFrustrationLow({ context } as any)).toBe(true);
    });
  });

  describe('hasNearbyAgents', () => {
    it('should return true when nearbyAgentCount > 0', () => {
      const context = {
        energy: 100,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
        nearbyAgentCount: 1,
      };

      expect(guards.hasNearbyAgents({ context } as any)).toBe(true);
    });

    it('should return false when nearbyAgentCount is 0', () => {
      const context = {
        energy: 100,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
        nearbyAgentCount: 0,
      };

      expect(guards.hasNearbyAgents({ context } as any)).toBe(false);
    });

    it('should return false when nearbyAgentCount is not set', () => {
      const context: AgentContext = {
        energy: 100,
        frustration: 0,
        workload: 0,
        streak: 0,
        errorStreak: 0,
      };

      expect(guards.hasNearbyAgents({ context } as any)).toBe(false);
    });
  });
});
