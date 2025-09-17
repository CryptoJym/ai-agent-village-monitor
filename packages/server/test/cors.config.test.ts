import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';

let server: http.Server;
let baseUrl: string;

describe('CORS configuration', () => {
  beforeAll(async () => {
    // Configure explicit allowed origin for this test
    process.env.CORS_ALLOWED_ORIGINS = 'http://allowed.test';
    // Ensure NODE_ENV reflects test to avoid dev defaults if desired
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    const { createApp } = await import('../src/app');
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port as number;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('allows configured origin with credentials and sets Vary: Origin', async () => {
    const res = await request(baseUrl)
      .options('/healthz')
      .set('Origin', 'http://allowed.test')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://allowed.test');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    // cors sets vary: Origin by default
    const vary = String(res.headers['vary'] || '');
    expect(vary.toLowerCase()).toContain('origin');
  });

  it('does not allow a disallowed origin', async () => {
    const res = await request(baseUrl).get('/healthz').set('Origin', 'http://disallowed.test');
    // Express still serves 200, but CORS headers should be absent
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
