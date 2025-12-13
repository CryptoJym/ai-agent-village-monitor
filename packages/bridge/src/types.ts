/**
 * Types for the Agent Bridge CLI wrapper
 */

export type AgentType = 'claude' | 'aider' | 'codex' | 'cursor' | 'custom';

export interface AgentBridgeConfig {
  /** Server URL for the village monitor (e.g., http://localhost:4000) */
  serverUrl: string;
  /** Village ID to join */
  villageId: string;
  /** Type of AI agent being wrapped */
  agentType: AgentType;
  /** Custom name for the agent (optional) */
  agentName?: string;
  /** Working directory / repository path */
  repoPath: string;
  /** JWT token for authentication (optional) */
  authToken?: string;
  /** Enable verbose logging */
  verbose?: boolean;
}

export interface AgentSession {
  id: string;
  agentId: string;
  agentType: AgentType;
  repoPath: string;
  villageId: string;
  startedAt: Date;
  status: 'connecting' | 'active' | 'disconnected' | 'ended';
}

export interface WorkStreamEvent {
  id?: string;
  agentId: string;
  sessionId: string;
  type: WorkStreamEventType;
  payload: Record<string, unknown>;
  timestamp: string;
}

export type WorkStreamEventType =
  | 'session_start'
  | 'session_end'
  | 'thinking'
  | 'file_read'
  | 'file_edit'
  | 'file_create'
  | 'file_delete'
  | 'command'
  | 'tool_use'
  | 'search'
  | 'output'
  | 'error'
  | 'completed'
  | 'status_change';

export type AgentState = 'idle' | 'thinking' | 'working' | 'waiting' | 'error';

export interface AgentUpdatePayload {
  agentId: string;
  state?: AgentState;
  x?: number;
  y?: number;
  currentFile?: string;
  currentTask?: string;
}

/**
 * Patterns for parsing different AI agent CLI outputs
 */
export interface AgentOutputPattern {
  type: WorkStreamEventType;
  pattern: RegExp;
  extractPayload?: (match: RegExpMatchArray) => Record<string, unknown>;
}

/**
 * Agent-specific configuration for output parsing
 */
export interface AgentParserConfig {
  name: string;
  patterns: AgentOutputPattern[];
  promptIndicator?: RegExp;
}
