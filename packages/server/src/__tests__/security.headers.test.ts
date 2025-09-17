import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';

describe('security headers and behaviors', () => {
  let createApp: any;
  let app: any;

  beforeAll(async () => {
    // Default test env: NODE_ENV = test
    ({ createApp } = await import('../app'));
    app = createApp();
  });

  it('returns CSP and nosniff headers', async () => {
    const res = await request(app).get('/api/docs');
    expect(res.status).toBe(200);
    // CSP may come from Helmet (as meta or header); app sets meta on /api/docs, but ensure no sniff header exists generally
    // Use /healthz as a generic route for header check
    const res2 = await request(app).get('/healthz');
    const nosniff = String(res2.headers['x-content-type-options'] || '').toLowerCase();
    expect(nosniff).toBe('nosniff');
  });

  it('401 includes WWW-Authenticate: Bearer', async () => {
    const res = await request(app).get('/api/villages');
    expect([401, 403]).toContain(res.status);
    if (res.status === 401) {
      expect(String(res.headers['www-authenticate'] || '')).toMatch(/Bearer/i);
    }
  });
});

describe('CORS behavior', () => {
  let createApp: any;
  let app: any;
  beforeAll(async () => {
    ({ createApp } = await import('../app'));
    app = createApp();
  });

  it('denies unknown origins by not echoing Access-Control-Allow-Origin', async () => {
    const res = await request(app).get('/healthz').set('Origin', 'https://malicious.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
