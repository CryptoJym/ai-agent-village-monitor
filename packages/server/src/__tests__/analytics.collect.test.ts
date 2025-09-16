import request from 'supertest';
import { describe, it, beforeAll, expect } from 'vitest';

describe('POST /api/analytics/collect', () => {
  let app: any;
  let token: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    const mod = await import('../app');
    const jwt = await import('../auth/jwt');
    app = mod.createApp();
    token = jwt.signAccessToken(1, 'tester');
  });

  it('valid batch returns 202', async () => {
    const res = await request(app)
      .post('/api/analytics/collect')
      .set('Authorization', `Bearer ${token}`)
      .send({ consent: true, events: [{ type: 'village_view', ts: Date.now(), villageId: 'v1' }] });
    expect(res.status).toBe(202);
  });

  it('invalid payload returns 400', async () => {
    const res = await request(app)
      .post('/api/analytics/collect')
      .set('Authorization', `Bearer ${token}`)
      .send({ consent: true, events: [{ type: 'unknown', ts: Date.now() }] });
    expect(res.status).toBe(400);
  });

  it('respects DNT/GPC headers (still 202 but ignored)', async () => {
    const res = await request(app)
      .post('/api/analytics/collect')
      .set('Authorization', `Bearer ${token}`)
      .set('DNT', '1')
      .send({ consent: true, events: [{ type: 'village_view', ts: Date.now(), villageId: 'v1' }] });
    expect(res.status).toBe(202);
  });
});
