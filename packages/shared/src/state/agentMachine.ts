import { setup, assign } from 'xstate';

/**
 * Agent Context - tracks the internal state of an agent
 */
export interface AgentContext {
  energy: number; // 0-100, decreases with work
  frustration: number; // 0-100, increases with errors
  workload: number; // 0-100, current task load
  streak: number; // Consecutive successes
  errorStreak: number; // Consecutive errors
  targetPosition?: { x: number; y: number };
  currentTask?: string;
}

/**
 * Agent Events - all possible events that can trigger state transitions
 */
export type AgentEvent =
  | { type: 'WORK_STARTED'; task: string }
  | { type: 'WORK_COMPLETED'; success: boolean }
  | { type: 'ERROR_OCCURRED'; severity: 'low' | 'medium' | 'high' }
  | { type: 'BUILD_FAILED' }
  | { type: 'PR_MERGED' }
  | { type: 'MILESTONE_REACHED' }
  | { type: 'ENERGY_LOW' }
  | { type: 'ENERGY_RESTORED' }
  | { type: 'AGENT_NEARBY' }
  | { type: 'AGENT_LEFT' }
  | { type: 'MOVE_TO'; target: { x: number; y: number } }
  | { type: 'ARRIVED' }
  | { type: 'TICK' }; // Regular update tick

/**
 * Agent States - corresponds to Prisma AgentState enum
 */
export type AgentStateValue =
  | 'idle'
  | 'working'
  | 'thinking'
  | 'frustrated'
  | 'celebrating'
  | 'resting'
  | 'socializing'
  | 'traveling'
  | 'observing';

/**
 * Default initial context
 */
export const defaultAgentContext: AgentContext = {
  energy: 100,
  frustration: 0,
  workload: 0,
  streak: 0,
  errorStreak: 0,
};

// Guard functions
const isHighFrustration = ({ context }: { context: AgentContext }) => context.frustration >= 80;
const isLowEnergy = ({ context }: { context: AgentContext }) => context.energy <= 20;
const isCriticallyLowEnergy = ({ context }: { context: AgentContext }) => context.energy <= 10;
const hasTarget = ({ context }: { context: AgentContext }) => context.targetPosition !== undefined;
const isAtTarget = ({ context }: { context: AgentContext }) => context.targetPosition === undefined;
const shouldRest = ({ context }: { context: AgentContext }) => context.energy <= 30;
const canCelebrate = ({ context }: { context: AgentContext }) => context.streak >= 3;
const isModerateFrustration = ({ context }: { context: AgentContext }) => context.frustration >= 40 && context.frustration < 80;
const hasHighErrorStreak = ({ context }: { context: AgentContext }) => context.errorStreak >= 3;
const isHighWorkload = ({ context }: { context: AgentContext }) => context.workload >= 80;
const isWellRested = ({ context }: { context: AgentContext }) => context.energy >= 70;
const isFrustrationLow = ({ context }: { context: AgentContext }) => context.frustration < 20;
const hasNearbyAgents = () => true; // Placeholder - would check agent proximity

/**
 * XState v5 Agent State Machine
 *
 * This machine models agent behavior in the AI Agent Village Monitor RPG.
 * States drive animations, steering behaviors, and emotes.
 */
