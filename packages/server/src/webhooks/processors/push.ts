import { WebhookEvent } from '../github-enhanced';
import { inc } from '../../metrics';

export interface PushPayload {
  ref: string;
  before: string;
  after: string;
  created: boolean;
  deleted: boolean;
  forced: boolean;
  commits: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
      username?: string;
    };
    timestamp: string;
  }>;
  repository: {
    id: number;
    name: string;
    full_name: string;
  };
  pusher: {
    name: string;
    email: string;
  };
  sender: {
    login: string;
    id: number;
  };
}

export async function processPushEvent(event: WebhookEvent): Promise<void> {
  const payload = event.payload as unknown as PushPayload;

  try {
    // Extract branch from ref (refs/heads/main -> main)
    const branch = payload.ref?.replace('refs/heads/', '') || 'unknown';
    const repoFullName = payload.repository?.full_name || 'unknown';
    const commitCount = payload.commits?.length || 0;

    console.log(`[Push] ${repoFullName}:${branch} - ${commitCount} commit(s)`);

    // Map to agent activity state: WORK_STARTED
    await mapToAgentState({
      event: 'WORK_STARTED',
      repoId: String(payload.repository?.id || ''),
      repoName: repoFullName,
      branch,
      commitCount,
      pusher: payload.pusher?.name || payload.sender?.login || 'unknown',
      timestamp: Date.now(),
      commits: payload.commits?.slice(0, 5).map((c) => ({
        sha: c.id,
        message: c.message,
        author: c.author?.name || c.author?.username || 'unknown',
      })),
    });

    inc('webhook_push_processed', { branch, repo: repoFullName });

    // If this is the default branch and has commits, mark as WORK_COMPLETED
    if (branch === 'main' || branch === 'master') {
      await mapToAgentState({
        event: 'WORK_COMPLETED',
        repoId: String(payload.repository?.id || ''),
        repoName: repoFullName,
        branch,
        commitCount,
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error('Error processing push event:', error);
    inc('webhook_push_error');
    throw error;
  }
}

async function mapToAgentState(data: {
  event: 'WORK_STARTED' | 'WORK_COMPLETED';
  repoId: string;
  repoName: string;
  branch: string;
  commitCount: number;
  pusher?: string;
  timestamp: number;
  commits?: Array<{ sha: string; message: string; author: string }>;
}): Promise<void> {
  try {
    // Import the activity store to apply transitions
    const { applyTransition } = await import('../../houses/activityStore');

    (applyTransition as any)({
      type: data.event,
      repoId: data.repoId,
      metadata: {
        branch: data.branch,
        commitCount: data.commitCount,
        pusher: data.pusher,
        repoName: data.repoName,
        commits: data.commits,
      },
    });

    console.log(`[Push -> Agent] Mapped ${data.event} for ${data.repoName}:${data.branch}`);
  } catch (error) {
    console.warn('Failed to map push event to agent state:', error);
  }
}

export default processPushEvent;
