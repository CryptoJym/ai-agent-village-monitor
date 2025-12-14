/**
 * Control Plane Types
 *
 * Defines types for the Control Plane API layer that connects
 * UI/external systems with runners and the update pipeline.
 */
import { z } from 'zod';
// =============================================================================
// ZOD SCHEMAS
// =============================================================================
/** Create session request schema */
export const CreateSessionRequestSchema = z.object({
    orgId: z.string().uuid(),
    repo: z.object({
        url: z.string().url(),
        branch: z.string().optional(),
        commit: z.string().optional(),
    }),
    providerId: z.enum(['codex', 'claude_code', 'gemini_cli']),
    task: z.string().optional(),
    options: z.object({
        dangerouslySkipPermissions: z.boolean().optional(),
        timeoutMinutes: z.number().int().positive().max(120).optional(),
        env: z.record(z.string()).optional(),
    }).optional(),
});
/** Pagination params schema */
export const PaginationParamsSchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
    cursor: z.string().optional(),
});
/** Register runner request schema */
export const RegisterRunnerRequestSchema = z.object({
    hostname: z.string().min(1),
    capabilities: z.object({
        providers: z.array(z.enum(['codex', 'claude_code', 'gemini_cli'])),
        maxConcurrentSessions: z.number().int().positive(),
        features: z.array(z.string()),
    }),
    metadata: z.record(z.string()).optional(),
});
/** Resolve approval request schema */
export const ResolveApprovalRequestSchema = z.object({
    approvalId: z.string().uuid(),
    decision: z.enum(['allow', 'deny']),
    reason: z.string().optional(),
});
/** Org runtime config request schema */
export const OrgRuntimeConfigRequestSchema = z.object({
    channel: z.enum(['stable', 'beta', 'pinned']),
    betaOptIn: z.boolean().optional(),
    autoUpgrade: z.boolean().optional(),
    pinnedBuildId: z.string().optional(),
});
/** Runner heartbeat schema */
export const RunnerHeartbeatSchema = z.object({
    runnerId: z.string().uuid(),
    timestamp: z.string().datetime(),
    activeSessions: z.array(z.string()),
    load: z.object({
        cpuPercent: z.number().min(0).max(100),
        memoryPercent: z.number().min(0).max(100),
        diskPercent: z.number().min(0).max(100),
    }),
    runtimeVersions: z.record(z.string()),
});
/** Approval response schema */
export const ApprovalResponseSchema = z.object({
    approvalId: z.string().uuid(),
    decision: z.enum(['allow', 'deny']),
    reason: z.string().optional(),
});
// =============================================================================
// TYPE GUARDS
// =============================================================================
/** Type guard for WebSocket message */
export function isWsMessage(obj) {
    return (typeof obj === 'object' &&
        obj !== null &&
        'type' in obj &&
        'messageId' in obj &&
        'timestamp' in obj);
}
/** Type guard for terminal input message */
export function isWsTerminalInput(msg) {
    return msg.type === 'terminal_input';
}
/** Type guard for subscribe session message */
export function isWsSubscribeSession(msg) {
    return msg.type === 'subscribe_session';
}
/** Type guard for unsubscribe session message */
export function isWsUnsubscribeSession(msg) {
    return msg.type === 'unsubscribe_session';
}
