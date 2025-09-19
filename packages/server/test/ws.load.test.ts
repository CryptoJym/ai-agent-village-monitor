import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import express from 'express';
import { io as Client } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { createSocketServer } from '../src/realtime/server';
import { signAccessToken } from '../src/auth/jwt';

// Skip by default to keep CI fast; enable with WS_LOAD_TEST=1
const RUN = process.env.WS_LOAD_TEST === '1';
const SKIP = !RUN;

describe.skipIf(SKIP)('WebSocket load/latency harness', () => {
  let server: http.Server;
  let port = 0;
  let token = '';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    const app = express();
    server = http.createServer(app);
    createSocketServer(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as any).port as number;
    token = signAccessToken(1, 'load');
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function url() {
    return `http://localhost:${port}`;
  }

  it('connects N clients, joins room, receives broadcast within budget', async () => {
    const N = Number(process.env.WS_LOAD_N || 25);
    const roomId = 'load';
    const clients: Socket[] = [];
    const joinAcks: Promise<any>[] = [];

    const connectOne = () =>
      new Promise<Socket>((resolve, reject) => {
        const socket: Socket = Client(url(), {
          transports: ['polling'],
          auth: { token },
          reconnection: false,
        });
        const t = setTimeout(() => reject(new Error('connect timeout')), 5000);
        socket.once('connect', () => {
          clearTimeout(t);
          resolve(socket);
        });
      });

    for (let i = 0; i < N; i++) {
      const s = await connectOne();
      clients.push(s);
      joinAcks.push(
        new Promise((resolve) => s.emit('join_village', { villageId: roomId }, resolve)),
      );
    }

    const ackResults = await Promise.all(joinAcks);
    const okCount = ackResults.filter((r: any) => r?.ok).length;
    expect(okCount).toBe(N);

    // Measure broadcast delivery
    const start = Date.now();
    const payload = { agentId: 'demo', status: 'idle', ts: Date.now() };
    let received = 0;
    const waiters = clients.map(
      (s) =>
        new Promise<void>((resolve) => {
          s.once('agent_update', () => {
            received += 1;
            resolve();
          });
        }),
    );
    // Send broadcast
    const { getIO } = await import('../src/realtime/io');
    getIO()?.to(`village:${roomId}`).emit('agent_update', payload);

    // Wait with timeout budget (default 2s)
    const budgetMs = Number(process.env.WS_BUDGET_MS || 2000);
    await Promise.race([
      Promise.all(waiters),
      new Promise((_r, rej) => setTimeout(() => rej(new Error('broadcast timeout')), budgetMs)),
    ]).catch(() => {});

    const duration = Date.now() - start;
    // Expect at least 90% clients to receive broadcast within budget
    expect(received).toBeGreaterThanOrEqual(Math.floor(0.9 * N));
    // And duration under budget
    expect(duration).toBeLessThanOrEqual(budgetMs);

    clients.forEach((s) => s.close());
  }, 15000);
});
