import { WebhookEvent } from '../github-enhanced';
import { inc } from '../../metrics';

export interface PullRequestPayload {
  action: string;
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    state: string;
    merged: boolean;
    merged_at: string | null;
    user: {
      login: string;
      id: number;
    };
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
      sha: string;
    };
    draft: boolean;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
  };
  sender: {
    login: string;
    id: number;
  };
}

export async function processPullRequestEvent(event: WebhookEvent): Promise<void> {
  const payload = event.payload as unknown as PullRequestPayload;

  try {
    const action = payload.action;
    const pr = payload.pull_request;
    const repoFullName = payload.repository?.full_name || 'unknown';

    console.log(`[PR] ${repoFullName}#${pr.number} - ${action}`);

    // Map different PR actions to agent states
    switch (action) {
      case 'opened':
      case 'reopened':
        await mapToAgentState({
          event: 'THINKING',
          repoId: String(payload.repository?.id || ''),
          repoName: repoFullName,
          prNumber: pr.number,
          prTitle: pr.title,
          author: pr.user?.login || 'unknown',
          timestamp: Date.now(),
        });
        break;

      case 'closed':
        if (pr.merged) {
          // PR was merged - celebrate!
          await mapToAgentState({
            event: 'CELEBRATE',
            repoId: String(payload.repository?.id || ''),
            repoName: repoFullName,
            prNumber: pr.number,
            prTitle: pr.title,
            mergedBy: payload.sender?.login || 'unknown',
            timestamp: Date.now(),
          });
        } else {
          // PR was closed without merging
          await mapToAgentState({
            event: 'IDLE',
            repoId: String(payload.repository?.id || ''),
            repoName: repoFullName,
            prNumber: pr.number,
            timestamp: Date.now(),
          });
        }
        break;

      case 'ready_for_review':
        // Draft PR became ready - agent is thinking
        await mapToAgentState({
          event: 'THINKING',
          repoId: String(payload.repository?.id || ''),
          repoName: repoFullName,
          prNumber: pr.number,
          prTitle: pr.title,
          timestamp: Date.now(),
        });
        break;

      case 'review_requested':
        // Review requested - agent needs to think
        await mapToAgentState({
          event: 'THINKING',
          repoId: String(payload.repository?.id || ''),
          repoName: repoFullName,
          prNumber: pr.number,
          prTitle: pr.title,
          timestamp: Date.now(),
        });
        break;
    }

    inc('webhook_pr_processed', { action, repo: repoFullName });
  } catch (error) {
    console.error('Error processing pull request event:', error);
    inc('webhook_pr_error', { action: payload.action });
    throw error;
  }
}

async function mapToAgentState(data: {
  event: 'THINKING' | 'CELEBRATE' | 'IDLE';
  repoId: string;
  repoName: string;
  prNumber: number;
  prTitle?: string;
  author?: string;
  mergedBy?: string;
  timestamp: number;
}): Promise<void> {
  try {
    const { applyTransition } = await import('../../houses/activityStore');

    (applyTransition as any)({
      type: data.event,
      repoId: data.repoId,
      metadata: {
        prNumber: data.prNumber,
        prTitle: data.prTitle,
        author: data.author,
        mergedBy: data.mergedBy,
        repoName: data.repoName,
      },
    });

    console.log(`[PR -> Agent] Mapped ${data.event} for ${data.repoName}#${data.prNumber}`);
  } catch (error) {
    console.warn('Failed to map PR event to agent state:', error);
  }
}

export default processPullRequestEvent;
