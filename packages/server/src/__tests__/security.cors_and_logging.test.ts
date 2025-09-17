import { describe, it, expect, beforeAll, vi, afterAll } from 'vitest';
import request from 'supertest';

describe('CORS allow-list and request log scrubbing', () => {
  let app: any;
  let createApp: any;
  const origInfo = console.info;

  beforeAll(async () => {
    // Ensure predictable env for CORS defaults
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    ({ createApp } = await import('../app'));
    app = createApp();
  });

  afterAll(() => {
    console.info = origInfo;
  });

  it('echoes Access-Control-Allow-Origin for allowed dev origin', async () => {
    // In non-production, localhost:5173 is allowed by default
    const origin = 'http://localhost:5173';
    const res = await request(app).get('/healthz').set('Origin', origin);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });

  it('scrubs sensitive headers in request logs', async () => {
    const spy = vi.fn();
    console.info = spy as any;

    // Trigger a simple request with sensitive headers
    await request(app)
      .get('/healthz')
      .set('Authorization', 'Bearer secret-token')
      .set('Cookie', 'access_token=abc; refresh_token=def');

    // Find a logged payload and assert redaction
    const calls = spy.mock.calls.map((c) => {
      try {
        return typeof c[0] === 'string' ? JSON.parse(c[0]) : c[0];
      } catch {
        return c[0];
      }
    });
    const payload = calls.find((p) => p && p.msg === 'request');
    expect(payload).toBeTruthy();
    const headers = payload.headers || {};
    expect(headers.authorization).toBe('[redacted]');
    expect(headers.cookie).toBe('[redacted]');
  });
});
