import { describe, it, expect } from 'vitest';
import { AnalyticsBatchSchema } from '../analytics/schema';

describe('analytics schema', () => {
  it('accepts a valid batch', () => {
    const now = Date.now();
    const res = AnalyticsBatchSchema.safeParse({
      consent: true,
      clientId: 'cid-123',
      events: [
        { type: 'session_start', ts: now, userId: 'u1', villageId: 'v1' },
        { type: 'village_view', ts: now, villageId: 'v1' },
        { type: 'dialogue_open', ts: now, source: 'click', villageId: 'v1' },
        { type: 'command_executed', ts: now, agentId: 'a1', command: 'run_tool', villageId: 'v1' },
        { type: 'session_end', ts: now, durationMs: 1234, userId: 'u1', villageId: 'v1' },
      ],
    });
    expect(res.success).toBe(true);
  });

  it('rejects unknown event types', () => {
    const res = AnalyticsBatchSchema.safeParse({
      consent: true,
      events: [{ type: 'unknown', ts: Date.now() }],
    } as any);
    expect(res.success).toBe(false);
  });

  it('rejects empty batch', () => {
    const res = AnalyticsBatchSchema.safeParse({ consent: true, events: [] });
    expect(res.success).toBe(false);
  });

  it('enforces command length limit', () => {
    const long = 'x'.repeat(200);
    const res = AnalyticsBatchSchema.safeParse({
      consent: true,
      events: [{ type: 'command_executed', ts: Date.now(), command: long }],
    });
    expect(res.success).toBe(false);
  });
});
