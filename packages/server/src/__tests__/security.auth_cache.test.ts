import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';

describe('auth responses are not cacheable and respect DNT', () => {
  let app: any;
  beforeAll(async () => {
    app = (await import('../app')).createApp();
  });

  it('auth endpoints include Cache-Control: no-store', async () => {
    const res = await request(app).get('/auth/me');
    // Unauthenticated may be 401, but still expect no-store
    const cc = String(res.headers['cache-control'] || '').toLowerCase();
    expect(cc.includes('no-store')).toBe(true);
  });

  it('drops analytics when DNT=1', async () => {
    const res = await request(app)
      .post('/api/analytics/collect')
      .set('DNT', '1')
      .send({ consent: true, events: [{ type: 'village_view', ts: Date.now(), villageId: 'v' }] });
    expect(res.status).toBe(202);
  });
});
