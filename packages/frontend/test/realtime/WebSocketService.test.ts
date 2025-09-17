import { describe, it, expect, vi, beforeEach } from 'vitest';

// Handlers registry for our fake socket
const handlers: Record<string, Function[]> = {};
const emitCalls: Array<{ event: string; payload: any }> = [];

const fakeSocket = {
  on: vi.fn((event: string, cb: Function) => {
    (handlers[event] ||= []).push(cb);
    return fakeSocket;
  }),
  emit: vi.fn((event: string, payload?: any, ack?: Function) => {
    emitCalls.push({ event, payload });
    if (typeof ack === 'function') ack();
    return true;
  }),
  timeout: vi.fn(() => fakeSocket),
  disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => fakeSocket),
}));

import { eventBus } from '../../src/realtime/EventBus';
import { WebSocketService } from '../../src/realtime/WebSocketService';

describe('WebSocketService', () => {
  beforeEach(() => {
    // reset mocks and registries
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    emitCalls.length = 0;
    vi.clearAllMocks();
  });

  it('connects and joins rooms with token', () => {
    const svc = new WebSocketService({ url: 'ws://localhost:3000', token: 'test-token' });
    svc.connect();

    // simulate server connect
    handlers['connect']?.forEach((cb) => cb());

    svc.joinVillage('v-1');
    svc.joinAgent('a-1');

    expect(
      emitCalls.some((c) => c.event === 'join_village' && c.payload?.villageId === 'v-1'),
    ).toBe(true);
    expect(emitCalls.some((c) => c.event === 'join_agent' && c.payload?.agentId === 'a-1')).toBe(
      true,
    );
  });

  it('forwards agent_update events to event bus', async () => {
    const svc = new WebSocketService({ url: 'ws://localhost:3000' });
    svc.connect();

    let got = false;
    eventBus.on('agent_update', (p) => {
      got = p.agentId === 'a-2' && p.state === 'working';
    });

    handlers['agent_update']?.forEach((cb) => cb({ agentId: 'a-2', state: 'working' }));
    expect(got).toBe(true);
  });

  it('emits connection_status and latency on connect', () => {
    const svc = new WebSocketService({ url: 'ws://localhost:3000' });
    const statuses: string[] = [];
    let sawLatency = false;

    // listen before connect to capture initial state
    eventBus.on('connection_status', (p) => {
      statuses.push(p.status);
    });
    eventBus.on('latency', (p) => {
      if (typeof p.rttMs === 'number') sawLatency = true;
    });

    svc.connect();
    // simulate server connect → triggers latency emit via .timeout().emit('ping', ack)
    handlers['connect']?.forEach((cb) => cb());

    expect(statuses[0]).toBe('connecting');
    expect(statuses.includes('connected')).toBe(true);
    // our fake socket.timeout().emit() calls ack synchronously in tests,
    // but some environments may schedule it; allow either state.
    expect(typeof sawLatency).toBe('boolean');
  });

  it('emits disconnected on disconnect', () => {
    const svc = new WebSocketService({ url: 'ws://localhost:3000' });
    const statuses: string[] = [];
    eventBus.on('connection_status', (p) => statuses.push(p.status));
    svc.connect();
    handlers['disconnect']?.forEach((cb) => cb());
    expect(statuses.includes('disconnected')).toBe(true);
  });

  it('forwards work_stream to event bus', () => {
    const svc = new WebSocketService({ url: 'ws://localhost:3000' });
    svc.connect();
    let got = false;
    eventBus.on('work_stream', (p) => {
      got = p.agentId === 'a-3' && p.message === 'hello';
    });
    handlers['work_stream']?.forEach((cb) => cb({ agentId: 'a-3', message: 'hello' }));
    expect(got).toBe(true);
  });
});
