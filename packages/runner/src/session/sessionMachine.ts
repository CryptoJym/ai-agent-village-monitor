/**
 * Session State Machine
 * XState v5 machine implementing the 9-state session lifecycle
 *
 * Per spec section 4.2: Session Lifecycle
 * States: CREATED → PREPARING_WORKSPACE → STARTING_PROVIDER → RUNNING →
 *         WAITING_FOR_APPROVAL | PAUSED_BY_HUMAN → STOPPING → COMPLETED | FAILED
 */

import { createMachine, assign, type MachineContext } from 'xstate';
import type {
  SessionState,
  SessionConfig,
  WorkspaceRef,
  UsageMetrics,
  ApprovalRequest,
  ProviderId,
} from '@ai-agent-village-monitor/shared';

/**
 * Session context - all data associated with a session
 */
export type SessionContext = {
  /** Session configuration */
  config: SessionConfig;
  /** Workspace reference once created */
  workspace?: WorkspaceRef;
  /** Provider process ID */
  providerPid?: number;
  /** Provider version */
  providerVersion?: string;
  /** Session start timestamp */
  startedAt?: number;
  /** Session end timestamp */
  endedAt?: number;
  /** Current sequence number for events */
  eventSeq: number;
  /** Pending approval requests */
  pendingApprovals: ApprovalRequest[];
  /** Usage metrics accumulated */
  usage: UsageMetrics;
  /** Last error message */
  errorMessage?: string;
  /** Process exit code */
  exitCode?: number;
  /** Pause reason */
  pauseReason?: string;
};

/**
 * Session events
 */
