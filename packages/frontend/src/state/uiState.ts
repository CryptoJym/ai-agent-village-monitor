export type TabKey = 'thread' | 'control' | 'info';

export type UIHashState = {
  agent?: string;
  tab?: TabKey;
  cam?: { x: number; y: number; z?: number };
};

function parseCam(v: string | null | undefined): UIHashState['cam'] | undefined {
  if (!v) return undefined;
  const parts = v.split(',').map((s) => Number(s.trim()));
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return undefined;
  const [x, y, z] = parts;
  return { x, y, z: Number.isFinite(z) ? z : undefined };
}

function stringifyCam(cam?: UIHashState['cam']): string | undefined {
  if (!cam) return undefined;
  const { x, y, z } = cam;
  const xs = Number.isFinite(x) ? x : 0;
  const ys = Number.isFinite(y) ? y : 0;
  if (Number.isFinite(z as number)) return `${xs},${ys},${z}`;
  return `${xs},${ys}`;
}

export function readUIHash(): UIHashState {
  const raw = (typeof window !== 'undefined' ? window.location.hash : '') || '';
  const qs = raw.startsWith('#') ? raw.slice(1) : raw;
  const sp = new URLSearchParams(qs);
  const agent = sp.get('agent') || undefined;
  const tabRaw = sp.get('tab') || undefined;
  const tab =
    tabRaw === 'thread' || tabRaw === 'control' || tabRaw === 'info'
      ? (tabRaw as TabKey)
      : undefined;
  const cam = parseCam(sp.get('cam'));
  return { agent, tab, cam };
}

export function writeUIHash(next: Partial<UIHashState>) {
  const cur = readUIHash();
  const out: UIHashState = { ...cur, ...next };
  const sp = new URLSearchParams();
  if (out.agent) sp.set('agent', out.agent);
  if (out.tab) sp.set('tab', out.tab);
  const cam = stringifyCam(out.cam);
  if (cam) sp.set('cam', cam);
  const newHash = sp.toString();
  const base = window.location.href.split('#')[0];
  const url = newHash ? `${base}#${newHash}` : base;
  try {
    window.history.replaceState(null, '', url);
  } catch (e) {
    void e;
    window.location.hash = newHash;
  }
}

export function onHashChange(handler: () => void) {
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}

// Back-compat helpers expected by some tests
export function getUIState(): { dialogueTab?: TabKey; agentId?: string } {
  try {
    const raw = localStorage.getItem('ui_state_v1');
    if (raw) {
      const j = JSON.parse(raw) as { dialogueTab?: TabKey; agentId?: string };
      return { dialogueTab: j.dialogueTab, agentId: j.agentId };
    }
  } catch (e) {
    void e;
  }
  const h = readUIHash();
  return { dialogueTab: h.tab, agentId: h.agent };
}

export function setUIState(st: {
  dialogueTab?: TabKey;
  agentId?: string;
  cam?: UIHashState['cam'];
}) {
  const next: Partial<UIHashState> = {};
  if (st.dialogueTab) next.tab = st.dialogueTab;
  if (st.agentId) next.agent = st.agentId;
  if (st.cam) next.cam = st.cam;
  writeUIHash(next);
  try {
    const raw = localStorage.getItem('ui_state_v1');
    const cur = raw ? JSON.parse(raw) : {};
    const updated = { ...cur };
    if (st.dialogueTab) (updated as any).dialogueTab = st.dialogueTab;
    if (st.agentId) (updated as any).agentId = st.agentId;
    localStorage.setItem('ui_state_v1', JSON.stringify(updated));
  } catch (e) {
    void e;
  }
}
