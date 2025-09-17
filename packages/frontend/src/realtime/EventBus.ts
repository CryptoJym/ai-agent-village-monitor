import mitt from 'mitt';

type Events = {
  agent_update: { agentId: string; state: string; x?: number; y?: number };
  work_stream: { agentId: string; message: string; ts?: number };
  // Spawns may reference a house (preferred) or provide absolute x/y as a fallback.
  // When houseId is provided, the scene will place the bot within a ring around the house center.
  bug_bot_spawn: {
    id: string;
    // Optional target house context
    houseId?: string;
    title?: string;
    summary?: string;
    // Fallback coordinates (e.g., house center or absolute spawn)
    x?: number;
    y?: number;
    severity?: 'low' | 'medium' | 'high';
  };
  bug_bot_progress: { id: string; progress: number }; // 0..1
  bug_bot_resolved: { id: string };
  bug_bot_assign_request: { id: string };
  agent_drop: { x: number; y: number };
  agent_assignment: { agentId: string; houseId?: string };
  agent_identity: { agentId: string; name?: string };
  house_focus: { houseId: string; source?: string };
  house_dashboard_request: { houseId: string; source?: string };
  house_dashboard: {
    houseId: string;
    name: string;
    language?: string;
    components?: string[];
    issues?: number;
    agents?: Array<{ id: string; name: string }>;
    stars?: number;
    buildStatus?: string;
  };
  connection_status: { status: 'connecting' | 'connected' | 'disconnected' };
  latency: { rttMs: number };
  toast: { type: 'success' | 'error' | 'info'; message: string };
  // Emitted when the main camera finishes an instant snap or a short pan
  cameraSettled: { x: number; y: number; zoom: number };
  house_activity: {
    type: 'house.activity';
    houseId?: string | number;
    repoId?: string | number;
    indicators: {
      lights: { active: boolean; minRemainingMs?: number };
      banner: { active: boolean; prNumber?: number; minRemainingMs?: number };
      smoke: {
        active: boolean;
        status?: 'in_progress' | 'failed' | 'passed';
        minRemainingMs?: number;
      };
    };
    version: number;
    ts: number;
  };
};

export const eventBus = mitt<Events>();
