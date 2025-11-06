import { prisma } from '../db/client';

export async function setVillageLastSynced(villageId: string, at: Date = new Date()) {
  // Update the lastSynced field on the village
  const v = await prisma.village.update({
    where: { id: villageId },
    data: { lastSynced: at },
  });
  return v;
}
