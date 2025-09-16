import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from './jwt';
import { prisma } from '../db/client';

export class AuthError extends Error {
  status = 401;
  code = 'UNAUTHORIZED';
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends Error {
  status = 403;
  code = 'FORBIDDEN';
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization') || req.header('Authorization') || '';
    let token = '';
    if (header.toLowerCase().startsWith('bearer ')) token = header.slice(7).trim();
    if (!token && typeof (req as any).signedCookies?.access_token === 'string') token = (req as any).signedCookies.access_token;
    if (!token && typeof req.cookies?.access_token === 'string') token = req.cookies.access_token;
    if (!token) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="api"');
      return res.status(401).json({ error: 'Missing bearer token', code: 'UNAUTHORIZED' });
    }
    const payload = verifyAccessToken(token);
    req.user = payload;
    return next();
  } catch (e: any) {
    res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
    return res.status(401).json({ error: e?.message || 'Invalid token', code: 'UNAUTHORIZED' });
  }
}

export type VillageRole = 'owner' | 'member' | 'visitor';

export async function getUserVillageRole(userId: number, villageId: number): Promise<VillageRole | null> {
  const access = await prisma.villageAccess.findUnique({ where: { villageId_userId: { villageId, userId } } });
  if (!access) return null;
  const role = (access.role || '').toLowerCase();
  if (role === 'owner' || role === 'member' || role === 'visitor') return role as VillageRole;
  return null;
}

// Test seam: allow overriding role resolution in tests
let roleResolver: typeof getUserVillageRole | null = null;
export function __setRoleResolver(fn: typeof getUserVillageRole | null) {
  roleResolver = fn;
}

export function requireVillageRole(getVillageId: (req: Request) => number, roles: VillageRole[] = ['owner']) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AuthError());
      const villageId = getVillageId(req);
      if (typeof villageId !== 'number' || !Number.isFinite(villageId)) {
        return next(new ForbiddenError('Invalid village id'));
      }
      const userId = Number(req.user.sub);
      const role = await (roleResolver ? roleResolver(userId, villageId) : getUserVillageRole(userId, villageId));
      if (role === 'owner') return next();
      if (role && roles.includes(role)) return next();
      return next(new ForbiddenError('Insufficient permissions'));
    } catch (e: any) {
      return next(new ForbiddenError(e?.message || 'Forbidden'));
    }
  };
}

// Enforce village role based on agent id in route params (e.g., /api/agents/:id/...)
export function requireAgentVillageRole(roles: VillageRole[] = ['owner', 'member']) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AuthError());
      const raw = req.params.id;
      const agentId = Number(raw);
      // Allow ad-hoc or non-persisted agent ids (string ids) — authenticated-only access
      if (!Number.isFinite(agentId)) return next();
      const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { villageId: true } });
      // If agent not persisted yet, allow; downstream handlers can enforce additional checks
      if (!agent) return next();
      const userId = Number(req.user.sub);
      const role = await getUserVillageRole(userId, agent.villageId);
      if (role === 'owner') return next();
      if (role && roles.includes(role)) return next();
      return next(new ForbiddenError('Insufficient permissions'));
    } catch (e: any) {
      return next(new ForbiddenError(e?.message || 'Forbidden'));
    }
  };
}
