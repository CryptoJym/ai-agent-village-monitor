/**
 * Session Handler
 *
 * Handles session lifecycle operations for the Control Plane API.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { ProviderId, SessionState } from '@ai-agent-village-monitor/shared';
import type {
  CreateSessionRequest,
  SessionSummary,
  SessionDetail,
  ResolveApprovalRequest,
  ApprovalRequest,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
} from '../types';

/** Session storage (in production, this would be a database) */
export interface StoredSession {
  sessionId: string;
  orgId: string;
  state: SessionState;
  providerId: ProviderId;
  repo: {
    url: string;
    branch: string;
    commit: string;
  };
  workspace: {
    path: string;
    sizeBytes?: number;
  };
  usage: {
    tokensIn: number;
    tokensOut: number;
    apiCalls: number;
    computeSeconds: number;
  };
  task?: string;
  runnerId?: string;
  startedAt: Date;
  completedAt?: Date;
  pendingApprovals: ApprovalRequest[];
}

/** Session handler configuration */
export interface SessionHandlerConfig {
  /** Maximum sessions per organization */
  maxSessionsPerOrg: number;
  /** Default session timeout (minutes) */
  defaultTimeoutMinutes: number;
  /** Session data TTL after completion (hours) */
  sessionDataTtlHours: number;
}

const DEFAULT_CONFIG: SessionHandlerConfig = {
  maxSessionsPerOrg: 10,
  defaultTimeoutMinutes: 60,
  sessionDataTtlHours: 24,
};

/**
 * SessionHandler manages session CRUD operations.
 *
 * Emits:
 * - 'session_created': When a new session is created
 * - 'session_updated': When session state changes
 * - 'session_completed': When session finishes
 * - 'approval_requested': When approval is needed
 * - 'approval_resolved': When approval decision is made
 */
export class SessionHandler extends EventEmitter {
  private config: SessionHandlerConfig;
  private sessions: Map<string, StoredSession> = new Map();
  private orgSessions: Map<string, Set<string>> = new Map();

