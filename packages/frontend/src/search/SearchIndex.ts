export type AgentEntity = {
  type: 'agent';
  id: string;
  name: string;
  status?: string;
  houseId?: string;
  houseName?: string;
};
export type HouseEntity = {
  type: 'house';
  id: string;
  name: string;
  location?: string;
  components?: string[];
};
export type ActionEntity = {
  type: 'action';
  id: string;
  label: string;
  actionId?: string;
  payload?: any;
};

export type Entity = AgentEntity | HouseEntity | ActionEntity;

export type NormalizedResult = {
  type: Entity['type'];
  id: string;
  label: string;
  // generic metadata for rendering/action payloads
  meta?: Record<string, any>;
  // Reference to the action to execute when selected
  actionRef?: { actionId: string; payload: any };
  score: number;
};

const state: { agents: AgentEntity[]; houses: HouseEntity[]; actions: ActionEntity[] } = {
  agents: [],
  houses: [],
  actions: [],
};

export function setData(data: Partial<typeof state>) {
  if (data.agents) state.agents = data.agents;
  if (data.houses) state.houses = data.houses;
  if (data.actions) state.actions = data.actions;
}

// extremely lightweight fuzzy: case-insensitive substring + simple score
function matchScore(haystack: string, needle: string): number {
  const a = haystack.toLowerCase();
  const b = needle.toLowerCase().trim();
  if (!b) return 0.0001; // treat empty as minimal match
  const i = a.indexOf(b);
  if (i === -1) return -1;
  // Prefer earlier matches and shorter labels
  return 100 - i - Math.min(50, Math.abs(haystack.length - needle.length));
}

export function search(query: string): NormalizedResult[] {
  const res: NormalizedResult[] = [];
  const push = (r: NormalizedResult) => res.push(r);

  for (const a of state.agents) {
    const haystack = `${a.name} ${a.status ?? ''} ${a.houseName ?? ''} ${a.houseId ?? ''}`;
    const s = matchScore(haystack, query);
    if (s >= 0)
      push({
        type: 'agent',
        id: a.id,
        label: `${a.name}${
          a.status || a.houseName ? ` (${[a.status, a.houseName].filter(Boolean).join(' • ')})` : ''
        }`,
        meta: { status: a.status, house: a.houseName, houseId: a.houseId },
        actionRef: { actionId: 'startAgent', payload: { agentId: a.id } },
        score: s,
      });
  }

  for (const h of state.houses) {
    const extra = Array.isArray(h.components) ? h.components.join(' ') : '';
    const s = matchScore(`${h.name} ${h.location ?? ''} ${extra}`, query);
    if (s >= 0)
      push({
        type: 'house',
        id: h.id,
        label: `${h.name}${h.location ? ` (${h.location})` : ''}`,
        meta: { location: h.location, components: h.components },
        actionRef: { actionId: 'navigateToHouse', payload: { houseId: h.id } },
        score: s,
      });
  }

  for (const a of state.actions) {
    const s = matchScore(a.label, query);
    if (s >= 0)
      push({
        type: 'action',
        id: a.id,
        label: a.label,
        actionRef: { actionId: a.actionId ?? a.id, payload: a.payload ?? {} },
        score: s,
      });
  }

  res.sort((x, y) => y.score - x.score);
  return res;
}
