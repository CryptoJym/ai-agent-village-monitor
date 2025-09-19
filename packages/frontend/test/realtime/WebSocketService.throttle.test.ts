import { describe, it, expect, beforeEach } from 'vitest';
import { WebSocketService } from '../../src/realtime/WebSocketService';
import { eventBus } from '../../src/realtime/EventBus';

describe('WebSocketService throttling', () => {
  beforeEach(() => {
    // @ts-ignore
    global.requestAnimationFrame = (cb: FrameRequestCallback) => {
      setTimeout(() => cb(performance.now()), 0);
      return 0 as any;
    };
  });

  it('batches high-frequency agent_update/work_stream into animation frames', async () => {
    const ws = new WebSocketService({ url: 'ws://invalid' });
    // @ts-ignore private
    ws['socket'] = {
      on() {},
      emit() {},
      timeout() {
        return { emit() {} };
      },
    } as any;
    const updates: any[] = [];
    const logs: any[] = [];
    const off1 = (eventBus as any).on('agent_update', (p: any) => updates.push(p));
    const off2 = (eventBus as any).on('work_stream', (p: any) => logs.push(p));
    // @ts-ignore
    ws['enqueue']('agent_update', { a: 1 });
    // @ts-ignore
    ws['enqueue']('agent_update', { a: 2 });
    // @ts-ignore
    ws['enqueue']('work_stream', { m: 'x' });
    // @ts-ignore
    ws['enqueue']('work_stream', { m: 'y' });
    await new Promise((r) => setTimeout(r, 10));
    expect(updates.length).toBe(2);
    expect(logs.length).toBe(2);
    off1?.();
    off2?.();
  });
});
