import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../app';

describe('webhook dedupe', () => {
  it('short-circuits duplicate deliveries by delivery id', async () => {
    const app = createApp();
    const payload = { action: 'opened', repository: { id: 1, full_name: 'o/r' }, issue: { id: 11, number: 7, title: 'x', body: '' } };
    const id = 'delivery-123';
    // First delivery
    let res = await request(app)
      .post('/api/webhooks/github')
      .set('x-github-event', 'issues')
      .set('x-github-delivery', id)
      .send(payload);
    expect([200, 202, 204]).toContain(res.status);
    // Duplicate delivery
    res = await request(app)
      .post('/api/webhooks/github')
      .set('x-github-event', 'issues')
      .set('x-github-delivery', id)
      .send(payload);
    expect(res.status).toBe(202);
    // best-effort hint in body
    expect(res.body?.deduped).toBe(true);
  });
});

