import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';

const envOverrides = {
  NODE_ENV: 'test',
  JWT_SECRET: 'testsecret',
  GITHUB_OAUTH_CLIENT_ID: 'client_id',
  GITHUB_OAUTH_CLIENT_SECRET: 'client_secret',
  PUBLIC_SERVER_URL: 'http://localhost:3000',
  PUBLIC_APP_URL: 'http://localhost:5173',
} as const;

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

describe('GitHub OAuth flow (E2E mock)', () => {
  let agent: request.SuperAgentTest;
  let app: any;
  let restoreFetch: (() => void) | undefined;
  let restoreEnv: (() => void) | undefined;

  beforeAll(async () => {
    const previous: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(envOverrides)) {
      previous[key] = process.env[key];
      process.env[key] = value;
    }
    restoreEnv = () => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    };

    const { createApp } = await import('../app');
    app = createApp();
    agent = request.agent(app);
  });

  afterAll(() => {
    if (restoreFetch) restoreFetch();
    if (restoreEnv) restoreEnv();
  });

  it('GET /auth/login issues state+pkce and redirects to GitHub', async () => {
    const res = await agent.get('/auth/login');
    expect(res.status).toBe(302);
    const loc = res.headers['location'] as string;
    expect(loc).toMatch(/^https:\/\/github.com\/login\/oauth\/authorize\?/);
    const url = new URL(loc);
    expect(url.searchParams.get('client_id')).toBe('client_id');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const state = url.searchParams.get('state');
    expect(state).toBeTruthy();

    // Ensure state cookies are set
    const cookies = res.headers['set-cookie'] || [];
    const hasState = cookies.some((c: string) => c.startsWith('oauth_state='));
    const hasVerifier = cookies.some((c: string) => c.startsWith('oauth_verifier='));
    expect(hasState).toBe(true);
    expect(hasVerifier).toBe(true);
  });

  it('GET /auth/github/callback exchanges code, persists user, sets JWT cookies, and redirects', async () => {
    // Read last login redirect to get state param
    const resLogin = await agent.get('/auth/login');
    const authorize = new URL(resLogin.headers['location']);
    const state = authorize.searchParams.get('state');
    expect(state).toBeTruthy();

    // Mock fetch for token exchange and user profile
    const origFetch = global.fetch;
    restoreFetch = () => {
      // @ts-expect-error - restoring to original
      global.fetch = origFetch;
    };
    // @ts-expect-error - override fetch in tests
    global.fetch = vi.fn(async (input: RequestInfo, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes('github.com/login/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'ghs_abc123' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('api.github.com/user')) {
        return new Response(
          JSON.stringify({
            id: 123,
            login: 'alice',
            avatar_url: 'https://avatars.example/alice.png',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      return new Response('not found', { status: 404 });
    });

    const res = await agent.get(`/auth/github/callback?code=abc&state=${state}`);
    expect(res.status).toBe(302);
    expect(String(res.headers['location'])).toMatch(/^http:\/\/localhost:5173\/?$/);
    const cookies = res.headers['set-cookie'] || [];
    const hasAccess = cookies.some((c: string) => c.startsWith('access_token='));
    const hasRefresh = cookies.some((c: string) => c.startsWith('refresh_token='));
    expect(hasAccess && hasRefresh).toBe(true);
  });

  it('GET /auth/me returns profile when authenticated; then logout clears session', async () => {
    // Ensure authenticated state via prior callback test by repeating minimal flow
    const resLogin = await agent.get('/auth/login');
    const authorize = new URL(resLogin.headers['location']);
    const state = authorize.searchParams.get('state');
    expect(state).toBeTruthy();

    // Mock fetch again
    const origFetch = global.fetch;
    restoreFetch = () => {
      // @ts-expect-error
      global.fetch = origFetch;
    };
    // @ts-expect-error
    global.fetch = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes('github.com/login/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'ghs_abc123' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('api.github.com/user')) {
        return new Response(
          JSON.stringify({
            id: 123,
            login: 'alice',
            avatar_url: 'https://avatars.example/alice.png',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      return new Response('not found', { status: 404 });
    });

    await agent.get(`/auth/github/callback?code=abc&state=${state}`);

    const me = await agent.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ username: 'alice' });

    const lo = await agent.post('/auth/logout');
    expect(lo.status).toBe(204);
  });
});
