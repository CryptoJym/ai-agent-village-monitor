import { EventEmitter } from 'node:events';
import { RunnerMode, ProviderId, ProviderAdapter, SessionCommand, RunnerInfo, SessionConfig, SessionRuntimeState, SessionState, WorkspaceRef, ApprovalRequest, UsageMetrics, RepoRef, CheckoutSpec, RunnerEvent, PolicySpec, Capability, DetectionResult, StartSessionArgs, ProviderEvent, DiffSummaryEvent } from '@ai-agent-village-monitor/shared';
export { ApprovalRequest, Capability, CheckoutSpec, PolicySpec, ProviderAdapter, ProviderId, RepoRef, RunnerEvent, RunnerInfo, RunnerMode, SessionCommand, SessionConfig, SessionRuntimeState, SessionState, TaskSpec, UsageMetrics, WorkspaceRef } from '@ai-agent-village-monitor/shared';
import * as xstate from 'xstate';
import { SimpleGit } from 'simple-git';

/**
 * Agent Runner
 * Main orchestrator for the execution plane
 *
 * The Runner is responsible for:
 * - Managing session lifecycle
 * - Connecting to Control Plane
 * - Streaming events
 * - Handling commands
 * - Reporting health/status
 */

/**
 * Runner configuration
 */
type RunnerConfig = {
    /** Unique runner ID */
    runnerId: string;
    /** Deployment mode */
    mode: RunnerMode;
    /** Runner version */
    version: string;
    /** Control Plane WebSocket URL */
    controlPlaneUrl: string;
    /** Authentication token */
    authToken: string;
    /** Maximum concurrent sessions */
    maxSessions: number;
    /** Heartbeat interval in ms */
    heartbeatIntervalMs: number;
    /** Provider adapter factories */
    adapterFactories: Map<ProviderId, () => ProviderAdapter>;
};
/**
 * Runner state
 */
type RunnerState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
/**
 * The Agent Runner - execution plane for AI coding sessions
 */
declare class Runner extends EventEmitter {
    private config;
    private state;
    private sessionManager;
    private eventStream;
    private heartbeatInterval;
    private startedAt;
    constructor(config: RunnerConfig);
    /**
     * Start the runner
     */
    start(): Promise<void>;
    /**
     * Stop the runner
     */
    stop(): Promise<void>;
    /**
     * Handle a command from Control Plane
     */
    handleCommand(command: SessionCommand & {
        sessionId?: string;
    }): Promise<void>;
    /**
     * Get runner info for heartbeat
     */
    getInfo(): RunnerInfo;
    /**
     * Get runner state
     */
    getState(): RunnerState;
    /**
     * Get uptime in milliseconds
     */
    getUptime(): number;
    private handleStartCommand;
    private handleSessionEvent;
    private handleControlPlaneMessage;
    private startHeartbeat;
    private stopHeartbeat;
    private sendHeartbeat;
    private getCapabilities;
}
/**
 * Create a runner instance
 */
declare function createRunner(config: RunnerConfig): Runner;
/**
 * Create a runner with default configuration
 */
declare function createDefaultRunner(controlPlaneUrl: string, authToken: string, adapterFactories: Map<ProviderId, () => ProviderAdapter>): Runner;

/**
 * Session Manager
 * Orchestrates session lifecycle, workspace, PTY, and events
 *
 * This is the main coordinator that:
 * - Creates and manages session state machines
 * - Coordinates workspace creation
 * - Manages PTY processes
 * - Emits runner events
 */

/**
 * Session Manager configuration
 */
type SessionManagerConfig = {
    /** Maximum concurrent sessions */
    maxSessions: number;
    /** Usage tick interval in ms (default: 30000) */
    usageTickIntervalMs: number;
    /** Session timeout in ms (default: 1 hour) */
    sessionTimeoutMs: number;
};
/**
 * Manages all active sessions on this runner
 */
