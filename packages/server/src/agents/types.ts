export type AgentLifecycleState =
  | 'disconnected'
  | 'connecting'
  | 'reconnecting'
  | 'connected'
  | 'error';

export type AgentControllerConfig = {
  mcpServerUrl?: string;
};

export type AgentRuntime = {
  agentId: string;
  state: AgentLifecycleState;
  sessionToken?: string;
  sessionId?: string;
  villageId?: string; // Cached for work stream broadcasting
  lastError?: string;
  connectedAt?: number;
  updatedAt?: number;
  backoffAttempt?: number;
  retryTimer?: NodeJS.Timeout | null;
};

export type AgentStreamEvent = {
  type: 'log' | 'progress' | 'status' | 'error';
  message?: string;
  progress?: number;
  data?: unknown;
};
