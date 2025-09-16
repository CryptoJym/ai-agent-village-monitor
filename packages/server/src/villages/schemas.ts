import { z } from 'zod';

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  orderBy: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt').optional(),
  order: z.enum(['asc', 'desc']).default('desc').optional(),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const createVillageSchema = z.object({
  name: z.string().min(1).max(100),
  githubOrgId: z.union([z.string(), z.number(), z.bigint()]).transform((v) => {
    try {
      return BigInt(v as any);
    } catch {
      throw new Error('Invalid githubOrgId');
    }
  }),
  config: z.record(z.string(), z.any()).default({}).optional(),
});

export const updateVillageSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    config: z.record(z.string(), z.any()).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'No fields to update' });

export type ListQuery = z.infer<typeof listQuerySchema>;
export type CreateVillageBody = z.infer<typeof createVillageSchema>;
export type UpdateVillageBody = z.infer<typeof updateVillageSchema>;
