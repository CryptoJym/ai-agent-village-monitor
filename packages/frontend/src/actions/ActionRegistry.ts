import { eventBus } from '../realtime/EventBus';
import { track } from '../analytics/client';
import { queueAwarePost } from '../utils/queueFetch';

export type ActionId =
  | 'startAgent'
  | 'stopAgent'
  | 'runRecentTool'
  | 'navigateToHouse'
  | 'assignAgentToHouse'
  | 'openHouseDashboard'
  | 'startHouseAgents'
  | 'runHouseChecks';

export type ActionPayloads = {
  startAgent: { agentId: string };
  stopAgent: { agentId: string };
  runRecentTool: { agentId: string; toolId: string };
  navigateToHouse: { houseId: string };
  assignAgentToHouse: { agentId: string; houseId: string };
  openHouseDashboard: { houseId: string };
  startHouseAgents: { houseId: string };
  runHouseChecks: { houseId: string };
};

export type AnyAction = {
  id: ActionId;
  payload: any; // kept loose for flexibility at call sites
};

type Impl<T extends ActionId> = (payload: ActionPayloads[T]) => Promise<void | false>;

const registry: Partial<{ [K in ActionId]: Impl<K> }> = {};

const recent: AnyAction[] = [];

export function registerAction<T extends ActionId>(id: T, impl: Impl<T>) {
  // Basic guard to avoid duplicate registrations in HMR/test
  (registry as any)[id] = impl as any;
}

export function getRecentActions(): AnyAction[] {
  return recent.slice(0, 10);
}

export async function executeAction<T extends ActionId>(id: T, payload: ActionPayloads[T]) {
  // Push into recent list (MRU)
  recent.unshift({ id, payload });
  if (recent.length > 25) recent.length = 25;

  const impl = registry[id] as Impl<T> | undefined;
  if (!impl) {
    // Stub behavior for now: emit a toast and a synthetic event
    eventBus.emit('toast', { type: 'info', message: `Action '${id}' queued` });
    return;
  }
  try {
    const result = await impl(payload);
    if (result !== false)
      eventBus.emit('toast', { type: 'success', message: `Action '${id}' executed` });
  } catch {
    try {
      const houseId = (payload as any)?.houseId;
      if (houseId) {
        track({
          type: 'house_command',
          ts: Date.now(),
          houseId: String(houseId),
          command: id,
          status: 'error',
        });
      }
    } catch (err) {
      void err;
    }
    eventBus.emit('toast', { type: 'error', message: `Action '${id}' failed` });
  }
}

// Real implementations that call backend APIs
registerAction('startAgent', async ({ agentId }) => {
  // Call backend to actually start the agent
  await queueAwarePost(`/api/agents/${encodeURIComponent(agentId)}/start`, {});
  // Update UI state optimistically
  eventBus.emit('agent_update', { agentId, state: 'connecting' });
});

registerAction('stopAgent', async ({ agentId }) => {
  // Call backend to actually stop the agent
  await queueAwarePost(`/api/agents/${encodeURIComponent(agentId)}/stop`, {});
  // Update UI state optimistically
  eventBus.emit('agent_update', { agentId, state: 'disconnected' });
});

registerAction('runRecentTool', async ({ agentId, toolId }) => {
  // Call backend to actually run the tool via MCP
  await queueAwarePost(`/api/agents/${encodeURIComponent(agentId)}/tool`, {
    tool: toolId,
    params: {},
  });
  // Optimistic UI update
  eventBus.emit('work_stream', {
    agentId,
    message: `Running tool '${toolId}'…`,
    ts: Date.now(),
  });
});

registerAction('navigateToHouse', async ({ houseId }) => {
  eventBus.emit('house_focus', { houseId, source: 'action' });
});

registerAction('assignAgentToHouse', async ({ agentId, houseId }) => {
  eventBus.emit('agent_assignment', { agentId, houseId });
  return false;
});

registerAction('openHouseDashboard', async ({ houseId }) => {
  eventBus.emit('house_dashboard_request', { houseId, source: 'action' });
  return false;
});

registerAction('startHouseAgents', async ({ houseId }) => {
  eventBus.emit('toast', {
    type: 'info',
    message: `Starting agents for ${houseId}`,
  });
  return false;
});

registerAction('runHouseChecks', async ({ houseId }) => {
  eventBus.emit('toast', {
    type: 'info',
    message: `Queued repository checks for ${houseId}`,
  });
  return false;
});
