import { WebhookEvent } from '../github-enhanced';
import { inc } from '../../metrics';

export interface IssuesPayload {
  action: string;
  issue: {
    id: number;
    number: number;
    title: string;
    body: string;
    state: string;
    user: {
      login: string;
      id: number;
    };
    labels: Array<{
      name: string;
      color: string;
    }>;
    created_at: string;
    updated_at: string;
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

export async function processIssuesEvent(event: WebhookEvent): Promise<void> {
  const payload = event.payload as unknown as IssuesPayload;

  try {
    const action = payload.action;
    const issue = payload.issue;
    const repoFullName = payload.repository?.full_name || 'unknown';

    console.log(`[Issue] ${repoFullName}#${issue.number} - ${action}`);

    switch (action) {
      case 'opened':
        await createBugFromIssue({
          repoId: String(payload.repository?.id || ''),
          repoName: repoFullName,
          issue,
        });
        break;

      case 'closed':
        await updateBugStatus({
          repoName: repoFullName,
          issueNumber: issue.number,
          status: 'resolved',
        });
        break;

      case 'reopened':
        await updateBugStatus({
          repoName: repoFullName,
          issueNumber: issue.number,
          status: 'active',
        });
        break;

      case 'labeled':
      case 'unlabeled':
        await updateBugLabels({
          repoName: repoFullName,
          issueNumber: issue.number,
          labels: issue.labels.map((l) => l.name),
        });
        break;
    }

    inc('webhook_issues_processed', { action, repo: repoFullName });
  } catch (error) {
    console.error('Error processing issues event:', error);
    inc('webhook_issues_error', { action: payload.action });
    throw error;
  }
}

async function createBugFromIssue(data: {
  repoId: string;
  repoName: string;
  issue: IssuesPayload['issue'];
}): Promise<void> {
  try {
    const { createBugBot } = await import('../../bugs/service');

    const bugId = `${data.repoName}/${data.issue.number}`;
    const severity = determineSeverity(data.issue.labels, data.issue.title, data.issue.body);

    await createBugBot({
      id: bugId,
      villageId: '', // Will be resolved by the bug service
      provider: 'github',
      repoId: data.repoId,
      issueId: String(data.issue.id),
      issueNumber: data.issue.number,
      title: data.issue.title,
      description: data.issue.body || '',
      severity,
      x: undefined,
      y: undefined,
    });

    console.log(`[Issue -> Bug] Created bug for issue #${data.issue.number}`);
    inc('bug_created', { source: 'issue_opened' });

    // Also map to agent state - new issue means thinking/investigation
    const { applyTransition } = await import('../../houses/activityStore');
    (applyTransition as any)({
      type: 'THINKING',
      repoId: data.repoId,
      metadata: {
        issueNumber: data.issue.number,
        issueTitle: data.issue.title,
        repoName: data.repoName,
      },
    });
  } catch (error) {
    console.warn('Failed to create bug from issue:', error);
  }
}

async function updateBugStatus(data: {
  repoName: string;
  issueNumber: number;
  status: 'resolved' | 'active';
}): Promise<void> {
  try {
    const { updateBugStatus: updateBug } = await import('../../bugs/service');
    const bugId = `${data.repoName}/${data.issueNumber}`;

    // Map active to open for bug service
    const bugStatus = data.status === 'active' ? 'open' : data.status;
    await updateBug(bugId, bugStatus as any);

    console.log(`[Issue -> Bug] Updated bug ${bugId} status to ${data.status}`);
    inc('bug_updated', { action: data.status });

    // If resolved, celebrate!
    if (data.status === 'resolved') {
      const { applyTransition } = await import('../../houses/activityStore');
      (applyTransition as any)({
        type: 'CELEBRATE',
        metadata: {
          issueNumber: data.issueNumber,
          repoName: data.repoName,
        },
      });
    }
  } catch (error) {
    console.warn('Failed to update bug status:', error);
  }
}

async function updateBugLabels(data: {
  repoName: string;
  issueNumber: number;
  labels: string[];
}): Promise<void> {
  try {
    console.log(`[Issue -> Bug] Updated labels for ${data.repoName}/${data.issueNumber}`);
    inc('bug_labels_updated');
    // Label updates could be stored in bug metadata if needed
  } catch (error) {
    console.warn('Failed to update bug labels:', error);
  }
}

function determineSeverity(
  labels: Array<{ name: string }>,
  title: string,
  body: string,
): 'low' | 'medium' | 'high' | null {
  const labelNames = labels.map((l) => l.name.toLowerCase());
  const text = `${title} ${body}`.toLowerCase();

  // Check labels first
  if (labelNames.some((l) => l.includes('critical') || l.includes('urgent'))) {
    return 'high';
  }
  if (labelNames.some((l) => l.includes('bug') || l.includes('error'))) {
    return 'medium';
  }
  if (labelNames.some((l) => l.includes('enhancement') || l.includes('feature'))) {
    return 'low';
  }

  // Check text content
  if (
    text.includes('crash') ||
    text.includes('critical') ||
    text.includes('data loss') ||
    text.includes('security')
  ) {
    return 'high';
  }
  if (text.includes('error') || text.includes('bug') || text.includes('broken')) {
    return 'medium';
  }

  return null;
}

export default processIssuesEvent;
