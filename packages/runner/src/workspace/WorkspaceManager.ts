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

import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import { mkdir, rm, access, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { RepoRef, CheckoutSpec, WorkspaceRef } from '@ai-agent-village-monitor/shared';

/**
 * Configuration for the workspace manager
 */
export type WorkspaceManagerConfig = {
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
 * Default configuration
 */
const DEFAULT_CONFIG: WorkspaceManagerConfig = {
  baseDir: '/tmp/ai-village-workspaces',
  cacheDir: '/tmp/ai-village-cache',
  shallowClone: true,
  maxCacheAge: 24 * 60 * 60 * 1000, // 24 hours
  maxCachedRepos: 50,
};

/**
 * Manages workspace lifecycle for agent sessions
 */
export class WorkspaceManager {
  private config: WorkspaceManagerConfig;
  private activeWorkspaces: Map<string, WorkspaceRef> = new Map();

  constructor(config: Partial<WorkspaceManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the workspace manager
   * Creates necessary directories
   */
  async initialize(): Promise<void> {
    await mkdir(this.config.baseDir, { recursive: true });
    await mkdir(this.config.cacheDir, { recursive: true });
  }

  /**
   * Create a workspace for a session
   */
  async createWorkspace(
    sessionId: string,
    repoRef: RepoRef,
    checkout: CheckoutSpec,
    options: {
      roomPath?: string;
      readOnly?: boolean;
      authToken?: string;
    } = {},
  ): Promise<WorkspaceRef> {
    const workspaceId = `ws_${randomUUID().slice(0, 8)}`;
    const worktreePath = join(this.config.baseDir, sessionId, workspaceId);

    // Ensure the cached clone exists
    const cachePath = await this.ensureCachedClone(repoRef, options.authToken);

    // Create a worktree for this session
    await this.createWorktree(cachePath, worktreePath, checkout);

    const workspaceRef: WorkspaceRef = {
      workspaceId,
      repoRef,
      checkout,
      worktreePath,
      roomPath: options.roomPath,
      readOnly: options.readOnly ?? false,
      createdAt: Date.now(),
    };

    this.activeWorkspaces.set(sessionId, workspaceRef);
    return workspaceRef;
  }

  /**
   * Get the workspace for a session
   */
  getWorkspace(sessionId: string): WorkspaceRef | undefined {
    return this.activeWorkspaces.get(sessionId);
  }

  /**
   * Destroy a workspace and clean up resources
   */
  async destroyWorkspace(sessionId: string): Promise<void> {
    const workspace = this.activeWorkspaces.get(sessionId);
    if (!workspace) {
      return;
    }

    try {
      // Remove the worktree
      const cachePath = this.getCachePath(workspace.repoRef);
      const git = simpleGit(cachePath);

      try {
        await git.raw(['worktree', 'remove', workspace.worktreePath, '--force']);
      } catch {
        // Worktree might already be removed, continue with cleanup
      }

      // Clean up the session directory
      const sessionDir = join(this.config.baseDir, sessionId);
      await rm(sessionDir, { recursive: true, force: true });
    } finally {
      this.activeWorkspaces.delete(sessionId);
    }
  }

  /**
   * Get the full path to a file in the workspace
   */
  getFilePath(sessionId: string, relativePath: string): string | undefined {
    const workspace = this.activeWorkspaces.get(sessionId);
    if (!workspace) {
      return undefined;
    }
    return join(workspace.worktreePath, relativePath);
  }

  /**
   * Get the room path within a workspace
   */
  getRoomPath(sessionId: string): string | undefined {
    const workspace = this.activeWorkspaces.get(sessionId);
    if (!workspace?.roomPath) {
      return undefined;
    }
    return join(workspace.worktreePath, workspace.roomPath);
  }

  /**
   * Get a git instance for the workspace
   */
  getGit(sessionId: string): SimpleGit | undefined {
    const workspace = this.activeWorkspaces.get(sessionId);
    if (!workspace) {
      return undefined;
    }
    return simpleGit(workspace.worktreePath);
  }

  /**
   * Ensure a cached clone exists for the repository
   */
  private async ensureCachedClone(repoRef: RepoRef, authToken?: string): Promise<string> {
    // Local repos are already present on disk; use them directly (dev/testing)
    if (repoRef.provider === 'local') {
      await access(repoRef.path);
      return repoRef.path;
    }

    const cachePath = this.getCachePath(repoRef);

    try {
      await access(cachePath);
      // Cache exists, fetch latest
      const git = simpleGit(cachePath);
      await git.fetch(['--prune']);
      return cachePath;
    } catch {
      // Cache doesn't exist, clone
      const url = this.getRepoUrl(repoRef, authToken);
      await mkdir(cachePath, { recursive: true });

      const gitOptions: Partial<SimpleGitOptions> = {
        baseDir: cachePath,
        binary: 'git',
      };

      const git = simpleGit(gitOptions);

      const cloneOptions = this.config.shallowClone ? ['--depth', '1', '--single-branch'] : [];

      // Clone as bare to save space and support multiple worktrees
      await git.clone(url, cachePath, ['--bare', ...cloneOptions]);

      // Enable worktree support
      const bareGit = simpleGit(cachePath);
      await bareGit.raw(['config', 'core.bare', 'false']);

      return cachePath;
    }
  }

  /**
   * Create a worktree from the cached clone
   */
  private async createWorktree(
    cachePath: string,
    worktreePath: string,
    checkout: CheckoutSpec,
  ): Promise<void> {
    await mkdir(worktreePath, { recursive: true });

    const git = simpleGit(cachePath);
    const ref = this.getCheckoutRef(checkout);

    try {
      // Create worktree at the specified ref
      // Use detached HEAD to allow multiple concurrent sessions on the same ref.
      await git.raw(['worktree', 'add', '--detach', worktreePath, ref]);
    } catch (error) {
      // If ref doesn't exist locally, fetch and retry
      try {
        await git.fetch(['origin', ref]);
      } catch {
        // No remote origin or fetch is unavailable; continue with retry.
      }
      await git.raw(['worktree', 'add', '--detach', worktreePath, ref]);
    }
  }

  /**
   * Get the cache path for a repository
   */
  private getCachePath(repoRef: RepoRef): string {
    if (repoRef.provider === 'local') {
      return repoRef.path;
    }
    const repoKey = `${repoRef.provider}-${repoRef.owner}-${repoRef.name}`;
    return join(this.config.cacheDir, repoKey);
  }

  /**
   * Get the clone URL for a repository
   */
  private getRepoUrl(repoRef: RepoRef, authToken?: string): string {
    const { provider } = repoRef;

    if (provider === 'local') {
      return repoRef.path;
    }

    const { owner, name } = repoRef;

    switch (provider) {
      case 'github': {
        if (authToken) {
          return `https://${authToken}@github.com/${owner}/${name}.git`;
        }
        return `https://github.com/${owner}/${name}.git`;
      }
      case 'gitlab': {
        if (authToken) {
          return `https://oauth2:${authToken}@gitlab.com/${owner}/${name}.git`;
        }
        return `https://gitlab.com/${owner}/${name}.git`;
      }
      case 'bitbucket': {
        if (authToken) {
          return `https://x-token-auth:${authToken}@bitbucket.org/${owner}/${name}.git`;
        }
        return `https://bitbucket.org/${owner}/${name}.git`;
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Get the git ref from a checkout spec
   */
  private getCheckoutRef(checkout: CheckoutSpec): string {
    switch (checkout.type) {
      case 'branch':
        return checkout.ref;
      case 'commit':
        return checkout.sha;
      case 'tag':
        return checkout.tag;
    }
  }

  /**
   * Clean up old cached repositories
   */
  async pruneCache(): Promise<number> {
    const entries = await readdir(this.config.cacheDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());

    if (dirs.length <= this.config.maxCachedRepos) {
      return 0;
    }

    // Sort by modification time and remove oldest
    const toRemove = dirs.length - this.config.maxCachedRepos;
    let removed = 0;

    for (let i = 0; i < toRemove && i < dirs.length; i++) {
      const dirPath = join(this.config.cacheDir, dirs[i].name);
      await rm(dirPath, { recursive: true, force: true });
      removed++;
    }

    return removed;
  }

  /**
   * Get statistics about active workspaces
   */
  getStats(): {
    activeWorkspaces: number;
    workspaces: Array<{ sessionId: string; repoRef: RepoRef; createdAt: number }>;
  } {
    const workspaces: Array<{ sessionId: string; repoRef: RepoRef; createdAt: number }> = [];

    for (const [sessionId, ws] of this.activeWorkspaces) {
      workspaces.push({
        sessionId,
        repoRef: ws.repoRef,
        createdAt: ws.createdAt,
      });
    }

    return {
      activeWorkspaces: this.activeWorkspaces.size,
      workspaces,
    };
  }
}

/**
 * Singleton instance
 */
let workspaceManager: WorkspaceManager | null = null;

export function getWorkspaceManager(config?: Partial<WorkspaceManagerConfig>): WorkspaceManager {
  if (!workspaceManager) {
    workspaceManager = new WorkspaceManager(config);
  }
  return workspaceManager;
}
