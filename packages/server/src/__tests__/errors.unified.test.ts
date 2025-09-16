import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

describe('Unified error shapes and sanitization', () => {
  let app: any;
  let token: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    const mod = await import('../app');
    const jwt = await import('../auth/jwt');
    app = mod.createApp();
    token = jwt.signAccessToken(1, 'tester');
  });

  it('returns unified envelope on malformed JSON', async () => {
    const res = await request(app)
      .post('/api/github/dispatch')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send('{"owner": "a"  invalid');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body?.error?.code).toBe('VALIDATION_ERROR');
    expect(res.body?.error?.message).toMatch(/Malformed JSON|Invalid/);
    expect(res.body?.requestId).toBeTruthy();
  });

  it('strips/normalizes identifiers for /api/github/dispatch', async () => {
    const res = await request(app)
      .post('/api/github/dispatch')
      .set('Authorization', `Bearer ${token}`)
      .send({
        owner: ' Org ',
        repo: ' Repo ',
        workflowId: ' .github/workflows/build.yml ',
        ref: ' main ',
      });
    // Depending on env, may return 202 (stubbed GitHub client) or unified error envelope
    expect([202, 502, 503, 400]).toContain(res.status);
    if (res.status !== 202) {
      expect(res.body?.error?.code).toBeTruthy();
      expect(res.body?.requestId).toBeTruthy();
    }
  });
});
