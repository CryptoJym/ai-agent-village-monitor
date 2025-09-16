import { ZodSchema } from 'zod';
import {
  HealthSchema,
  type HealthResponse,
  VillageSchema,
  type Village,
  VillageAccessListSchema,
  type VillageAccessRow,
} from './schemas';

function getBaseUrl() {
  if (typeof location !== 'undefined') {
    const proto = location.protocol === 'https:' ? 'https' : 'http';
    return `${proto}://${location.hostname}:3000/api`;
  }
  return 'http://localhost:3000/api';
}

import { enqueue, setupOnlineFlush } from './offlineQueue';

setupOnlineFlush();

async function apiFetch<T>(path: string, schema: ZodSchema<T>, init?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const reqInit: RequestInit = {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
    ...init,
  };
  const isGet = (reqInit.method || 'GET').toUpperCase() === 'GET';

  // Exponential backoff retries for transient failures
  const attempts = isGet ? 2 : 3;
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, reqInit);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      return schema.parse(data);
    } catch (e) {
      lastErr = e;
      // On offline and non-GET, queue for later
      if (!navigator.onLine && !isGet) {
        enqueue(url, reqInit);
        // Return a best-effort optimistic value if schema permits empty object
        throw new Error('Queued offline request');
      }
      await new Promise((r) => setTimeout(r, 200 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

export const api = {
  health(): Promise<HealthResponse> {
    return apiFetch('/health', HealthSchema);
  },
  // Villages
  getVillage(id: string | number): Promise<Village> {
    return apiFetch(`/villages/${encodeURIComponent(String(id))}`, VillageSchema);
  },
  updateVillagePublic(id: string | number, isPublic: boolean): Promise<Village> {
    return apiFetch(`/villages/${encodeURIComponent(String(id))}`, VillageSchema, {
      method: 'PUT',
      body: JSON.stringify({ isPublic }),
    });
  },
  // Access list
  getAccessList(id: string | number): Promise<VillageAccessRow[]> {
    return apiFetch(`/villages/${encodeURIComponent(String(id))}/access`, VillageAccessListSchema);
  },
  upsertAccess(
    id: string | number,
    userId: number,
    role: 'owner' | 'member' | 'visitor',
  ): Promise<VillageAccessRow> {
    return apiFetch(
      `/villages/${encodeURIComponent(String(id))}/access`,
      // POST returns at least { userId, role }; schema allows optional username/grantedAt
      VillageAccessListSchema.element,
      { method: 'POST', body: JSON.stringify({ userId, role }) },
    );
  },
  updateAccess(
    id: string | number,
    userId: number,
    role: 'owner' | 'member' | 'visitor',
  ): Promise<VillageAccessRow> {
    return apiFetch(
      `/villages/${encodeURIComponent(String(id))}/access/${userId}`,
      VillageAccessListSchema.element,
      { method: 'PUT', body: JSON.stringify({ role }) },
    );
  },
  async removeAccess(id: string | number, userId: number): Promise<void> {
    const res = await fetch(
      `${getBaseUrl()}/villages/${encodeURIComponent(String(id))}/access/${userId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      },
    );
    if (!res.ok) throw new Error(`API error ${res.status}`);
  },
  inviteByUsername(
    id: string | number,
    username: string,
    role: 'owner' | 'member' | 'visitor' = 'member',
  ): Promise<VillageAccessRow> {
    return apiFetch(
      `/villages/${encodeURIComponent(String(id))}/invite`,
      VillageAccessListSchema.element,
      { method: 'POST', body: JSON.stringify({ username, role }) },
    );
  },
};

export type ApiClient = typeof api;