declare class SessionManager extends EventEmitter {
    private sessions;
    private workspaceManager;
    private ptyManager;
    private config;
    private initialized;
    constructor(config?: Partial<SessionManagerConfig>);
    /**
     * Initialize the session manager
     */
    initialize(): Promise<void>;
    /**
     * Start a new session
     */
    startSession(config: SessionConfig): Promise<SessionRuntimeState>;
    /**
     * Set the provider adapter for a session and start it
     */
    setProviderAdapter(sessionId: string, adapter: ProviderAdapter): Promise<void>;
    /**
     * Send input to a session
     */
    sendInput(sessionId: string, data: string): Promise<void>;
    /**
     * Pause a session
     */
    pauseSession(sessionId: string): void;
    /**
     * Resume a paused session
     */
    resumeSession(sessionId: string): void;
    /**
     * Stop a session
     */
    stopSession(sessionId: string, graceful?: boolean): Promise<void>;
    /**
     * Resolve an approval request
     */
    resolveApproval(sessionId: string, approvalId: string, decision: 'allow' | 'deny', note?: string): void;
    /**
     * Get the current state of a session
     */
    getSessionState(sessionId: string): SessionRuntimeState | undefined;
    /**
     * Get all active session IDs
     */
    getActiveSessions(): string[];
    /**
     * Get session count by state
     */
    getSessionStats(): Record<SessionState, number>;
    /**
     * Cleanup and shutdown
     */
    shutdown(): Promise<void>;
    private handlePTYData;
    private handlePTYExit;
    private handleProviderEvent;
    private startUsageTicker;
    private stopUsageTicker;
    private emitUsageTick;
    private emitSessionStarted;
    private emitStateChanged;
    private emitSessionEnded;
    private cleanupSession;
    private nextSeq;
    private emitEvent;
}
declare function getSessionManager(config?: Partial<SessionManagerConfig>): Promise<SessionManager>;

/**
 * Session context - all data associated with a session
 */
