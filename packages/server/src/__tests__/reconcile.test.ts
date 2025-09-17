import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp, setReady } from '../app';
import { createBugBot, getBugsForVillage } from '../bugs/service';

describe('Reconciliation endpoint', () => {
  const app = createApp();
  const villageId = 'demo';

  beforeAll(() => {
    setReady(true);
  });

  it('creates missing bugs and resolves stale ones', async () => {
    // seed: have bugs 1 and 2
    await createBugBot({ id: 'org/repo/1', villageId, issueId: '1', issueNumber: 1 });
    await createBugBot({ id: 'org/repo/2', villageId, issueId: '2', issueNumber: 2 });

    // reconcile: open issues are [2, 3]
    const res = await request(app).post('/api/repos/org/repo/reconcile').send({ villageId, openIssues: [2, 3] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, open: 2 });

    const list = await getBugsForVillage(villageId);
    const ids = list.map((b: any) => b.id).sort();
    // bug 1 should be resolved (removed); bugs 2 and 3 present
    expect(ids).toContain('org/repo/2');
    expect(ids).toContain('org/repo/3');
    expect(ids).not.toContain('org/repo/1');
  });
});

