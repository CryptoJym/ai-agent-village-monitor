import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'testsecret';
  process.env.GITHUB_OAUTH_CLIENT_ID = 'client_id';
  process.env.GITHUB_OAUTH_CLIENT_SECRET = 'client_secret';
  process.env.PUBLIC_SERVER_URL = 'http://localhost:3000';
  process.env.PUBLIC_APP_URL = 'http://localhost:5173';
});

// Mock Prisma client used by the server
vi.mock('../db/client', () => {
  const user = {
    id: 1,
    username: 'alice',
    avatarUrl: 'https://avatars.example/alice.png',
  };
  return {
    prisma: {
      user: {
        upsert: vi.fn().mockResolvedValue(user),
        findUnique: vi.fn().mockResolvedValue(user),
      },
      $queryRawUnsafe: vi.fn().mockResolvedValue(1),
    },
  };
});

const appPromise = import('../app').then((m) => m.createApp());

describe('auth refresh and 401 headers', () => {
  let agent: request.SuperAgentTest;
  let restoreFetch: (() => void) | undefined;

  beforeAll(async () => {
    const app = await appPromise;
    agent = request.agent(app);
  });

  afterAll(() => {
    if (restoreFetch) restoreFetch();
  });

  it('rotates refresh token and rejects reuse of prior token', async () => {
    // 1) Initiate login to get state
    const resLogin = await agent.get('/auth/login');
    const authorize = new URL(resLogin.headers['location']);
    const state = authorize.searchParams.get('state');
    expect(state).toBeTruthy();

    // 2) Mock fetch for token exchange and user profile
    const origFetch = global.fetch;
    restoreFetch = () => {
      // @ts-expect-error - restoring to original
      global.fetch = origFetch;
    };
    // @ts-expect-error - override fetch
    global.fetch = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes('github.com/login/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'ghs_abc123' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('api.github.com/user')) {
        return new Response(JSON.stringify({ id: 123, login: 'alice', avatar_url: 'https://avatars.example/alice.png' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not found', { status: 404 });
    });

    // 3) Complete callback, capture initial refresh cookie
    const resCb = await agent.get(`/auth/github/callback?code=abc&state=${state}`);
    expect(resCb.status).toBe(302);
    const setCookies1 = (resCb.headers['set-cookie'] || []) as string[];
    const refreshCookie1 = setCookies1.find((c) => c.startsWith('refresh_token='));
    expect(refreshCookie1).toBeTruthy();

    // 4) Call /auth/refresh (rotation)
    const resRef1 = await agent.post('/auth/refresh');
    expect(resRef1.status).toBe(200);
    const setCookies2 = (resRef1.headers['set-cookie'] || []) as string[];
    const refreshCookie2 = setCookies2?.find((c) => c.startsWith('refresh_token='));
    expect(refreshCookie2).toBeTruthy();
    expect(refreshCookie2).not.toBe(refreshCookie1);

    // 5) Attempt reuse of the old refresh token → 401
    const app = await appPromise;
    const resReuse = await request(app)
      .post('/auth/refresh')
      .set('Cookie', refreshCookie1 as string);
    expect(resReuse.status).toBe(401);
  });

  it('sets WWW-Authenticate header on 401 from /api/* when missing token', async () => {
    const app = await appPromise;
    const res = await request(app).get('/api/villages');
    expect(res.status).toBe(401);
    expect(String(res.headers['www-authenticate'] || '')).toMatch(/Bearer/);
  });
});

