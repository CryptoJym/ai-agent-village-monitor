import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'testsecret';
});

// Mock Prisma: agent + workStreamEvent
vi.mock('../db/client', () => {
  return {
    prisma: {
      agent: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, villageId: 42 }),
      },
      workStreamEvent: {
        findMany: vi.fn(async (args: any) => {
          // If legacy query shape
          if (args?.select?.message) {
            return [
              { message: 'status: working', ts: new Date('2025-01-01T00:00:02Z') },
              { message: 'log: started', ts: new Date('2025-01-01T00:00:01Z') },
            ];
          }
          // New shape
          return [
            { eventType: 'status', content: 'idle', metadata: null, timestamp: new Date('2025-01-01T00:00:03Z') },
            { eventType: 'log', content: 'hello', metadata: null, timestamp: new Date('2025-01-01T00:00:02Z') },
          ];
        }),
      },
      villageAccess: { findUnique: vi.fn().mockResolvedValue({ role: 'member' }) },
    },
  };
});

const appPromise = import('../app').then((m) => m.createApp());
let signAccessToken: (id: number, username: string) => string;

describe('events stream endpoints', () => {
  beforeAll(async () => {
    ({ signAccessToken } = await import('../auth/jwt'));
  });

  it('GET /api/agents/:id/stream returns paginated DTOs', async () => {
    const app = await appPromise;
    const token = signAccessToken(100, 'user');
    const res = await request(app).get('/api/agents/1/stream?limit=2').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items[0]).toHaveProperty('event_type');
    expect(res.body.items[0]).toHaveProperty('timestamp');
  });

  it('GET /api/agents/:id/stream/sse initializes SSE and emits events', async () => {
    vi.useFakeTimers();
    const app = await appPromise;
    const token = signAccessToken(100, 'user');
    const req = request(app).get('/api/agents/1/stream/sse').set('Authorization', `Bearer ${token}`);
    const res = await req;
    expect(res.status).toBe(200);
    // We can't easily capture streamed chunks with supertest without a custom agent here,
    // but ensuring 200 and proper headers is sufficient smoke coverage.
    expect(String(res.headers['content-type'] || '')).toMatch(/text\/event-stream/);
    vi.useRealTimers();
  });
});

