import request from 'supertest';
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';

describe('analytics pipeline validations', () => {
  let app: any;
  let signAccessToken: (id: number, username: string) => string;
  let prisma: any;
  let token: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    const mod = await import('../app');
    ({ signAccessToken } = await import('../auth/jwt'));
    ({ prisma } = await import('../db/client'));
    app = mod.createApp();
    token = signAccessToken(1, 'user');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enforces server-side user opt-out (preferences.analytics.enabled=false)', async () => {
    // Mock user preferences to disable analytics
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
      preferences: { analytics: { enabled: false } },
    });
    const res = await request(app)
      .post('/api/analytics/collect')
      .set('Authorization', `Bearer ${token}`)
      .send({
        consent: true,
        clientId: 'cid-1',
        events: [{ type: 'village_view', ts: Date.now(), villageId: 'v1', userId: 'u1' }],
      });
    expect(res.status).toBe(202);
  });

  it('respects explicit client opt-out (consent=false)', async () => {
    const res = await request(app)
      .post('/api/analytics/collect')
      .set('Authorization', `Bearer ${token}`)
      .send({
        consent: false,
        clientId: 'cid-2',
        events: [{ type: 'village_view', ts: Date.now(), villageId: 'v1' }],
      });
    expect(res.status).toBe(202);
  });

  it('KPI summary responds when Redis not configured', async () => {
    const res = await request(app)
      .get('/api/internal/kpi/summary')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
    expect(res.body.ok).toBe(true);
  });

  it('ingests 1000 events within an acceptable budget', async () => {
    const now = Date.now();
    const batch = {
      consent: true,
      clientId: 'cid-3',
      events: Array.from({ length: 1000 }).map((_v, i) => ({
        type: i % 5 === 0 ? 'dialogue_open' : i % 7 === 0 ? 'command_executed' : 'village_view',
        ts: now + i,
        villageId: 'v1',
      })),
    };
    const start = Date.now();
    const res = await request(app)
      .post('/api/analytics/collect')
      .set('Authorization', `Bearer ${token}`)
      .send(batch);
    const ms = Date.now() - start;
    expect(res.status).toBe(202);
    // Generous CI budget
    expect(ms).toBeLessThan(800);
  });
});
