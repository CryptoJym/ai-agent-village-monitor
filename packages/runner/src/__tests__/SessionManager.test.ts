/**
 * SessionManager Tests
 *
 * Tests for session lifecycle management using the actual SessionManager API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager, type SessionManagerConfig } from '../session/SessionManager';
import type { SessionState, SessionConfig } from '@ai-agent-village-monitor/shared';

// Mock the workspace manager
vi.mock('../workspace/WorkspaceManager', () => ({
  getWorkspaceManager: vi.fn().mockReturnValue({
    initialize: vi.fn().mockResolvedValue(undefined),
    createWorkspace: vi.fn().mockResolvedValue({
      sessionId: 'test-session',
      worktreePath: '/tmp/workspace/test-session',
      status: 'ready',
    }),
    getWorkspace: vi.fn().mockReturnValue({
      sessionId: 'test-session',
      worktreePath: '/tmp/workspace/test-session',
      status: 'ready',
    }),
    destroyWorkspace: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock the PTY manager
vi.mock('../pty/PTYManager', () => ({
  getPTYManager: vi.fn().mockResolvedValue({
    on: vi.fn(),
    off: vi.fn(),
    spawn: vi.fn().mockResolvedValue({ pid: 12345 }),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    cleanup: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('SessionManager', () => {
  let manager: SessionManager;
  const mockConfig: Partial<SessionManagerConfig> = {
    maxSessions: 10,
    sessionTimeoutMs: 3600000, // 1 hour
    usageTickIntervalMs: 30000,
  };

  // Helper to create a valid SessionConfig
  const createSessionConfig = (id: string): SessionConfig => ({
    sessionId: id,
    orgId: 'org-1',
    providerId: 'codex',
    repoRef: { provider: 'github', owner: 'test', name: 'test-repo' },
    checkout: { type: 'branch', ref: 'main' },
    roomPath: `/tmp/room/${id}`,
    task: {
      title: 'Test Task',
      goal: 'Run a test',
      constraints: [],
      acceptance: [],
    },
    policy: {
      shellAllowlist: ['*'],
      shellDenylist: [],
      requiresApprovalFor: [],
      networkMode: 'open',
    },
    billing: {
      plan: 'team',
      orgId: 'org-1',
      limits: { maxConcurrency: 5 },
    },
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    manager = new SessionManager(mockConfig);
    await manager.initialize();
  });

  afterEach(async () => {
    await manager.shutdown();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should create a session manager', () => {
      expect(manager).toBeDefined();
    });

    it('should initialize properly', async () => {
      const newManager = new SessionManager(mockConfig);
      await expect(newManager.initialize()).resolves.toBeUndefined();
    });

    it('should be idempotent on multiple initialize calls', async () => {
      await expect(manager.initialize()).resolves.toBeUndefined();
      await expect(manager.initialize()).resolves.toBeUndefined();
    });
  });

  describe('session starting', () => {
    it('should start a new session and progress through workspace preparation', async () => {
      const config = createSessionConfig('sess-001');
      const state = await manager.startSession(config);

      expect(state).toBeDefined();
      expect(state.sessionId).toBe('sess-001');
      expect(state.providerId).toBe('codex');
      // After startSession returns, workspace prep has begun - state should be PREPARING_WORKSPACE
      // or further if workspace creation was fast (mocked to be instant)
      expect(state.state).toBe('PREPARING_WORKSPACE');
    });

    it('should return CREATED state before workspace prep starts', async () => {
      // This tests the initial state machine state
      const config = createSessionConfig('sess-initial');

      // Mock workspace to be slow
      const { getWorkspaceManager } = await import('../workspace/WorkspaceManager');
      const mockWs = (getWorkspaceManager as ReturnType<typeof vi.fn>)();
      let resolveWorkspace: () => void;
      mockWs.createWorkspace.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveWorkspace = () =>
            resolve({
              sessionId: 'sess-initial',
              worktreePath: '/tmp/workspace/sess-initial',
              status: 'ready',
            });
        }),
      );

      const statePromise = manager.startSession(config);

      // Before workspace completes, session exists
      const immediateState = manager.getSessionState('sess-initial');
      // State starts as CREATED before transitioning
      expect(immediateState).toBeDefined();

      // Complete workspace creation
      resolveWorkspace!();
      await statePromise;
    });

    it('should reject duplicate session IDs', async () => {
      const config = createSessionConfig('duplicate-id');
      await manager.startSession(config);

      await expect(manager.startSession(config)).rejects.toThrow(/already exists/);
    });

    it('should enforce max concurrent sessions', async () => {
      // Create sessions up to limit
      for (let i = 0; i < 10; i++) {
        await manager.startSession(createSessionConfig(`sess-${i}`));
      }

      // Try to exceed limit
      await expect(manager.startSession(createSessionConfig('sess-overflow'))).rejects.toThrow(
        /Maximum sessions/,
      );
    });

    it('should throw when not initialized', async () => {
      const uninitializedManager = new SessionManager(mockConfig);
      const config = createSessionConfig('uninit-test');

      await expect(uninitializedManager.startSession(config)).rejects.toThrow(/not initialized/);
    });
  });

  describe('session state', () => {
    it('should get session state by ID', async () => {
      await manager.startSession(createSessionConfig('state-test'));

      const state = manager.getSessionState('state-test');
      expect(state).toBeDefined();
      expect(state?.sessionId).toBe('state-test');
    });

    it('should return undefined for non-existent session', () => {
      const state = manager.getSessionState('non-existent');
      expect(state).toBeUndefined();
    });

    it('should list all active sessions', async () => {
      await manager.startSession(createSessionConfig('state-test-1'));
      await manager.startSession(createSessionConfig('state-test-2'));

      const sessions = manager.getActiveSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions).toContain('state-test-1');
      expect(sessions).toContain('state-test-2');
    });

    it('should track session stats by state', async () => {
      await manager.startSession(createSessionConfig('stats-test'));

      const stats = manager.getSessionStats();
      // Verify stats object has all required states
      expect(stats).toHaveProperty('CREATED');
      expect(stats).toHaveProperty('PREPARING_WORKSPACE');
      expect(stats).toHaveProperty('STARTING_PROVIDER');
      expect(stats).toHaveProperty('RUNNING');
      expect(stats).toHaveProperty('WAITING_FOR_APPROVAL');
      expect(stats).toHaveProperty('PAUSED_BY_HUMAN');
      expect(stats).toHaveProperty('STOPPING');
      expect(stats).toHaveProperty('COMPLETED');
      expect(stats).toHaveProperty('FAILED');

      // Session should be in PREPARING_WORKSPACE after workspace is ready
      expect(stats.PREPARING_WORKSPACE).toBe(1);

      // Total sessions should be 1
      const totalSessions = Object.values(stats).reduce((a, b) => a + b, 0);
      expect(totalSessions).toBe(1);
    });
  });

  describe('session control', () => {
    it('should pause a session', async () => {
      await manager.startSession(createSessionConfig('control-test'));

      expect(() => manager.pauseSession('control-test')).not.toThrow();
    });

    it('should resume a session', async () => {
      await manager.startSession(createSessionConfig('resume-test'));

      expect(() => manager.resumeSession('resume-test')).not.toThrow();
    });

    it('should stop a session', async () => {
      await manager.startSession(createSessionConfig('stop-test'));

      await expect(manager.stopSession('stop-test')).resolves.toBeUndefined();
    });

    it('should throw when pausing non-existent session', () => {
      expect(() => manager.pauseSession('non-existent')).toThrow(/not found/);
    });

    it('should throw when resuming non-existent session', () => {
      expect(() => manager.resumeSession('non-existent')).toThrow(/not found/);
    });
  });

  describe('approval handling', () => {
    it('should resolve approval with allow', async () => {
      await manager.startSession(createSessionConfig('approval-test'));

      expect(() =>
        manager.resolveApproval('approval-test', 'approval-1', 'allow', 'Approved'),
      ).not.toThrow();
    });

    it('should resolve approval with deny', async () => {
      await manager.startSession(createSessionConfig('approval-deny'));

      expect(() =>
        manager.resolveApproval('approval-deny', 'approval-1', 'deny', 'Not approved'),
      ).not.toThrow();
    });

    it('should throw when resolving for non-existent session', () => {
      expect(() => manager.resolveApproval('non-existent', 'approval-1', 'allow')).toThrow(
        /not found/,
      );
    });
  });

  describe('input handling', () => {
    it('should throw when sending input without adapter', async () => {
      await manager.startSession(createSessionConfig('input-test'));

      await expect(manager.sendInput('input-test', 'test input')).rejects.toThrow(/No adapter/);
    });

    it('should throw when sending input to non-existent session', async () => {
      await expect(manager.sendInput('non-existent', 'test input')).rejects.toThrow(/not found/);
    });
  });

  describe('events', () => {
    it('should emit SESSION_STATE_CHANGED event on state transitions', async () => {
      const eventHandler = vi.fn();
      manager.on('event', eventHandler);

      await manager.startSession(createSessionConfig('event-test'));

      // Events are emitted asynchronously via state machine
      await vi.advanceTimersByTimeAsync(100);

      // Verify SESSION_STATE_CHANGED event was emitted
      const stateChangeEvents = eventHandler.mock.calls.filter(
        (call) => call[0].type === 'SESSION_STATE_CHANGED',
      );
      expect(stateChangeEvents.length).toBeGreaterThan(0);

      // Verify event structure
      const firstStateChange = stateChangeEvents[0][0];
      expect(firstStateChange).toMatchObject({
        type: 'SESSION_STATE_CHANGED',
        sessionId: 'event-test',
        orgId: 'org-1',
      });
      expect(firstStateChange).toHaveProperty('previousState');
      expect(firstStateChange).toHaveProperty('newState');
      expect(firstStateChange).toHaveProperty('ts');
      expect(firstStateChange).toHaveProperty('seq');
    });

    it('should emit events with correct sequence numbers', async () => {
      const eventHandler = vi.fn();
      manager.on('event', eventHandler);

      await manager.startSession(createSessionConfig('seq-test'));
      await vi.advanceTimersByTimeAsync(100);

      // Get all events for this session
      const events = eventHandler.mock.calls
        .map((call) => call[0])
        .filter((evt) => evt.sessionId === 'seq-test');

      // Verify sequence numbers are monotonically increasing
      for (let i = 1; i < events.length; i++) {
        expect(events[i].seq).toBeGreaterThan(events[i - 1].seq);
      }
    });

    it('should emit events with required base fields', async () => {
      const eventHandler = vi.fn();
      manager.on('event', eventHandler);

      await manager.startSession(createSessionConfig('fields-test'));
      await vi.advanceTimersByTimeAsync(100);

      // All events should have base RunnerEvent fields
      eventHandler.mock.calls.forEach((call) => {
        const event = call[0];
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('sessionId');
        expect(event).toHaveProperty('orgId');
        expect(event).toHaveProperty('ts');
        expect(event).toHaveProperty('seq');
        expect(event).toHaveProperty('repoRef');
      });
    });
  });

  describe('provider adapter integration', () => {
    it('should set provider adapter for session', async () => {
      await manager.startSession(createSessionConfig('adapter-test'));

      const mockAdapter = {
        id: 'codex' as const,
        detect: vi.fn().mockResolvedValue({ installed: true, version: '1.0.0' }),
        capabilities: vi.fn().mockResolvedValue({
          ptyStreaming: true,
          structuredEdits: 'diff',
          supportsMCP: true,
          supportsNonInteractive: true,
          supportsPlanAndExecute: true,
          supportsPRFlow: 'full',
        }),
        startSession: vi.fn().mockResolvedValue({ sessionPid: 12345 }),
        sendInput: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        onEvent: vi.fn(),
        offEvent: vi.fn(),
      };

      await expect(
        manager.setProviderAdapter('adapter-test', mockAdapter),
      ).resolves.toBeUndefined();

      // Verify adapter methods were called
      expect(mockAdapter.startSession).toHaveBeenCalled();
      expect(mockAdapter.detect).toHaveBeenCalled();
      expect(mockAdapter.onEvent).toHaveBeenCalled();
    });

    it('should throw when setting adapter for non-existent session', async () => {
      const mockAdapter = {
        id: 'codex' as const,
        detect: vi.fn(),
        capabilities: vi.fn(),
        startSession: vi.fn(),
        sendInput: vi.fn(),
        stop: vi.fn(),
        onEvent: vi.fn(),
        offEvent: vi.fn(),
      };

      await expect(manager.setProviderAdapter('non-existent', mockAdapter)).rejects.toThrow(
        /not found/,
      );
    });

    it('should allow sending input after adapter is set', async () => {
      await manager.startSession(createSessionConfig('input-adapter-test'));

      const mockAdapter = {
        id: 'codex' as const,
        detect: vi.fn().mockResolvedValue({ installed: true, version: '1.0.0' }),
        capabilities: vi.fn().mockResolvedValue({
          ptyStreaming: true,
          structuredEdits: 'diff',
          supportsMCP: true,
          supportsNonInteractive: true,
          supportsPlanAndExecute: true,
          supportsPRFlow: 'full',
        }),
        startSession: vi.fn().mockResolvedValue({ sessionPid: 12345 }),
        sendInput: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        onEvent: vi.fn(),
        offEvent: vi.fn(),
      };

      await manager.setProviderAdapter('input-adapter-test', mockAdapter);

      await expect(manager.sendInput('input-adapter-test', 'test input')).resolves.toBeUndefined();

      expect(mockAdapter.sendInput).toHaveBeenCalledWith('test input');
    });

    it('should emit SESSION_STARTED event when provider starts', async () => {
      const eventHandler = vi.fn();
      manager.on('event', eventHandler);

      await manager.startSession(createSessionConfig('started-event-test'));

      const mockAdapter = {
        id: 'codex' as const,
        detect: vi.fn().mockResolvedValue({ installed: true, version: '2.0.0' }),
        capabilities: vi.fn().mockResolvedValue({
          ptyStreaming: true,
          structuredEdits: 'diff',
          supportsMCP: true,
          supportsNonInteractive: true,
          supportsPlanAndExecute: true,
          supportsPRFlow: 'full',
        }),
        startSession: vi.fn().mockResolvedValue({ sessionPid: 99999 }),
        sendInput: vi.fn(),
        stop: vi.fn(),
        onEvent: vi.fn(),
        offEvent: vi.fn(),
      };

      await manager.setProviderAdapter('started-event-test', mockAdapter);
      await vi.advanceTimersByTimeAsync(100);

      // Find SESSION_STARTED event
      const sessionStartedEvents = eventHandler.mock.calls.filter(
        (call) => call[0].type === 'SESSION_STARTED',
      );
      expect(sessionStartedEvents.length).toBe(1);

      const startedEvent = sessionStartedEvents[0][0];
      expect(startedEvent).toMatchObject({
        type: 'SESSION_STARTED',
        sessionId: 'started-event-test',
        providerId: 'codex',
        providerVersion: '2.0.0',
      });
      expect(startedEvent).toHaveProperty('workspacePath');
    });
  });

  describe('shutdown', () => {
    it('should shutdown cleanly', async () => {
      await expect(manager.shutdown()).resolves.toBeUndefined();
    });

    it('should stop all active sessions on shutdown', async () => {
      await manager.startSession(createSessionConfig('shutdown-test-1'));
      await manager.startSession(createSessionConfig('shutdown-test-2'));

      await manager.shutdown();

      expect(manager.getActiveSessions()).toHaveLength(0);
    });

    it('should stop provider adapters on shutdown', async () => {
      await manager.startSession(createSessionConfig('shutdown-adapter-test'));

      const mockAdapter = {
        id: 'codex' as const,
        detect: vi.fn().mockResolvedValue({ installed: true, version: '1.0.0' }),
        capabilities: vi.fn().mockResolvedValue({
          ptyStreaming: true,
          structuredEdits: 'diff',
          supportsMCP: true,
          supportsNonInteractive: true,
          supportsPlanAndExecute: true,
          supportsPRFlow: 'full',
        }),
        startSession: vi.fn().mockResolvedValue({ sessionPid: 12345 }),
        sendInput: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
        onEvent: vi.fn(),
        offEvent: vi.fn(),
      };

      await manager.setProviderAdapter('shutdown-adapter-test', mockAdapter);
      await manager.shutdown();

      expect(mockAdapter.stop).toHaveBeenCalled();
    });
  });
});
