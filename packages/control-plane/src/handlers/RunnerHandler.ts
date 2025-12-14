/**
 * Runner Handler
 *
 * Manages runner registration, health monitoring, and load balancing.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { ProviderId } from '@ai-agent-village-monitor/shared';
import type {
  RegisterRunnerRequest,
  RunnerInfo,
  RunnerHeartbeat,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
} from '../types';

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

const DEFAULT_CONFIG: RunnerHandlerConfig = {
  heartbeatTimeoutMs: 60000, // 1 minute
  healthCheckIntervalMs: 30000, // 30 seconds
  maxRunners: 1000,
  loadFactor: 0.8, // Don't exceed 80% capacity
};

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
export class RunnerHandler extends EventEmitter {
  private config: RunnerHandlerConfig;
  private runners: Map<string, StoredRunner> = new Map();
  private hostToRunner: Map<string, string> = new Map();
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<RunnerHandlerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the runner handler.
   */
  start(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(
      () => this.performHealthCheck(),
      this.config.healthCheckIntervalMs
    );
  }

  /**
   * Stop the runner handler.
   */
  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Register a new runner.
   */
  async registerRunner(request: RegisterRunnerRequest): Promise<ApiResponse<RunnerInfo>> {
    const requestId = uuidv4();

    try {
      // Check if hostname already registered
      const existingId = this.hostToRunner.get(request.hostname);
      if (existingId) {
        // Update existing runner
        const existing = this.runners.get(existingId);
        if (existing) {
          existing.capabilities = request.capabilities;
          existing.metadata = request.metadata ?? {};
          existing.status = 'online';
          existing.lastHeartbeat = new Date();

          this.emit('runner_online', existing);

          return {
            success: true,
            data: this.toRunnerInfo(existing),
            meta: { requestId, timestamp: new Date().toISOString() },
          };
        }
      }

      // Check runner limit
      if (this.runners.size >= this.config.maxRunners) {
        return {
          success: false,
          error: {
            code: 'RUNNER_LIMIT_EXCEEDED',
            message: `Maximum ${this.config.maxRunners} runners allowed`,
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        };
      }

      // Create new runner
      const runnerId = uuidv4();
      const now = new Date();

      const runner: StoredRunner = {
        runnerId,
        hostname: request.hostname,
        status: 'online',
        capabilities: request.capabilities,
        load: {
          activeSessions: 0,
          cpuPercent: 0,
          memoryPercent: 0,
          diskPercent: 0,
        },
        runtimeVersions: {} as Record<ProviderId, string>,
        metadata: request.metadata ?? {},
        registeredAt: now,
        lastHeartbeat: now,
        activeSessions: new Set(),
      };

      this.runners.set(runnerId, runner);
      this.hostToRunner.set(request.hostname, runnerId);

      this.emit('runner_registered', runner);

      return {
        success: true,
        data: this.toRunnerInfo(runner),
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
   * Process runner heartbeat.
   */
  async processHeartbeat(heartbeat: RunnerHeartbeat): Promise<ApiResponse<void>> {
    const requestId = uuidv4();

    const runner = this.runners.get(heartbeat.runnerId);
    if (!runner) {
      return {
        success: false,
        error: {
          code: 'RUNNER_NOT_FOUND',
          message: `Runner ${heartbeat.runnerId} not found`,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
    }

    // Update runner state
    const wasOffline = runner.status === 'offline';
    runner.status = 'online';
    runner.lastHeartbeat = new Date(heartbeat.timestamp);
    runner.load = {
      ...runner.load,
      activeSessions: heartbeat.activeSessions.length,
      cpuPercent: heartbeat.load.cpuPercent,
      memoryPercent: heartbeat.load.memoryPercent,
      diskPercent: heartbeat.load.diskPercent,
    };
    runner.activeSessions = new Set(heartbeat.activeSessions);

    // Update runtime versions
    if (heartbeat.runtimeVersions) {
      const previousVersions = { ...runner.runtimeVersions };
      runner.runtimeVersions = heartbeat.runtimeVersions;

      // Check for version changes
      for (const [providerId, version] of Object.entries(heartbeat.runtimeVersions)) {
        if (previousVersions[providerId as ProviderId] !== version) {
          this.emit('version_reported', {
            runnerId: runner.runnerId,
            providerId,
            version,
            previousVersion: previousVersions[providerId as ProviderId],
          });
        }
      }
    }

    if (wasOffline) {
      this.emit('runner_online', runner);
    }

    return {
      success: true,
      meta: { requestId, timestamp: new Date().toISOString() },
    };
  }

  /**
   * Get runner by ID.
   */
  async getRunner(runnerId: string): Promise<ApiResponse<RunnerInfo>> {
    const requestId = uuidv4();

    const runner = this.runners.get(runnerId);
    if (!runner) {
      return {
        success: false,
        error: {
          code: 'RUNNER_NOT_FOUND',
          message: `Runner ${runnerId} not found`,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
    }

    return {
      success: true,
      data: this.toRunnerInfo(runner),
      meta: { requestId, timestamp: new Date().toISOString() },
    };
  }

  /**
   * List runners with filtering.
   */
  async listRunners(
    pagination: PaginationParams,
    filters?: {
      status?: RunnerInfo['status'];
      providerId?: ProviderId;
    }
  ): Promise<ApiResponse<PaginatedResponse<RunnerInfo>>> {
    const requestId = uuidv4();

    let runners = Array.from(this.runners.values());

    // Apply filters
    if (filters?.status) {
      runners = runners.filter(r => r.status === filters.status);
    }
    if (filters?.providerId) {
      runners = runners.filter(r =>
        r.capabilities.providers.includes(filters.providerId!)
      );
    }

    // Sort by hostname
    runners.sort((a, b) => a.hostname.localeCompare(b.hostname));

    // Paginate
    const page = pagination.page ?? 1;
    const pageSize = pagination.pageSize ?? 20;
    const total = runners.length;
    const start = (page - 1) * pageSize;
    const items = runners.slice(start, start + pageSize);

    return {
      success: true,
      data: {
        items: items.map(r => this.toRunnerInfo(r)),
        total,
        page,
        pageSize,
        hasMore: start + pageSize < total,
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    };
  }

  /**
   * Set runner to draining mode.
   */
  async drainRunner(runnerId: string): Promise<ApiResponse<RunnerInfo>> {
    const requestId = uuidv4();

    const runner = this.runners.get(runnerId);
    if (!runner) {
      return {
        success: false,
        error: {
          code: 'RUNNER_NOT_FOUND',
          message: `Runner ${runnerId} not found`,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
    }

    runner.status = 'draining';
    this.emit('runner_draining', runner);

    return {
      success: true,
      data: this.toRunnerInfo(runner),
      meta: { requestId, timestamp: new Date().toISOString() },
    };
  }

  /**
   * Remove a runner.
   */
  async removeRunner(runnerId: string): Promise<ApiResponse<void>> {
    const requestId = uuidv4();

    const runner = this.runners.get(runnerId);
    if (!runner) {
      return {
        success: false,
        error: {
          code: 'RUNNER_NOT_FOUND',
          message: `Runner ${runnerId} not found`,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
    }

    if (runner.activeSessions.size > 0) {
      return {
        success: false,
        error: {
          code: 'RUNNER_HAS_ACTIVE_SESSIONS',
          message: `Runner has ${runner.activeSessions.size} active sessions`,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
    }

    this.runners.delete(runnerId);
    this.hostToRunner.delete(runner.hostname);

    this.emit('runner_removed', runner);

    return {
      success: true,
      meta: { requestId, timestamp: new Date().toISOString() },
    };
  }

  /**
   * Select best runner for a new session.
   */
  selectRunner(providerId: ProviderId): StoredRunner | null {
    const candidates = Array.from(this.runners.values())
      .filter(r =>
        r.status === 'online' &&
        r.capabilities.providers.includes(providerId) &&
        r.load.activeSessions < r.capabilities.maxConcurrentSessions * this.config.loadFactor
      );

    if (candidates.length === 0) {
      return null;
    }

    // Select runner with lowest load
    candidates.sort((a, b) => {
      const aUtil = a.load.activeSessions / a.capabilities.maxConcurrentSessions;
      const bUtil = b.load.activeSessions / b.capabilities.maxConcurrentSessions;
      return aUtil - bUtil;
    });

    return candidates[0];
  }

  /**
   * Assign session to runner.
   */
  assignSession(runnerId: string, sessionId: string): boolean {
    const runner = this.runners.get(runnerId);
    if (!runner) {
      return false;
    }

    runner.activeSessions.add(sessionId);
    runner.load.activeSessions = runner.activeSessions.size;
    return true;
  }

  /**
   * Release session from runner.
   */
  releaseSession(runnerId: string, sessionId: string): boolean {
    const runner = this.runners.get(runnerId);
    if (!runner) {
      return false;
    }

    runner.activeSessions.delete(sessionId);
    runner.load.activeSessions = runner.activeSessions.size;
    return true;
  }

  /**
   * Get online runner count.
   */
  getOnlineRunnerCount(): number {
    return Array.from(this.runners.values())
      .filter(r => r.status === 'online')
      .length;
  }

  /**
   * Get total capacity.
   */
  getTotalCapacity(): { total: number; used: number; available: number } {
    let total = 0;
    let used = 0;

    for (const runner of this.runners.values()) {
      if (runner.status === 'online') {
        total += runner.capabilities.maxConcurrentSessions;
        used += runner.load.activeSessions;
      }
    }

    return { total, used, available: total - used };
  }

  /**
   * Perform health check on all runners.
   */
  private performHealthCheck(): void {
    const now = Date.now();

    for (const runner of this.runners.values()) {
      if (runner.status === 'offline') {
        continue;
      }

      const timeSinceHeartbeat = now - runner.lastHeartbeat.getTime();

      if (timeSinceHeartbeat > this.config.heartbeatTimeoutMs) {
        runner.status = 'offline';
        this.emit('runner_offline', runner);
      }
    }
  }

  /**
   * Convert to runner info.
   */
  private toRunnerInfo(runner: StoredRunner): RunnerInfo {
    return {
      runnerId: runner.runnerId,
      hostname: runner.hostname,
      status: runner.status,
      lastHeartbeat: runner.lastHeartbeat.toISOString(),
      capabilities: runner.capabilities,
      load: {
        activeSessions: runner.load.activeSessions,
        cpuPercent: runner.load.cpuPercent,
        memoryPercent: runner.load.memoryPercent,
      },
      runtimeVersions: runner.runtimeVersions,
    };
  }
}

export default RunnerHandler;
