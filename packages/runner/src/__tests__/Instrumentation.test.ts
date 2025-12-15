/**
 * Runner instrumentation tests
 *
 * Validates that SessionManager:
 * - passes the runner sessionId down to the provider adapter (PTY correlation)
 * - maps provider "file touched" hints into FILE_TOUCHED runner events
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../session/SessionManager';
import type {
  ProviderAdapter,
  ProviderEvent,
  SessionConfig,
} from '@ai-agent-village-monitor/shared';

// Mock the workspace manager
vi.mock('../workspace/WorkspaceManager', () => ({
  getWorkspaceManager: vi.fn().mockReturnValue({
    initialize: vi.fn().mockResolvedValue(undefined),
    createWorkspace: vi.fn().mockResolvedValue({
      sessionId: 'sess-1',
      worktreePath: '/tmp/workspace/sess-1',
      status: 'ready',
    }),
    getWorkspace: vi.fn().mockReturnValue({
      sessionId: 'sess-1',
      worktreePath: '/tmp/workspace/sess-1',
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
    spawn: vi.fn().mockReturnValue(12345),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    isActive: vi.fn().mockReturnValue(true),
    cleanup: vi.fn().mockResolvedValue(undefined),
  }),
}));

const createSessionConfig = (id: string): SessionConfig => ({
  sessionId: id,
  orgId: 'org-1',
  providerId: 'codex',
  repoRef: { provider: 'github', owner: 'test', name: 'test-repo' },
  checkout: { type: 'branch', ref: 'main' },
  roomPath: `/tmp/room/${id}`,
  task: {
    title: 'Test Task',
    goal: 'Verify instrumentation',
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

describe('SessionManager instrumentation', () => {
  let manager: SessionManager;

  beforeEach(async () => {
    manager = new SessionManager({
      maxSessions: 5,
      usageTickIntervalMs: 60_000,
      sessionTimeoutMs: 60 * 60 * 1000,
    });
    await manager.initialize();
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  it('passes sessionId to adapter.startSession', async () => {
    await manager.startSession(createSessionConfig('sess-1'));

    const startSession = vi.fn().mockResolvedValue({ sessionPid: 123 });
    const detect = vi.fn().mockResolvedValue({ installed: true, version: 'test' });

    const adapter: ProviderAdapter = {
      id: 'codex',
      detect,
      capabilities: vi.fn().mockResolvedValue({
        ptyStreaming: true,
        structuredEdits: 'diff',
        supportsMCP: false,
        supportsNonInteractive: true,
        supportsPlanAndExecute: true,
        supportsPRFlow: 'full',
      }),
      startSession,
      sendInput: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      onEvent: vi.fn(),
      offEvent: vi.fn(),
    };

    await manager.setProviderAdapter('sess-1', adapter);

    expect(startSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-1', repoPath: '/tmp/workspace/sess-1' }),
    );
  });

  it('emits FILE_TOUCHED when provider emits HINT_FILES_TOUCHED', async () => {
    await manager.startSession(createSessionConfig('sess-1'));

    const runnerEvents: any[] = [];
    manager.on('event', (evt) => runnerEvents.push(evt));

    let onEventCb: ((evt: ProviderEvent) => void) | undefined;

    const adapter: ProviderAdapter = {
      id: 'codex',
      detect: vi.fn().mockResolvedValue({ installed: true, version: 'test' }),
      capabilities: vi.fn().mockResolvedValue({
        ptyStreaming: true,
        structuredEdits: 'diff',
        supportsMCP: false,
        supportsNonInteractive: true,
        supportsPlanAndExecute: true,
        supportsPRFlow: 'full',
      }),
      startSession: vi.fn().mockResolvedValue({ sessionPid: 123 }),
      sendInput: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      onEvent: vi.fn((cb) => {
        onEventCb = cb;
      }),
      offEvent: vi.fn(),
    };

    await manager.setProviderAdapter('sess-1', adapter);

    onEventCb?.({
      type: 'HINT_FILES_TOUCHED',
      providerId: 'codex',
      timestamp: Date.now(),
      sessionId: 'sess-1',
      paths: ['packages/server/src/app.ts'],
      operation: 'read',
    });

    expect(
      runnerEvents.some(
        (e) =>
          e.type === 'FILE_TOUCHED' &&
          e.sessionId === 'sess-1' &&
          e.path === 'packages/server/src/app.ts' &&
          e.reason === 'read',
      ),
    ).toBe(true);
  });
});
