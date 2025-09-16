import { z } from 'zod';

export const PreferencesSchema = z.object({
  lod: z.enum(['low', 'medium', 'high']).optional(),
  maxFps: z.coerce.number().int().min(15).max(240).optional(),
  colorblind: z.coerce.boolean().optional(),
  theme: z.enum(['dark', 'light']).optional(),
  keybindings: z
    .object({ talk: z.string().min(1).default('T') })
    .partial()
    .optional(),
});

export const RequeueSchema = z.object({ jobId: z.string().min(1) });

export const DlqDeleteBodySchema = z.object({ jobId: z.string().min(1).optional() });
export const DlqDeleteQuerySchema = z.object({ all: z.enum(['true']).optional() });

