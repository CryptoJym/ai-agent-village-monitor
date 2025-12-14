/**
 * Sweep Manager
 *
 * Manages post-update repository improvement sweeps.
 * Never auto-merges - always creates PRs for human review.
 */
import { EventEmitter } from 'events';
import type { SweepConfig, SweepRepoTarget, SweepResult, RunnerBuild } from '../types';
/** Sweep manager configuration */
export interface SweepManagerConfig {
    /** Maximum concurrent sweeps */
    maxConcurrentSweeps: number;
    /** Default rate limit (repos per minute) */
    defaultRateLimit: number;
    /** Default max repos per run */
    defaultMaxReposPerRun: number;
    /** Enable sweep execution */
    enabled: boolean;
}
/** Sweep job status */
export interface SweepJob {
    /** Job identifier */
    jobId: string;
    /** Sweep configuration */
    config: SweepConfig;
    /** Current state */
    state: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    /** Repos completed */
    reposCompleted: number;
    /** Repos remaining */
    reposRemaining: number;
    /** Results collected */
    results: SweepResult[];
    /** Started at */
    startedAt?: Date;
    /** Completed at */
    completedAt?: Date;
    /** Error if failed */
    error?: string;
}
/** Sweep statistics */
export interface SweepStats {
    totalSweeps: number;
    totalReposSwept: number;
    totalPRsCreated: number;
    averageSweptPerRun: number;
    successRate: number;
}
/**
 * SweepManager orchestrates post-update repository sweeps.
 *
 * SAFETY: autoMerge is ALWAYS false. PRs are created for human review.
 *
 * Emits:
 * - 'sweep_started': When a sweep job starts
 * - 'sweep_completed': When a sweep job completes
 * - 'sweep_failed': When a sweep job fails
 * - 'repo_swept': When a single repo is swept
 * - 'pr_created': When a PR is created
 */
export declare class SweepManager extends EventEmitter {
    private config;
    private jobs;
    private activeJobs;
    private stats;
    constructor(config?: Partial<SweepManagerConfig>);
    /**
     * Trigger a sweep for opted-in repos after a build promotion.
     */
    triggerPostUpdateSweep(build: RunnerBuild, repos: SweepRepoTarget[], options?: Partial<Omit<SweepConfig, 'sweepId' | 'triggeredByBuildId' | 'targetRepos' | 'autoMerge'>>): Promise<SweepJob>;
    /**
     * Start a sweep job with the given configuration.
     */
    startSweep(config: SweepConfig): Promise<SweepJob>;
    /**
     * Execute a sweep job.
     */
    private executeSweep;
    /**
     * Sweep a single repository.
     */
    private sweepRepo;
    /**
     * Cancel a running sweep.
     */
    cancelSweep(jobId: string): SweepJob;
    /**
     * Get a sweep job.
     */
    getJob(jobId: string): SweepJob | undefined;
    /**
     * Get all jobs.
     */
    getAllJobs(): SweepJob[];
    /**
     * Get active jobs.
     */
    getActiveJobs(): SweepJob[];
    /**
     * Check if a job has been cancelled.
     */
    private isJobCancelled;
    /**
     * Get sweep statistics.
     */
    getStats(): SweepStats;
    /**
     * Get results for a sweep.
     */
    getSweepResults(sweepId: string): SweepResult[];
    /**
     * Check if manager is accepting new sweeps.
     */
    canAcceptSweep(): boolean;
    /**
     * Enable/disable sweep execution.
     */
    setEnabled(enabled: boolean): void;
    /**
     * Update statistics after a job completes.
     */
    private updateStats;
    /**
     * Delay helper for rate limiting.
     */
    private delay;
}
export default SweepManager;
//# sourceMappingURL=SweepManager.d.ts.map