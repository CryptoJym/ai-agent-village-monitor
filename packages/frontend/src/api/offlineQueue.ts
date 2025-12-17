import { csrfFetch } from './csrf';

type QueuedRequest = {
  id: string;
  url: string;
  init: RequestInit;
  createdAt: number;
};

const STORAGE_KEY = 'aavm_offline_queue_v1';

function loadQueue(): QueuedRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveQueue(q: QueuedRequest[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
  } catch (e) {
    void e;
  }
}

export function enqueue(url: string, init: RequestInit) {
  const q = loadQueue();
  const id = `${Date.now()}:${Math.random().toString(16).slice(2)}`;
  q.push({ id, url, init, createdAt: Date.now() });
  saveQueue(q);
}

export async function flush(): Promise<number> {
  const q = loadQueue();
  let success = 0;
  const remain: QueuedRequest[] = [];
  for (const item of q) {
    try {
      const res = await csrfFetch(item.url, item.init);
      if (res.ok) success += 1;
      else remain.push(item);
    } catch {
      remain.push(item);
    }
  }
  saveQueue(remain);
  return success;
}

export function setupOnlineFlush() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => {
    void flush();
  });
}
