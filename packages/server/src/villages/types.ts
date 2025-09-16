import { z } from 'zod';

export const VillageCreateSchema = z.object({
  name: z.string().min(1),
  githubOrgId: z.union([z.string(), z.number(), z.bigint()]).transform((v) => BigInt(v as any)),
  isPublic: z.boolean().optional().default(false),
  villageConfig: z.unknown().optional(),
});

export const VillageUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  isPublic: z.boolean().optional(),
  villageConfig: z.unknown().optional(),
});

export type VillageCreateInput = z.infer<typeof VillageCreateSchema>;
export type VillageUpdateInput = z.infer<typeof VillageUpdateSchema>;

