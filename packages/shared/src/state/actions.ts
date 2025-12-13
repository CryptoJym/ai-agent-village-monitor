import { assign } from 'xstate';
import type { AgentContext, AgentEvent } from './agentMachine';

// XState v5 compatible action type helper
type ActionParams = { context: AgentContext; event: AgentEvent };

/**
 * Action: Update energy level
 */
export const updateEnergy = assign(({ context }: ActionParams, params?: { delta: number }) => {
  const delta = params?.delta ?? 0;
  const newEnergy = context.energy + delta;
  return { energy: Math.max(0, Math.min(100, newEnergy)) };
});

/**
 * Action: Decrease energy (for work activities)
 */
export const decreaseEnergy = assign(({ context }: ActionParams) => ({
  energy: Math.max(0, context.energy - 5),
}));

/**
 * Action: Increase energy (for rest activities)
 */
export const increaseEnergy = assign(({ context }: ActionParams) => ({
  energy: Math.min(100, context.energy + 10),
}));

/**
 * Action: Update frustration level
 */
export const updateFrustration = assign(({ context }: ActionParams, params?: { delta: number }) => {
  const delta = params?.delta ?? 0;
  const newFrustration = context.frustration + delta;
  return { frustration: Math.max(0, Math.min(100, newFrustration)) };
});

/**
 * Action: Increase frustration
 */
export const increaseFrustration = assign(({ context }: ActionParams, params?: { amount: number }) => {
  const amount = params?.amount ?? 10;
  const newFrustration = context.frustration + amount;
  return { frustration: Math.min(100, newFrustration) };
});

/**
 * Action: Decrease frustration (calm down)
 */
export const decreaseFrustration = assign(({ context }: ActionParams) => ({
  frustration: Math.max(0, context.frustration - 5),
}));

/**
 * Action: Reset frustration
 */
export const resetFrustration = assign(() => ({
  frustration: 0,
}));

/**
 * Action: Set target position for navigation
 */
export const setTarget = assign(({ event }: ActionParams) => {
  if (event.type === 'MOVE_TO') {
    return { targetPosition: event.target };
  }
  return { targetPosition: undefined };
});

/**
 * Action: Clear target position
 */
export const clearTarget = assign(() => ({
  targetPosition: undefined,
}));

/**
 * Action: Increment success streak
 */
export const incrementStreak = assign(({ context }: ActionParams) => ({
  streak: context.streak + 1,
  errorStreak: 0, // Reset error streak on success
}));

/**
 * Action: Reset success streak
 */
export const resetStreak = assign(() => ({
  streak: 0,
}));

/**
 * Action: Increment error streak
 */
export const incrementErrorStreak = assign(({ context }: ActionParams) => ({
  errorStreak: context.errorStreak + 1,
  streak: 0, // Reset success streak on error
}));

/**
 * Action: Reset error streak
 */
export const resetErrorStreak = assign(() => ({
  errorStreak: 0,
}));

/**
 * Action: Start a task
 */
export const startTask = assign(({ context, event }: ActionParams) => {
  if (event.type === 'WORK_STARTED') {
    return {
      currentTask: event.task,
      workload: Math.min(100, context.workload + 20),
    };
  }
  return {
    currentTask: undefined,
    workload: Math.min(100, context.workload + 20),
  };
});

/**
 * Action: Complete a task
 */
export const completeTask = assign(({ context }: ActionParams) => ({
  currentTask: undefined,
  workload: Math.max(0, context.workload - 20),
}));

/**
 * Action: Update workload
 */
export const updateWorkload = assign(({ context }: ActionParams, params?: { delta: number }) => {
  const delta = params?.delta ?? 0;
  const newWorkload = context.workload + delta;
  return { workload: Math.max(0, Math.min(100, newWorkload)) };
});

/**
 * Action: Increase workload
 */
export const increaseWorkload = assign(({ context }: ActionParams) => ({
  workload: Math.min(100, context.workload + 15),
}));

/**
 * Action: Decrease workload (task progress)
 */
export const decreaseWorkload = assign(({ context }: ActionParams) => ({
  workload: Math.max(0, context.workload - 10),
}));

/**
 * Action: Handle work completion (success)
 */
export const handleWorkSuccess = assign(({ context }: ActionParams) => ({
  currentTask: undefined,
  workload: Math.max(0, context.workload - 20),
  energy: Math.max(0, context.energy - 10),
  frustration: Math.max(0, context.frustration - 5),
  streak: context.streak + 1,
  errorStreak: 0,
}));

/**
 * Action: Handle work completion (failure)
 */
export const handleWorkFailure = assign(({ context }: ActionParams) => ({
  currentTask: undefined,
  workload: Math.max(0, context.workload - 10),
  energy: Math.max(0, context.energy - 15),
  frustration: Math.min(100, context.frustration + 15),
  errorStreak: context.errorStreak + 1,
  streak: 0,
}));

/**
 * Action: Handle error occurrence
 */
export const handleError = assign(({ context, event }: ActionParams) => {
  if (event.type !== 'ERROR_OCCURRED') {
    return { errorStreak: context.errorStreak + 1 };
  }

  const severityFrustrationMap = { low: 5, medium: 15, high: 25 };
  const severityEnergyMap = { low: 2, medium: 5, high: 10 };

  return {
    frustration: Math.min(100, context.frustration + severityFrustrationMap[event.severity]),
    energy: Math.max(0, context.energy - severityEnergyMap[event.severity]),
    errorStreak: context.errorStreak + 1,
  };
});

/**
 * Action: Handle build failure
 */
export const handleBuildFailure = assign(({ context }: ActionParams) => ({
  frustration: Math.min(100, context.frustration + 30),
  energy: Math.max(0, context.energy - 15),
  errorStreak: context.errorStreak + 1,
  streak: 0,
}));

/**
 * Action: Handle PR merged (celebration)
 */
export const handlePRMerged = assign(({ context }: ActionParams) => ({
  frustration: 0,
  energy: Math.min(100, context.energy + 20),
  streak: context.streak + 3,
  errorStreak: 0,
  workload: Math.max(0, context.workload - 30),
}));

/**
 * Action: Handle milestone reached
 */
export const handleMilestone = assign(({ context }: ActionParams) => ({
  frustration: 0,
  energy: Math.min(100, context.energy + 30),
  streak: context.streak + 5,
  errorStreak: 0,
}));

/**
 * Action: Rest recovery
 */
export const restRecovery = assign(({ context }: ActionParams) => ({
  energy: Math.min(100, context.energy + 15),
  frustration: Math.max(0, context.frustration - 10),
}));

/**
 * Action: Gradual energy decay (for TICK events in idle/wandering)
 */
export const gradualEnergyDecay = assign(({ context }: ActionParams) => ({
  energy: Math.max(0, context.energy - 0.5),
}));

/**
 * Action: Gradual frustration decay (for TICK events when not stressed)
 */
export const gradualFrustrationDecay = assign(({ context }: ActionParams) => ({
  frustration: Math.max(0, context.frustration - 1),
}));
