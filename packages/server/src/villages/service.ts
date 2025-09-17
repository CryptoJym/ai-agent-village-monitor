import { prisma } from '../db/client';

export async function setVillageLastSynced(_villageId: string, _at: Date = new Date()) {
  // No-op alignment: the schema has no lastSynced; consider persisting a timestamp in config if needed.
  const v = await prisma.village.findFirst({});
  return v;
}
