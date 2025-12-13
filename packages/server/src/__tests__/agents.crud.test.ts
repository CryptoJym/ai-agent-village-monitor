import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

const hasDb = !!process.env.DATABASE_URL && process.env.DISABLE_DB_TESTS !== 'true';

describe.skipIf(!hasDb)('Agents CRUD (integration)', () => {
  let app: any;
  let prisma: any;
  let signAccessToken: (id: number, username: string) => string;
  let token: string = '';
  let villageId: number = 0;
  let agentId: number = 0;

  beforeAll(async () => {
    const mod = await import('../app');
    app = mod.createApp();
    prisma = (await import('../db/client')).prisma;
    ({ signAccessToken } = await import('../auth/jwt'));

    // Seed user + village (owner)
    const u = await prisma.user.create({ data: { githubId: BigInt(Date.now()), username: 'owner' } });
    token = signAccessToken(u.id, u.username);
    const v = await prisma.village.create({ data: { githubOrgId: BigInt(Date.now()), orgName: 'Village' } });
    villageId = v.id;
    await prisma.villageAccess.create({ data: { villageId: v.id, userId: u.id, role: 'owner' } });
  });

  it('lists agents (empty) for village', async () => {
    const res = await request(app).get(`/api/villages/${villageId}/agents`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('creates, updates, and deletes an agent', async () => {
    // Create
    const created = await request(app)
      .post(`/api/villages/${villageId}/agents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alpha', mcpServerUrl: 'https://example.com/mcp' });
    expect(created.status).toBe(201);
    agentId = created.body.id;

    // Update
    const updated = await request(app)
      .put(`/api/agents/${agentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ currentStatus: 'working', positionX: 123, positionY: 456 });
    expect(updated.status).toBe(200);
    expect(updated.body.currentStatus).toBe('working');
    expect(updated.body.positionX).toBe(123);
    expect(updated.body.positionY).toBe(456);

    // Delete
    const del = await request(app)
      .delete(`/api/agents/${agentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    // List again
    const res = await request(app).get(`/api/villages/${villageId}/agents`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.find((a: any) => a.id === agentId)).toBeUndefined();
  });
});

