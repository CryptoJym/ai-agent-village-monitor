import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'testsecret';
});

// Mock Prisma with deterministic pagination behavior
const calls: any[] = [];
vi.mock('../db/client', () => {
  return {
    prisma: {
      agent: { findUnique: vi.fn().mockResolvedValue({ id: 1, villageId: 42 }) },
      villageAccess: { findUnique: vi.fn().mockResolvedValue({ role: 'member' }) },
      workStreamEvent: {
        findMany: vi.fn(async (args: any) => {
          calls.push(args);
          const mk = (ts: string, type = 'log', content = 'x') => ({ eventType: type, content, metadata: null, timestamp: new Date(ts) });
          // First page: t3, t2
          if (!args?.where?.timestamp?.lt) {
            return [mk('2025-01-01T00:00:03Z'), mk('2025-01-01T00:00:02Z')];
          }
          // Second page with before=t2: t1 only
          return [mk('2025-01-01T00:00:01Z')];
        }),
      },
    },
  };
});

const appPromise = import('../app').then((m) => m.createApp());
let signAccessToken: (id: number, username: string) => string;

describe('events pagination correctness', () => {
  beforeAll(async () => {
    ({ signAccessToken } = await import('../auth/jwt'));
  });

  it('returns nextCursor and respects before cursor', async () => {
    const app = await appPromise;
    const token = signAccessToken(123, 'tester');

    // First page
    const r1 = await request(app).get('/api/agents/1/stream?limit=2').set('Authorization', `Bearer ${token}`);
    expect(r1.status).toBe(200);
    expect(Array.isArray(r1.body.items)).toBe(true);
    expect(r1.body.items.map((i: any) => i.timestamp)).toEqual(['2025-01-01T00:00:03.000Z', '2025-01-01T00:00:02.000Z']);
    const next = r1.body.nextCursor;
    expect(next).toBe('2025-01-01T00:00:02.000Z');

    // Second page using before
    const r2 = await request(app)
      .get(`/api/agents/1/stream?limit=2&before=${encodeURIComponent(next)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(r2.status).toBe(200);
    expect(r2.body.items.map((i: any) => i.timestamp)).toEqual(['2025-01-01T00:00:01.000Z']);
  });
});

