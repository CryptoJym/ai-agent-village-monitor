export type NpcRole = 'engineer' | 'bot' | 'visitor';

export interface HouseSnapshot {
  id: string;
  name: string;
  language: string;
  position: { x: number; y: number };
  radius?: number;
  metadata?: {
    stars?: number;
    issues?: number;
    components?: string[];
    agents?: Array<{ id: string; name: string }>;
  };
}

export interface NpcSeed {
  id: string;
  role: NpcRole;
  houseId: string;
  tint: number;
  name: string;
  cron?: number;
}

export interface PopulationPlan {
  houseId: string;
  npcs: NpcSeed[];
}

export interface NpcBehaviorOptions {
  idleDurationMs?: number;
  wanderRadius?: number;
  workDurationMs?: number;
  momentum?: number;
}

export interface NpcPopulationOverrides {
  [houseId: string]: Partial<{
    count: number;
    roles: NpcRole[];
    tint?: number;
  }>;
}
