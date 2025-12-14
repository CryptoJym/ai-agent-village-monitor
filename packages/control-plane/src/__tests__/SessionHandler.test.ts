/**
 * SessionHandler Tests
 *
 * Tests for session lifecycle operations in the Control Plane API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionHandler } from '../handlers/SessionHandler';
import type { CreateSessionRequest } from '../types';

describe('SessionHandler', () => {
  let handler: SessionHandler;

  beforeEach(() => {
    handler = new SessionHandler({
      maxSessionsPerOrg: 5,
      defaultTimeoutMinutes: 60,
      sessionDataTtlHours: 24,
    });
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const request: CreateSessionRequest = {
        orgId: 'org-1',
        providerId: 'codex',
        repo: {
          url: 'https://github.com/test/repo',
          branch: 'main',
        },
        task: 'Test task',
      };

      const result = await handler.createSession(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.sessionId).toBeDefined();
      expect(result.data?.orgId).toBe('org-1');
      expect(result.data?.state).toBe('CREATED');
      expect(result.data?.providerId).toBe('codex');
    });

    it('should enforce org session limit', async () => {
      const request: CreateSessionRequest = {
        orgId: 'org-limit',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      };

      // Create sessions up to limit
      for (let i = 0; i < 5; i++) {
        const result = await handler.createSession(request);
        expect(result.success).toBe(true);
      }

      // Try to exceed limit
      const overLimitResult = await handler.createSession(request);
      expect(overLimitResult.success).toBe(false);
      expect(overLimitResult.error?.code).toBe('SESSION_LIMIT_EXCEEDED');
    });

    it('should emit session_created event', async () => {
      const eventHandler = vi.fn();
      handler.on('session_created', eventHandler);

      await handler.createSession({
        orgId: 'org-1',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          providerId: 'codex',
        })
      );
    });

    it('should include request metadata', async () => {
      const result = await handler.createSession({
        orgId: 'org-1',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });

      expect(result.meta).toBeDefined();
      expect(result.meta?.requestId).toBeDefined();
      expect(result.meta?.timestamp).toBeDefined();
    });
  });

  describe('getSession', () => {
    it('should retrieve an existing session', async () => {
      const createResult = await handler.createSession({
        orgId: 'org-1',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
        task: 'Test task',
      });

      const sessionId = createResult.data!.sessionId;
      const result = await handler.getSession(sessionId);

      expect(result.success).toBe(true);
      expect(result.data?.sessionId).toBe(sessionId);
      expect(result.data?.taskSummary).toBe('Test task');
    });

    it('should return error for non-existent session', async () => {
      const result = await handler.getSession('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SESSION_NOT_FOUND');
    });
  });

  describe('listSessions', () => {
    beforeEach(async () => {
      // Create test sessions
      await handler.createSession({
        orgId: 'org-a',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });
      await handler.createSession({
        orgId: 'org-a',
        providerId: 'claude_code',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });
      await handler.createSession({
        orgId: 'org-b',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });
    });

    it('should list sessions for an org', async () => {
      const result = await handler.listSessions('org-a', { page: 1, pageSize: 20 });

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(2);
      expect(result.data?.total).toBe(2);
    });

    it('should filter by provider', async () => {
      const result = await handler.listSessions(
        'org-a',
        { page: 1, pageSize: 20 },
        { providerId: 'codex' }
      );

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.items[0].providerId).toBe('codex');
    });

    it('should paginate results', async () => {
      // Use a handler with higher limit for pagination test
      const paginationHandler = new SessionHandler({
        maxSessionsPerOrg: 20,
        defaultTimeoutMinutes: 60,
        sessionDataTtlHours: 24,
      });

      // Add sessions
      for (let i = 0; i < 10; i++) {
        await paginationHandler.createSession({
          orgId: 'org-paginate',
          providerId: 'codex',
          repo: { url: 'https://github.com/test/repo', branch: 'main' },
        });
      }

      const page1 = await paginationHandler.listSessions('org-paginate', { page: 1, pageSize: 5 });
      const page2 = await paginationHandler.listSessions('org-paginate', { page: 2, pageSize: 5 });

      expect(page1.data?.items).toHaveLength(5);
      expect(page1.data?.hasMore).toBe(true);
      expect(page2.data?.items).toHaveLength(5);
      expect(page2.data?.hasMore).toBe(false);
    });
  });

  describe('stopSession', () => {
    it('should stop a running session', async () => {
      const createResult = await handler.createSession({
        orgId: 'org-1',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });

      const sessionId = createResult.data!.sessionId;

      // First transition to RUNNING
      handler.updateSessionState(sessionId, 'RUNNING');

      const result = await handler.stopSession(sessionId, 'User requested');

      expect(result.success).toBe(true);
      expect(result.data?.state).toBe('COMPLETED');
      expect(result.data?.completedAt).toBeDefined();
    });

    it('should reject stopping already stopped session', async () => {
      const createResult = await handler.createSession({
        orgId: 'org-1',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });

      const sessionId = createResult.data!.sessionId;
      handler.updateSessionState(sessionId, 'RUNNING');
      handler.updateSessionState(sessionId, 'COMPLETED');

      const result = await handler.stopSession(sessionId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SESSION_ALREADY_STOPPED');
    });

    it('should emit session_completed event', async () => {
      const eventHandler = vi.fn();
      handler.on('session_completed', eventHandler);

      const createResult = await handler.createSession({
        orgId: 'org-1',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });

      const sessionId = createResult.data!.sessionId;
      handler.updateSessionState(sessionId, 'RUNNING');
      await handler.stopSession(sessionId);

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('pauseSession', () => {
    it('should pause a running session', async () => {
      const createResult = await handler.createSession({
        orgId: 'org-1',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });

      const sessionId = createResult.data!.sessionId;
      handler.updateSessionState(sessionId, 'RUNNING');

      const result = await handler.pauseSession(sessionId);

      expect(result.success).toBe(true);
      expect(result.data?.state).toBe('PAUSED_BY_HUMAN');
    });

    it('should reject pausing non-running session', async () => {
      const createResult = await handler.createSession({
        orgId: 'org-1',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });

      const result = await handler.pauseSession(createResult.data!.sessionId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_STATE');
    });
  });

  describe('resumeSession', () => {
    it('should resume a paused session', async () => {
      const createResult = await handler.createSession({
        orgId: 'org-1',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });

      const sessionId = createResult.data!.sessionId;
      handler.updateSessionState(sessionId, 'RUNNING');
      await handler.pauseSession(sessionId);

      const result = await handler.resumeSession(sessionId);

      expect(result.success).toBe(true);
      expect(result.data?.state).toBe('RUNNING');
    });

    it('should reject resuming non-paused session', async () => {
      const createResult = await handler.createSession({
        orgId: 'org-1',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });

      const sessionId = createResult.data!.sessionId;
      handler.updateSessionState(sessionId, 'RUNNING');

      const result = await handler.resumeSession(sessionId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_STATE');
    });
  });

  describe('approval workflow', () => {
    it('should request approval', async () => {
      const createResult = await handler.createSession({
        orgId: 'org-1',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });

      const sessionId = createResult.data!.sessionId;
      handler.updateSessionState(sessionId, 'RUNNING');

      const approval = handler.requestApproval(
        sessionId,
        'merge',
        'Merge PR #123',
        { prNumber: 123 }
      );

      expect(approval).toBeDefined();
      expect(approval?.action).toBe('merge');
      expect(approval?.description).toBe('Merge PR #123');

      const session = await handler.getSession(sessionId);
      expect(session.data?.state).toBe('WAITING_FOR_APPROVAL');
      expect(session.data?.pendingApprovals).toHaveLength(1);
    });

    it('should emit approval_requested event', async () => {
      const eventHandler = vi.fn();
      handler.on('approval_requested', eventHandler);

      const createResult = await handler.createSession({
        orgId: 'org-1',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });

      const sessionId = createResult.data!.sessionId;
      handler.updateSessionState(sessionId, 'RUNNING');

      handler.requestApproval(sessionId, 'deploy', 'Deploy to production');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          approval: expect.objectContaining({
            action: 'deploy',
          }),
        })
      );
    });

    it('should resolve approval with allow', async () => {
      const createResult = await handler.createSession({
        orgId: 'org-1',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });

      const sessionId = createResult.data!.sessionId;
      handler.updateSessionState(sessionId, 'RUNNING');

      const approval = handler.requestApproval(sessionId, 'merge', 'Merge PR');

      const result = await handler.resolveApproval(sessionId, {
        approvalId: approval!.approvalId,
        decision: 'allow',
        reason: 'Approved by user',
      });

      expect(result.success).toBe(true);
      expect(result.data?.state).toBe('RUNNING'); // Back to running
      expect(result.data?.pendingApprovals).toHaveLength(0);
    });

    it('should resolve approval with deny', async () => {
      const createResult = await handler.createSession({
        orgId: 'org-1',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });

      const sessionId = createResult.data!.sessionId;
      handler.updateSessionState(sessionId, 'RUNNING');

      const approval = handler.requestApproval(sessionId, 'merge', 'Merge PR');

      const result = await handler.resolveApproval(sessionId, {
        approvalId: approval!.approvalId,
        decision: 'deny',
        reason: 'Not approved',
      });

      expect(result.success).toBe(true);
    });

    it('should emit approval_resolved event', async () => {
      const eventHandler = vi.fn();
      handler.on('approval_resolved', eventHandler);

      const createResult = await handler.createSession({
        orgId: 'org-1',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });

      const sessionId = createResult.data!.sessionId;
      handler.updateSessionState(sessionId, 'RUNNING');

      const approval = handler.requestApproval(sessionId, 'merge', 'Merge PR');

      await handler.resolveApproval(sessionId, {
        approvalId: approval!.approvalId,
        decision: 'allow',
      });

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          decision: 'allow',
        })
      );
    });
  });

  describe('usage tracking', () => {
    it('should update session usage', async () => {
      const createResult = await handler.createSession({
        orgId: 'org-1',
        providerId: 'codex',
        repo: { url: 'https://github.com/test/repo', branch: 'main' },
      });

      const sessionId = createResult.data!.sessionId;

      const success = handler.updateSessionUsage(sessionId, {
        tokensIn: 1000,
        tokensOut: 500,
        apiCalls: 5,
      });

      expect(success).toBe(true);

      const session = await handler.getSession(sessionId);
      expect(session.data?.usage.tokensIn).toBe(1000);
      expect(session.data?.usage.tokensOut).toBe(500);
      expect(session.data?.usage.apiCalls).toBe(5);
    });
  });
});
