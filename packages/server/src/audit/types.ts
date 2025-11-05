export type AuditEventType =
  | 'auth.login'
  | 'auth.refresh.rotate'
  | 'auth.logout'
  | 'ws.connect'
  | 'ws.disconnect'
  | 'agent.command'
  | 'agent.connected'
  | 'agent.connect_error'
  | 'agent.disconnected'
  | 'agent.error'
  | 'agent.job_enqueued'
  | 'agent.job_deduped'
  | 'account.delete'
  | 'session.created'
  | 'session.ended'
  | 'session.event'
  | 'agent.session_starting'
  | 'session_started'
  | 'agent.session_started'
  | 'agent.session_stopping'
  | 'session_stopped'
  | 'agent.session_stopped'
  | 'command_enqueued'
  | 'agent.command_started'
  | 'command_completed'
  | 'command_failed'
  | 'agent.command_completed'
  | 'agent.command_failed'
  | 'agent.command_error'
  | 'agent.command_dlq';

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
