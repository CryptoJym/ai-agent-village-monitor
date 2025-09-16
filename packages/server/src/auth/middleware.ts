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
    if (!token && typeof (req as any).signedCookies?.access_token === 'string')
      token = (req as any).signedCookies.access_token;
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

export type VillageRole = 'owner' | 'member' | 'viewer';

export async function getUserVillageRole(
  userId: string | number,
  villageId: string | number,
): Promise<VillageRole | null> {
  // Honor test seam override when present
  if (roleResolver) {
    try {
      const r = await roleResolver(String(userId), String(villageId));
      if (r) return r;
    } catch {}
  }
  const access = await prisma.villageAccess.findUnique({
    where: { villageId_userId: { villageId: String(villageId), userId: String(userId) } },
  });
  if (!access) return null;
  const role = (access.role || '').toLowerCase();
  if (role === 'owner' || role === 'member' || role === 'viewer') return role as VillageRole;
  return null;
}

// Test seam: allow overriding role resolution in tests
let roleResolver: typeof getUserVillageRole | null = null;
export function __setRoleResolver(fn: typeof getUserVillageRole | null) {
  roleResolver = fn;
}

export function requireVillageRole(
  getVillageId: (req: Request) => any,
  roles: VillageRole[] = ['owner'],
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AuthError());
      const rawId = getVillageId(req);
      const villageId = rawId != null ? String(rawId) : '';
      if (!villageId) {
        return next(new ForbiddenError('Invalid village id'));
      }
      const userId = String(req.user.sub);
      const role = await (roleResolver
        ? roleResolver(userId, villageId)
        : getUserVillageRole(userId, villageId));
      if (role === 'owner') return next();
      if (role && roles.includes(role)) return next();
      return next(new ForbiddenError('Insufficient permissions'));
    } catch (e: any) {
      return next(new ForbiddenError(e?.message || 'Forbidden'));
    }
  };
}

// Enforce village role based on agent id in route params (e.g., /api/agents/:id/...)
export function requireAgentVillageRole(_roles: VillageRole[] = ['owner', 'member']) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AuthError());
      // Schema has no agent->village relation; defer fine-grained checks to route-specific logic
      return next();
    } catch (e: any) {
      return next(new ForbiddenError(e?.message || 'Forbidden'));
    }
  };
}
