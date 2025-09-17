import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

describe('POST /api/github/dispatch (repository_dispatch)', () => {
  let createApp: any;
  let app: any;
  let signAccessToken: (id: number, username: string) => string;
  let prisma: any;
  let __setRoleResolver: any;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    ({ createApp } = await import('../app'));
    ({ signAccessToken } = await import('../auth/jwt'));
    ({ prisma } = await import('../db/client'));
    ({ __setRoleResolver } = await import('../auth/middleware'));
    app = createApp();
  });

  it('400 on missing repo_id and owner/repo', async () => {
    const token = signAccessToken(1, 'test');
    const res = await request(app)
      .post('/api/github/dispatch')
      .set('Authorization', `Bearer ${token}`)
      .send({ event_type: 'run' });
    expect(res.status).toBe(400);
  });

  it('403 when user lacks village membership', async () => {
    // Arrange: stub house lookup and deny role
    (prisma as any).house = {
      findUnique: vi.fn().mockResolvedValue({ villageId: 'v1', repoName: 'openai/agent-village' }),
    };
    __setRoleResolver(() => null);
    const token = signAccessToken(2, 'user');
    const res = await request(app)
      .post('/api/github/dispatch')
      .set('Authorization', `Bearer ${token}`)
      .send({ repo_id: '123456', event_type: 'run', client_payload: { foo: 'bar' } });
    expect(res.status).toBe(403);
  });

  it('202 and triggers repository_dispatch (nock) when authorized', async () => {
    const nock = (await import('nock')).default;
    (prisma as any).house = {
      findUnique: vi.fn().mockResolvedValue({ villageId: 'v1', repoName: 'openai/agent-village' }),
    };
    __setRoleResolver(() => 'member');
    const scope = nock('https://api.github.com')
      .post('/repos/openai/agent-village/dispatches')
      .reply(204);

    const token = signAccessToken(3, 'member');
    const res = await request(app)
      .post('/api/github/dispatch')
      .set('Authorization', `Bearer ${token}`)
      .send({ repo_id: '123456', event_type: 'run', client_payload: { foo: 'bar' } });
    expect([202, 204]).toContain(res.status);
    expect(scope.isDone()).toBe(true);
  });
});
