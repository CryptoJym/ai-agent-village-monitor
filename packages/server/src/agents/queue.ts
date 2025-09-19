import type { JobsOptions } from 'bullmq';
import { createQueues } from '../queue/queues';
import crypto from 'node:crypto';
import { audit } from '../audit/logger';

export type AgentCommandPayload =
  | { kind: 'start'; agentId: string | number; restart?: boolean }
  | { kind: 'stop'; agentId: string | number }
  | { kind: 'command'; agentId: string | number; command: string; args?: Record<string, unknown> };

function stableStringify(obj: unknown) {
  try {
    return JSON.stringify(obj, Object.keys(obj as any).sort());
  } catch {
    return JSON.stringify(obj);
  }
}

function computeJobId(payload: AgentCommandPayload): string {
  const agent = String(payload.agentId);
  if (payload.kind === 'start') return `start:${agent}`;
  if (payload.kind === 'stop') return `stop:${agent}`;
  // For command dedup, prefer client-provided id in args
  const args = (payload as any).args || {};
  const requestId = args.clientRequestId || args.requestId;
  if (requestId) return `cmd:${agent}:${(payload as any).command}:${String(requestId)}`;
  const hash = crypto
    .createHash('sha1')
    .update(`${(payload as any).command}:${stableStringify(args)}`)
    .digest('hex')
    .slice(0, 12);
  return `cmd:${agent}:${(payload as any).command}:${hash}`;
}

export async function enqueueAgentJob(payload: AgentCommandPayload, opts?: JobsOptions) {
  const queues = createQueues();
  // In environments without Redis configured, accept immediately to keep UX/tests smooth
  if (!queues) return { ok: true as const, enqueued: false as const };
  const name = payload.kind;
  const jobId = computeJobId(payload);
  const existing = await queues.agentCommands.getJob(jobId).catch(() => null);
  if (existing) {
    // If an existing job with this id exists and isn't finalized, treat as idempotent
    try {
      const state = await existing.getState();
      if (state && !['completed', 'failed'].includes(state)) {
        audit.log('agent.job_deduped', {
          jobId,
          kind: name,
          agentId: String((payload as any).agentId),
        });
        return { ok: true as const, enqueued: false as const, jobId };
      }
    } catch {
      // Ignore state lookup failures; treat as needing enqueue.
    }
  }
  await queues.agentCommands.add(name, payload as any, {
    jobId,
    removeOnComplete: { count: 500, age: 3600 },
    removeOnFail: { age: 24 * 3600 },
    ...(opts || {}),
  });
  audit.log('agent.job_enqueued', { jobId, kind: name, agentId: String((payload as any).agentId) });
  return { ok: true as const, enqueued: true as const, jobId };
}
