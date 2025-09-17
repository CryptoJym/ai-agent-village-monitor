import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id') || req.header('X-Request-Id');
  const id = incoming && incoming.trim() ? incoming.trim() : (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));
  (req as any).id = id;
  res.setHeader('x-request-id', id);
  next();
}