  constructor(config: Partial<SessionHandlerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a new session.
   */
  async createSession(request: CreateSessionRequest): Promise<ApiResponse<SessionDetail>> {
    const requestId = uuidv4();

    try {
      // Check org session limit
      const orgSessionIds = this.orgSessions.get(request.orgId) ?? new Set();
      const activeCount = Array.from(orgSessionIds)
        .filter(id => {
          const session = this.sessions.get(id);
          return session && !this.isTerminalState(session.state);
        }).length;

      if (activeCount >= this.config.maxSessionsPerOrg) {
        return {
          success: false,
          error: {
            code: 'SESSION_LIMIT_EXCEEDED',
            message: `Maximum ${this.config.maxSessionsPerOrg} active sessions per organization`,
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        };
      }

      // Create session
      const sessionId = uuidv4();
      const now = new Date();

      const session: StoredSession = {
        sessionId,
        orgId: request.orgId,
        state: 'CREATED',
        providerId: request.providerId,
        repo: {
          url: request.repo.url,
          branch: request.repo.branch ?? 'main',
          commit: request.repo.commit ?? 'HEAD',
        },
        workspace: {
          path: `/workspaces/${sessionId}`,
        },
        usage: {
          tokensIn: 0,
          tokensOut: 0,
          apiCalls: 0,
          computeSeconds: 0,
        },
        task: request.task,
        startedAt: now,
        pendingApprovals: [],
      };

      this.sessions.set(sessionId, session);

      // Track org sessions
      if (!this.orgSessions.has(request.orgId)) {
        this.orgSessions.set(request.orgId, new Set());
      }
      this.orgSessions.get(request.orgId)!.add(sessionId);

      this.emit('session_created', session);

      return {
        success: true,
        data: this.toSessionDetail(session),
        meta: { requestId, timestamp: new Date().toISOString() },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
    }
  }

  /**
   * Get session by ID.
   */
  async getSession(sessionId: string): Promise<ApiResponse<SessionDetail>> {
    const requestId = uuidv4();

    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Session ${sessionId} not found`,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
    }

    return {
      success: true,
      data: this.toSessionDetail(session),
      meta: { requestId, timestamp: new Date().toISOString() },
    };
  }

  /**
   * List sessions with filtering.
   */
  async listSessions(
    orgId: string,
    pagination: PaginationParams,
    filters?: {
      state?: SessionState;
      providerId?: ProviderId;
    }
  ): Promise<ApiResponse<PaginatedResponse<SessionSummary>>> {
    const requestId = uuidv4();

    let sessions = Array.from(this.sessions.values())
      .filter(s => s.orgId === orgId);

    // Apply filters
    if (filters?.state) {
      sessions = sessions.filter(s => s.state === filters.state);
    }
    if (filters?.providerId) {
      sessions = sessions.filter(s => s.providerId === filters.providerId);
    }

    // Sort by start time (newest first)
    sessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    // Paginate
    const page = pagination.page ?? 1;
    const pageSize = pagination.pageSize ?? 20;
    const total = sessions.length;
    const start = (page - 1) * pageSize;
    const items = sessions.slice(start, start + pageSize);

    return {
      success: true,
      data: {
        items: items.map(s => this.toSessionSummary(s)),
        total,
        page,
        pageSize,
        hasMore: start + pageSize < total,
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    };
  }

  /**
   * Stop a session.
   */
  async stopSession(sessionId: string, reason?: string): Promise<ApiResponse<SessionDetail>> {
    const requestId = uuidv4();

    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Session ${sessionId} not found`,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
    }

    if (this.isTerminalState(session.state)) {
      return {
        success: false,
        error: {
          code: 'SESSION_ALREADY_STOPPED',
          message: `Session ${sessionId} is already in terminal state ${session.state}`,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
    }

    // Update state
    session.state = 'COMPLETED';
    session.completedAt = new Date();

    this.emit('session_completed', { session, reason });

    return {
      success: true,
      data: this.toSessionDetail(session),
      meta: { requestId, timestamp: new Date().toISOString() },
    };
  }

  /**
   * Pause a session.
   */
  async pauseSession(sessionId: string): Promise<ApiResponse<SessionDetail>> {
    const requestId = uuidv4();

    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Session ${sessionId} not found`,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
    }

    if (session.state !== 'RUNNING') {
      return {
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: `Cannot pause session in state ${session.state}`,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
    }

    session.state = 'PAUSED_BY_HUMAN';
    this.emit('session_updated', session);

    return {
      success: true,
      data: this.toSessionDetail(session),
      meta: { requestId, timestamp: new Date().toISOString() },
    };
  }

  /**
   * Resume a paused session.
   */
  async resumeSession(sessionId: string): Promise<ApiResponse<SessionDetail>> {
    const requestId = uuidv4();

    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Session ${sessionId} not found`,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
    }

    if (session.state !== 'PAUSED_BY_HUMAN') {
      return {
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: `Cannot resume session in state ${session.state}`,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
    }

    session.state = 'RUNNING';
    this.emit('session_updated', session);

    return {
      success: true,
      data: this.toSessionDetail(session),
      meta: { requestId, timestamp: new Date().toISOString() },
    };
  }

  /**
   * Request approval for an action.
   */
  requestApproval(
    sessionId: string,
    action: ApprovalRequest['action'],
    description: string,
    context?: Record<string, unknown>
  ): ApprovalRequest | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const approval: ApprovalRequest = {
      approvalId: uuidv4(),
      action,
      description,
      requestedAt: new Date().toISOString(),
      context,
    };

    session.pendingApprovals.push(approval);
    session.state = 'WAITING_FOR_APPROVAL';

    this.emit('approval_requested', { sessionId, approval });

    return approval;
  }

  /**
   * Resolve an approval request.
   */
  async resolveApproval(
    sessionId: string,
    request: ResolveApprovalRequest
  ): Promise<ApiResponse<SessionDetail>> {
    const requestId = uuidv4();

    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Session ${sessionId} not found`,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
    }

    const approvalIndex = session.pendingApprovals.findIndex(
      a => a.approvalId === request.approvalId
    );

    if (approvalIndex === -1) {
      return {
        success: false,
        error: {
          code: 'APPROVAL_NOT_FOUND',
          message: `Approval ${request.approvalId} not found`,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
    }

    // Remove from pending
    const [approval] = session.pendingApprovals.splice(approvalIndex, 1);

    // If no more pending approvals, resume session
    if (session.pendingApprovals.length === 0) {
      session.state = 'RUNNING';
    }

    this.emit('approval_resolved', {
      sessionId,
      approval,
      decision: request.decision,
      reason: request.reason,
    });

    return {
      success: true,
      data: this.toSessionDetail(session),
      meta: { requestId, timestamp: new Date().toISOString() },
    };
  }

  /**
   * Update session state (called by runner).
   */
  updateSessionState(sessionId: string, state: SessionState): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.state = state;

    if (this.isTerminalState(state)) {
      session.completedAt = new Date();
      this.emit('session_completed', { session });
    } else {
      this.emit('session_updated', session);
    }

    return true;
  }

  /**
   * Update session usage (called by runner).
   */
  updateSessionUsage(
    sessionId: string,
    usage: Partial<StoredSession['usage']>
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    Object.assign(session.usage, usage);
    return true;
  }

  /**
   * Check if state is terminal.
   */
  private isTerminalState(state: SessionState): boolean {
    return state === 'COMPLETED' || state === 'FAILED';
  }

  /**
   * Convert to session summary.
   */
  private toSessionSummary(session: StoredSession): SessionSummary {
    const durationSeconds = session.completedAt
      ? Math.floor((session.completedAt.getTime() - session.startedAt.getTime()) / 1000)
      : Math.floor((Date.now() - session.startedAt.getTime()) / 1000);

    return {
      sessionId: session.sessionId,
      orgId: session.orgId,
      state: session.state,
      providerId: session.providerId,
      repoUrl: session.repo.url,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString(),
      durationSeconds,
      taskSummary: session.task?.slice(0, 100),
    };
  }

  /**
   * Convert to session detail.
   */
  private toSessionDetail(session: StoredSession): SessionDetail {
    return {
      ...this.toSessionSummary(session),
      repo: session.repo,
      workspace: session.workspace,
      usage: session.usage,
      recentEvents: [], // Would be populated from event log
      pendingApprovals: session.pendingApprovals,
    };
  }
}

export default SessionHandler;
