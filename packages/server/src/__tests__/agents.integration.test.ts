import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import { io as Client } from 'socket.io-client';

describe('agents integration (start → command → stop)', () => {
  let server: http.Server;
  let port = 0;
  const agentId = 'it-agent-1';
  let token = '';

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    const { createApp } = await import('../app');
    const { createSocketServer } = await import('../realtime/server');
    const { signAccessToken } = await import('../auth/jwt');

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

  function url(p: string) { return `http://localhost:${port}${p}`; }

  it('accepts start, command, stop (202 Accepted)', async () => {
    const start = await request(url('')).post(`/api/agents/${agentId}/start`).set('Authorization', `Bearer ${token}`);
    expect(start.status).toBe(202);
    const cmd = await request(url('')).post(`/api/agents/${agentId}/command`).set('Authorization', `Bearer ${token}`).send({ command: 'run_tool', args: { tool: 'echo' } });
    expect(cmd.status).toBe(202);
    const stop = await request(url('')).post(`/api/agents/${agentId}/stop`).set('Authorization', `Bearer ${token}`);
    expect(stop.status).toBe(202);
  });

  it.skipIf(!process.env.REDIS_URL)('streams WS events when Redis is configured', async () => {
    const socket = Client(`http://localhost:${port}`, { transports: ['polling'], auth: { token } });
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });
    const events: any[] = [];
    socket.on('work_stream', (e) => events.push(e));

    await request(url('')).post(`/api/agents/${agentId}/start`).set('Authorization', `Bearer ${token}`);
    await request(url('')).post(`/api/agents/${agentId}/command`).set('Authorization', `Bearer ${token}`).send({ command: 'run_tool', args: { tool: 'echo' } });
    await request(url('')).post(`/api/agents/${agentId}/stop`).set('Authorization', `Bearer ${token}`);

    await new Promise((r) => setTimeout(r, 200));
    socket.disconnect();
    expect(events.length).toBeGreaterThan(0);
  });
});

