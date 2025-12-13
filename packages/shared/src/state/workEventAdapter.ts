import type { AgentEvent } from './agentMachine';

/**
 * GitHub Event Types
 * These represent the raw events from GitHub webhooks
 */
export type GitHubEventType =
  | 'push'
  | 'pull_request'
  | 'check_run'
  | 'workflow_run'
  | 'issues'
  | 'commit_comment'
  | 'release'
  | 'milestone';

/**
 * Generic Work Event structure
 * Represents a normalized work event from any provider (GitHub, GitLab, etc.)
 */
export interface WorkEvent {
  type: GitHubEventType | string;
  action?: string;
  payload?: any;
  metadata?: {
    severity?: 'low' | 'medium' | 'high';
    success?: boolean;
    commitCount?: number;
    prNumber?: number;
    issuenumber?: number;
    [key: string]: any;
  };
}

/**
 * Converts GitHub push events to Agent events
 */
function convertPushEvent(event: WorkEvent): AgentEvent[] {
  const events: AgentEvent[] = [];
  const commitCount = event.metadata?.commitCount || 1;

  // Single commit = one work cycle
  if (commitCount === 1) {
    events.push({ type: 'WORK_STARTED', task: 'commit' });
    events.push({ type: 'WORK_COMPLETED', success: true });
  }
  // Multiple commits = higher workload
  else if (commitCount > 1) {
    events.push({ type: 'WORK_STARTED', task: `batch_commit_${commitCount}` });
    events.push({ type: 'WORK_COMPLETED', success: true });
  }

  return events;
}

/**
 * Converts GitHub pull request events to Agent events
 */
function convertPullRequestEvent(event: WorkEvent): AgentEvent[] {
  const events: AgentEvent[] = [];
  const action = event.action;

  switch (action) {
    case 'opened':
      events.push({ type: 'WORK_STARTED', task: 'create_pr' });
      events.push({ type: 'WORK_COMPLETED', success: true });
      break;

    case 'closed':
      if (event.payload?.pull_request?.merged) {
        events.push({ type: 'PR_MERGED' });
      }
      break;

    case 'ready_for_review':
      events.push({ type: 'WORK_COMPLETED', success: true });
      break;

    case 'review_requested':
      events.push({ type: 'WORK_STARTED', task: 'code_review' });
      break;

    default:
      // No conversion for other actions
      break;
  }

  return events;
}

/**
 * Converts GitHub check run events to Agent events
 */
function convertCheckRunEvent(event: WorkEvent): AgentEvent[] {
  const events: AgentEvent[] = [];
  const action = event.action;
  const conclusion = event.payload?.check_run?.conclusion;

  if (action === 'completed') {
    if (conclusion === 'success') {
      events.push({ type: 'WORK_COMPLETED', success: true });
    } else if (conclusion === 'failure') {
      events.push({ type: 'BUILD_FAILED' });
    } else if (conclusion === 'cancelled' || conclusion === 'timed_out') {
      events.push({ type: 'ERROR_OCCURRED', severity: 'medium' });
    }
  }

  return events;
}

/**
 * Converts GitHub workflow run events to Agent events
 */
function convertWorkflowRunEvent(event: WorkEvent): AgentEvent[] {
  const events: AgentEvent[] = [];
  const action = event.action;
  const conclusion = event.payload?.workflow_run?.conclusion;

  if (action === 'completed') {
    if (conclusion === 'success') {
      events.push({ type: 'WORK_COMPLETED', success: true });
    } else if (conclusion === 'failure') {
      events.push({ type: 'BUILD_FAILED' });
    } else if (conclusion === 'cancelled') {
      events.push({ type: 'ERROR_OCCURRED', severity: 'low' });
    }
  }

  return events;
}

/**
 * Converts GitHub issues events to Agent events
 */
function convertIssuesEvent(event: WorkEvent): AgentEvent[] {
  const events: AgentEvent[] = [];
  const action = event.action;

  switch (action) {
    case 'opened':
      events.push({ type: 'WORK_STARTED', task: 'triage_issue' });
      break;

    case 'closed':
      events.push({ type: 'WORK_COMPLETED', success: true });
      break;

    case 'assigned':
      events.push({ type: 'WORK_STARTED', task: 'assigned_issue' });
      break;

    default:
      break;
  }

  return events;
}

