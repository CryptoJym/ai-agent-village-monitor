type QueuedCommand = {
  url: string;
  body: any;
  headers?: Record<string, string>;
  ts: number;
};

const KEY = 'commandQueue';

function load(): QueuedCommand[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}
function save(list: QueuedCommand[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    void e;
  }
}

export function enqueueCommand(url: string, body: any, headers?: Record<string, string>) {
  const list = load();
  list.push({ url, body, headers, ts: Date.now() });
  save(list);
}

export async function flushQueuedCommands() {
  const list = load();
  if (list.length === 0) return;
  const remaining: QueuedCommand[] = [];
  for (const item of list) {
    try {
      const res = await fetch(item.url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(item.headers || {}) },
        body: JSON.stringify(item.body),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      remaining.push(item);
    }
  }
  save(remaining);
}

export function startAutoFlush() {
  const onOnline = () => {
    void flushQueuedCommands();
  };
  window.addEventListener('online', onOnline);
  // Fire once on load
  void flushQueuedCommands();
}
