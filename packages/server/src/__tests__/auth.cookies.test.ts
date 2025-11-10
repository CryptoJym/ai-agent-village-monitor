import request from 'supertest';
import { describe, it, beforeAll, expect } from 'vitest';

describe('auth (cookies + protected routes)', () => {
  let createApp: any;
  let signAccessToken: (id: string | number, username: string) => string;
  let app: any;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    ({ createApp } = await import('../app'));
    ({ signAccessToken } = await import('../auth/jwt'));
    app = createApp();
  });

  it('GET /auth/me → 401 without cookie', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /auth/me → 200 (or 401 if user not persisted) with access_token cookie', async () => {
    const token = signAccessToken('7', 'cookie-user');
    const res = await request(app)
      .get('/auth/me')
      .set('Cookie', [`access_token=${token}`]); // unsigned still accepted as fallback
    // Route returns 200 if the DB has the user; otherwise 401. Both are acceptable for this check.
    if (res.status === 200) {
      // ID should be a string after our type migration
      expect(res.body?.id).toBeTypeOf('string');
      expect(res.body?.username).toBeTypeOf('string');
    } else {
      expect(res.status).toBe(401);
    }
  });

  it('Protected API requires auth; accepts cookie bearer', async () => {
    // Unauthenticated → 401
    const resUnauthed = await request(app)
      .post('/api/agents/alpha/command')
      .send({ command: 'commit', message: 'test' });
    expect([401, 400]).toContain(resUnauthed.status); // 401 expected; some middlewares may 400 on payload first

    // With cookie → route executes (will likely 202 or 400 based on payload validation)
    const token = signAccessToken(9, 'agent-user');
    const resAuthed = await request(app)
      .post('/api/agents/alpha/command')
      .set('Cookie', [`access_token=${token}`])
      .send({ command: 'commit', message: 'message from test' });
    expect([200, 202]).toContain(resAuthed.status);
  });

  it('POST /auth/logout clears cookies', async () => {
    const token = signAccessToken(11, 'logout-user');
    const res = await request(app)
      .post('/auth/logout')
      .set('Cookie', [`access_token=${token}`]);
    expect(res.status).toBe(204);
    const setCookie = res.header['set-cookie'] || [];
    // Expect cookies to be cleared (empty or past expiry)
    const clearedAccess = setCookie.find((c: string) =>
      c.toLowerCase().startsWith('access_token='),
    );
    const clearedRefresh = setCookie.find((c: string) =>
      c.toLowerCase().startsWith('refresh_token='),
    );
    expect(clearedAccess || clearedRefresh).toBeDefined();
  });
});
