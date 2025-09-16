import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import http from 'node:http';
import { createSocketServer } from '../realtime/server';
import { startWorkers, stopWorkers } from '../queue/workers';
import request from 'supertest';

const hasRedis = !!process.env.REDIS_URL;

describe.skipIf(!hasRedis)('agents idempotency and restart semantics', () => {
  let server: http.Server | undefined;
  let io: ReturnType<typeof createSocketServer> | undefined;
  let app: express.Express;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    const mod = await import('../app');
    app = mod.createApp();
    server = http.createServer(app);
    io = createSocketServer(server);
    startWorkers();
    await new Promise<void>((resolve) => server!.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => io?.close(() => resolve()));
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await stopWorkers({});
  });

  function url() {
    const addr = server!.address() as any;
    return `http://localhost:${addr.port}`;
  }

  it('start is idempotent and accepts restart=true', async () => {
    // First start
    const one = await request(url()).post('/api/agents/alpha/start').set('Authorization', 'Bearer x');
    expect(one.status).toBe(202);
    const idempotencyKey = one.headers['idempotency-key'] || '';
    expect(idempotencyKey).toBeTruthy();

    // Second identical start should reuse job id
    const two = await request(url()).post('/api/agents/alpha/start').set('Authorization', 'Bearer x');
    expect(two.status).toBe(202);
    expect(two.headers['idempotency-status'] || '').toMatch(/reused/i);

    // Restart semantics (force new)
    const three = await request(url()).post('/api/agents/alpha/start?restart=true').set('Authorization', 'Bearer x');
    expect(three.status).toBe(202);
  });
});

