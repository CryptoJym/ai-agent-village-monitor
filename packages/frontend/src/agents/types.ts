export type AgentState = 'idle' | 'working' | 'debugging' | 'error';

export const AGENT_STATE_COLORS: Record<AgentState, number> = {
  idle: 0x22c55e, // green
  working: 0x3b82f6, // blue
  debugging: 0xf59e0b, // amber
  error: 0xef4444, // red
};

export type AgentConfig = {
  name: string;
  state?: AgentState;
  id?: string | number; // used for deterministic tint variations
};
