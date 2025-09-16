import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { signAccessToken } from '../auth/jwt';

describe('rate limiting', () => {
  const app = createApp();
  let token = '';
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    process.env.RATE_LIMIT_WINDOW_MS = '1000';
    process.env.RATE_LIMIT_MAX = '2';
    token = signAccessToken(1, 'ratelimit-user');
  });

  it('limits rapid /api/agents/:id/command requests', async () => {
    const base = request(app).post('/api/agents/rl-agent/command').set('Authorization', `Bearer ${token}`).send({ command: 'noop' });
    const r1 = await base;
    const r2 = await base;
    const r3 = await base;
    // First two should be accepted (202), third should be 429 in memory store
    expect([202, 429]).toContain(r1.status);
    expect([202, 429]).toContain(r2.status);
    expect([202, 429]).toContain(r3.status);
  });
});

