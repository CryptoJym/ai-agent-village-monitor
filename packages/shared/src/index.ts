export type HealthStatus = {
  status: 'ok' | 'error';
  timestamp: string;
};

// Generation module exports (primary source for building generation types)
export * from './generation';

// State machine module exports
export * from './state/agentMachine';
export type { AgentContext, AgentEvent, AgentStateValue } from './state/agentMachine';
export * from './state/guards';
export * from './state/actions';
export * from './state/workEventAdapter';
export * from './state/useAgent';

// Tilemap module exports - only export types not already exported by generation
// Note: RoomType, SeededRNG, TilemapData, TilemapLayer are already exported from generation
export type {
  // Core tilemap types (not duplicated)
  TilesetReference,
  TileMapping,
  Rectangle,
  Room,
  Direction,
  Corridor,
  CorridorSegment,
  PlacementRule,
  Decoration,
  DecorationCatalog,
  DecorationItem,
  TilemapOptions,
} from './tilemap/types';

// Constants from tilemap
export {
  DEFAULT_TILE_IDS,
  AUTOTILE_MASKS,
  LAYER_NAMES,
} from './tilemap/types';

export function nowIso(): string {
  return new Date().toISOString();
}

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
  | { type: 'village_view'; ts: number; villageId: string }
  | { type: 'layout_reset'; ts: number; villageId?: string };

export type AnalyticsBatch = { events: AnalyticsEvent[]; clientId?: string; consent?: boolean };

// Provider Adapters module exports
export * from './adapters';

// Runner module exports
export * from './runner';
