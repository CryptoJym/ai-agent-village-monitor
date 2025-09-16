import { z } from 'zod';

export const VillageCreateSchema = z.object({
  name: z.string().min(1),
  githubOrgId: z.union([z.string(), z.number(), z.bigint()]).transform((v) => BigInt(v as any)),
  config: z.unknown().optional(),
});

export const VillageUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.unknown().optional(),
});

export type VillageCreateInput = z.infer<typeof VillageCreateSchema>;
export type VillageUpdateInput = z.infer<typeof VillageUpdateSchema>;