export const agentMachine = setup({
  types: {
    context: {} as AgentContext,
    events: {} as AgentEvent,
  },
  guards: {
    isHighFrustration,
    isLowEnergy,
    hasTarget,
    isAtTarget,
    hasNearbyAgents,
    shouldRest,
    canCelebrate,
    isCriticallyLowEnergy,
    isModerateFrustration,
    hasHighErrorStreak,
    isHighWorkload,
    isWellRested,
    isFrustrationLow,
  },
  actions: {
    decreaseEnergy: assign({
      energy: ({ context }) => Math.max(0, context.energy - 5),
    }),
    increaseEnergy: assign({
      energy: ({ context }) => Math.min(100, context.energy + 10),
    }),
    decreaseFrustration: assign({
      frustration: ({ context }) => Math.max(0, context.frustration - 5),
    }),
    resetFrustration: assign({
      frustration: 0,
    }),
    setTarget: assign({
      targetPosition: ({ event }) => {
        if (event.type === 'MOVE_TO') {
          return event.target;
        }
        return undefined;
      },
    }),
    clearTarget: assign({
      targetPosition: undefined,
    }),
    incrementStreak: assign({
      streak: ({ context }) => context.streak + 1,
      errorStreak: 0,
    }),
    resetStreak: assign({
      streak: 0,
    }),
    incrementErrorStreak: assign({
      errorStreak: ({ context }) => context.errorStreak + 1,
      streak: 0,
    }),
    resetErrorStreak: assign({
      errorStreak: 0,
    }),
    startTask: assign({
      currentTask: ({ event }) => {
        if (event.type === 'WORK_STARTED') {
          return event.task;
        }
        return undefined;
      },
      workload: ({ context }) => Math.min(100, context.workload + 20),
    }),
    increaseWorkload: assign({
      workload: ({ context }) => Math.min(100, context.workload + 15),
    }),
    decreaseWorkload: assign({
      workload: ({ context }) => Math.max(0, context.workload - 10),
    }),
    handleWorkSuccess: assign({
      currentTask: undefined,
      workload: ({ context }) => Math.max(0, context.workload - 20),
      energy: ({ context }) => Math.max(0, context.energy - 10),
      frustration: ({ context }) => Math.max(0, context.frustration - 5),
      streak: ({ context }) => context.streak + 1,
      errorStreak: 0,
    }),
    handleError: assign(({ context, event }) => {
      if (event.type !== 'ERROR_OCCURRED') {
        return { errorStreak: context.errorStreak + 1 };
      }
      const severityFrustrationMap: Record<string, number> = { low: 5, medium: 15, high: 25 };
      const severityEnergyMap: Record<string, number> = { low: 2, medium: 5, high: 10 };
      return {
        frustration: Math.min(100, context.frustration + severityFrustrationMap[event.severity]),
        energy: Math.max(0, context.energy - severityEnergyMap[event.severity]),
        errorStreak: context.errorStreak + 1,
      };
    }),
    handleBuildFailure: assign({
      frustration: ({ context }) => Math.min(100, context.frustration + 30),
      energy: ({ context }) => Math.max(0, context.energy - 15),
      errorStreak: ({ context }) => context.errorStreak + 1,
      streak: 0,
    }),
    handlePRMerged: assign({
      frustration: 0,
      energy: ({ context }) => Math.min(100, context.energy + 20),
      streak: ({ context }) => context.streak + 3,
      errorStreak: 0,
      workload: ({ context }) => Math.max(0, context.workload - 30),
    }),
    handleMilestone: assign({
      frustration: 0,
      energy: ({ context }) => Math.min(100, context.energy + 30),
      streak: ({ context }) => context.streak + 5,
      errorStreak: 0,
    }),
    restRecovery: assign({
      energy: ({ context }) => Math.min(100, context.energy + 15),
      frustration: ({ context }) => Math.max(0, context.frustration - 10),
    }),
    gradualEnergyDecay: assign({
      energy: ({ context }) => Math.max(0, context.energy - 0.5),
    }),
    gradualFrustrationDecay: assign({
      frustration: ({ context }) => Math.max(0, context.frustration - 1),
    }),
  },
}).createMachine({
  id: 'agent',
  initial: 'idle',
  context: defaultAgentContext,
  states: {
    /**
     * IDLE - Default state, agent is wandering or stationary
     */
    idle: {
      on: {
        WORK_STARTED: {
          target: 'working',
          actions: ['startTask'],
        },
        MOVE_TO: {
          target: 'traveling',
          actions: ['setTarget'],
        },
        AGENT_NEARBY: {
          target: 'socializing',
          guard: 'hasNearbyAgents',
        },
        TICK: {
          target: 'resting',
          guard: 'shouldRest',
          actions: ['gradualEnergyDecay'],
        },
        ENERGY_LOW: {
          target: 'resting',
          guard: 'isLowEnergy',
        },
      },
      entry: ['gradualFrustrationDecay'],
    },

    /**
     * WORKING - Agent is actively coding/committing
     */
    working: {
      on: {
        WORK_COMPLETED: [
          {
            target: 'celebrating',
            guard: 'canCelebrate',
            actions: ['handleWorkSuccess'],
          },
          {
            target: 'idle',
            actions: ['handleWorkSuccess'],
          },
        ],
        ERROR_OCCURRED: {
          target: 'thinking',
          actions: ['handleError'],
        },
        BUILD_FAILED: {
          target: 'frustrated',
          actions: ['handleBuildFailure'],
        },
        ENERGY_LOW: {
          target: 'resting',
          guard: 'isCriticallyLowEnergy',
        },
        TICK: {
          actions: ['decreaseEnergy', 'decreaseWorkload'],
        },
      },
      entry: ['increaseWorkload'],
    },

    /**
     * THINKING - Processing, planning, problem-solving
     */
    thinking: {
      on: {
        WORK_STARTED: {
          target: 'working',
          actions: ['startTask'],
        },
        ERROR_OCCURRED: {
          target: 'frustrated',
          guard: 'hasHighErrorStreak',
          actions: ['handleError'],
        },
        TICK: [
          {
            target: 'idle',
            guard: 'isFrustrationLow',
            actions: ['decreaseFrustration'],
          },
          {
            actions: ['decreaseFrustration', 'gradualEnergyDecay'],
          },
        ],
      },
      entry: ['decreaseFrustration'],
    },

    /**
     * FRUSTRATED - Errors, build failures, high error streak
     */
    frustrated: {
      on: {
        TICK: [
          {
            target: 'resting',
            guard: 'isCriticallyLowEnergy',
            actions: ['decreaseFrustration'],
          },
          {
            target: 'thinking',
            guard: 'isModerateFrustration',
            actions: ['decreaseFrustration'],
          },
          {
            target: 'idle',
            guard: 'isFrustrationLow',
            actions: ['decreaseFrustration', 'resetErrorStreak'],
          },
          {
            actions: ['decreaseFrustration'],
          },
        ],
        WORK_COMPLETED: {
          target: 'idle',
          guard: ({ event }) => event.success,
          actions: ['handleWorkSuccess', 'resetFrustration'],
        },
        MOVE_TO: {
          target: 'traveling',
          actions: ['setTarget'],
        },
      },
      // No entry action - errorStreak is incremented by the actions that transition here
    },

    /**
     * CELEBRATING - PR merged, milestone reached, high success streak
     */
    celebrating: {
      on: {
        TICK: {
          target: 'idle',
          actions: ['gradualEnergyDecay'],
        },
        WORK_STARTED: {
          target: 'working',
          actions: ['startTask'],
        },
        AGENT_NEARBY: {
          target: 'socializing',
          guard: 'hasNearbyAgents',
        },
      },
      entry: ['resetFrustration', 'resetErrorStreak'],
      after: {
        5000: 'idle', // Auto-transition after 5 seconds
      },
    },

    /**
     * RESTING - Low energy recovery
     */
    resting: {
      on: {
        TICK: [
          {
            target: 'idle',
            guard: 'isWellRested',
            actions: ['restRecovery'],
          },
          {
            actions: ['restRecovery'],
          },
        ],
        ENERGY_RESTORED: {
          target: 'idle',
        },
        WORK_STARTED: {
          target: 'working',
          guard: 'isWellRested',
          actions: ['startTask'],
        },
      },
      entry: ['restRecovery'],
    },

    /**
     * SOCIALIZING - Near other agents, interacting
     */
    socializing: {
      on: {
        AGENT_LEFT: {
          target: 'idle',
        },
        WORK_STARTED: {
          target: 'working',
          actions: ['startTask'],
        },
        TICK: {
          actions: ['decreaseFrustration', 'increaseEnergy'],
        },
      },
      entry: ['decreaseFrustration'],
    },

    /**
     * TRAVELING - Moving to a target location
     */
    traveling: {
      on: {
        ARRIVED: {
          target: 'idle',
          actions: ['clearTarget'],
        },
        MOVE_TO: {
          actions: ['setTarget'],
        },
        TICK: {
          actions: ['gradualEnergyDecay'],
        },
      },
    },

    /**
     * OBSERVING - Watching other agents work
     */
    observing: {
      on: {
        WORK_STARTED: {
          target: 'working',
          actions: ['startTask'],
        },
        AGENT_LEFT: {
          target: 'idle',
        },
        TICK: {
          actions: ['gradualEnergyDecay', 'decreaseFrustration'],
        },
      },
    },
  },

  /**
   * Global event handlers - apply to all states
   */
  on: {
    PR_MERGED: {
      target: '.celebrating',
      actions: ['handlePRMerged'],
    },
    MILESTONE_REACHED: {
      target: '.celebrating',
      actions: ['handleMilestone'],
    },
  },
});

/**
 * Type helper to extract the state machine type
 */
export type AgentMachine = typeof agentMachine;