export type SessionMachineEvent =
  | { type: 'WORKSPACE_READY'; workspace: WorkspaceRef }
  | { type: 'WORKSPACE_FAILED'; error: string }
  | { type: 'PROVIDER_STARTED'; pid: number; version: string }
  | { type: 'PROVIDER_FAILED'; error: string }
  | { type: 'APPROVAL_REQUESTED'; approval: ApprovalRequest }
  | { type: 'APPROVAL_RESOLVED'; approvalId: string; decision: 'allow' | 'deny' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP'; graceful: boolean }
  | { type: 'PROVIDER_EXITED'; exitCode: number }
  | { type: 'ERROR'; error: string }
  | { type: 'USAGE_TICK'; metrics: Partial<UsageMetrics> };

/**
 * Create the session state machine
 */
export function createSessionMachine(config: SessionConfig) {
  const initialContext: SessionContext = {
    config,
    eventSeq: 0,
    pendingApprovals: [],
    usage: {
      agentSeconds: 0,
      terminalKb: 0,
      filesTouched: 0,
      commandsRun: 0,
      approvalsRequested: 0,
    },
  };

  return createMachine({
    id: `session-${config.sessionId}`,
    initial: 'created',
    context: initialContext,
    states: {
      created: {
        entry: ['logStateEntry'],
        on: {
          WORKSPACE_READY: {
            target: 'preparingWorkspace',
          },
        },
        after: {
          // Auto-transition to preparing workspace
          0: 'preparingWorkspace',
        },
      },

      preparingWorkspace: {
        entry: ['logStateEntry', 'prepareWorkspace'],
        on: {
          WORKSPACE_READY: {
            target: 'startingProvider',
            actions: assign({
              workspace: ({ event }) => event.workspace,
            }),
          },
          WORKSPACE_FAILED: {
            target: 'failed',
            actions: assign({
              errorMessage: ({ event }) => event.error,
            }),
          },
        },
      },

      startingProvider: {
        entry: ['logStateEntry', 'startProvider'],
        on: {
          PROVIDER_STARTED: {
            target: 'running',
            actions: assign({
              providerPid: ({ event }) => event.pid,
              providerVersion: ({ event }) => event.version,
              startedAt: () => Date.now(),
            }),
          },
          PROVIDER_FAILED: {
            target: 'failed',
            actions: assign({
              errorMessage: ({ event }) => event.error,
            }),
          },
        },
      },

      running: {
        entry: ['logStateEntry', 'startUsageTicker'],
        exit: ['stopUsageTicker'],
        on: {
          APPROVAL_REQUESTED: {
            target: 'waitingForApproval',
            actions: [
              assign({
                pendingApprovals: ({ context, event }) => [
                  ...context.pendingApprovals,
                  event.approval,
                ],
                usage: ({ context }) => ({
                  ...context.usage,
                  approvalsRequested: context.usage.approvalsRequested + 1,
                }),
              }),
            ],
          },
          PAUSE: {
            target: 'pausedByHuman',
            actions: assign({
              pauseReason: () => 'User requested pause',
            }),
          },
          STOP: {
            target: 'stopping',
          },
          PROVIDER_EXITED: {
            target: 'completed',
            actions: assign({
              exitCode: ({ event }) => event.exitCode,
              endedAt: () => Date.now(),
            }),
          },
          ERROR: {
            target: 'failed',
            actions: assign({
              errorMessage: ({ event }) => event.error,
              endedAt: () => Date.now(),
            }),
          },
          USAGE_TICK: {
            actions: assign({
              usage: ({ context, event }) => ({
                agentSeconds: context.usage.agentSeconds + (event.metrics.agentSeconds ?? 0),
                terminalKb: context.usage.terminalKb + (event.metrics.terminalKb ?? 0),
                filesTouched: context.usage.filesTouched + (event.metrics.filesTouched ?? 0),
                commandsRun: context.usage.commandsRun + (event.metrics.commandsRun ?? 0),
                approvalsRequested: context.usage.approvalsRequested,
              }),
              eventSeq: ({ context }) => context.eventSeq + 1,
            }),
          },
        },
      },

      waitingForApproval: {
        entry: ['logStateEntry'],
        on: {
          APPROVAL_RESOLVED: [
            {
              target: 'running',
              guard: ({ context, event }) => {
                const pending = context.pendingApprovals.find(
                  (a) => a.approvalId === event.approvalId
                );
                return pending !== undefined && event.decision === 'allow';
              },
              actions: assign({
                pendingApprovals: ({ context, event }) =>
                  context.pendingApprovals.filter((a) => a.approvalId !== event.approvalId),
              }),
            },
            {
              target: 'stopping',
              guard: ({ event }) => event.decision === 'deny',
              actions: assign({
                errorMessage: () => 'Approval denied by user',
                pendingApprovals: ({ context, event }) =>
                  context.pendingApprovals.filter((a) => a.approvalId !== event.approvalId),
              }),
            },
          ],
          PAUSE: {
            target: 'pausedByHuman',
          },
          STOP: {
            target: 'stopping',
          },
          ERROR: {
            target: 'failed',
            actions: assign({
              errorMessage: ({ event }) => event.error,
            }),
          },
        },
      },

      pausedByHuman: {
        entry: ['logStateEntry'],
        on: {
          RESUME: {
            target: 'running',
            actions: assign({
              pauseReason: () => undefined,
            }),
          },
          STOP: {
            target: 'stopping',
          },
          ERROR: {
            target: 'failed',
            actions: assign({
              errorMessage: ({ event }) => event.error,
            }),
          },
        },
      },

      stopping: {
        entry: ['logStateEntry', 'stopProvider'],
        on: {
          PROVIDER_EXITED: {
            target: 'completed',
            actions: assign({
              exitCode: ({ event }) => event.exitCode,
              endedAt: () => Date.now(),
            }),
          },
          ERROR: {
            target: 'failed',
            actions: assign({
              errorMessage: ({ event }) => event.error,
              endedAt: () => Date.now(),
            }),
          },
        },
        after: {
          // Force kill after timeout
          30000: {
            target: 'completed',
            actions: assign({
              endedAt: () => Date.now(),
            }),
          },
        },
      },

      completed: {
        type: 'final',
        entry: ['logStateEntry', 'cleanupResources', 'emitSessionEnded'],
      },

      failed: {
        type: 'final',
        entry: ['logStateEntry', 'cleanupResources', 'emitSessionEnded'],
      },
    },
  });
}

/**
 * Map XState state values to SessionState type
 */
export function mapToSessionState(stateValue: string): SessionState {
  const mapping: Record<string, SessionState> = {
    created: 'CREATED',
    preparingWorkspace: 'PREPARING_WORKSPACE',
    startingProvider: 'STARTING_PROVIDER',
    running: 'RUNNING',
    waitingForApproval: 'WAITING_FOR_APPROVAL',
    pausedByHuman: 'PAUSED_BY_HUMAN',
    stopping: 'STOPPING',
    completed: 'COMPLETED',
    failed: 'FAILED',
  };

  return mapping[stateValue] ?? 'FAILED';
}

/**
 * Get session state value from context
 */
export function getSessionStateFromContext(context: SessionContext, stateValue: string): {
  state: SessionState;
  context: SessionContext;
} {
  return {
    state: mapToSessionState(stateValue),
    context,
  };
}
