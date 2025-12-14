/**
 * Session Handler
 *
 * Handles session lifecycle operations for the Control Plane API.
 */
import { EventEmitter } from 'events';
import type { ProviderId, SessionState } from '@ai-agent-village-monitor/shared';
import type { CreateSessionRequest, SessionSummary, SessionDetail, ResolveApprovalRequest, ApprovalRequest, ApiResponse, PaginatedResponse, PaginationParams } from '../types';
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
export declare class SessionHandler extends EventEmitter {
    private config;
    private sessions;
    private orgSessions;
    constructor(config?: Partial<SessionHandlerConfig>);
    /**
     * Create a new session.
     */
    createSession(request: CreateSessionRequest): Promise<ApiResponse<SessionDetail>>;
    /**
     * Get session by ID.
     */
    getSession(sessionId: string): Promise<ApiResponse<SessionDetail>>;
    /**
     * List sessions with filtering.
     */
    listSessions(orgId: string, pagination: PaginationParams, filters?: {
        state?: SessionState;
        providerId?: ProviderId;
    }): Promise<ApiResponse<PaginatedResponse<SessionSummary>>>;
    /**
     * Stop a session.
     */
    stopSession(sessionId: string, reason?: string): Promise<ApiResponse<SessionDetail>>;
    /**
     * Pause a session.
     */
    pauseSession(sessionId: string): Promise<ApiResponse<SessionDetail>>;
    /**
     * Resume a paused session.
     */
    resumeSession(sessionId: string): Promise<ApiResponse<SessionDetail>>;
    /**
     * Request approval for an action.
     */
    requestApproval(sessionId: string, action: ApprovalRequest['action'], description: string, context?: Record<string, unknown>): ApprovalRequest | null;
    /**
     * Resolve an approval request.
     */
    resolveApproval(sessionId: string, request: ResolveApprovalRequest): Promise<ApiResponse<SessionDetail>>;
    /**
     * Update session state (called by runner).
     */
    updateSessionState(sessionId: string, state: SessionState): boolean;
    /**
     * Update session usage (called by runner).
     */
    updateSessionUsage(sessionId: string, usage: Partial<StoredSession['usage']>): boolean;
    /**
     * Check if state is terminal.
     */
    private isTerminalState;
    /**
     * Convert to session summary.
     */
    private toSessionSummary;
    /**
     * Convert to session detail.
     */
    private toSessionDetail;
}
export default SessionHandler;
//# sourceMappingURL=SessionHandler.d.ts.map