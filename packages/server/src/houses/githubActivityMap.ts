import type { Transition } from './activityStore';

export function mapGitHubEventToTransitions(event: string | undefined, payload: any): Transition[] {
  const repoId = payload?.repository?.id ? String(payload.repository.id) : undefined;
  const prNumber = payload?.pull_request?.number;
  const villageId = undefined; // filled by webhook mapping if available
  const houseId = undefined; // optional
  const out: Transition[] = [];

  switch (event) {
    case 'push': {
      if (repoId) {
        out.push({
          kind: 'lights',
          repoId,
          houseId,
          villageId,
          on: true,
          source: 'push',
          contextId: payload?.after,
          minMs: undefined,
          ttlMs: undefined,
        });
      }
      break;
    }
    case 'pull_request': {
      const action = String(payload?.action || '').toLowerCase();
      if (!repoId) break;
      if (action === 'opened' || action === 'reopened' || action === 'ready_for_review') {
        out.push({
          kind: 'banner',
          repoId,
          on: true,
          source: 'pull_request',
          contextId: String(prNumber || ''),
          prNumber,
        });
      } else if (action === 'closed') {
        out.push({
          kind: 'banner',
          repoId,
          on: false,
          source: 'pull_request',
          contextId: String(prNumber || ''),
        });
      } else if (action === 'synchronize') {
        // no flicker: extend min duration by simply refreshing TTL
        out.push({
          kind: 'banner',
          repoId,
          on: true,
          source: 'pull_request',
          contextId: String(prNumber || ''),
          prNumber,
        });
      }
      break;
    }
    case 'check_run': {
      const action = String(payload?.action || '').toLowerCase();
      if (!repoId) break;
      if (action === 'created' || action === 'in_progress' || action === 'rerequested') {
        out.push({
          kind: 'smoke',
          repoId,
          on: true,
          source: 'check_run',
          contextId: String(payload?.check_run?.id || ''),
          status: 'in_progress',
        });
      } else if (action === 'completed') {
        const conclusion = String(payload?.check_run?.conclusion || '').toLowerCase();
        if (conclusion === 'success') {
          out.push({
            kind: 'smoke',
            repoId,
            on: false,
            source: 'check_run',
            contextId: String(payload?.check_run?.id || ''),
            status: 'passed',
          });
        } else {
          // failed or neutral: brief burst then off
          out.push({
            kind: 'smoke',
            repoId,
            on: false,
            source: 'check_run',
            contextId: String(payload?.check_run?.id || ''),
            status: 'failed',
          });
        }
      }
      break;
    }
    default:
      break;
  }
  return out;
}
