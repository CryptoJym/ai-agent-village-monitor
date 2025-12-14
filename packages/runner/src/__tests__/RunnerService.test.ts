/**
 * Runner Tests
 *
 * Tests for the main Runner class that orchestrates the execution plane.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Runner, type RunnerConfig, type RunnerState } from '../Runner';
import type { ProviderId, ProviderAdapter } from '@ai-agent-village-monitor/shared';

// Mock the session manager
vi.mock('../session/SessionManager', () => ({
  getSessionManager: vi.fn().mockResolvedValue({
    on: vi.fn(),
    startSession: vi.fn().mockResolvedValue({}),
    setProviderAdapter: vi.fn().mockResolvedValue(undefined),
    sendInput: vi.fn().mockResolvedValue(undefined),
    stopSession: vi.fn().mockResolvedValue(undefined),
    pauseSession: vi.fn(),
    resumeSession: vi.fn(),
    resolveApproval: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
    getActiveSessions: vi.fn().mockReturnValue([]),
  }),
}));

// Mock the event stream
vi.mock('../events/EventStream', () => ({
  createEventStream: vi.fn().mockReturnValue({
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    send: vi.fn(),
  }),
}));

describe('Runner', () => {
  let runner: Runner;

  // Create a mock adapter factory
  const mockAdapterFactory = (): ProviderAdapter => ({
    id: 'codex',
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
  });

  const mockConfig: RunnerConfig = {
    runnerId: 'test-runner-001',
    mode: 'hosted',
    version: '0.1.0',
    controlPlaneUrl: 'ws://localhost:8080',
    authToken: 'test-auth-token',
    maxSessions: 5,
    heartbeatIntervalMs: 30000,
    adapterFactories: new Map<ProviderId, () => ProviderAdapter>([
      ['codex', mockAdapterFactory],
      ['claude_code', mockAdapterFactory],
    ]),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    runner = new Runner(mockConfig);
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should create a runner with config', () => {
      expect(runner).toBeDefined();
      expect(runner.getState()).toBe('stopped');
    });

    it('should start and transition to running state', async () => {
      await runner.start();
      expect(runner.getState()).toBe('running');
    });

    it('should stop and transition to stopped state', async () => {
      await runner.start();
      await runner.stop();
      expect(runner.getState()).toBe('stopped');
    });

    it('should emit stateChange events', async () => {
      const stateHandler = vi.fn();
      runner.on('stateChange', stateHandler);

      await runner.start();
      expect(stateHandler).toHaveBeenCalledWith('starting');
      expect(stateHandler).toHaveBeenCalledWith('running');
    });

    it('should emit started event', async () => {
      const startedHandler = vi.fn();
      runner.on('started', startedHandler);

      await runner.start();
      expect(startedHandler).toHaveBeenCalledTimes(1);
    });

    it('should emit stopped event', async () => {
      const stoppedHandler = vi.fn();
      runner.on('stopped', stoppedHandler);

      await runner.start();
      await runner.stop();
      expect(stoppedHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('state management', () => {
    it('should reject start when not in stopped state', async () => {
      await runner.start();

      await expect(runner.start()).rejects.toThrow(/Cannot start runner in state/);
    });

    it('should not throw on stop when already stopped', async () => {
      await expect(runner.stop()).resolves.toBeUndefined();
    });

    it('should report correct uptime', async () => {
      await runner.start();

      vi.advanceTimersByTime(5000);

      expect(runner.getUptime()).toBe(5000);
    });

    it('should report zero uptime when not started', () => {
      expect(runner.getUptime()).toBe(0);
    });
  });

  describe('runner info', () => {
    beforeEach(async () => {
      await runner.start();
    });

    it('should return runner info', () => {
      const info = runner.getInfo();

      expect(info).toMatchObject({
        runnerId: 'test-runner-001',
        mode: 'hosted',
        version: '0.1.0',
        maxSessions: 5,
      });
    });

    it('should include capabilities', () => {
      const info = runner.getInfo();

      expect(info.capabilities).toContain('pty_streaming');
      expect(info.capabilities).toContain('workspace_isolation');
      expect(info.capabilities).toContain('policy_enforcement');
    });

    it('should list available providers in capabilities', () => {
      const info = runner.getInfo();

      expect(info.capabilities).toContain('codex_provider');
      expect(info.capabilities).toContain('claude_code_provider');
    });

    it('should include provider versions', () => {
      const info = runner.getInfo();

      expect(info.providerVersions).toBeDefined();
      expect(info.providerVersions.codex).toBe('available');
      expect(info.providerVersions.claude_code).toBe('available');
    });
  });

  describe('command handling', () => {
    beforeEach(async () => {
      await runner.start();
    });

    it('should handle START command', async () => {
      await expect(
        runner.handleCommand({
          type: 'START',
          config: {
            sessionId: 'test-session-1',
            orgId: 'org-1',
            providerId: 'codex',
            repoRef: { provider: 'github', owner: 'test', name: 'repo' },
            checkout: { type: 'branch', ref: 'main' },
            roomPath: '/tmp/room',
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
          },
        })
      ).resolves.toBeUndefined();
    });

    it('should require sessionId for INPUT command', async () => {
      await expect(
        runner.handleCommand({
          type: 'INPUT',
          input: { sessionId: 'test-session', data: 'test input', mode: 'raw' },
        })
      ).rejects.toThrow(/Session ID required/);
    });

    it('should handle INPUT command with sessionId', async () => {
      await expect(
        runner.handleCommand({
          type: 'INPUT',
          sessionId: 'test-session',
          input: { sessionId: 'test-session', data: 'test input', mode: 'raw' },
        })
      ).resolves.toBeUndefined();
    });

    it('should require sessionId for STOP command', async () => {
      await expect(
        runner.handleCommand({
          type: 'STOP',
          graceful: true,
        })
      ).rejects.toThrow(/Session ID required/);
    });

    it('should handle STOP command with sessionId', async () => {
      await expect(
        runner.handleCommand({
          type: 'STOP',
          sessionId: 'test-session',
          graceful: true,
        })
      ).resolves.toBeUndefined();
    });

    it('should require sessionId for PAUSE command', async () => {
      await expect(
        runner.handleCommand({
          type: 'PAUSE',
        })
      ).rejects.toThrow(/Session ID required/);
    });

    it('should require sessionId for RESUME command', async () => {
      await expect(
        runner.handleCommand({
          type: 'RESUME',
        })
      ).rejects.toThrow(/Session ID required/);
    });

    it('should require sessionId for APPROVE command', async () => {
      await expect(
        runner.handleCommand({
          type: 'APPROVE',
          approvalId: 'approval-1',
          decision: 'allow',
        })
      ).rejects.toThrow(/Session ID required/);
    });
  });

  describe('heartbeat', () => {
    it('should start heartbeat on runner start', async () => {
      const { createEventStream } = await import('../events/EventStream');
      const mockEventStream = (createEventStream as ReturnType<typeof vi.fn>).mock.results[0]?.value;

      await runner.start();

      // Initial heartbeat should be sent
      expect(mockEventStream?.send).toHaveBeenCalled();
    });
  });
});
