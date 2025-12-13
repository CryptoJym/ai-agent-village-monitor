import { describe, it, expect } from 'vitest';
import {
  convertWorkEventToAgentEvents,
  createWorkEventFromGitHub,
  determineErrorSeverity,
  isSuccessEvent,
  createTestWorkEvent,
  type WorkEvent,
} from '../workEventAdapter';

describe('Work Event Adapter', () => {
  describe('Push Events', () => {
    it('should convert single commit to WORK_STARTED and WORK_COMPLETED', () => {
      const event: WorkEvent = createTestWorkEvent('push', 'created', {
        commits: [{ id: '123' }],
      });
      event.metadata!.commitCount = 1;

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(2);
      expect(agentEvents[0]).toEqual({ type: 'WORK_STARTED', task: 'commit' });
      expect(agentEvents[1]).toEqual({ type: 'WORK_COMPLETED', success: true });
    });

    it('should convert multiple commits to batch work events', () => {
      const event: WorkEvent = createTestWorkEvent('push', 'created', {
        commits: [{ id: '1' }, { id: '2' }, { id: '3' }],
      });
      event.metadata!.commitCount = 3;

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(2);
      expect(agentEvents[0].type).toBe('WORK_STARTED');
      expect(agentEvents[0]).toHaveProperty('task', 'batch_commit_3');
    });
  });

  describe('Pull Request Events', () => {
    it('should convert PR opened to work events', () => {
      const event: WorkEvent = createTestWorkEvent('pull_request', 'opened', {
        pull_request: { number: 42 },
      });

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(2);
      expect(agentEvents[0]).toEqual({ type: 'WORK_STARTED', task: 'create_pr' });
      expect(agentEvents[1]).toEqual({ type: 'WORK_COMPLETED', success: true });
    });

    it('should convert merged PR to PR_MERGED event', () => {
      const event: WorkEvent = createTestWorkEvent('pull_request', 'closed', {
        pull_request: { merged: true },
      });

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(1);
      expect(agentEvents[0]).toEqual({ type: 'PR_MERGED' });
    });

    it('should not generate events for closed but not merged PR', () => {
      const event: WorkEvent = createTestWorkEvent('pull_request', 'closed', {
        pull_request: { merged: false },
      });

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(0);
    });

    it('should convert ready_for_review to WORK_COMPLETED', () => {
      const event: WorkEvent = createTestWorkEvent('pull_request', 'ready_for_review');

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(1);
      expect(agentEvents[0]).toEqual({ type: 'WORK_COMPLETED', success: true });
    });
  });

  describe('Check Run Events', () => {
    it('should convert successful check to WORK_COMPLETED', () => {
      const event: WorkEvent = createTestWorkEvent('check_run', 'completed', {
        check_run: { conclusion: 'success' },
      });

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(1);
      expect(agentEvents[0]).toEqual({ type: 'WORK_COMPLETED', success: true });
    });

    it('should convert failed check to BUILD_FAILED', () => {
      const event: WorkEvent = createTestWorkEvent('check_run', 'completed', {
        check_run: { conclusion: 'failure' },
      });

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(1);
      expect(agentEvents[0]).toEqual({ type: 'BUILD_FAILED' });
    });

    it('should convert cancelled check to ERROR_OCCURRED', () => {
      const event: WorkEvent = createTestWorkEvent('check_run', 'completed', {
        check_run: { conclusion: 'cancelled' },
      });

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(1);
      expect(agentEvents[0]).toEqual({ type: 'ERROR_OCCURRED', severity: 'medium' });
    });

    it('should convert timed_out check to ERROR_OCCURRED', () => {
      const event: WorkEvent = createTestWorkEvent('check_run', 'completed', {
        check_run: { conclusion: 'timed_out' },
      });

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(1);
      expect(agentEvents[0]).toEqual({ type: 'ERROR_OCCURRED', severity: 'medium' });
    });
  });

  describe('Workflow Run Events', () => {
    it('should convert successful workflow to WORK_COMPLETED', () => {
      const event: WorkEvent = createTestWorkEvent('workflow_run', 'completed', {
        workflow_run: { conclusion: 'success' },
      });

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(1);
      expect(agentEvents[0]).toEqual({ type: 'WORK_COMPLETED', success: true });
    });

    it('should convert failed workflow to BUILD_FAILED', () => {
      const event: WorkEvent = createTestWorkEvent('workflow_run', 'completed', {
        workflow_run: { conclusion: 'failure' },
      });

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(1);
      expect(agentEvents[0]).toEqual({ type: 'BUILD_FAILED' });
    });

    it('should convert cancelled workflow to ERROR_OCCURRED', () => {
      const event: WorkEvent = createTestWorkEvent('workflow_run', 'completed', {
        workflow_run: { conclusion: 'cancelled' },
      });

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(1);
      expect(agentEvents[0]).toEqual({ type: 'ERROR_OCCURRED', severity: 'low' });
    });
  });

  describe('Issues Events', () => {
    it('should convert issue opened to WORK_STARTED', () => {
      const event: WorkEvent = createTestWorkEvent('issues', 'opened', {
        issue: { number: 10 },
      });

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(1);
      expect(agentEvents[0]).toEqual({ type: 'WORK_STARTED', task: 'triage_issue' });
    });

    it('should convert issue closed to WORK_COMPLETED', () => {
      const event: WorkEvent = createTestWorkEvent('issues', 'closed');

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(1);
      expect(agentEvents[0]).toEqual({ type: 'WORK_COMPLETED', success: true });
    });

    it('should convert issue assigned to WORK_STARTED', () => {
      const event: WorkEvent = createTestWorkEvent('issues', 'assigned');

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(1);
      expect(agentEvents[0]).toEqual({ type: 'WORK_STARTED', task: 'assigned_issue' });
    });
  });

  describe('Milestone Events', () => {
    it('should convert milestone closed to MILESTONE_REACHED', () => {
      const event: WorkEvent = createTestWorkEvent('milestone', 'closed');

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(1);
      expect(agentEvents[0]).toEqual({ type: 'MILESTONE_REACHED' });
    });

    it('should not generate events for milestone created', () => {
      const event: WorkEvent = createTestWorkEvent('milestone', 'created');

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(0);
    });
  });

  describe('Release Events', () => {
    it('should convert release published to MILESTONE_REACHED', () => {
      const event: WorkEvent = createTestWorkEvent('release', 'published');

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(1);
      expect(agentEvents[0]).toEqual({ type: 'MILESTONE_REACHED' });
    });

    it('should convert release released to MILESTONE_REACHED', () => {
      const event: WorkEvent = createTestWorkEvent('release', 'released');

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(1);
      expect(agentEvents[0]).toEqual({ type: 'MILESTONE_REACHED' });
    });
  });

  describe('Unknown Events', () => {
    it('should return empty array for unknown event types', () => {
      const event: WorkEvent = {
        type: 'unknown_event',
        action: 'some_action',
      };

      const agentEvents = convertWorkEventToAgentEvents(event);

      expect(agentEvents).toHaveLength(0);
    });
  });

  describe('Helper Functions', () => {
    describe('createWorkEventFromGitHub', () => {
      it('should create work event from GitHub push payload', () => {
        const payload = {
          commits: [{ id: '1' }, { id: '2' }],
          repository: { name: 'test-repo' },
        };

        const event = createWorkEventFromGitHub('push', payload);

        expect(event.type).toBe('push');
        expect(event.payload).toBe(payload);
        expect(event.metadata?.commitCount).toBe(2);
      });

      it('should create work event from GitHub PR payload', () => {
        const payload = {
          action: 'opened',
          pull_request: { number: 42 },
        };

        const event = createWorkEventFromGitHub('pull_request', payload);

        expect(event.type).toBe('pull_request');
        expect(event.action).toBe('opened');
        expect(event.metadata?.prNumber).toBe(42);
      });

      it('should create work event from GitHub issues payload', () => {
        const payload = {
          action: 'opened',
          issue: { number: 10 },
        };

        const event = createWorkEventFromGitHub('issues', payload);

        expect(event.type).toBe('issues');
        expect(event.metadata?.issueNumber).toBe(10);
      });
    });

    describe('determineErrorSeverity', () => {
      it('should return explicit severity from metadata', () => {
        const event: WorkEvent = {
          type: 'custom',
          metadata: { severity: 'high' },
        };

        expect(determineErrorSeverity(event)).toBe('high');
      });

      it('should infer high severity from check_run failure', () => {
        const event: WorkEvent = createTestWorkEvent('check_run', 'completed', {
          check_run: { conclusion: 'failure' },
        });

        expect(determineErrorSeverity(event)).toBe('high');
      });

      it('should infer medium severity from check_run cancellation', () => {
        const event: WorkEvent = createTestWorkEvent('check_run', 'completed', {
          check_run: { conclusion: 'cancelled' },
        });

        expect(determineErrorSeverity(event)).toBe('medium');
      });

      it('should default to low severity', () => {
        const event: WorkEvent = createTestWorkEvent('push', 'created');

        expect(determineErrorSeverity(event)).toBe('low');
      });
    });

    describe('isSuccessEvent', () => {
      it('should return true for explicit success metadata', () => {
        const event: WorkEvent = {
          type: 'custom',
          metadata: { success: true },
        };

        expect(isSuccessEvent(event)).toBe(true);
      });

      it('should return false for explicit failure metadata', () => {
        const event: WorkEvent = {
          type: 'custom',
          metadata: { success: false },
        };

        expect(isSuccessEvent(event)).toBe(false);
      });

      it('should infer success from merged PR', () => {
        const event: WorkEvent = createTestWorkEvent('pull_request', 'closed', {
          pull_request: { merged: true },
        });

        expect(isSuccessEvent(event)).toBe(true);
      });

      it('should infer failure from closed but not merged PR', () => {
        const event: WorkEvent = createTestWorkEvent('pull_request', 'closed', {
          pull_request: { merged: false },
        });

        expect(isSuccessEvent(event)).toBe(false);
      });

      it('should infer success from successful check_run', () => {
        const event: WorkEvent = createTestWorkEvent('check_run', 'completed', {
          check_run: { conclusion: 'success' },
        });

        expect(isSuccessEvent(event)).toBe(true);
      });

      it('should infer failure from failed workflow_run', () => {
        const event: WorkEvent = createTestWorkEvent('workflow_run', 'completed', {
          workflow_run: { conclusion: 'failure' },
        });

        expect(isSuccessEvent(event)).toBe(false);
      });
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle workflow with multiple events', () => {
      const events: WorkEvent[] = [
        createTestWorkEvent('push', 'created', { commits: [{ id: '1' }] }),
        createTestWorkEvent('check_run', 'completed', { check_run: { conclusion: 'success' } }),
        createTestWorkEvent('pull_request', 'closed', { pull_request: { merged: true } }),
      ];

      events[0].metadata = { commitCount: 1 };

      const allAgentEvents = events.flatMap(convertWorkEventToAgentEvents);

      expect(allAgentEvents.length).toBeGreaterThan(0);
      expect(allAgentEvents.some((e) => e.type === 'PR_MERGED')).toBe(true);
    });

    it('should handle error recovery workflow', () => {
      const events: WorkEvent[] = [
        createTestWorkEvent('check_run', 'completed', { check_run: { conclusion: 'failure' } }),
        createTestWorkEvent('push', 'created', { commits: [{ id: 'fix' }] }),
        createTestWorkEvent('check_run', 'completed', { check_run: { conclusion: 'success' } }),
      ];

      events[1].metadata = { commitCount: 1 };

      const agentEvents = events.flatMap(convertWorkEventToAgentEvents);

      expect(agentEvents.some((e) => e.type === 'BUILD_FAILED')).toBe(true);
      expect(agentEvents.some((e) => e.type === 'WORK_COMPLETED' && e.success)).toBe(true);
    });
  });
});
