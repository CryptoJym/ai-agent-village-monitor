/**
 * Runner Handler
 *
 * Manages runner registration, health monitoring, and load balancing.
 */
import { EventEmitter } from 'events';
import type { ProviderId } from '@ai-agent-village-monitor/shared';
import type { RegisterRunnerRequest, RunnerInfo, RunnerHeartbeat, ApiResponse, PaginatedResponse, PaginationParams } from '../types';
/** Stored runner data */
interface StoredRunner {
    runnerId: string;
    hostname: string;
    status: RunnerInfo['status'];
    capabilities: {
        providers: ProviderId[];
        maxConcurrentSessions: number;
        features: string[];
    };
    load: {
        activeSessions: number;
        cpuPercent: number;
        memoryPercent: number;
        diskPercent: number;
    };
    runtimeVersions: Record<ProviderId, string>;
    metadata: Record<string, string>;
    registeredAt: Date;
    lastHeartbeat: Date;
    activeSessions: Set<string>;
}
/** Runner handler configuration */
export interface RunnerHandlerConfig {
    /** Heartbeat timeout (ms) - mark offline if no heartbeat */
    heartbeatTimeoutMs: number;
    /** Health check interval (ms) */
    healthCheckIntervalMs: number;
    /** Maximum runners to track */
    maxRunners: number;
    /** Load factor for session assignment (0-1) */
    loadFactor: number;
}
/**
 * RunnerHandler manages runner fleet operations.
 *
 * Emits:
 * - 'runner_registered': When a new runner joins
 * - 'runner_online': When a runner comes online
 * - 'runner_offline': When a runner goes offline
 * - 'runner_draining': When a runner is draining
 * - 'runner_removed': When a runner is removed
 * - 'version_reported': When runner reports runtime versions
 */
export declare class RunnerHandler extends EventEmitter {
    private config;
    private runners;
    private hostToRunner;
    private healthCheckTimer;
    constructor(config?: Partial<RunnerHandlerConfig>);
    /**
     * Start the runner handler.
     */
    start(): void;
    /**
     * Stop the runner handler.
     */
    stop(): void;
    /**
     * Register a new runner.
     */
    registerRunner(request: RegisterRunnerRequest): Promise<ApiResponse<RunnerInfo>>;
    /**
     * Process runner heartbeat.
     */
    processHeartbeat(heartbeat: RunnerHeartbeat): Promise<ApiResponse<void>>;
    /**
     * Get runner by ID.
     */
    getRunner(runnerId: string): Promise<ApiResponse<RunnerInfo>>;
    /**
     * List runners with filtering.
     */
    listRunners(pagination: PaginationParams, filters?: {
        status?: RunnerInfo['status'];
        providerId?: ProviderId;
    }): Promise<ApiResponse<PaginatedResponse<RunnerInfo>>>;
    /**
     * Set runner to draining mode.
     */
    drainRunner(runnerId: string): Promise<ApiResponse<RunnerInfo>>;
    /**
     * Remove a runner.
     */
    removeRunner(runnerId: string): Promise<ApiResponse<void>>;
    /**
     * Select best runner for a new session.
     */
    selectRunner(providerId: ProviderId): StoredRunner | null;
    /**
     * Assign session to runner.
     */
    assignSession(runnerId: string, sessionId: string): boolean;
    /**
     * Release session from runner.
     */
    releaseSession(runnerId: string, sessionId: string): boolean;
    /**
     * Get online runner count.
     */
    getOnlineRunnerCount(): number;
    /**
     * Get total capacity.
     */
    getTotalCapacity(): {
        total: number;
        used: number;
        available: number;
    };
    /**
     * Perform health check on all runners.
     */
    private performHealthCheck;
    /**
     * Convert to runner info.
     */
    private toRunnerInfo;
}
export default RunnerHandler;
//# sourceMappingURL=RunnerHandler.d.ts.map