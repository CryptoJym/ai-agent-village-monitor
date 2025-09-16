import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app';
import { getEnv } from '../config';

describe('server app', () => {
  const app = createApp({ env: getEnv(), initialReady: false });

  beforeAll(() => {
    // ensure not ready at start
    // ensure not ready at start
    (app as any).setReady?.(false);
  });

  it('GET /healthz -> 200 JSON', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/json/);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /readyz -> 503 before ready', async () => {
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(503);
  });

  it('GET /readyz -> 200 after ready', async () => {
    (app as any).setReady?.(true);
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(200);
  });

  it('unknown route -> 404 JSON', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.type).toMatch(/json/);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');
  });
});
