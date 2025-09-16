import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { io as Client } from 'socket.io-client';

let server: http.Server;
let baseUrl: string;

describe('WebSocket origin checks', () => {
  beforeAll(async () => {
    // Only allow this origin for WS
    process.env.WS_ALLOWED_ORIGINS = 'http://ws-allowed.test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    const { createApp } = await import('../src/app');
    const { createSocketServer } = await import('../src/realtime/server');
    const { signAccessToken } = await import('../src/auth/jwt');
    const app = createApp();
    server = http.createServer(app);
    createSocketServer(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port as number;
    baseUrl = `http://127.0.0.1:${port}`;
    // Seed a token for connections
    (global as any).__token = signAccessToken(1, 'tester');
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('accepts connection from allowed origin', async () => {
    const token = (global as any).__token as string;
    const socket = Client(baseUrl, {
      transports: ['polling'],
      auth: { token },
      extraHeaders: { Origin: 'http://ws-allowed.test' },
    });
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    socket.disconnect();
  });

  it('rejects connection from disallowed origin', async () => {
    const token = (global as any).__token as string;
    const socket = Client(baseUrl, {
      transports: ['polling'],
      auth: { token },
      extraHeaders: { Origin: 'http://ws-denied.test' },
    });
    const err = await new Promise<Error>((resolve) =>
      socket.on('connect_error', (e: Error) => resolve(e)),
    );
    // Socket.IO abstracts transport errors; asserting we got a connection error is sufficient
    expect(err).toBeTruthy();
    socket.disconnect();
  });
});
