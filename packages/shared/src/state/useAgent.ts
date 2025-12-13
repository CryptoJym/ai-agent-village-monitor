import { useMachine } from '@xstate/react';
import { createActor } from 'xstate';
import { agentMachine, type AgentContext, type AgentEvent, type AgentStateValue, defaultAgentContext } from './agentMachine';

/**
 * Options for initializing the agent state machine
 */
export interface UseAgentOptions {
  initialContext?: Partial<AgentContext>;
  onStateChange?: (state: any) => void;
}

/**
 * React hook for managing agent state with XState v5
 *
 * @param options - Configuration options for the agent machine
 * @returns Agent state machine instance with current state and send function
 *
 * @example
 * ```tsx
 * function AgentComponent({ agentId }) {
 *   const { state, send, context } = useAgentState({
 *     initialContext: { energy: 80, frustration: 10 }
 *   });
 *
 *   return (
 *     <div>
 *       <p>State: {state.value}</p>
 *       <p>Energy: {context.energy}</p>
 *       <button onClick={() => send({ type: 'WORK_STARTED', task: 'coding' })}>
 *         Start Work
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAgentState(options: UseAgentOptions = {}) {
  const { initialContext, onStateChange } = options;

  // Merge default context with provided initial context
  const mergedContext: AgentContext = {
    ...defaultAgentContext,
    ...initialContext,
  };

  // Initialize the state machine - XState v5 uses input for initial context
  const [snapshot, send] = useMachine(agentMachine, {
    input: mergedContext,
  });

  // Call onStateChange callback when state changes
  if (onStateChange && snapshot.status === 'active') {
    onStateChange(snapshot);
  }

  return {
    // Current state value (e.g., 'idle', 'working', 'frustrated')
    state: snapshot.value as AgentStateValue,

    // Full snapshot object (contains matches, context, etc.)
    snapshot,

    // Current context values
    context: snapshot.context,

    // Function to send events to the machine
    send,

    // Helper to check if in a specific state
    matches: (stateValue: AgentStateValue) => snapshot.matches(stateValue),

    // Helper to check if can transition to a state
    can: (event: AgentEvent) => {
      // In XState v5, we check can by seeing if the event is in next events
      return snapshot.can(event);
    },
  };
}

/**
 * Create an agent actor for server-side or non-React contexts
 * Useful for server-side or non-React contexts
 *
 * @param initialContext - Initial context values
 * @returns XState actor instance
 */
export function createAgentActor(initialContext?: Partial<AgentContext>) {
  const mergedContext: AgentContext = {
    ...defaultAgentContext,
    ...initialContext,
  };

  const actor = createActor(agentMachine, {
    input: mergedContext,
  });

  return actor;
}

/**
 * Type exports for convenience
 */
export type { AgentContext, AgentEvent, AgentStateValue } from './agentMachine';