/**
 * Converts GitHub milestone events to Agent events
 */
function convertMilestoneEvent(event: WorkEvent): AgentEvent[] {
  const events: AgentEvent[] = [];
  const action = event.action;

  if (action === 'closed') {
    events.push({ type: 'MILESTONE_REACHED' });
  }

  return events;
}

/**
 * Converts GitHub release events to Agent events
 */
function convertReleaseEvent(event: WorkEvent): AgentEvent[] {
  const events: AgentEvent[] = [];
  const action = event.action;

  if (action === 'published' || action === 'released') {
    events.push({ type: 'MILESTONE_REACHED' });
  }

  return events;
}

/**
 * Main conversion function - converts any GitHub event to Agent events
 */
export function convertWorkEventToAgentEvents(event: WorkEvent): AgentEvent[] {
  switch (event.type) {
    case 'push':
      return convertPushEvent(event);

    case 'pull_request':
      return convertPullRequestEvent(event);

    case 'check_run':
      return convertCheckRunEvent(event);

    case 'workflow_run':
      return convertWorkflowRunEvent(event);

    case 'issues':
      return convertIssuesEvent(event);

    case 'milestone':
      return convertMilestoneEvent(event);

    case 'release':
      return convertReleaseEvent(event);

    default:
      // Unknown event type - return empty array
      return [];
  }
}

/**
 * Converts a batch of work events to agent events
 */
export function convertWorkEventBatch(events: WorkEvent[]): AgentEvent[] {
  return events.flatMap(convertWorkEventToAgentEvents);
}

/**
 * Helper: Create a work event from GitHub webhook payload
 */
export function createWorkEventFromGitHub(
  eventType: GitHubEventType,
  payload: any
): WorkEvent {
  const event: WorkEvent = {
    type: eventType,
    action: payload.action,
    payload,
    metadata: {},
  };

  // Extract common metadata
  if (eventType === 'push') {
    event.metadata!.commitCount = payload.commits?.length || 1;
  }

  if (eventType === 'pull_request') {
    event.metadata!.prNumber = payload.pull_request?.number;
  }

  if (eventType === 'issues') {
    event.metadata!.issueNumber = payload.issue?.number;
  }

  return event;
}

/**
 * Helper: Determine error severity based on event details
 */
export function determineErrorSeverity(event: WorkEvent): 'low' | 'medium' | 'high' {
  // Check for explicit severity in metadata
  if (event.metadata?.severity) {
    return event.metadata.severity;
  }

  // Infer severity from event type
  if (event.type === 'check_run' || event.type === 'workflow_run') {
    const conclusion = event.payload?.check_run?.conclusion || event.payload?.workflow_run?.conclusion;

    if (conclusion === 'failure') {
      return 'high';
    } else if (conclusion === 'cancelled' || conclusion === 'timed_out') {
      return 'medium';
    }
  }

  // Default to low severity
  return 'low';
}

/**
 * Helper: Check if a work event represents success
 */
export function isSuccessEvent(event: WorkEvent): boolean {
  if (event.metadata?.success !== undefined) {
    return event.metadata.success;
  }

  // Infer success from event type and action
  if (event.type === 'pull_request' && event.action === 'closed') {
    return event.payload?.pull_request?.merged === true;
  }

  if (event.type === 'check_run' && event.action === 'completed') {
    return event.payload?.check_run?.conclusion === 'success';
  }

  if (event.type === 'workflow_run' && event.action === 'completed') {
    return event.payload?.workflow_run?.conclusion === 'success';
  }

  return false;
}

/**
 * Example usage and testing helper
 */
export function createTestWorkEvent(
  type: GitHubEventType,
  action: string,
  customPayload: any = {}
): WorkEvent {
  return {
    type,
    action,
    payload: customPayload,
    metadata: {},
  };
}
