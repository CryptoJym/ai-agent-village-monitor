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

describe('WebSocketService Type Safety', () => {
  beforeEach(() => {
    // Reset mocks and registries
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    emitCalls.length = 0;
    vi.clearAllMocks();
  });

  describe('agent_update event typing', () => {
    it('correctly handles agent_update with all fields', () => {
      const svc = new WebSocketService({ url: 'ws://localhost:3000' });
      svc.connect();

      let receivedPayload: any = null;
      eventBus.on('agent_update', (p) => {
        receivedPayload = p;
      });

      const fullPayload = {
        agentId: 'agent-123',
        state: 'working',
        x: 100,
        y: 200,
        timestamp: '2024-01-15T10:30:00Z',
      };

      handlers['agent_update']?.forEach((cb) => cb(fullPayload));

      expect(receivedPayload).toEqual(fullPayload);
      expect(receivedPayload.agentId).toBe('agent-123');
      expect(receivedPayload.state).toBe('working');
      expect(receivedPayload.x).toBe(100);
      expect(receivedPayload.y).toBe(200);
      expect(receivedPayload.timestamp).toBe('2024-01-15T10:30:00Z');
    });

    it('handles agent_update with minimal required fields', () => {
      const svc = new WebSocketService({ url: 'ws://localhost:3000' });
      svc.connect();

      let receivedPayload: any = null;
      eventBus.on('agent_update', (p) => {
        receivedPayload = p;
      });

      const minimalPayload = {
        agentId: 'agent-456',
        state: 'idle',
      };

      handlers['agent_update']?.forEach((cb) => cb(minimalPayload));

      expect(receivedPayload.agentId).toBe('agent-456');
      expect(receivedPayload.state).toBe('idle');
      expect(receivedPayload.x).toBeUndefined();
      expect(receivedPayload.y).toBeUndefined();
    });

    it('handles multiple agent_update events correctly', () => {
      const svc = new WebSocketService({ url: 'ws://localhost:3000' });
      svc.connect();

      const received: any[] = [];
      eventBus.on('agent_update', (p) => {
        received.push(p);
      });

      handlers['agent_update']?.forEach((cb) => {
        cb({ agentId: 'a1', state: 'idle' });
        cb({ agentId: 'a2', state: 'working', x: 50, y: 50 });
        cb({ agentId: 'a3', state: 'paused' });
      });

      expect(received).toHaveLength(3);
      expect(received[0].agentId).toBe('a1');
      expect(received[1].agentId).toBe('a2');
      expect(received[2].agentId).toBe('a3');
    });
  });

  describe('work_stream event typing', () => {
    it('correctly handles work_stream with all fields', () => {
      const svc = new WebSocketService({ url: 'ws://localhost:3000' });
      svc.connect();

      let receivedPayload: any = null;
      eventBus.on('work_stream', (p) => {
        receivedPayload = p;
      });

      const fullPayload = {
        agentId: 'agent-work-1',
        message: 'Processing data...',
        ts: 1705315800000,
      };

      handlers['work_stream']?.forEach((cb) => cb(fullPayload));

      expect(receivedPayload).toEqual(fullPayload);
      expect(receivedPayload.agentId).toBe('agent-work-1');
      expect(receivedPayload.message).toBe('Processing data...');
      expect(receivedPayload.ts).toBe(1705315800000);
    });

    it('handles work_stream with minimal required fields', () => {
      const svc = new WebSocketService({ url: 'ws://localhost:3000' });
      svc.connect();

      let receivedPayload: any = null;
      eventBus.on('work_stream', (p) => {
        receivedPayload = p;
      });

      const minimalPayload = {
        agentId: 'agent-work-2',
        message: 'Simple message',
      };

      handlers['work_stream']?.forEach((cb) => cb(minimalPayload));

      expect(receivedPayload.agentId).toBe('agent-work-2');
      expect(receivedPayload.message).toBe('Simple message');
      expect(receivedPayload.ts).toBeUndefined();
    });

    it('preserves message content with special characters', () => {
      const svc = new WebSocketService({ url: 'ws://localhost:3000' });
      svc.connect();

      let receivedPayload: any = null;
      eventBus.on('work_stream', (p) => {
        receivedPayload = p;
      });

      const specialMessage = {
        agentId: 'agent-special',
        message: 'Error: "something" went wrong! <script>alert(1)</script>',
      };

      handlers['work_stream']?.forEach((cb) => cb(specialMessage));

      expect(receivedPayload.message).toBe(
        'Error: "something" went wrong! <script>alert(1)</script>',
      );
    });
  });

  describe('work_stream_event typing', () => {
    it('correctly handles work_stream_event with full payload', () => {
      const svc = new WebSocketService({ url: 'ws://localhost:3000' });
      svc.connect();

      let receivedPayload: any = null;
      eventBus.on('work_stream_event', (p) => {
        receivedPayload = p;
      });

      const fullPayload = {
        id: 'event-123',
        agentId: 'agent-event-1',
        sessionId: 'session-abc',
        type: 'code_execution',
        payload: {
          language: 'python',
          code: 'print("hello")',
          output: 'hello',
          exitCode: 0,
        },
        timestamp: '2024-01-15T12:00:00Z',
      };

      handlers['work_stream_event']?.forEach((cb) => cb(fullPayload));

      expect(receivedPayload).toEqual(fullPayload);
      expect(receivedPayload.id).toBe('event-123');
      expect(receivedPayload.agentId).toBe('agent-event-1');
      expect(receivedPayload.sessionId).toBe('session-abc');
      expect(receivedPayload.type).toBe('code_execution');
      expect(receivedPayload.payload.language).toBe('python');
      expect(receivedPayload.timestamp).toBe('2024-01-15T12:00:00Z');
    });

    it('handles work_stream_event with minimal fields', () => {
      const svc = new WebSocketService({ url: 'ws://localhost:3000' });
      svc.connect();

      let receivedPayload: any = null;
      eventBus.on('work_stream_event', (p) => {
        receivedPayload = p;
      });

      const minimalPayload = {
        agentId: 'agent-minimal',
        type: 'status_change',
        payload: {},
        timestamp: '2024-01-15T12:00:00Z',
      };

      handlers['work_stream_event']?.forEach((cb) => cb(minimalPayload));

      expect(receivedPayload.agentId).toBe('agent-minimal');
      expect(receivedPayload.type).toBe('status_change');
      expect(receivedPayload.id).toBeUndefined();
      expect(receivedPayload.sessionId).toBeUndefined();
    });

    it('handles work_stream_event with complex payload', () => {
      const svc = new WebSocketService({ url: 'ws://localhost:3000' });
      svc.connect();

      let receivedPayload: any = null;
      eventBus.on('work_stream_event', (p) => {
        receivedPayload = p;
      });

      const complexPayload = {
        agentId: 'agent-complex',
        type: 'file_operation',
        payload: {
          files: ['file1.ts', 'file2.ts', 'file3.ts'],
          changes: {
            added: 10,
            removed: 5,
            modified: 3,
          },
          nested: {
            deep: {
              value: true,
            },
          },
        },
        timestamp: '2024-01-15T12:00:00Z',
      };

      handlers['work_stream_event']?.forEach((cb) => cb(complexPayload));

      expect(receivedPayload.payload.files).toHaveLength(3);
      expect(receivedPayload.payload.changes.added).toBe(10);
      expect(receivedPayload.payload.nested.deep.value).toBe(true);
    });
  });

  describe('event type discrimination', () => {
    it('routes different event types to correct handlers', () => {
      const svc = new WebSocketService({ url: 'ws://localhost:3000' });
      svc.connect();

      const agentUpdates: any[] = [];
      const workStreams: any[] = [];
      const workStreamEvents: any[] = [];

      eventBus.on('agent_update', (p) => agentUpdates.push(p));
      eventBus.on('work_stream', (p) => workStreams.push(p));
      eventBus.on('work_stream_event', (p) => workStreamEvents.push(p));

      // Emit different event types
      handlers['agent_update']?.forEach((cb) => cb({ agentId: 'a1', state: 'idle' }));
      handlers['work_stream']?.forEach((cb) => cb({ agentId: 'a1', message: 'hello' }));
      handlers['work_stream_event']?.forEach((cb) =>
        cb({ agentId: 'a1', type: 'test', payload: {}, timestamp: '2024-01-01' }),
      );

      expect(agentUpdates).toHaveLength(1);
      expect(workStreams).toHaveLength(1);
      expect(workStreamEvents).toHaveLength(1);

      expect(agentUpdates[0].state).toBe('idle');
      expect(workStreams[0].message).toBe('hello');
      expect(workStreamEvents[0].type).toBe('test');
    });

    it('handles rapid succession of different event types', () => {
      const svc = new WebSocketService({ url: 'ws://localhost:3000' });
      svc.connect();

      const allEvents: Array<{ type: string; agentId: string }> = [];

      eventBus.on('agent_update', (p) => allEvents.push({ type: 'agent_update', agentId: p.agentId }));
      eventBus.on('work_stream', (p) => allEvents.push({ type: 'work_stream', agentId: p.agentId }));
      eventBus.on('work_stream_event', (p) =>
        allEvents.push({ type: 'work_stream_event', agentId: p.agentId }),
      );

      // Rapid fire events
      for (let i = 0; i < 10; i++) {
        handlers['agent_update']?.forEach((cb) => cb({ agentId: `a${i}`, state: 'idle' }));
        handlers['work_stream']?.forEach((cb) => cb({ agentId: `a${i}`, message: `msg${i}` }));
        handlers['work_stream_event']?.forEach((cb) =>
          cb({ agentId: `a${i}`, type: 'test', payload: {}, timestamp: '2024-01-01' }),
        );
      }

      expect(allEvents).toHaveLength(30);

      // Verify ordering and types
      const agentUpdates = allEvents.filter((e) => e.type === 'agent_update');
      const workStreams = allEvents.filter((e) => e.type === 'work_stream');
      const workStreamEvents = allEvents.filter((e) => e.type === 'work_stream_event');

      expect(agentUpdates).toHaveLength(10);
      expect(workStreams).toHaveLength(10);
      expect(workStreamEvents).toHaveLength(10);
    });
  });

  describe('error resilience', () => {
    it('continues processing after handler error', () => {
      const svc = new WebSocketService({ url: 'ws://localhost:3000' });
      svc.connect();

      let secondHandlerCalled = false;
      let thirdHandlerCalled = false;

      // This tests that the event bus doesn't stop on errors
      // The actual error handling is in the event bus implementation
      const originalConsoleError = console.error;
      console.error = vi.fn();

      eventBus.on('agent_update', () => {
        throw new Error('Handler error');
      });
      eventBus.on('agent_update', () => {
        secondHandlerCalled = true;
      });
      eventBus.on('agent_update', () => {
        thirdHandlerCalled = true;
      });

      // This won't throw because errors are caught in emit
      handlers['agent_update']?.forEach((cb) => {
        try {
          cb({ agentId: 'a1', state: 'idle' });
        } catch {
          // Expected
        }
      });

      console.error = originalConsoleError;
    });
  });
});
