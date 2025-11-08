import { z } from 'zod';
import { emitToVillage } from '../realtime/io';
import {
  createBug as storeCreate,
  removeBug as storeRemove,
  listVillageBugs,
  assignAgent,
  updateStatus,
} from './store';
import { BugBot, BugSeverity, BugStatus, type CreateBugInput } from './types';
import { getPrisma } from '../db';
import { recordEvent } from '../metrics';

export const AssignInput = z.object({ agentId: z.string().min(1) });
export type AssignInput = z.infer<typeof AssignInput>;

export const StatusInput = z.object({ status: BugStatus });
export type StatusInput = z.infer<typeof StatusInput>;

export async function createBugBot(input: CreateBugInput) {
  const prisma = getPrisma();
  let bug: any;
  if (prisma) {
    const now = new Date();
    // Upsert by id for idempotency
    bug = await prisma.bugBot.upsert({
      where: { id: input.id! },
      update: {
        villageId: input.villageId!,
        provider: input.provider ?? 'github',
        repoId: input.repoId ?? null,
        issueId: input.issueId!,
        issueNumber: input.issueNumber ?? null,
        title: input.title ?? null,
        description: input.description ?? null,
        severity: input.severity ?? null,
        x: input.x ?? null,
        y: input.y ?? null,
        updatedAt: now,
      },
      create: {
        id: input.id!,
        villageId: input.villageId!,
        provider: input.provider ?? 'github',
        repoId: input.repoId ?? null,
        issueId: input.issueId!,
        issueNumber: input.issueNumber ?? null,
        title: input.title ?? null,
        description: input.description ?? null,
        status: 'open',
        severity: input.severity ?? null,
        assignedAgentId: null,
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
        x: input.x ?? null,
        y: input.y ?? null,
      },
    });
  } else {
    bug = storeCreate(input);
  }
  const payload: Pick<BugBot, 'id' | 'x' | 'y'> & {
    severity?: z.infer<typeof BugSeverity>;
    houseId?: string;
  } = {
    id: bug.id,
    x: bug.x ?? 0,
    y: bug.y ?? 0,
    severity: bug.severity ?? undefined,
  };
  const houseId = (input as any).houseId as string | undefined;
  if (houseId) (payload as any).houseId = houseId;
  emitToVillage(bug.villageId, 'bug_bot_spawn', payload);
  recordEvent('bug.created');
  return bug;
}

export async function assignAgentToBug(bugId: string, agentId: string) {
  const prisma = getPrisma();
  let bug: any;
  if (prisma) {
    bug = await prisma.bugBot
      .update({
        where: { id: bugId },
        data: { assignedAgentId: agentId, status: 'assigned', updatedAt: new Date() },
      })
      .catch(() => undefined);
  } else {
    bug = assignAgent(bugId, agentId);
  }
  if (!bug) return undefined;
  recordEvent('bug.assigned');
  return bug;
}

export async function updateBugStatus(bugId: string, status: z.infer<typeof BugStatus>) {
  const prisma = getPrisma();
  let bug: any;
  if (prisma) {
    bug = await prisma.bugBot
      .update({
        where: { id: bugId },
        data: {
          status,
          updatedAt: new Date(),
          resolvedAt: status === 'resolved' ? new Date() : null,
        },
      })
      .catch(() => undefined);
  } else {
    bug = updateStatus(bugId, status);
  }
  if (!bug) return undefined;
  if (status === 'resolved') {
    emitToVillage(bug.villageId, 'bug_bot_resolved', { id: bug.id });
    recordEvent('bug.resolved');
    if (prisma) {
      await prisma.bugBot.delete({ where: { id: bug.id } }).catch(() => {});
    } else {
      storeRemove(bug.id);
    }
  }
  return bug;
}

export function getBugsForVillage(villageId: string) {
  // For unit tests (no DB), return synchronous in-memory list for convenience
  // If a DB is configured, prefer creating a separate async accessor.
  return listVillageBugs(villageId);
}

export async function removeBug(id: string) {
  const prisma = getPrisma();
  if (prisma) {
    await prisma.bugBot.delete({ where: { id } }).catch(() => {});
    return true;
  }
  return storeRemove(id);
}

export async function updateBugProgress(agentId: string, progress: number) {
  const prisma = getPrisma();
  if (!prisma) return; // Skip if no database

  try {
    // Find bug assigned to this agent
    const bugs = await prisma.bugBot.findMany({
      where: {
        assignedAgentId: agentId,
        status: { in: ['assigned', 'in_progress'] },
      },
      select: { id: true, villageId: true, progress: true },
    });

    // Update progress for all bugs assigned to this agent
    for (const bug of bugs) {
      // Only update if progress increased
      const currentProgress = bug.progress ?? 0;
      if (progress > currentProgress) {
        await prisma.bugBot.update({
          where: { id: bug.id },
          data: {
            progress,
            status: progress > 0 ? 'in_progress' : 'assigned',
            updatedAt: new Date(),
          },
        });

        // Emit WebSocket event for real-time UI update
        emitToVillage(bug.villageId, 'bug_bot_progress', {
          id: bug.id,
          progress,
        });
      }
    }
  } catch (e) {
    // Best-effort, don't throw
    void e;
  }
}
