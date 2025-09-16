import { eventBus } from '../realtime/EventBus';

export type ActionId = 'startAgent' | 'stopAgent' | 'runRecentTool' | 'navigateToHouse';

export type ActionPayloads = {
  startAgent: { agentId: string };
  stopAgent: { agentId: string };
  runRecentTool: { agentId: string; toolId: string };
  navigateToHouse: { houseId: string };
};

export type AnyAction = {
  id: ActionId;
  payload: any; // kept loose for flexibility at call sites
};

type Impl<T extends ActionId> = (payload: ActionPayloads[T]) => Promise<void>;

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
    await impl(payload);
    eventBus.emit('toast', { type: 'success', message: `Action '${id}' executed` });
  } catch {
    eventBus.emit('toast', { type: 'error', message: `Action '${id}' failed` });
  }
}

// Default stub implementations to be wired to real services later
registerAction('startAgent', async ({ agentId }) => {
  eventBus.emit('agent_update', { agentId, state: 'working' });
});

registerAction('stopAgent', async ({ agentId }) => {
  eventBus.emit('agent_update', { agentId, state: 'idle' });
});

registerAction('runRecentTool', async ({ agentId, toolId }) => {
  eventBus.emit('work_stream', {
    agentId,
    message: `Running tool '${toolId}'…`,
    ts: Date.now(),
  });
});

registerAction('navigateToHouse', async ({ houseId }) => {
  // In a complete wiring, this would trigger route or scene navigation
  void houseId; // noop
});
