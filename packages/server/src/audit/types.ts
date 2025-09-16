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
