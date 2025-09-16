import { prisma } from '../db/client';

export async function setVillageLastSynced(villageId: number, at: Date = new Date()) {
  return prisma.village.update({ where: { id: villageId }, data: { lastSynced: at } });
}

