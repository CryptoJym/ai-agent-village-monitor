import { WebhookEvent } from '../github-enhanced';
import { inc } from '../../metrics';

export interface CheckRunPayload {
  action: string;
  check_run: {
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    started_at: string;
    completed_at: string | null;
    output: {
      title: string | null;
      summary: string | null;
      text: string | null;
    };
    pull_requests: Array<{
      id: number;
      number: number;
      head: {
        ref: string;
        sha: string;
      };
    }>;
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

export async function processCheckRunEvent(event: WebhookEvent): Promise<void> {
  const payload = event.payload as unknown as CheckRunPayload;

  try {
    const action = payload.action;
    const checkRun = payload.check_run;
    const repoFullName = payload.repository?.full_name || 'unknown';

    console.log(
      `[CheckRun] ${repoFullName} - ${checkRun.name}: ${action} (${checkRun.conclusion || 'in-progress'})`,
    );

    // Only process completed check runs
    if (action === 'completed' && checkRun.conclusion) {
      const conclusion = checkRun.conclusion.toLowerCase();

      switch (conclusion) {
        case 'success':
          // Build succeeded - celebrate!
          await mapToAgentState({
            event: 'CELEBRATE',
            repoId: String(payload.repository?.id || ''),
            repoName: repoFullName,
            checkName: checkRun.name,
            conclusion: 'success',
            timestamp: Date.now(),
          });
          break;

        case 'failure':
        case 'timed_out':
        case 'cancelled':
          // Build failed - error state
          await mapToAgentState({
            event: 'ERROR_OCCURRED',
            repoId: String(payload.repository?.id || ''),
            repoName: repoFullName,
            checkName: checkRun.name,
            conclusion,
            errorSummary: checkRun.output?.summary || checkRun.output?.title || 'Check failed',
            timestamp: Date.now(),
          });

          // Create a bug bot for the failure
          await createBugForCheckFailure({
            repoId: String(payload.repository?.id || ''),
            repoName: repoFullName,
            checkRunId: checkRun.id,
            checkName: checkRun.name,
            summary: checkRun.output?.summary || '',
            conclusion,
          });
          break;

        case 'neutral':
        case 'skipped':
          // Neutral/skipped - back to idle
          await mapToAgentState({
            event: 'IDLE',
            repoId: String(payload.repository?.id || ''),
            repoName: repoFullName,
            checkName: checkRun.name,
            conclusion,
            timestamp: Date.now(),
          });
          break;
      }
    }

    inc('webhook_checkrun_processed', {
      action,
      conclusion: checkRun.conclusion || 'none',
      repo: repoFullName,
    });
  } catch (error) {
    console.error('Error processing check run event:', error);
    inc('webhook_checkrun_error', { action: payload.action });
    throw error;
  }
}

async function mapToAgentState(data: {
  event: 'CELEBRATE' | 'ERROR_OCCURRED' | 'IDLE';
  repoId: string;
  repoName: string;
  checkName: string;
  conclusion: string;
  errorSummary?: string;
  timestamp: number;
}): Promise<void> {
  try {
    const { applyTransition } = await import('../../houses/activityStore');

    (applyTransition as any)({
      type: data.event,
      repoId: data.repoId,
      metadata: {
        checkName: data.checkName,
        conclusion: data.conclusion,
        errorSummary: data.errorSummary,
        repoName: data.repoName,
      },
    });

    console.log(`[CheckRun -> Agent] Mapped ${data.event} for ${data.repoName} (${data.checkName})`);
  } catch (error) {
    console.warn('Failed to map check run event to agent state:', error);
  }
}

async function createBugForCheckFailure(data: {
  repoId: string;
  repoName: string;
  checkRunId: number;
  checkName: string;
  summary: string;
  conclusion: string;
}): Promise<void> {
  try {
    const { createBugBot } = await import('../../bugs/service');

    const bugId = `${data.repoName}/check/${data.checkRunId}`;

    await createBugBot({
      id: bugId,
      villageId: '', // Will be resolved by the bug service
      provider: 'github',
      repoId: data.repoId,
      issueId: String(data.checkRunId),
      title: `${data.checkName} - ${data.conclusion}`,
      description: data.summary || `Check run ${data.checkName} ${data.conclusion}`,
      severity: data.conclusion === 'failure' ? 'high' : 'medium',
      x: undefined,
      y: undefined,
    });

    console.log(`[CheckRun -> Bug] Created bug for ${data.checkName} failure`);
    inc('bug_created', { source: 'check_run_failure' });
  } catch (error) {
    console.warn('Failed to create bug for check run failure:', error);
  }
}

export default processCheckRunEvent;
