import type { PrismaClient } from '@prisma/client';
import { getPrisma } from '../db';

export async function resolveVillageAndHouse(payload: any): Promise<{ villageId: string; houseId?: string; x?: number; y?: number }> {
  const prisma = getPrisma() as PrismaClient | undefined;
  // Default fallback village id used by frontend realtime; not persisted if DB is absent
  const fallbackVillage = 'demo';

  if (!prisma) return { villageId: fallbackVillage };

  try {
    const orgLogin: string | undefined = payload?.organization?.login || payload?.repository?.owner?.login;
    const orgIdNum: number | undefined = payload?.organization?.id || payload?.repository?.owner?.id;
    const orgId: bigint | undefined = typeof orgIdNum === 'number' ? BigInt(orgIdNum) : undefined;

    const village = await prisma.village.findFirst({
      where: {
        OR: [
          orgLogin ? ({ orgName: { equals: orgLogin } } as any) : undefined,
          orgId ? ({ githubOrgId: orgId } as any) : undefined,
        ].filter(Boolean) as any,
      },
    });
    const villageId = village?.id || fallbackVillage;

    const repo = payload?.repository;
    if (!repo || !village) return { villageId };

    const repoIdNum: number | undefined = repo.id;
    const repoId = typeof repoIdNum === 'number' ? BigInt(repoIdNum) : undefined;
    const repoName: string | undefined = repo.full_name || repo.name;
    const house = await prisma.house.findFirst({
      where: {
        villageId: village.id,
        OR: [
          repoId ? ({ githubRepoId: repoId } as any) : undefined,
          repoName ? ({ repoName: repoName } as any) : undefined,
        ].filter(Boolean) as any,
      },
    });
    if (!house) return { villageId };
    const x = typeof (house as any).positionX === 'number' ? (house as any).positionX : undefined;
    const y = typeof (house as any).positionY === 'number' ? (house as any).positionY : undefined;
    const out: { villageId: string; houseId?: string; x?: number; y?: number } = { villageId, houseId: house.id };
    if (typeof x === 'number' && typeof y === 'number') { out.x = x; out.y = y; }
    return out;
  } catch {
    return { villageId: fallbackVillage };
  }
}

