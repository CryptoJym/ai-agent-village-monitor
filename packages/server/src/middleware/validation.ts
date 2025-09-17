import type { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export function validateBody<T extends ZodSchema<any>>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const requestId = (req as any).id;
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.flatten() }, requestId });
    }
    (req as any).validatedBody = parsed.data;
    next();
  };
}

export function validateQuery<T extends ZodSchema<any>>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query ?? {});
    if (!parsed.success) {
      const requestId = (req as any).id;
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: parsed.error.flatten() }, requestId });
    }
    (req as any).validatedQuery = parsed.data;
    next();
  };
}

export const CommandSchema = z.object({
  command: z.string().min(1),
  args: z.record(z.unknown()).optional(),
});