type SessionContext = {
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
type SessionMachineEvent = {
    type: 'WORKSPACE_READY';
    workspace: WorkspaceRef;
} | {
    type: 'WORKSPACE_FAILED';
    error: string;
} | {
    type: 'PROVIDER_STARTED';
    pid: number;
    version: string;
} | {
    type: 'PROVIDER_FAILED';
    error: string;
} | {
    type: 'APPROVAL_REQUESTED';
    approval: ApprovalRequest;
} | {
    type: 'APPROVAL_RESOLVED';
    approvalId: string;
    decision: 'allow' | 'deny';
} | {
    type: 'PAUSE';
} | {
    type: 'RESUME';
} | {
    type: 'STOP';
    graceful: boolean;
} | {
    type: 'PROVIDER_EXITED';
    exitCode: number;
} | {
    type: 'ERROR';
    error: string;
} | {
    type: 'USAGE_TICK';
    metrics: Partial<UsageMetrics>;
};
/**
 * Create the session state machine
 */
declare function createSessionMachine(config: SessionConfig): xstate.StateMachine<SessionContext, xstate.AnyEventObject, Record<string, xstate.AnyActorRef>, xstate.ProvidedActor, xstate.ParameterizedObject, xstate.ParameterizedObject, string, xstate.StateValue, string, unknown, xstate.NonReducibleUnknown, xstate.EventObject, xstate.MetaObject, any>;
/**
 * Map XState state values to SessionState type
 */
declare function mapToSessionState(stateValue: string): SessionState;
/**
 * Get session state value from context
 */
declare function getSessionStateFromContext(context: SessionContext, stateValue: string): {
    state: SessionState;
    context: SessionContext;
};

/**
 * Workspace Manager
 * Handles repository cloning, caching, and per-session worktree isolation
 *
 * Per spec section 4.1: Each session runs in a workspace with:
 * - unique directory per session OR git worktree per branch
 * - clean teardown on session end
 * - reusable cached clone to accelerate startups
 * - read-only and write modes
 */

/**
 * Configuration for the workspace manager
 */
type WorkspaceManagerConfig = {
    /** Base directory for all workspaces */
    baseDir: string;
    /** Directory for cached repository clones */
    cacheDir: string;
    /** Whether to enable shallow clones for faster startups */
    shallowClone: boolean;
    /** Maximum cache age in milliseconds before refresh */
    maxCacheAge: number;
    /** Maximum number of cached repos */
    maxCachedRepos: number;
};
/**
 * Manages workspace lifecycle for agent sessions
 */
declare class WorkspaceManager {
    private config;
    private activeWorkspaces;
    constructor(config?: Partial<WorkspaceManagerConfig>);
    /**
     * Initialize the workspace manager
     * Creates necessary directories
     */
    initialize(): Promise<void>;
    /**
     * Create a workspace for a session
     */
    createWorkspace(sessionId: string, repoRef: RepoRef, checkout: CheckoutSpec, options?: {
        roomPath?: string;
        readOnly?: boolean;
        authToken?: string;
    }): Promise<WorkspaceRef>;
    /**
     * Get the workspace for a session
     */
    getWorkspace(sessionId: string): WorkspaceRef | undefined;
    /**
     * Destroy a workspace and clean up resources
     */
    destroyWorkspace(sessionId: string): Promise<void>;
    /**
     * Get the full path to a file in the workspace
     */
    getFilePath(sessionId: string, relativePath: string): string | undefined;
    /**
     * Get the room path within a workspace
     */
    getRoomPath(sessionId: string): string | undefined;
    /**
     * Get a git instance for the workspace
     */
    getGit(sessionId: string): SimpleGit | undefined;
    /**
     * Ensure a cached clone exists for the repository
     */
    private ensureCachedClone;
    /**
     * Create a worktree from the cached clone
     */
    private createWorktree;
    /**
     * Get the cache path for a repository
     */
    private getCachePath;
    /**
     * Get the clone URL for a repository
     */
    private getRepoUrl;
    /**
     * Get the git ref from a checkout spec
     */
    private getCheckoutRef;
    /**
     * Clean up old cached repositories
     */
    pruneCache(): Promise<number>;
    /**
     * Get statistics about active workspaces
     */
    getStats(): {
        activeWorkspaces: number;
        workspaces: Array<{
            sessionId: string;
            repoRef: RepoRef;
            createdAt: number;
        }>;
    };
}
declare function getWorkspaceManager(config?: Partial<WorkspaceManagerConfig>): WorkspaceManager;

/**
 * PTY Manager
 * Manages pseudo-terminal processes for agent sessions
 *
 * Per spec section 4.3: Terminal Streaming
 * - PTY-based spawning
 * - Stream stdout/stderr chunks
 * - Bidirectional input
 * - Exit code tracking
 */

/**
 * PTY spawn options
 */
type PTYSpawnOptions = {
    /** Command to execute */
    command: string;
    /** Command arguments */
    args?: string[];
    /** Working directory */
    cwd: string;
    /** Environment variables */
    env?: Record<string, string>;
    /** Number of columns */
    cols?: number;
    /** Number of rows */
    rows?: number;
    /** Shell to use */
    shell?: string;
};
/**
 * PTY data event
 */
type PTYDataEvent = {
    sessionId: string;
    data: string;
    stream: 'stdout' | 'stderr';
    timestamp: number;
};
/**
 * PTY exit event
 */
type PTYExitEvent = {
    sessionId: string;
    exitCode: number;
    signal?: string;
    timestamp: number;
};
/**
 * Manages PTY processes for terminal streaming
 */
declare class PTYManager extends EventEmitter {
    private sessions;
    private nodePty;
    /**
     * Initialize the PTY manager
     * Dynamically imports node-pty to handle native module loading
     */
    initialize(): Promise<void>;
    /**
     * Spawn a new PTY process
     */
    spawn(sessionId: string, options: PTYSpawnOptions): number;
    /**
     * Send input to a PTY session
     */
    write(sessionId: string, data: string): void;
    /**
     * Resize a PTY session
     */
    resize(sessionId: string, cols: number, rows: number): void;
    /**
     * Kill a PTY session
     */
    kill(sessionId: string, signal?: string): void;
    /**
     * Get the PID of a session
     */
    getPid(sessionId: string): number | undefined;
    /**
     * Check if a session is active
     */
    isActive(sessionId: string): boolean;
    /**
     * Get buffered output for a session
     */
    getBuffer(sessionId: string): string[];
    /**
     * Get session statistics
     */
    getStats(sessionId: string): {
        pid: number;
        startedAt: number;
        cwd: string;
        command: string;
        bufferSize: number;
    } | undefined;
    /**
     * Get all active session IDs
     */
    getActiveSessions(): string[];
    /**
     * Cleanup all sessions
     */
    cleanup(): Promise<void>;
}
declare function getPTYManager(): Promise<PTYManager>;

/**
 * Event Stream
 * Handles streaming runner events to the Control Plane via WebSocket
 *
 * Per spec section 6.4: Runner → Control Plane streaming events
 * - WebSocket multiplexing
 * - Event buffering and retry
 * - Connection management
 */

/**
 * Event stream configuration
 */
type EventStreamConfig = {
    /** Control Plane WebSocket URL */
    controlPlaneUrl: string;
    /** Authentication token */
    authToken: string;
    /** Runner ID */
    runnerId: string;
    /** Reconnect interval in ms */
    reconnectIntervalMs: number;
    /** Max reconnect attempts */
    maxReconnectAttempts: number;
    /** Buffer size for offline events */
    maxBufferSize: number;
    /** Ping interval in ms */
    pingIntervalMs: number;
};
/**
 * Connection state
 */
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
/**
 * Streams runner events to Control Plane
 */
declare class EventStream extends EventEmitter {
    private config;
    private ws;
    private state;
    private buffer;
    private reconnectAttempts;
    private reconnectTimeout;
    private pingInterval;
    constructor(config: EventStreamConfig);
    /**
     * Connect to Control Plane
     */
    connect(): Promise<void>;
    /**
     * Disconnect from Control Plane
     */
    disconnect(): void;
    /**
     * Send an event to Control Plane
     */
    send(event: RunnerEvent): boolean;
    /**
     * Send multiple events
     */
    sendBatch(events: RunnerEvent[]): number;
    /**
     * Get current connection state
     */
    getState(): ConnectionState;
    /**
     * Get buffer size
     */
    getBufferSize(): number;
    /**
     * Clear the event buffer
     */
    clearBuffer(): void;
    private bufferEvent;
    private flushBuffer;
    private handleDisconnect;
    private scheduleReconnect;
    private handleMessage;
    private startPing;
    private stopPing;
}
/**
 * Create an event stream with the session manager
 */
declare function createEventStream(config: EventStreamConfig): EventStream;

/**
 * Policy Enforcer
 * Local safety layer that enforces policies even if agent attempts forbidden actions
 *
 * Per spec section 4.5: Policy Enforcement
 * - Forbidden shell commands
 * - Forbidden filesystem paths
 * - Secret redaction
 * - Network egress policies
 * - No auto-merge unless explicitly enabled
 */

/**
 * Policy violation details
 */
type PolicyViolation = {
    /** Type of violation */
    type: 'shell_command' | 'filesystem_path' | 'secret_detected' | 'network_egress' | 'approval_required';
    /** Description of what was blocked */
    description: string;
    /** The blocked value (command, path, etc.) */
    value: string;
    /** Severity level */
    severity: 'warn' | 'block';
    /** Timestamp */
    timestamp: number;
};
/**
 * Command check result
 */
type CommandCheckResult = {
    allowed: boolean;
    violations: PolicyViolation[];
    sanitizedCommand?: string;
};
/**
 * Enforces policies on agent actions
 */
declare class PolicyEnforcer {
    private policy;
    private violations;
    constructor(policy: PolicySpec);
    /**
     * Check if a shell command is allowed
     */
    checkCommand(command: string): CommandCheckResult;
    /**
     * Check if a filesystem path access is allowed
     */
    checkPath(path: string, operation: 'read' | 'write' | 'delete'): CommandCheckResult;
    /**
     * Redact secrets from text
     */
    redactSecrets(text: string): {
        redacted: string;
        secretsFound: number;
    };
    /**
     * Check if an action requires approval
     */
    requiresApproval(action: 'merge' | 'deps_add' | 'secrets' | 'deploy'): boolean;
    /**
     * Check network egress policy
     */
    checkNetworkEgress(url: string): CommandCheckResult;
    /**
     * Get all violations recorded
     */
    getViolations(): PolicyViolation[];
    /**
     * Get violation count by type
     */
    getViolationStats(): Record<PolicyViolation['type'], number>;
    /**
     * Clear recorded violations
     */
    clearViolations(): void;
    /**
     * Update the policy
     */
    updatePolicy(policy: PolicySpec): void;
    /**
     * Get current policy
     */
    getPolicy(): PolicySpec;
}
/**
 * Create a policy enforcer for a session
 */
declare function createPolicyEnforcer(policy: PolicySpec): PolicyEnforcer;

/**
 * Base Provider Adapter
 * Abstract base class for all provider adapters
 *
 * Provides common functionality:
 * - PTY process management
 * - Event emission
 * - Dynamic flag detection via --help
 * - Filesystem watching for structured events
 */

/**
 * Base adapter configuration
 */
type BaseAdapterConfig = {
    /** Command to run for this provider */
    command: string;
    /** Default arguments */
    defaultArgs?: string[];
    /** Environment variables to set */
    env?: Record<string, string>;
    /** Timeout for detection in ms */
    detectionTimeout?: number;
    /** Working directory */
    cwd?: string;
};
/**
 * Abstract base class for provider adapters
 */
declare abstract class BaseAdapter implements ProviderAdapter {
    abstract readonly id: ProviderId;
    protected config: BaseAdapterConfig;
    protected eventEmitter: EventEmitter;
    protected ptyManager: PTYManager | null;
    protected currentSessionId: string | null;
    protected detectedCapabilities: Capability | null;
    protected detectedVersion: string | null;
    constructor(config: BaseAdapterConfig);
    /**
     * Detect if the provider CLI is installed
     */
    detect(): Promise<DetectionResult>;
    /**
     * Get provider capabilities
     * Subclasses should override to provide accurate capabilities
     */
    capabilities(): Promise<Capability>;
    /**
     * Start a provider session
     */
    startSession(args: StartSessionArgs): Promise<{
        sessionPid: number;
    }>;
    /**
     * Send input to the running session
     */
    sendInput(data: string): Promise<void>;
    /**
     * Stop the running session
     */
    stop(): Promise<void>;
    /**
     * Subscribe to provider events
     */
    onEvent(cb: (evt: ProviderEvent) => void): void;
    /**
     * Unsubscribe from provider events
     */
    offEvent(cb: (evt: ProviderEvent) => void): void;
    /**
     * Build command arguments from session args
     * Subclasses should override for provider-specific args
     */
    protected buildCommandArgs(args: StartSessionArgs): string[];
    /**
     * Parse version from CLI output
     * Subclasses should override for provider-specific parsing
     */
    protected parseVersion(output: string): string | null;
    /**
     * Parse structured events from terminal output
     * Subclasses should override for provider-specific parsing
     */
    protected parseStructuredEvents(data: string): ProviderEvent[];
    /**
     * Emit a provider event
     */
    protected emitEvent(event: ProviderEvent): void;
    private handlePTYData;
    private handlePTYExit;
}

/**
 * Claude Code Adapter
 * Provider adapter for Anthropic's Claude Code CLI
 *
 * Per spec section 7.2: Claude Code Adapter
 * - Strong candidate for "Reviewer" role
 * - May support MCP-based tool access
 * - PTY spawn + help detection + env
 */

/**
 * Claude Code specific configuration
 */
type ClaudeCodeAdapterConfig = Omit<BaseAdapterConfig, 'command'> & {
    /** Custom command path (default: 'claude') */
    command?: string;
    /** Model to use (default: claude-sonnet-4-20250514) */
    model?: string;
    /** API key (if not in env) */
    apiKey?: string;
    /** Enable MCP if available */
    enableMCP?: boolean;
};
/**
 * Adapter for Claude Code CLI
 */
declare class ClaudeCodeAdapter extends BaseAdapter {
    readonly id: ProviderId;
    private claudeConfig;
    private features;
    constructor(config?: ClaudeCodeAdapterConfig);
    /**
     * Get Claude Code capabilities
     */
    capabilities(): Promise<Capability>;
    /**
     * Build Claude Code command arguments
     */
    protected buildCommandArgs(args: StartSessionArgs): string[];
    /**
     * Parse structured events from Claude Code output
     */
    protected parseStructuredEvents(data: string): ProviderEvent[];
    /**
     * Parse version from Claude output
     */
    protected parseVersion(output: string): string | null;
    private detectFeatures;
    private buildPrompt;
    private buildAllowedTools;
    private createToolRequestEvent;
    private detectPatternsFromText;
}
/**
 * Create a Claude Code adapter instance
 */
declare function createClaudeCodeAdapter(config?: ClaudeCodeAdapterConfig): ClaudeCodeAdapter;

/**
 * File Watcher
 * Monitors filesystem changes to generate structured events
 *
 * Per spec section 4.2: Structured events via repo instrumentation
 * Even if the provider doesn't emit structured file events, we can generate them:
 * - Watch filesystem changes
 * - Compute git diff on intervals/milestones
 * - Map files to rooms for sprite movement
 */

/**
 * File change event
 */
type FileChangeEvent = {
    path: string;
    relativePath: string;
    type: 'add' | 'change' | 'unlink';
    timestamp: number;
    roomPath?: string;
};
/**
 * File watcher configuration
 */
type FileWatcherConfig = {
    /** Root path to watch */
    rootPath: string;
    /** Debounce interval in ms */
    debounceMs: number;
    /** Patterns to ignore (glob-like) */
    ignorePatterns: string[];
    /** Maximum depth to watch */
    maxDepth: number;
};
/**
 * Watches filesystem for changes and emits structured events
 */
declare class FileWatcher extends EventEmitter {
    private config;
    private watchers;
    private pendingEvents;
    private debounceTimer;
    private isWatching;
    constructor(config: FileWatcherConfig);
    /**
     * Start watching the filesystem
     */
    start(): Promise<void>;
    /**
     * Stop watching
     */
    stop(): void;
    /**
     * Get files changed since last check
     */
    getChangedFiles(): FileChangeEvent[];
    /**
     * Map a file path to its room path
     */
    getRoomPath(filePath: string): string | undefined;
    private watchDirectory;
    private handleFileEvent;
    private flushEvents;
    private shouldIgnore;
}
/**
 * Create a file watcher for a workspace
 */
declare function createFileWatcher(rootPath: string, options?: Partial<FileWatcherConfig>): FileWatcher;

/**
 * Diff Summarizer
 * Computes git diff summaries to generate structured events
 *
 * Per spec section 4.2: Structured events via repo instrumentation
 * - Compute git diff --name-only on intervals / milestones
 * - Map files to rooms for sprite movement
 */

/**
 * File diff details
 */
type FileDiff = {
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    additions: number;
    deletions: number;
    oldPath?: string;
};
/**
 * Diff summary result
 */
type DiffSummary = {
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
    files: FileDiff[];
};
/**
 * Room summary (files grouped by room)
 */
type RoomSummary = {
    roomPath: string;
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
};
/**
 * Summarizes git diffs for structured event generation
 */
declare class DiffSummarizer {
    private git;
    private rootPath;
    private lastCommit;
    constructor(rootPath: string);
    /**
     * Get diff summary for staged changes
     */
    getStagedDiff(): Promise<DiffSummary>;
    /**
     * Get diff summary for unstaged changes
     */
    getUnstagedDiff(): Promise<DiffSummary>;
    /**
     * Get diff summary for all changes (staged + unstaged)
     */
    getAllChanges(): Promise<DiffSummary>;
    /**
     * Get diff since a specific commit
     */
    getDiffSince(commitSha: string): Promise<DiffSummary>;
    /**
     * Get diff since last check (tracks state)
     */
    getDiffSinceLastCheck(): Promise<DiffSummary | null>;
    /**
     * Get list of changed files (names only)
     */
    getChangedFiles(): Promise<string[]>;
    /**
     * Get diff grouped by room (directory)
     */
    getDiffByRoom(roomDepth?: number): Promise<RoomSummary[]>;
    /**
     * Create a DiffSummaryEvent for the runner
     */
    createDiffEvent(sessionId: string, orgId: string, seq: number): Promise<Omit<DiffSummaryEvent, 'repoRef'> | null>;
    /**
     * Reset tracking state
     */
    reset(): Promise<void>;
    private getCurrentCommit;
    private parseDiffNumstat;
    private getFileRoomPath;
}
/**
 * Create a diff summarizer for a workspace
 */
declare function createDiffSummarizer(rootPath: string): DiffSummarizer;

export { BaseAdapter, type BaseAdapterConfig, ClaudeCodeAdapter, type ClaudeCodeAdapterConfig, type CommandCheckResult, type ConnectionState, DiffSummarizer, type DiffSummary, EventStream, type EventStreamConfig, type FileChangeEvent, type FileDiff, FileWatcher, type FileWatcherConfig, type PTYDataEvent, type PTYExitEvent, PTYManager, type PTYSpawnOptions, PolicyEnforcer, type PolicyViolation, type RoomSummary, Runner, type RunnerConfig, type RunnerState, type SessionContext, type SessionMachineEvent, SessionManager, type SessionManagerConfig, WorkspaceManager, type WorkspaceManagerConfig, createClaudeCodeAdapter, createDefaultRunner, createDiffSummarizer, createEventStream, createFileWatcher, createPolicyEnforcer, createRunner, createSessionMachine, getPTYManager, getSessionManager, getSessionStateFromContext, getWorkspaceManager, mapToSessionState };
