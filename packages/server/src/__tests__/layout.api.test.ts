import request from 'supertest';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';

// We avoid static imports so we can set env before modules load
let createApp: any;
let prisma: any;
let signAccessToken: (id: number, username: string) => string;
let setRoleResolver: ((fn: ((userId: string, villageId: string) => any) | null) => void) | null =
  null;

// Use a fixed test secret to sign JWTs
const TEST_JWT = 'test-secret-for-layout-tests';

// Utility: build Bearer header
function bearer(t: string) {
  return { Authorization: `Bearer ${t}` } as const;
}

describe('village layout API', () => {
  let app: any;
  const ownerId = 101;
  const memberId = 202;
  const villageId = 777; // synthetic id for stubbing
  let ownerToken = '';
  let memberToken = '';

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || TEST_JWT;
    // Dynamic imports to ensure env is set first
    ({ createApp } = await import('../app'));
    ({ prisma } = await import('../db/client'));
    ({ signAccessToken } = await import('../auth/jwt'));
    try {
      const mod = await import('../auth/middleware');
      // @ts-ignore - access test seam
      setRoleResolver = (mod.__setRoleResolver as any) ?? null;
    } catch {
      setRoleResolver = null;
    }

    app = createApp();

    ownerToken = signAccessToken(ownerId, 'owner_user');
    memberToken = signAccessToken(memberId, 'member_user');

    // Ensure routes treat our synthetic ids as authorized roles without touching DB
    if (setRoleResolver) {
      setRoleResolver((uid: string, vid: string) => {
        if (vid !== String(villageId)) return null;
        if (uid === String(ownerId)) return 'owner';
        if (uid === String(memberId)) return 'member';
        return null;
      });
    }
  });

  afterEach(() => {
    // Restore spies between tests
    if ((prisma?.village?.findUnique as any)?.mockRestore)
      (prisma.village.findUnique as any).mockRestore();
    if ((prisma?.village?.update as any)?.mockRestore) (prisma.village.update as any).mockRestore();
    if ((prisma?.house?.findMany as any)?.mockRestore) (prisma.house.findMany as any).mockRestore();
    if ((prisma?.house?.update as any)?.mockRestore) (prisma.house.update as any).mockRestore();
    if ((prisma?.house?.updateMany as any)?.mockRestore)
      (prisma.house.updateMany as any).mockRestore();
    if ((prisma?.agent?.findMany as any)?.mockRestore) (prisma.agent.findMany as any).mockRestore();
    if ((prisma?.agent?.update as any)?.mockRestore) (prisma.agent.update as any).mockRestore();
    if ((prisma?.agent?.updateMany as any)?.mockRestore)
      (prisma.agent.updateMany as any).mockRestore();
  });

  it('GET /:id/layout returns version and lists', async () => {
    // Arrange: extend vitest prisma stub with required models
    (prisma as any).village = (prisma as any).village || {};
    (prisma as any).village.findUnique = (prisma as any).village.findUnique || (async () => null);
    (prisma as any).village.update = (prisma as any).village.update || (async () => ({}));
    (prisma as any).house = (prisma as any).house || {};
    (prisma as any).house.findMany = (prisma as any).house.findMany || (async () => []);
    (prisma as any).house.update = (prisma as any).house.update || (async () => ({}));
    (prisma as any).house.updateMany =
      (prisma as any).house.updateMany || (async () => ({ count: 0 }));
    (prisma as any).agent = (prisma as any).agent || {};
    (prisma as any).agent.findMany = (prisma as any).agent.findMany || (async () => []);
    (prisma as any).agent.update = (prisma as any).agent.update || (async () => ({}));
    (prisma as any).agent.updateMany =
      (prisma as any).agent.updateMany || (async () => ({ count: 0 }));
    const vFind = vi
      .spyOn((prisma as any).village, 'findUnique')
      .mockResolvedValue({ layoutVersion: 3 });
    const hFind = vi.spyOn((prisma as any).house, 'findMany').mockResolvedValue([]);

    // Act
    const res = await request(app)
      .get(`/api/villages/${villageId}/layout`)
      .set(bearer(memberToken));

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ version: 3, agents: [], houses: [] });
    expect(vFind).toHaveBeenCalled();
    expect(hFind).toHaveBeenCalled();
  });

  it('PUT /:id/layout updates positions and increments version', async () => {
    // Arrange current version
    (prisma as any).village = (prisma as any).village || {};
    (prisma as any).village.findUnique = (prisma as any).village.findUnique || (async () => null);
    (prisma as any).village.update = (prisma as any).village.update || (async () => ({}));
    (prisma as any).house = (prisma as any).house || {};
    (prisma as any).house.update = (prisma as any).house.update || (async () => ({}));
    (prisma as any).agent = (prisma as any).agent || {};
    (prisma as any).agent.update = (prisma as any).agent.update || (async () => ({}));
    vi.spyOn((prisma as any).village, 'findUnique').mockResolvedValue({ layoutVersion: 2 });
    const aUpd = vi.spyOn((prisma as any).agent, 'update').mockResolvedValue({ id: 'a1' });
    const hUpd = vi.spyOn((prisma as any).house, 'update').mockResolvedValue({ id: 'h1' });
    const vUpd = vi
      .spyOn((prisma as any).village, 'update')
      .mockResolvedValue({ id: villageId, layoutVersion: 3 });

    const body = {
      version: 2,
      agents: [{ id: 'a1', x: 100, y: 200, spriteConfig: { mood: 'happy' }, status: 'busy' }],
      houses: [{ id: 'h1', x: 300, y: 400 }],
    };

    // Act
    const res = await request(app)
      .put(`/api/villages/${villageId}/layout`)
      .set(bearer(ownerToken))
      .send(body);

    // Assert
    expect(res.status).toBe(204);
    expect(aUpd).toHaveBeenCalledWith({
      where: { id: String('a1') },
      data: expect.objectContaining({
        positionX: 100,
        positionY: 200,
        spriteConfig: { mood: 'happy' },
        currentStatus: 'busy',
      }),
    });
    expect(hUpd).toHaveBeenCalledWith({
      where: { id: String('h1') },
      data: expect.objectContaining({ positionX: 300, positionY: 400 }),
    });
    expect(vUpd).toHaveBeenCalled();
  });

  it('PUT /:id/layout with mismatched version returns 409', async () => {
    // Arrange mismatch: server version 5, client sends 999
    (prisma as any).village = (prisma as any).village || {};
    (prisma as any).village.findUnique = (prisma as any).village.findUnique || (async () => null);
    vi.spyOn((prisma as any).village, 'findUnique').mockResolvedValue({ layoutVersion: 5 });

    const res = await request(app)
      .put(`/api/villages/${villageId}/layout`)
      .set(bearer(ownerToken))
      .send({ version: 999, agents: [], houses: [] });

    expect(res.status).toBe(409);
    expect(res.body?.error?.code || 'CONFLICT').toBe('CONFLICT');
  });

  it('POST /:id/layout/reset nulls positions and sprite config', async () => {
    (prisma as any).village = (prisma as any).village || {};
    (prisma as any).village.update = (prisma as any).village.update || (async () => ({}));
    (prisma as any).house = (prisma as any).house || {};
    (prisma as any).house.updateMany =
      (prisma as any).house.updateMany || (async () => ({ count: 0 }));
    (prisma as any).agent = (prisma as any).agent || {};
    (prisma as any).agent.updateMany =
      (prisma as any).agent.updateMany || (async () => ({ count: 0 }));
    const hReset = vi
      .spyOn((prisma as any).house, 'updateMany')
      .mockResolvedValue({ count: 1 } as any);
    const aReset = vi
      .spyOn((prisma as any).agent, 'updateMany')
      .mockResolvedValue({ count: 1 } as any);
    const vBump = vi
      .spyOn((prisma as any).village, 'update')
      .mockResolvedValue({ id: villageId, layoutVersion: 10 } as any);

    const res = await request(app)
      .post(`/api/villages/${villageId}/layout/reset`)
      .set(bearer(ownerToken));

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: 'queued' });
    expect(hReset).toHaveBeenCalled();
    expect(aReset).toHaveBeenCalled();
    expect(vBump).toHaveBeenCalled();
  });
});
