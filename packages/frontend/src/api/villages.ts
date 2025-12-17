import { Village, VillageSchema, VillageAccessListSchema, VillageAccessRow } from './schemas';
import { csrfFetch } from './csrf';

async function parseJson<T>(res: Response, schema: any): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return schema.parse(data);
}

export async function getVillage(id: string): Promise<Village> {
  const res = await fetch(`/api/villages/${encodeURIComponent(id)}`, { credentials: 'include' });
  return parseJson<Village>(res, VillageSchema);
}

export async function getAccessList(id: string): Promise<VillageAccessRow[]> {
  const res = await fetch(`/api/villages/${encodeURIComponent(id)}/access`, {
    credentials: 'include',
  });
  return parseJson<VillageAccessRow[]>(res, VillageAccessListSchema);
}

export async function updateVillagePublic(id: string, isPublic: boolean): Promise<void> {
  const res = await csrfFetch(`/api/villages/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPublic }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function upsertAccess(
  id: string,
  userId: number,
  role: 'member' | 'visitor' | 'owner' = 'member',
): Promise<void> {
  const res = await csrfFetch(`/api/villages/${encodeURIComponent(id)}/access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, role }),
  });
  if (!res.ok && res.status !== 201) throw new Error(`HTTP ${res.status}`);
}

export async function updateAccess(
  id: string,
  userId: number,
  role: 'owner' | 'member' | 'visitor',
): Promise<void> {
  const res = await csrfFetch(`/api/villages/${encodeURIComponent(id)}/access/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function removeAccess(id: string, userId: number): Promise<void> {
  const res = await csrfFetch(`/api/villages/${encodeURIComponent(id)}/access/${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
}

export async function inviteByUsername(
  id: string,
  username: string,
  role: 'member' | 'visitor' = 'member',
): Promise<void> {
  const res = await csrfFetch(`/api/villages/${encodeURIComponent(id)}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, role }),
  });
  if (!res.ok && res.status !== 201) throw new Error(`HTTP ${res.status}`);
}
