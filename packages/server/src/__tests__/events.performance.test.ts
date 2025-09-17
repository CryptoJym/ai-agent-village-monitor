import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'testsecret';
});

vi.mock('../db/client', () => {
  return {
    prisma: {
      agent: { findUnique: vi.fn().mockResolvedValue({ id: 1, villageId: 1 }) },
      villageAccess: { findUnique: vi.fn().mockResolvedValue({ role: 'member' }) },
      workStreamEvent: {
        findMany: vi.fn(async (args: any) => {
          const limit = args?.take ?? 100;
          const base = Date.parse('2025-01-01T00:00:00Z');
          const rows = Array.from({ length: limit }, (_v, i) => ({
            eventType: 'log',
            content: `msg-${i}`,
            metadata: null,
            timestamp: new Date(base - i * 1000),
          }));
          return rows;
        }),
      },
    },
  };
});

const appPromise = import('../app').then((m) => m.createApp());
let signAccessToken: (id: number, username: string) => string;

describe('events performance', () => {
  beforeAll(async () => {
    ({ signAccessToken } = await import('../auth/jwt'));
  });

  it('responds within budget for 500 events', async () => {
    const app = await appPromise;
    const token = signAccessToken(1, 'perf');
    const start = Date.now();
    const res = await request(app).get('/api/agents/1/stream?limit=500').set('Authorization', `Bearer ${token}`);
    const ms = Date.now() - start;
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    // Budget: 500ms (generous for CI); generally ~10-50ms on dev
    expect(ms).toBeLessThan(500);
  });
});

