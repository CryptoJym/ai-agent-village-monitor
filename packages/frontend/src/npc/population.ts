import type { HouseSnapshot, NpcSeed, NpcPopulationOverrides } from './types';
import { hashTint } from '../assets/AssetManager';

const ROLE_ORDER: NpcSeed['role'][] = ['engineer', 'bot', 'visitor'];

export function estimateNpcCount(house: HouseSnapshot, override?: NpcPopulationOverrides[string]) {
  if (override?.count != null) return override.count;
  const stars = house.metadata?.stars ?? 40;
  const issues = house.metadata?.issues ?? 0;
  const agents = house.metadata?.agents?.length ?? 0;
  const base = 1 + Math.round(stars / 60);
  const issueBonus = Math.min(3, Math.round(issues / 10));
  const agentBonus = Math.min(3, Math.round(agents / 2));
  return Math.max(2, Math.min(8, base + issueBonus + agentBonus));
}

export function deriveRoles(
  count: number,
  house: HouseSnapshot,
  override?: NpcSeed['role'][] | undefined,
): NpcSeed['role'][] {
  if (override && override.length) {
    const pool = [...override];
    while (pool.length < count) pool.push(override[pool.length % override.length]);
    return pool.slice(0, count);
  }
  const roles: NpcSeed['role'][] = [];
  const issues = house.metadata?.issues ?? 0;
  const components = house.metadata?.components?.length ?? 0;
  for (let i = 0; i < count; i++) {
    if (issues > 8 && i % 3 === 0) roles.push('bot');
    else if (components > 2 && i % 2 === 0) roles.push('engineer');
    else roles.push(ROLE_ORDER[i % ROLE_ORDER.length]);
  }
  return roles.slice(0, count);
}

export function computeNpcTint(houseId: string, role: NpcSeed['role'], index: number) {
  const base = `${houseId}:${role}:${index}`;
  return hashTint(base);
}
