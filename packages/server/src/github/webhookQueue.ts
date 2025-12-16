import type { JobsOptions } from 'bullmq';
import crypto from 'node:crypto';
import { createQueues } from '../queue/queues';
import { audit } from '../audit/logger';

export type GitHubWebhookJobPayload = {
  deliveryId: string;
  event: string;
  signature: string;
  payload: unknown;
  receivedAt: number;
};

function stableStringify(obj: unknown) {
  try {
    return JSON.stringify(obj, Object.keys(obj as any).sort());
  } catch {
    return JSON.stringify(obj);
  }
}

function computeJobId(payload: GitHubWebhookJobPayload): string {
  const deliveryId = String(payload.deliveryId || '').trim();
  if (deliveryId) return `gh-webhook:${deliveryId}`;
  const hash = crypto
    .createHash('sha1')
    .update(stableStringify(payload))
    .digest('hex')
    .slice(0, 12);
  return `gh-webhook:hash:${hash}`;
}

export async function enqueueGitHubWebhookEvent(
  payload: GitHubWebhookJobPayload,
  opts?: JobsOptions,
) {
  const queues = createQueues();
  if (!queues) return { ok: true as const, enqueued: false as const };

  const jobId = computeJobId(payload);
  const existing = await queues.githubWebhooks.getJob(jobId).catch(() => null);
  if (existing) {
    try {
      const state = await existing.getState();
      if (state && !['completed', 'failed'].includes(state)) {
        audit.log('github.webhook_deduped', {
          jobId,
          deliveryId: payload.deliveryId,
          event: payload.event,
        });
        return { ok: true as const, enqueued: false as const, jobId };
      }
    } catch {
      // Ignore lookup failures; fall through to enqueue.
    }
  }

  const action = (payload.payload as any)?.action;
  const name = action ? `${payload.event}.${String(action)}` : payload.event;
  await queues.githubWebhooks.add(name, payload, {
    jobId,
    removeOnComplete: { count: 500, age: 3600 },
    removeOnFail: { age: 24 * 3600 },
    ...(opts || {}),
  });

  audit.log('github.webhook_enqueued', {
    jobId,
    deliveryId: payload.deliveryId,
    event: payload.event,
  });
  return { ok: true as const, enqueued: true as const, jobId };
}
