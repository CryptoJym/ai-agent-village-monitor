export type AuditEventType =
  // Auth events
  | 'auth.login'
  | 'auth.refresh.rotate'
  | 'auth.logout'
  // WebSocket events
  | 'ws.connect'
  | 'ws.disconnect'
  // Agent connection events
  | 'agent.command'
  | 'agent.connected'
  | 'agent.connect_error'
  | 'agent.disconnected'
  | 'agent.error'
  | 'agent.job_enqueued'
  | 'agent.job_deduped'
  // Agent session events
  | 'agent.session_starting'
  | 'agent.session_started'
  | 'agent.session_stopping'
  | 'agent.session_stopped'
  // Agent command events
  | 'agent.command_started'
  | 'agent.command_completed'
  | 'agent.command_failed'
  | 'agent.command_error'
  | 'agent.command_dlq'
  // Session events (legacy format)
  | 'session_started'
  | 'session_stopped'
  | 'session.created'
  | 'session.ended'
  | 'session.event'
  // Command events (legacy format)
  | 'command_enqueued'
  | 'command_completed'
  | 'command_failed'
  // Account events
  | 'account.delete';

export type AuditBase = {
  type: AuditEventType;
  ts: string; // ISO timestamp
  // Actor is optional; omit in unauthenticated contexts
  actorId?: string;
  // Optional correlation identifiers
  sessionId?: string;
  socketId?: string;
};

export type AuditEvent = AuditBase & Record<string, unknown>;
