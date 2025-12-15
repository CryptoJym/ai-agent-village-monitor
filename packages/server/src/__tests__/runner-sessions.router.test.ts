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
});
