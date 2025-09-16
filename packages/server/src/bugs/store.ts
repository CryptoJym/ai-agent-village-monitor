import { BugBot, type BugStatus, type CreateBugInput } from './types';
import { nowIso } from '@shared/index';

const bugs = new Map<string, BugBot>();
const byVillage = new Map<string, Set<string>>();

function indexVillage(villageId: string, id: string) {
  let set = byVillage.get(villageId);
  if (!set) {
    set = new Set();
    byVillage.set(villageId, set);
  }
  set.add(id);
}

function unindexVillage(villageId: string, id: string) {
  const set = byVillage.get(villageId);
  if (set) {
    set.delete(id);
    if (set.size === 0) byVillage.delete(villageId);
  }
}

export function createBug(data: CreateBugInput) {
  const now = nowIso();
  const bug: BugBot = {
    id: data.id!,
    villageId: data.villageId!,
    provider: data.provider ?? 'github',
    repoId: data.repoId,
    issueId: data.issueId!,
    issueNumber: data.issueNumber,
    title: data.title,
    description: data.description,
    status: 'open',
    severity: data.severity ?? null,
    assignedAgentId: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    x: data.x,
    y: data.y,
  };
  bugs.set(bug.id, bug);
  indexVillage(bug.villageId, bug.id);
  return bug;
}

export function getBug(id: string) {
  return bugs.get(id);
}

export function removeBug(id: string) {
  const b = bugs.get(id);
  if (!b) return false;
  bugs.delete(id);
  unindexVillage(b.villageId, id);
  return true;
}

export function listVillageBugs(villageId: string) {
  const ids = byVillage.get(villageId);
  if (!ids) return [];
  const arr: BugBot[] = [];
  ids.forEach((id) => {
    const b = bugs.get(id);
    if (b) arr.push(b);
  });
  return arr;
}

export function assignAgent(id: string, agentId: string) {
  const b = bugs.get(id);
  if (!b) return undefined;
  b.assignedAgentId = agentId;
  b.status = b.status === 'open' ? 'assigned' : b.status;
  b.updatedAt = nowIso();
  return b;
}

export function updateStatus(id: string, status: BugStatus) {
  const b = bugs.get(id);
  if (!b) return undefined;
  b.status = status;
  b.updatedAt = nowIso();
  if (status === 'resolved') {
    b.resolvedAt = b.updatedAt;
  }
  return b;
}
