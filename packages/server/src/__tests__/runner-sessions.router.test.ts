import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

describe('runner sessions router', () => {
  let app: any;
  let token: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    const { createApp } = await import('../app');
    const { signAccessToken } = await import('../auth/jwt');
    app = createApp();
    token = signAccessToken(42, 'tester');
  });

  it('POST /api/runner/sessions validates body after auth', async () => {
    const res = await request(app)
      .post('/api/runner/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body?.error).toBe('invalid body');
  });

  it('POST /api/runner/sessions returns 400 when provider credentials are missing', async () => {
    const prev = process.env.OPENAI_API_KEY;
    try {
      delete process.env.OPENAI_API_KEY;

      const res = await request(app)
        .post('/api/runner/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          villageId: 'demo',
          providerId: 'codex',
          repoRef: { provider: 'local', path: '/tmp/repo' },
          task: { title: 'Smoke', goal: 'Say hi' },
        });

      expect(res.status).toBe(400);
      expect(res.body?.error?.code).toBe('PROVIDER_AUTH_MISSING');
      expect(res.body?.error?.details?.missing).toContain('OPENAI_API_KEY');
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  });

  it('POST /api/runner/sessions/:id/stop returns 404 for unknown sessions', async () => {
    const res = await request(app)
      .post('/api/runner/sessions/not-a-real-session/stop')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(404);
    expect(res.body?.error?.code).toBe('SESSION_NOT_FOUND');
  });
});
