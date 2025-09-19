import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { revokeProviderToken } from '../auth/tokenStore';
import { audit } from '../audit/logger';

export const usersRouter = Router();

// Delete current account (GDPR-style erasure)
// Flow: authenticated user confirms with their current name or email
// Effect: revoke provider tokens, remove access, nullify personal fields, detach agents
usersRouter.delete('/account', requireAuth, async (req, res) => {
  try {
    const userId = String((req as any).user?.sub || '');
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const confirm = String(req.body?.confirm ?? '')
      .trim()
      .toLowerCase();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'not found' });
    const name = (user as any).username || user.name || '';
    const email = user.email || '';
    if (
      !confirm ||
      (confirm !== String(name).toLowerCase() && confirm !== String(email).toLowerCase())
    ) {
      return res.status(400).json({ error: 'confirmation mismatch' });
    }
    // Revoke provider token(s)
    try {
      if (name) await revokeProviderToken({ userKey: String(name), provider: 'github' });
    } catch {
      // Revocation best effort; continue anonymization.
    }
    // Remove village access entries
    await prisma.villageAccess.deleteMany({ where: { userId: userId } });
    // Detach agents
    await prisma.agent.updateMany({ where: { userId: userId }, data: { userId: null } });
    // Anonymize user (soft-delete)
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: `deleted-${userId}`,
        email: null,
        preferences: null,
        githubId: null,
      },
    });
    audit.log('account.delete', { actorId: userId });
    return res.status(202).json({ status: 'scheduled', id: userId });
  } catch {
    return res.status(500).json({ error: 'internal error' });
  }
});
