import type { JobsOptions } from 'bullmq';
import crypto from 'node:crypto';
import { createQueues } from '../queue/queues';
import { audit } from '../audit/logger';

export type RepoAnalysisJobPayload = {
  houseId: string;
};

function stableStringify(obj: unknown) {
  try {
    return JSON.stringify(obj, Object.keys(obj as any).sort());
  } catch {
    return JSON.stringify(obj);
  }
}

function computeJobId(payload: RepoAnalysisJobPayload): string {
  const hash = crypto
    .createHash('sha1')
    .update(stableStringify(payload))
    .digest('hex')
    .slice(0, 12);
  return `repo-analysis:${payload.houseId}:${hash}`;
}

export async function enqueueHouseRepoAnalysis(
  payload: RepoAnalysisJobPayload,
  opts?: JobsOptions,
) {
  const queues = createQueues();
  // Environments without Redis should behave as "accepted" (non-blocking UX/tests).
  if (!queues) return { ok: true as const, enqueued: false as const };

  const jobId = computeJobId(payload);
  const existing = await queues.repoAnalysis.getJob(jobId).catch(() => null);
  if (existing) {
    try {
      const state = await existing.getState();
      if (state && !['completed', 'failed'].includes(state)) {
        audit.log('house.repo_analysis_deduped', { houseId: payload.houseId, jobId });
        return { ok: true as const, enqueued: false as const, jobId };
      }
    } catch {
      // Ignore lookup failures; fall through to enqueue.
    }
  }

  await queues.repoAnalysis.add('analyze', payload, {
    jobId,
    removeOnComplete: { count: 200, age: 3600 },
    removeOnFail: { age: 24 * 3600 },
    ...(opts || {}),
  });

  audit.log('house.repo_analysis_enqueued', { houseId: payload.houseId, jobId });
  return { ok: true as const, enqueued: true as const, jobId };
}
