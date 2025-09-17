import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import type { AddressInfo } from 'node:net';
import { io as ioc, Socket } from 'socket.io-client';
import { createApp } from '../app';
import { createSocketServer } from '../realtime/server';
import { emitToVillage } from '../realtime/io';

let baseURL = '';
let server: import('http').Server;
let ioServer: import('socket.io').Server;

function waitForEvent<T = any>(socket: Socket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

beforeAll(async () => {
  const app = createApp();
  server = app.listen(0);
  ioServer = createSocketServer(server);
  const addr = server.address() as AddressInfo;
  baseURL = `http://localhost:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => ioServer.close(() => r()));
  await new Promise<void>((r) => server.close(() => r()));
});

describe('WebSocket integration', () => {
  it('connects and responds to ping ack', async () => {
    const socket = ioc(baseURL, { transports: ['websocket'], autoConnect: true, timeout: 2000 });
    await waitForEvent(socket, 'connect');
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('ping ack timeout')), 1000);
      socket.emit('ping', () => {
        clearTimeout(t);
        resolve();
      });
    });
    socket.disconnect();
  });

  it('joins village room and receives broadcast', async () => {
    const socket = ioc(baseURL, { transports: ['websocket'], autoConnect: true, timeout: 2000 });
    await waitForEvent(socket, 'connect');
    const ack: any = await new Promise((resolve) => {
      socket.emit('join_village', { villageId: '1' }, (resp: any) => resolve(resp));
    });
    expect(ack?.ok).toBe(true);
    // emit to the village room and expect client to receive
    const payload = { agentId: 'demo', message: 'hello', ts: Date.now() };
    emitToVillage('1', 'work_stream', payload);
    const received = await waitForEvent<typeof payload>(socket, 'work_stream');
    expect(received.message).toBe('hello');
    socket.disconnect();
  });

  it('supports polling transport', async () => {
    const socket = ioc(baseURL, { transports: ['polling'], autoConnect: true, timeout: 4000 });
    await waitForEvent(socket, 'connect', 4000);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('ping ack timeout')), 1500);
      socket.emit('ping', () => {
        clearTimeout(t);
        resolve();
      });
    });
    socket.disconnect();
  });
});
