import { enqueueCommand, startAutoFlush } from '../offline/CommandQueue';

let initialized = false;
function ensureInit() {
  if (!initialized) {
    initialized = true;
    if (typeof window !== 'undefined') startAutoFlush();
  }
}

export async function queueAwarePost(
  url: string,
  body: any,
  headers?: Record<string, string>,
): Promise<Response | { queued: true }> {
  ensureInit();
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueCommand(url, body, headers);
      return { queued: true } as const;
    }
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(String(res.status));
    return res;
  } catch (e) {
    enqueueCommand(url, body, headers);
    return { queued: true } as const;
  }
}
