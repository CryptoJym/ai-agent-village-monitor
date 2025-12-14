/**
 * Control Plane Types
 *
 * Defines types for the Control Plane API layer that connects
 * UI/external systems with runners and the update pipeline.
 */
import { z } from 'zod';
import type { ProviderId, SessionState } from '@ai-agent-village-monitor/shared';
import type { ReleaseChannel } from '@ai-agent-village-monitor/update-pipeline';
/** API error structure */
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
/** API response wrapper */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: ApiError;
    meta?: {
        requestId: string;
        timestamp: string;
        duration?: number;
    };
}
/** Pagination parameters */
export interface PaginationParams {
    page?: number;
    pageSize?: number;
    cursor?: string;
}
/** Paginated response */
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    nextCursor?: string;
}
/** Create session request */
export interface CreateSessionRequest {
    /** Organization ID */
    orgId: string;
    /** Repository to work on */
    repo: {
        url: string;
        branch?: string;
        commit?: string;
    };
    /** Provider to use */
    providerId: ProviderId;
    /** Initial task/prompt */
    task?: string;
    /** Session options */
    options?: {
        /** Use dangerously skip permissions */
        dangerouslySkipPermissions?: boolean;
        /** Timeout in minutes */
        timeoutMinutes?: number;
        /** Custom environment variables */
        env?: Record<string, string>;
    };
}
/** Session summary for list view */
export interface SessionSummary {
    /** Session identifier */
    sessionId: string;
    /** Organization ID */
    orgId: string;
    /** Current state */
    state: SessionState;
    /** Provider being used */
    providerId: ProviderId;
    /** Repository URL */
    repoUrl: string;
    /** Started at */
    startedAt: string;
    /** Completed at (if finished) */
    completedAt?: string;
    /** Duration in seconds */
    durationSeconds?: number;
    /** Current task summary */
    taskSummary?: string;
}
/** Detailed session info */
export interface SessionDetail extends SessionSummary {
    /** Full repository reference */
    repo: {
        url: string;
        branch: string;
        commit: string;
    };
    /** Workspace info */
    workspace: {
        path: string;
        sizeBytes?: number;
    };
    /** Usage metrics */
    usage: {
        tokensIn: number;
        tokensOut: number;
        apiCalls: number;
        computeSeconds: number;
    };
    /** Recent events */
    recentEvents: SessionEventSummary[];
    /** Pending approvals */
    pendingApprovals: ApprovalRequest[];
}
/** Summary of a session event */
export interface SessionEventSummary {
    /** Event type */
    type: string;
    /** Event timestamp */
    timestamp: string;
    /** Brief description */
    summary: string;
}
/** Approval request */
export interface ApprovalRequest {
    /** Approval ID */
    approvalId: string;
    /** Action requiring approval */
    action: 'merge' | 'deps_add' | 'secrets' | 'deploy';
    /** Description */
    description: string;
    /** Requested at */
    requestedAt: string;
    /** Context */
    context?: Record<string, unknown>;
}
/** Resolve approval request */
export interface ResolveApprovalRequest {
    /** Approval ID */
    approvalId: string;
    /** Decision */
    decision: 'allow' | 'deny';
    /** Optional reason */
    reason?: string;
}
/** Session output chunk */
export interface SessionOutput {
    /** Output stream */
    stream: 'stdout' | 'stderr';
    /** Output data */
    data: string;
    /** Timestamp */
    timestamp: string;
}
/** Approval response (result of resolving an approval) */
export interface ApprovalResponse {
    /** Approval ID */
    approvalId: string;
    /** Session ID */
    sessionId: string;
    /** Decision made */
    decision: 'allow' | 'deny';
    /** Reason provided */
    reason?: string;
    /** Resolved at */
    resolvedAt: string;
    /** Resolved by user ID */
    resolvedBy: string;
}
/** Runner registration request */
export interface RegisterRunnerRequest {
    /** Runner hostname/identifier */
    hostname: string;
    /** Runner capabilities */
    capabilities: {
        providers: ProviderId[];
        maxConcurrentSessions: number;
        features: string[];
    };
    /** Runner metadata */
    metadata?: Record<string, string>;
}
/** Runner info */
export interface RunnerInfo {
    /** Runner ID */
    runnerId: string;
    /** Hostname */
    hostname: string;
    /** Status */
    status: 'online' | 'offline' | 'draining' | 'maintenance';
    /** Last heartbeat */
    lastHeartbeat: string;
    /** Capabilities */
    capabilities: {
        providers: ProviderId[];
        maxConcurrentSessions: number;
        features: string[];
    };
    /** Current load */
    load: {
        activeSessions: number;
        cpuPercent: number;
        memoryPercent: number;
    };
    /** Runtime versions */
    runtimeVersions: Record<ProviderId, string>;
}
/** Runner heartbeat */
export interface RunnerHeartbeat {
    /** Runner ID */
    runnerId: string;
    /** Timestamp */
    timestamp: string;
    /** Active sessions */
    activeSessions: string[];
    /** Load metrics */
    load: {
        cpuPercent: number;
        memoryPercent: number;
        diskPercent: number;
    };
    /** Runtime versions (for version tracking) */
    runtimeVersions: Record<ProviderId, string>;
}
/** Version info */
export interface VersionInfo {
    /** Provider ID */
    providerId: ProviderId;
    /** Version string */
    version: string;
    /** Release date */
    releasedAt: string;
    /** Canary status */
    canaryPassed: boolean;
    /** Canary passed date */
    canaryPassedAt?: string;
    /** Source URL */
    sourceUrl?: string;
}
/** Build info */
export interface BuildInfo {
    /** Build ID */
    buildId: string;
    /** Runner version */
    runnerVersion: string;
    /** Built at */
    builtAt: string;
    /** Status */
    status: 'testing' | 'known_good' | 'known_bad' | 'deprecated';
    /** Recommendation */
    recommendation: 'recommended' | 'acceptable' | 'not_recommended' | 'blocked';
    /** Bundled runtime versions */
    runtimeVersions: Record<ProviderId, string>;
}
/** Rollout status */
export interface RolloutStatus {
    /** Rollout ID */
    rolloutId: string;
    /** Target build */
    targetBuildId: string;
    /** Channel */
    channel: ReleaseChannel;
    /** State */
    state: string;
    /** Current percentage */
    currentPercentage: number;
    /** Started at */
    startedAt: string;
    /** Last updated */
    lastUpdatedAt: string;
    /** Affected orgs count */
    affectedOrgsCount: number;
}
/** Initiate rollout request */
export interface InitiateRolloutRequest {
    /** Build ID to roll out */
    buildId: string;
    /** Target channel */
    channel: ReleaseChannel;
}
/** Organization runtime config */
export interface OrgRuntimeConfigRequest {
    /** Channel preference */
    channel: ReleaseChannel;
    /** Beta opt-in */
    betaOptIn?: boolean;
    /** Auto-upgrade */
    autoUpgrade?: boolean;
    /** Pinned build (for pinned channel) */
    pinnedBuildId?: string;
}
/** WebSocket message base - used by both server and handlers */
export interface WebSocketMessage {
    /** Message type */
    type: string;
    /** Timestamp */
    timestamp: string;
}
/** WebSocket session message */
export interface WebSocketSessionMessage extends WebSocketMessage {
    type: 'session';
    sessionId: string;
    action: 'output' | 'state_change' | 'approval_request' | 'completed';
    data: Record<string, unknown>;
}
/** WebSocket terminal message */
export interface WebSocketTerminalMessage extends WebSocketMessage {
    type: 'terminal';
    sessionId: string;
    action: 'output' | 'input' | 'resize';
    data: string;
}
/** WebSocket event message */
export interface WebSocketEventMessage extends WebSocketMessage {
    type: 'event';
    event: string;
    data: Record<string, unknown>;
}
/** WebSocket error message */
export interface WebSocketErrorMessage extends WebSocketMessage {
    type: 'error';
    code: string;
    message: string;
}
/** @deprecated Use WebSocketMessage instead */
export type WsMessage = WebSocketMessage & {
    messageId: string;
};
/** Subscribe to session */
export interface WsSubscribeSession extends WsMessage {
    type: 'subscribe_session';
    sessionId: string;
}
/** Unsubscribe from session */
export interface WsUnsubscribeSession extends WsMessage {
    type: 'unsubscribe_session';
    sessionId: string;
}
/** Session event pushed to client */
export interface WsSessionEvent extends WsMessage {
    type: 'session_event';
    sessionId: string;
    event: {
        eventType: string;
        payload: unknown;
    };
}
/** Terminal data pushed to client */
export interface WsTerminalData extends WsMessage {
    type: 'terminal_data';
    sessionId: string;
    data: string;
}
/** Terminal input from client */
export interface WsTerminalInput extends WsMessage {
    type: 'terminal_input';
    sessionId: string;
    data: string;
}
/** Approval required notification */
export interface WsApprovalRequired extends WsMessage {
    type: 'approval_required';
    sessionId: string;
    approval: ApprovalRequest;
}
/** Runner status update */
export interface WsRunnerStatus extends WsMessage {
    type: 'runner_status';
    runnerId: string;
    status: 'online' | 'offline' | 'draining';
}
/** Create session request schema */
export declare const CreateSessionRequestSchema: z.ZodObject<{
    orgId: z.ZodString;
    repo: z.ZodObject<{
        url: z.ZodString;
        branch: z.ZodOptional<z.ZodString>;
        commit: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        branch?: string | undefined;
        commit?: string | undefined;
    }, {
        url: string;
        branch?: string | undefined;
        commit?: string | undefined;
    }>;
    providerId: z.ZodEnum<["codex", "claude_code", "gemini_cli"]>;
    task: z.ZodOptional<z.ZodString>;
    options: z.ZodOptional<z.ZodObject<{
        dangerouslySkipPermissions: z.ZodOptional<z.ZodBoolean>;
        timeoutMinutes: z.ZodOptional<z.ZodNumber>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        dangerouslySkipPermissions?: boolean | undefined;
        timeoutMinutes?: number | undefined;
        env?: Record<string, string> | undefined;
    }, {
        dangerouslySkipPermissions?: boolean | undefined;
        timeoutMinutes?: number | undefined;
        env?: Record<string, string> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    providerId: "codex" | "claude_code" | "gemini_cli";
    orgId: string;
    repo: {
        url: string;
        branch?: string | undefined;
        commit?: string | undefined;
    };
    options?: {
        dangerouslySkipPermissions?: boolean | undefined;
        timeoutMinutes?: number | undefined;
        env?: Record<string, string> | undefined;
    } | undefined;
    task?: string | undefined;
}, {
    providerId: "codex" | "claude_code" | "gemini_cli";
    orgId: string;
    repo: {
        url: string;
        branch?: string | undefined;
        commit?: string | undefined;
    };
    options?: {
        dangerouslySkipPermissions?: boolean | undefined;
        timeoutMinutes?: number | undefined;
        env?: Record<string, string> | undefined;
    } | undefined;
    task?: string | undefined;
}>;
/** Pagination params schema */
export declare const PaginationParamsSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    pageSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    cursor: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    cursor?: string | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    cursor?: string | undefined;
}>;
/** Register runner request schema */
export declare const RegisterRunnerRequestSchema: z.ZodObject<{
    hostname: z.ZodString;
    capabilities: z.ZodObject<{
        providers: z.ZodArray<z.ZodEnum<["codex", "claude_code", "gemini_cli"]>, "many">;
        maxConcurrentSessions: z.ZodNumber;
        features: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        providers: ("codex" | "claude_code" | "gemini_cli")[];
        maxConcurrentSessions: number;
        features: string[];
    }, {
        providers: ("codex" | "claude_code" | "gemini_cli")[];
        maxConcurrentSessions: number;
        features: string[];
    }>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    hostname: string;
    capabilities: {
        providers: ("codex" | "claude_code" | "gemini_cli")[];
        maxConcurrentSessions: number;
        features: string[];
    };
    metadata?: Record<string, string> | undefined;
}, {
    hostname: string;
    capabilities: {
        providers: ("codex" | "claude_code" | "gemini_cli")[];
        maxConcurrentSessions: number;
        features: string[];
    };
    metadata?: Record<string, string> | undefined;
}>;
/** Resolve approval request schema */
export declare const ResolveApprovalRequestSchema: z.ZodObject<{
    approvalId: z.ZodString;
    decision: z.ZodEnum<["allow", "deny"]>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    approvalId: string;
    decision: "allow" | "deny";
    reason?: string | undefined;
}, {
    approvalId: string;
    decision: "allow" | "deny";
    reason?: string | undefined;
}>;
/** Org runtime config request schema */
export declare const OrgRuntimeConfigRequestSchema: z.ZodObject<{
    channel: z.ZodEnum<["stable", "beta", "pinned"]>;
    betaOptIn: z.ZodOptional<z.ZodBoolean>;
    autoUpgrade: z.ZodOptional<z.ZodBoolean>;
    pinnedBuildId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    channel: "stable" | "beta" | "pinned";
    betaOptIn?: boolean | undefined;
    autoUpgrade?: boolean | undefined;
    pinnedBuildId?: string | undefined;
}, {
    channel: "stable" | "beta" | "pinned";
    betaOptIn?: boolean | undefined;
    autoUpgrade?: boolean | undefined;
    pinnedBuildId?: string | undefined;
}>;
/** Runner heartbeat schema */
export declare const RunnerHeartbeatSchema: z.ZodObject<{
    runnerId: z.ZodString;
    timestamp: z.ZodString;
    activeSessions: z.ZodArray<z.ZodString, "many">;
    load: z.ZodObject<{
        cpuPercent: z.ZodNumber;
        memoryPercent: z.ZodNumber;
        diskPercent: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        cpuPercent: number;
        memoryPercent: number;
        diskPercent: number;
    }, {
        cpuPercent: number;
        memoryPercent: number;
        diskPercent: number;
    }>;
    runtimeVersions: z.ZodRecord<z.ZodString, z.ZodString>;
}, "strip", z.ZodTypeAny, {
    runnerId: string;
    timestamp: string;
    activeSessions: string[];
    load: {
        cpuPercent: number;
        memoryPercent: number;
        diskPercent: number;
    };
    runtimeVersions: Record<string, string>;
}, {
    runnerId: string;
    timestamp: string;
    activeSessions: string[];
    load: {
        cpuPercent: number;
        memoryPercent: number;
        diskPercent: number;
    };
    runtimeVersions: Record<string, string>;
}>;
/** Approval response schema */
export declare const ApprovalResponseSchema: z.ZodObject<{
    approvalId: z.ZodString;
    decision: z.ZodEnum<["allow", "deny"]>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    approvalId: string;
    decision: "allow" | "deny";
    reason?: string | undefined;
}, {
    approvalId: string;
    decision: "allow" | "deny";
    reason?: string | undefined;
}>;
/** Type guard for WebSocket message */
export declare function isWsMessage(obj: unknown): obj is WsMessage;
/** Type guard for terminal input message */
export declare function isWsTerminalInput(msg: WsMessage): msg is WsTerminalInput;
/** Type guard for subscribe session message */
export declare function isWsSubscribeSession(msg: WsMessage): msg is WsSubscribeSession;
/** Type guard for unsubscribe session message */
export declare function isWsUnsubscribeSession(msg: WsMessage): msg is WsUnsubscribeSession;
//# sourceMappingURL=types.d.ts.map