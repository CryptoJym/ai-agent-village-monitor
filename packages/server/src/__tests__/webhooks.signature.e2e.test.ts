import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import crypto from 'node:crypto';

let server: http.Server;
let baseUrl: string;
const secret = 'topsecret';

function sign(body: string) {
  const h = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${h}`;
}

function issuesOpenedPayload() {
  return {
    action: 'opened',
    issue: { id: 123, number: 42, title: 'Bug', body: 'Details' },
    repository: { id: 999, full_name: 'org/repo', name: 'repo', owner: { id: 1, login: 'org' } },
    organization: { id: 1, login: 'org' },
  };
}

describe('GitHub webhook E2E: signing, tamper, dedupe, burst', () => {
  beforeAll(async () => {
    process.env.WEBHOOK_SECRET = secret;
    const { createApp } = await import('../app');
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port as number;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('accepts correctly signed issues opened event', async () => {
    const bodyObj = issuesOpenedPayload();
    const body = JSON.stringify(bodyObj);
    const res = await request(baseUrl)
      .post('/api/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('x-github-event', 'issues')
      .set('x-github-delivery', 'd1')
      .set('x-hub-signature-256', sign(body))
      .send(body);
    expect([202, 204]).toContain(res.status);
  });

  it('rejects tampered signature', async () => {
    const bodyObj = issuesOpenedPayload();
    const body = JSON.stringify(bodyObj);
    const badSig = 'sha256=' + '0'.repeat(64);
    const res = await request(baseUrl)
      .post('/api/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('x-github-event', 'issues')
      .set('x-github-delivery', 'd2')
      .set('x-hub-signature-256', badSig)
      .send(body);
    expect(res.status).toBe(401);
  });

  it('deduplicates repeat delivery id', async () => {
    const bodyObj = issuesOpenedPayload();
    const body = JSON.stringify(bodyObj);
    const sig = sign(body);
    const id = 'repeat-123';
    const first = await request(baseUrl)
      .post('/api/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('x-github-event', 'issues')
      .set('x-github-delivery', id)
      .set('x-hub-signature-256', sig)
      .send(body);
    expect([202, 204]).toContain(first.status);
    const second = await request(baseUrl)
      .post('/api/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('x-github-event', 'issues')
      .set('x-github-delivery', id)
      .set('x-hub-signature-256', sig)
      .send(body);
    expect(second.status).toBe(202);
    // body may include { deduped: true }
    const b = second.body || {};
    expect(b.deduped === true || Object.keys(b).length === 0).toBe(true);
  });

  it('handles burst of unique deliveries', async () => {
    const N = 10;
    const statuses: number[] = [];
    await Promise.all(
      Array.from({ length: N }).map((_, i) => {
        const bodyObj = issuesOpenedPayload();
        bodyObj.issue.number = i + 1;
        const body = JSON.stringify(bodyObj);
        const sig = sign(body);
        const id = `burst-${i}`;
        return request(baseUrl)
          .post('/api/webhooks/github')
          .set('Content-Type', 'application/json')
          .set('x-github-event', 'issues')
          .set('x-github-delivery', id)
          .set('x-hub-signature-256', sig)
          .send(body)
          .then((res) => statuses.push(res.status));
      }),
    );
    expect(statuses.length).toBe(N);
    expect(statuses.every((s) => s === 202 || s === 204)).toBe(true);
  });
});
