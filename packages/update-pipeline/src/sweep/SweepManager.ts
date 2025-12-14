/**
 * Sweep Manager
 *
 * Manages post-update repository improvement sweeps.
 * Never auto-merges - always creates PRs for human review.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type {
  SweepConfig,
  SweepRepoTarget,
  SweepResult,
  RunnerBuild,
} from '../types';

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

const DEFAULT_CONFIG: SweepManagerConfig = {
  maxConcurrentSweeps: 3,
  defaultRateLimit: 10,
  defaultMaxReposPerRun: 100,
  enabled: true,
};

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
export class SweepManager extends EventEmitter {
  private config: SweepManagerConfig;
  private jobs: Map<string, SweepJob> = new Map();
  private activeJobs: Set<string> = new Set();
  private stats: SweepStats = {
    totalSweeps: 0,
    totalReposSwept: 0,
    totalPRsCreated: 0,
    averageSweptPerRun: 0,
    successRate: 1,
  };

  constructor(config: Partial<SweepManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Trigger a sweep for opted-in repos after a build promotion.
   */
  async triggerPostUpdateSweep(
    build: RunnerBuild,
    repos: SweepRepoTarget[],
    options: Partial<Omit<SweepConfig, 'sweepId' | 'triggeredByBuildId' | 'targetRepos' | 'autoMerge'>> = {}
  ): Promise<SweepJob> {
    if (!this.config.enabled) {
      throw new Error('Sweep manager is disabled');
    }

    // Filter to opted-in repos
    const optedInRepos = repos.filter(r => r.optedIn);

    if (optedInRepos.length === 0) {
      throw new Error('No opted-in repos to sweep');
    }

    // Create sweep config (autoMerge ALWAYS false)
    const sweepConfig: SweepConfig = {
      sweepId: uuidv4(),
      triggeredByBuildId: build.buildId,
      targetRepos: optedInRepos,
      sweepType: options.sweepType ?? 'maintenance',
      createPRs: options.createPRs ?? true,
      autoMerge: false, // NEVER auto-merge
      priority: options.priority ?? 'normal',
      maxReposPerRun: options.maxReposPerRun ?? this.config.defaultMaxReposPerRun,
      rateLimit: options.rateLimit ?? this.config.defaultRateLimit,
    };

    return this.startSweep(sweepConfig);
  }

  /**
   * Start a sweep job with the given configuration.
   */
  async startSweep(config: SweepConfig): Promise<SweepJob> {
    // Check concurrent limit
    if (this.activeJobs.size >= this.config.maxConcurrentSweeps) {
      throw new Error(
        `Maximum concurrent sweeps (${this.config.maxConcurrentSweeps}) reached`
      );
    }

    // Create job
    const jobId = uuidv4();
    const job: SweepJob = {
      jobId,
      config,
      state: 'pending',
      reposCompleted: 0,
      reposRemaining: Math.min(config.targetRepos.length, config.maxReposPerRun),
      results: [],
    };

    this.jobs.set(jobId, job);

    // Start execution
    void this.executeSweep(job);

    return job;
  }

  /**
   * Execute a sweep job.
   */
  private async executeSweep(job: SweepJob): Promise<void> {
    job.state = 'running';
    job.startedAt = new Date();
    this.activeJobs.add(job.jobId);

    this.emit('sweep_started', {
      jobId: job.jobId,
      sweepId: job.config.sweepId,
      repoCount: job.reposRemaining,
      timestamp: job.startedAt,
    });

    try {
      const repos = job.config.targetRepos.slice(0, job.config.maxReposPerRun);
      const delayMs = 60000 / job.config.rateLimit; // Time between repos

      for (const repo of repos) {
        // Re-check state as it may be cancelled externally
        if (this.isJobCancelled(job.jobId)) {
          job.state = 'cancelled';
          break;
        }

        try {
          const result = await this.sweepRepo(job, repo);
          job.results.push(result);
          job.reposCompleted++;
          job.reposRemaining--;

          this.emit('repo_swept', {
            jobId: job.jobId,
            repoUrl: repo.repoUrl,
            status: result.status,
            prUrl: result.prUrl,
          });

          if (result.prUrl) {
            this.emit('pr_created', {
              jobId: job.jobId,
              repoUrl: repo.repoUrl,
              prUrl: result.prUrl,
            });
          }

          // Rate limiting
          if (job.reposRemaining > 0) {
            await this.delay(delayMs);
          }
        } catch (error) {
          // Log but continue with other repos
          job.results.push({
            sweepId: job.config.sweepId,
            repoUrl: repo.repoUrl,
            status: 'failed',
            durationMs: 0,
            error: error instanceof Error ? error.message : String(error),
            completedAt: new Date(),
          });
          job.reposCompleted++;
          job.reposRemaining--;
        }
      }

      job.state = 'completed';
      job.completedAt = new Date();

      this.updateStats(job);

      this.emit('sweep_completed', {
        jobId: job.jobId,
        sweepId: job.config.sweepId,
        results: job.results,
        duration: job.completedAt.getTime() - job.startedAt!.getTime(),
      });
    } catch (error) {
      job.state = 'failed';
      job.completedAt = new Date();
      job.error = error instanceof Error ? error.message : String(error);

      this.emit('sweep_failed', {
        jobId: job.jobId,
        sweepId: job.config.sweepId,
        error: job.error,
      });
    } finally {
      this.activeJobs.delete(job.jobId);
    }
  }

  /**
   * Sweep a single repository.
   */
  private async sweepRepo(
    job: SweepJob,
    repo: SweepRepoTarget
  ): Promise<SweepResult> {
    const startTime = Date.now();

    // Placeholder implementation
    // In production, this would:
    // 1. Clone the repo
    // 2. Start an agent session
    // 3. Execute the sweep task
    // 4. Optionally create a PR

    const result: SweepResult = {
      sweepId: job.config.sweepId,
      repoUrl: repo.repoUrl,
      status: 'success',
      durationMs: Date.now() - startTime,
      completedAt: new Date(),
    };

    // Simulate sweep based on type
    switch (job.config.sweepType) {
      case 'maintenance':
        result.changesSummary = {
          filesModified: 0,
          linesAdded: 0,
          linesRemoved: 0,
        };
        result.status = 'no_changes';
        break;

      case 'lint_fix':
        // Simulate some changes
        result.changesSummary = {
          filesModified: Math.floor(Math.random() * 5),
          linesAdded: Math.floor(Math.random() * 20),
          linesRemoved: Math.floor(Math.random() * 10),
        };
        if (result.changesSummary.filesModified > 0 && job.config.createPRs) {
          result.prUrl = `https://github.com/example/${repo.repoUrl.split('/').pop()}/pull/1`;
        }
        break;

      case 'dependency_update':
        // Simulate dependency updates
        result.changesSummary = {
          filesModified: 2,
          linesAdded: 10,
          linesRemoved: 10,
        };
        if (job.config.createPRs) {
          result.prUrl = `https://github.com/example/${repo.repoUrl.split('/').pop()}/pull/1`;
        }
        break;

      case 'custom':
        result.status = 'success';
        break;
    }

    // Update repo's last swept time
    repo.lastSweptAt = new Date();

    return result;
  }

  /**
   * Cancel a running sweep.
   */
  cancelSweep(jobId: string): SweepJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Sweep job ${jobId} not found`);
    }

    if (job.state !== 'running' && job.state !== 'pending') {
      throw new Error(`Cannot cancel sweep in state ${job.state}`);
    }

    job.state = 'cancelled';
    job.completedAt = new Date();

    return job;
  }

  /**
   * Get a sweep job.
   */
  getJob(jobId: string): SweepJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs.
   */
  getAllJobs(): SweepJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get active jobs.
   */
  getActiveJobs(): SweepJob[] {
    return Array.from(this.activeJobs)
      .map(id => this.jobs.get(id)!)
      .filter(Boolean);
  }

  /**
   * Check if a job has been cancelled.
   */
  private isJobCancelled(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    return job?.state === 'cancelled';
  }

  /**
   * Get sweep statistics.
   */
  getStats(): SweepStats {
    return { ...this.stats };
  }

  /**
   * Get results for a sweep.
   */
  getSweepResults(sweepId: string): SweepResult[] {
    const job = Array.from(this.jobs.values())
      .find(j => j.config.sweepId === sweepId);

    return job?.results ?? [];
  }

  /**
   * Check if manager is accepting new sweeps.
   */
  canAcceptSweep(): boolean {
    return (
      this.config.enabled &&
      this.activeJobs.size < this.config.maxConcurrentSweeps
    );
  }

  /**
   * Enable/disable sweep execution.
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Update statistics after a job completes.
   */
  private updateStats(job: SweepJob): void {
    const successful = job.results.filter(
      r => r.status === 'success' || r.status === 'no_changes'
    ).length;
    const prsCreated = job.results.filter(r => r.prUrl).length;

    this.stats.totalSweeps++;
    this.stats.totalReposSwept += job.reposCompleted;
    this.stats.totalPRsCreated += prsCreated;
    this.stats.averageSweptPerRun = this.stats.totalReposSwept / this.stats.totalSweeps;
    this.stats.successRate =
      (this.stats.successRate * (this.stats.totalSweeps - 1) +
        successful / job.reposCompleted) /
      this.stats.totalSweeps;
  }

  /**
   * Delay helper for rate limiting.
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default SweepManager;
