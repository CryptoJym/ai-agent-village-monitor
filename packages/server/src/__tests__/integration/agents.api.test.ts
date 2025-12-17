import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';

import { createApp } from '../../app';
import { signAccessToken } from '../../auth/jwt';
import { setupTestDatabase, teardownTestDatabase, cleanDatabase } from '../utils/db';
import { createUserCreateData, createAgentCreateData } from '../utils/fixtures';

describe('Agents API (SQLite integration)', () => {
  let app: any;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
    app = createApp();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('creates an agent, lists it, transitions state, and deletes it', async () => {
    const user = await prisma.user.create({
      data: createUserCreateData({ username: 'agentowner', email: 'agentowner@test.com' }),
    });
    const token = signAccessToken(user.id, user.username || 'agentowner');

    const create = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${token}`)
      .send(
        createAgentCreateData({
          name: 'Agent One',
          currentStatus: 'idle',
          positionX: 1,
          positionY: 2,
        }),
      )
      .expect(201);

    const agentId = String(create.body.id);
    expect(create.body).toMatchObject({ id: agentId, name: 'Agent One', currentStatus: 'idle' });

    const list = await request(app)
      .get('/api/agents')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some((a: any) => a.id === agentId)).toBe(true);

    const state = await request(app)
      .get(`/api/agents/${agentId}/state`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(state.body).toMatchObject({ id: agentId, currentState: 'idle' });

    const transition = await request(app)
      .post(`/api/agents/${agentId}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ event: 'START_WORK', metrics: { workload: 50 } })
      .expect(200);
    expect(transition.body.currentState).toBe('working');
    expect(transition.body.transition).toMatchObject({ from: 'idle', to: 'working' });

    const stream = await request(app)
      .get(`/api/agents/${agentId}/stream?limit=10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(stream.body).toHaveProperty('items');

    await request(app)
      .delete(`/api/agents/${agentId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(app)
      .get(`/api/agents/${agentId}/state`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
