import type { AgentContext, AgentEvent } from './agentMachine';

/**
 * Guard: Check if frustration level is high (> 70)
 */
export function isHighFrustration({ context }: { context: AgentContext }): boolean {
  return context.frustration > 70;
}

/**
 * Guard: Check if energy level is low (< 20)
 */
export function isLowEnergy({ context }: { context: AgentContext }): boolean {
  return context.energy < 20;
}

/**
 * Guard: Check if agent has a target position
 */
export function hasTarget({ context }: { context: AgentContext }): boolean {
  return context.targetPosition !== undefined;
}

/**
 * Guard: Check if agent is at target position (within threshold)
 */
export function isAtTarget({ context }: { context: AgentContext }): boolean {
  if (!context.targetPosition) return false;

  // In a real implementation, this would check the agent's current position
  // against the target. For now, we'll use a simple check.
  // This should be integrated with the actual position tracking system.
  return false; // Will be updated by ARRIVED event
}

/**
 * Guard: Check if there are nearby agents for socializing
 * This would typically check proximity to other agents in the world
 */
export function hasNearbyAgents({ context }: { context: AgentContext }): boolean {
  // This should be populated by the game engine based on spatial queries
  // For now, we'll use a simple flag that can be set via context
  return (context as any).nearbyAgentCount > 0;
}

/**
 * Guard: Check if agent should rest (low energy and not working)
 */
export function shouldRest({ context }: { context: AgentContext }): boolean {
  return context.energy < 30 && !context.currentTask;
}

/**
 * Guard: Check if agent can celebrate (has achievement streak or milestone)
 */
export function canCelebrate({ context }: { context: AgentContext }): boolean {
  return context.streak >= 3;
}

/**
 * Guard: Check if energy is critically low
 */
export function isCriticallyLowEnergy({ context }: { context: AgentContext }): boolean {
  return context.energy < 10;
}

/**
 * Guard: Check if frustration is moderate (40-70)
 */
export function isModerateFrustration({ context }: { context: AgentContext }): boolean {
  return context.frustration >= 40 && context.frustration <= 70;
}

/**
 * Guard: Check if agent has high error streak
 */
export function hasHighErrorStreak({ context }: { context: AgentContext }): boolean {
  return context.errorStreak >= 3;
}

/**
 * Guard: Check if workload is high
 */
export function isHighWorkload({ context }: { context: AgentContext }): boolean {
  return context.workload > 70;
}

/**
 * Guard: Check if agent is well-rested (high energy)
 */
export function isWellRested({ context }: { context: AgentContext }): boolean {
  return context.energy >= 80;
}

/**
 * Guard: Check if frustration has dissipated
 */
export function isFrustrationLow({ context }: { context: AgentContext }): boolean {
  return context.frustration < 30;
}
