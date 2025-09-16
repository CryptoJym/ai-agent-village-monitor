import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { setReady } from '../app';
import { createBugBot, getBugsForVillage } from '../bugs/service';

describe('Bug Bot lifecycle', () => {
  let app: any;
  let token: string;
  const villageId = 'demo';

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    const mod = await import('../app');
    app = mod.createApp();
    const { signAccessToken } = await import('../auth/jwt');
    token = signAccessToken(1, 'tester');
    setReady(true);
  });

  it('lists bugs by village', async () => {
    createBugBot({ id: 'v1/123', villageId, issueId: 'i-123', title: 'Issue 123', x: 100, y: 120 });
    const res = await request(app).get(`/api/villages/${villageId}/bugs`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.find((b: any) => b.id === 'v1/123')).toBeTruthy();
  });

  it('assigns agent to bug', async () => {
    createBugBot({ id: 'v1/456', villageId, issueId: 'i-456', title: 'Issue 456' });
    const res = await request(app)
      .post(`/api/bugs/${encodeURIComponent('v1/456')}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .send({ agentId: 'agent-1' });
    expect(res.status).toBe(200);
    const listAfter = await getBugsForVillage(villageId as any);
    const after = listAfter.find((b: any) => b.id === 'v1/456');
    expect(after?.assignedAgentId).toBe('agent-1');
  });

  it('resolving a bug removes it', async () => {
    createBugBot({ id: 'v1/789', villageId, issueId: 'i-789', title: 'Issue 789' });
    const res = await request(app)
      .put(`/api/bugs/${encodeURIComponent('v1/789')}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'resolved' });
    expect(res.status).toBe(200);
    const list = await getBugsForVillage(villageId as any);
    expect(list.find((b: any) => b.id === 'v1/789')).toBeUndefined();
  });
});
