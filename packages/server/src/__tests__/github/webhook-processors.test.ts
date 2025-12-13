import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookEvent } from '../../webhooks/github-enhanced';

// Mock dependencies
vi.mock('../../houses/activityStore', () => ({
  applyTransition: vi.fn(),
}));

vi.mock('../../bugs/service', () => ({
  createBugBot: vi.fn(),
  updateBugStatus: vi.fn(),
}));

vi.mock('../../metrics', () => ({
  inc: vi.fn(),
}));

describe('Webhook Processors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Push Event Processor', () => {
    it('should process push event and map to WORK_STARTED', async () => {
      const { default: processPushEvent } = await import('../../webhooks/processors/push');
      const { applyTransition } = await import('../../houses/activityStore');

      const event: WebhookEvent = {
        id: 'delivery-123',
        event: 'push',
        payload: {
          ref: 'refs/heads/main',
          before: 'abc123',
          after: 'def456',
          commits: [
            {
              id: 'commit1',
              message: 'Add feature',
              author: { name: 'Test User', email: 'test@example.com' },
              timestamp: '2024-01-01T00:00:00Z',
            },
          ],
          repository: {
            id: 123,
            name: 'test-repo',
            full_name: 'owner/test-repo',
          },
          pusher: { name: 'Test User', email: 'test@example.com' },
          sender: { login: 'testuser', id: 456 },
        },
        signature: 'sha256=abc',
        deliveryId: 'delivery-123',
        timestamp: Date.now(),
      };

      await processPushEvent(event);

      expect(applyTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'WORK_STARTED',
          repoId: '123',
          metadata: expect.objectContaining({
            branch: 'main',
            commitCount: 1,
            repoName: 'owner/test-repo',
          }),
        }),
      );
    });

    it('should map main branch push to WORK_COMPLETED', async () => {
      const { default: processPushEvent } = await import('../../webhooks/processors/push');
      const { applyTransition } = await import('../../houses/activityStore');

      const event: WebhookEvent = {
        id: 'delivery-124',
        event: 'push',
        payload: {
          ref: 'refs/heads/main',
          commits: [{ id: 'c1', message: 'Fix bug', author: { name: 'Dev' }, timestamp: '2024-01-01' }],
          repository: { id: 123, name: 'repo', full_name: 'owner/repo' },
          pusher: { name: 'Dev', email: 'dev@test.com' },
          sender: { login: 'dev', id: 1 },
        },
        signature: 'sha256=abc',
        deliveryId: 'delivery-124',
        timestamp: Date.now(),
      };

      await processPushEvent(event);

      // Should be called twice: WORK_STARTED and WORK_COMPLETED
      expect(applyTransition).toHaveBeenCalledTimes(2);
      expect(applyTransition).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'WORK_COMPLETED' }),
      );
    });
  });

  describe('Pull Request Event Processor', () => {
    it('should process PR opened event and map to THINKING', async () => {
      const { default: processPullRequestEvent } = await import('../../webhooks/processors/pull-request');
      const { applyTransition } = await import('../../houses/activityStore');

      const event: WebhookEvent = {
        id: 'delivery-125',
        event: 'pull_request',
        action: 'opened',
        payload: {
          action: 'opened',
          number: 42,
          pull_request: {
            id: 789,
            number: 42,
            title: 'Add new feature',
            state: 'open',
            merged: false,
            merged_at: null,
            user: { login: 'contributor', id: 123 },
            head: { ref: 'feature-branch', sha: 'abc' },
            base: { ref: 'main', sha: 'def' },
            draft: false,
          },
          repository: { id: 456, name: 'repo', full_name: 'owner/repo' },
          sender: { login: 'contributor', id: 123 },
        },
        signature: 'sha256=abc',
        deliveryId: 'delivery-125',
        timestamp: Date.now(),
      };

      await processPullRequestEvent(event);

      expect(applyTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'THINKING',
          repoId: '456',
          metadata: expect.objectContaining({
            prNumber: 42,
            prTitle: 'Add new feature',
          }),
        }),
      );
    });

    it('should map merged PR to CELEBRATE', async () => {
      const { default: processPullRequestEvent } = await import('../../webhooks/processors/pull-request');
      const { applyTransition } = await import('../../houses/activityStore');

      const event: WebhookEvent = {
        id: 'delivery-126',
        event: 'pull_request',
        action: 'closed',
        payload: {
          action: 'closed',
          number: 42,
          pull_request: {
            id: 789,
            number: 42,
            title: 'Add feature',
            state: 'closed',
            merged: true,
            merged_at: '2024-01-01T00:00:00Z',
            user: { login: 'dev', id: 1 },
            head: { ref: 'feat', sha: 'a' },
            base: { ref: 'main', sha: 'b' },
            draft: false,
          },
          repository: { id: 456, name: 'repo', full_name: 'owner/repo' },
          sender: { login: 'maintainer', id: 2 },
        },
        signature: 'sha256=abc',
        deliveryId: 'delivery-126',
        timestamp: Date.now(),
      };

      await processPullRequestEvent(event);

      expect(applyTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CELEBRATE',
          metadata: expect.objectContaining({
            prNumber: 42,
            mergedBy: 'maintainer',
          }),
        }),
      );
    });
  });

  describe('Check Run Event Processor', () => {
    it('should process successful check run and map to CELEBRATE', async () => {
      const { default: processCheckRunEvent } = await import('../../webhooks/processors/check-run');
      const { applyTransition } = await import('../../houses/activityStore');

      const event: WebhookEvent = {
        id: 'delivery-127',
        event: 'check_run',
        action: 'completed',
        payload: {
          action: 'completed',
          check_run: {
            id: 999,
            name: 'CI Build',
            status: 'completed',
            conclusion: 'success',
            started_at: '2024-01-01T00:00:00Z',
            completed_at: '2024-01-01T00:05:00Z',
            output: { title: 'Build passed', summary: 'All tests passed', text: null },
            pull_requests: [],
          },
          repository: { id: 123, name: 'repo', full_name: 'owner/repo' },
          sender: { login: 'bot', id: 1 },
        },
        signature: 'sha256=abc',
        deliveryId: 'delivery-127',
        timestamp: Date.now(),
      };

      await processCheckRunEvent(event);

      expect(applyTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CELEBRATE',
          metadata: expect.objectContaining({
            checkName: 'CI Build',
            conclusion: 'success',
          }),
        }),
      );
    });

    it('should process failed check run and create bug', async () => {
      const { default: processCheckRunEvent } = await import('../../webhooks/processors/check-run');
      const { applyTransition } = await import('../../houses/activityStore');
      const { createBugBot } = await import('../../bugs/service');

      const event: WebhookEvent = {
        id: 'delivery-128',
        event: 'check_run',
        action: 'completed',
        payload: {
          action: 'completed',
          check_run: {
            id: 888,
            name: 'Test Suite',
            status: 'completed',
            conclusion: 'failure',
            started_at: '2024-01-01T00:00:00Z',
            completed_at: '2024-01-01T00:05:00Z',
            output: {
              title: 'Tests failed',
              summary: '3 tests failed',
              text: 'Details...',
            },
            pull_requests: [],
          },
          repository: { id: 123, name: 'repo', full_name: 'owner/repo' },
          sender: { login: 'bot', id: 1 },
        },
        signature: 'sha256=abc',
        deliveryId: 'delivery-128',
        timestamp: Date.now(),
      };

      await processCheckRunEvent(event);

      expect(applyTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ERROR_OCCURRED',
          metadata: expect.objectContaining({
            checkName: 'Test Suite',
            conclusion: 'failure',
          }),
        }),
      );

      expect(createBugBot).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'owner/repo/check/888',
          title: 'Test Suite - failure',
          severity: 'high',
        }),
      );
    });
  });

  describe('Issues Event Processor', () => {
    it('should create bug when issue is opened', async () => {
      const { default: processIssuesEvent } = await import('../../webhooks/processors/issues');
      const { createBugBot } = await import('../../bugs/service');

      const event: WebhookEvent = {
        id: 'delivery-129',
        event: 'issues',
        action: 'opened',
        payload: {
          action: 'opened',
          issue: {
            id: 555,
            number: 10,
            title: 'Bug in login',
            body: 'Login fails with error',
            state: 'open',
            user: { login: 'user', id: 1 },
            labels: [{ name: 'bug', color: 'red' }],
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          repository: { id: 123, name: 'repo', full_name: 'owner/repo' },
          sender: { login: 'user', id: 1 },
        },
        signature: 'sha256=abc',
        deliveryId: 'delivery-129',
        timestamp: Date.now(),
      };

      await processIssuesEvent(event);

      expect(createBugBot).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'owner/repo/10',
          issueNumber: 10,
          title: 'Bug in login',
          severity: 'medium',
        }),
      );
    });

    it('should update bug status when issue is closed', async () => {
      const { default: processIssuesEvent } = await import('../../webhooks/processors/issues');
      const { updateBugStatus } = await import('../../bugs/service');

      const event: WebhookEvent = {
        id: 'delivery-130',
        event: 'issues',
        action: 'closed',
        payload: {
          action: 'closed',
          issue: {
            id: 555,
            number: 10,
            title: 'Bug in login',
            body: 'Fixed',
            state: 'closed',
            user: { login: 'user', id: 1 },
            labels: [],
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:10:00Z',
          },
          repository: { id: 123, name: 'repo', full_name: 'owner/repo' },
          sender: { login: 'user', id: 1 },
        },
        signature: 'sha256=abc',
        deliveryId: 'delivery-130',
        timestamp: Date.now(),
      };

      await processIssuesEvent(event);

      expect(updateBugStatus).toHaveBeenCalledWith('owner/repo/10', 'resolved');
    });
  });
});
