import type { AgentArchetype, Direction8 } from '../assets/pixellabManifest';

export type AgentState = 'idle' | 'working' | 'debugging' | 'error';

export const AGENT_STATE_COLORS: Record<AgentState, number> = {
  idle: 0x22c55e,
  working: 0x3b82f6,
  debugging: 0xf59e0b,
  error: 0xef4444,
};

export type AgentConfig = {
  name: string;
  state?: AgentState;
  id?: string | number;
  houseId?: string;
  archetype?: AgentArchetype;
  direction?: Direction8;
};
