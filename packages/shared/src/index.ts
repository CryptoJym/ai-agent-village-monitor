export type HealthStatus = {
  status: 'ok' | 'error';
  timestamp: string;
};

export const nowIso = () => new Date().toISOString();

// Analytics
export type AnalyticsEvent =
  | { type: 'session_start'; ts: number; userId?: string; villageId?: string }
  | { type: 'session_end'; ts: number; durationMs: number; userId?: string; villageId?: string }
  | { type: 'dialogue_open'; ts: number; source?: string; villageId?: string }
  | { type: 'command_executed'; ts: number; agentId?: string; command?: string; villageId?: string }
  | {
      type: 'house_command';
      ts: number;
      houseId: string;
      command?: string;
      status?: 'queued' | 'success' | 'error' | 'failed';
      latencyMs?: number;
      villageId?: string;
    }
  | { type: 'village_view'; ts: number; villageId: string };

export type AnalyticsBatch = { events: AnalyticsEvent[]; clientId?: string; consent?: boolean };
