import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app';
import { signAccessToken } from '../auth/jwt';
import { prisma } from '../db/client';

// Basic integration smoke; requires DATABASE_URL to be configured and migrations applied
const hasDb = !!process.env.DATABASE_URL && process.env.DISABLE_DB_TESTS !== 'true';

describe('villages api', () => {
  const app = createApp();
  let userId = 0;
  let token = '';

  beforeAll(async () => {
    if (!hasDb) return;
    const u = await prisma.user.create({
      data: { githubId: BigInt(Date.now()), username: 'tester' },
    });
    userId = u.id;
    token = signAccessToken(u.id, u.username);
  });

  it.skipIf(!hasDb)('create + get village (owner)', async () => {
    const create = await request(app)
      .post('/api/villages')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Village', githubOrgId: String(Date.now()) });
    expect(create.status).toBe(201);
    const id = create.body.id as number;
    const get = await request(app)
      .get(`/api/villages/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body).toHaveProperty('name', 'My Village');
  });
});
