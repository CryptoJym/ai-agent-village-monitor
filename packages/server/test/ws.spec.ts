import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import http from 'node:http';
import { io as Client } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

let server: http.Server;
let port: number;
let token: string;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
  const { createApp } = await import('../src/app');
  const { createSocketServer } = await import('../src/realtime/server');
  const { signAccessToken } = await import('../src/auth/jwt');

  const app = createApp();
  server = http.createServer(app);
  createSocketServer(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  port = (server.address() as any).port as number;
  token = signAccessToken(1, 'tester');
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function url() {
  return `http://localhost:${port}`;
}

// Marked skip to avoid interference with other suites until E2E env ready
describe('WebSocket server', () => {
  test('connects with polling-only transport and pings', async () => {
    const socket: Socket = Client(url(), { transports: ['polling'], auth: { token } });
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    // ping ack roundtrip
    await new Promise<void>((resolve, reject) => {
      try {
        socket.timeout(2000).emit('ping', () => resolve());
      } catch (e) {
        reject(e);
      }
    });
    socket.disconnect();
  });

  test('join rooms with ack responses', async () => {
    const socket: Socket = Client(url(), { transports: ['polling'], auth: { token } });
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', (err) => {
        console.error('connect_error (join rooms):', err);
        reject(err);
      });
    });
    // join village
    const resVillage = await new Promise<any>((resolve) =>
      socket.emit('join_village', { villageId: '1' }, resolve),
    );
    expect(resVillage?.ok).toBe(true);
    expect(resVillage?.room).toBe('village:1');
    // join agent
    const resAgent = await new Promise<any>((resolve) =>
      socket.emit('join_agent', { agentId: 'demo' }, resolve),
    );
    expect(resAgent?.ok).toBe(true);
    expect(resAgent?.room).toBe('agent:demo');
    // join repo
    const resRepo = await new Promise<any>((resolve) =>
      socket.emit('join_repo', { repoId: 'r1' }, resolve),
    );
    expect(resRepo?.ok).toBe(true);
    expect(resRepo?.room).toBe('repo:r1');
    socket.disconnect();
  });

  test('bad join payload returns standardized error', async () => {
    const socket: Socket = Client(url(), { transports: ['polling'], auth: { token } });
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', (err) => {
        console.error('connect_error (bad payload):', err);
        reject(err);
      });
    });
    const res = await new Promise<any>((resolve) =>
      socket.emit(
        'join_village',
        {
          /* missing */
        },
        resolve,
      ),
    );
    expect(res?.ok).toBe(false);
    expect(res?.error?.code).toBe('E_BAD_PAYLOAD');
    socket.disconnect();
  });
});
