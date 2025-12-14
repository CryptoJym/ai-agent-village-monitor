/**
 * Diff Summarizer
 * Computes git diff summaries to generate structured events
 *
 * Per spec section 4.2: Structured events via repo instrumentation
 * - Compute git diff --name-only on intervals / milestones
 * - Map files to rooms for sprite movement
 */

import { simpleGit, type SimpleGit, type DiffResult } from 'simple-git';
import type { DiffSummaryEvent } from '@ai-agent-village-monitor/shared';

/**
 * File diff details
 */
export type FileDiff = {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  oldPath?: string; // For renamed files
};

/**
 * Diff summary result
 */
export type DiffSummary = {
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  files: FileDiff[];
};

/**
 * Room summary (files grouped by room)
 */
export type RoomSummary = {
  roomPath: string;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
};

/**
 * Summarizes git diffs for structured event generation
 */
export class DiffSummarizer {
  private git: SimpleGit;
  private rootPath: string;
  private lastCommit: string | null = null;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.git = simpleGit(rootPath);
  }

  /**
   * Get diff summary for staged changes
   */
  async getStagedDiff(): Promise<DiffSummary> {
    const diff = await this.git.diff(['--cached', '--numstat']);
    return this.parseDiffNumstat(diff, 'staged');
  }

  /**
   * Get diff summary for unstaged changes
   */
  async getUnstagedDiff(): Promise<DiffSummary> {
    const diff = await this.git.diff(['--numstat']);
    return this.parseDiffNumstat(diff, 'unstaged');
  }

  /**
   * Get diff summary for all changes (staged + unstaged)
   */
  async getAllChanges(): Promise<DiffSummary> {
    const diff = await this.git.diff(['HEAD', '--numstat']);
    return this.parseDiffNumstat(diff, 'all');
  }

  /**
   * Get diff since a specific commit
   */
  async getDiffSince(commitSha: string): Promise<DiffSummary> {
    const diff = await this.git.diff([commitSha, 'HEAD', '--numstat']);
    return this.parseDiffNumstat(diff, 'since');
  }

  /**
   * Get diff since last check (tracks state)
   */
  async getDiffSinceLastCheck(): Promise<DiffSummary | null> {
    const currentCommit = await this.getCurrentCommit();

    if (!this.lastCommit) {
      this.lastCommit = currentCommit;
      return null;
    }

    if (this.lastCommit === currentCommit) {
      // No new commits, check for unstaged changes
      return this.getAllChanges();
    }

    const diff = await this.getDiffSince(this.lastCommit);
    this.lastCommit = currentCommit;
    return diff;
  }

  /**
   * Get list of changed files (names only)
   */
  async getChangedFiles(): Promise<string[]> {
    const status = await this.git.status();
    return [
      ...status.modified,
      ...status.created,
      ...status.deleted,
      ...status.renamed.map((r) => r.to),
    ];
  }

  /**
   * Get diff grouped by room (directory)
   */
  async getDiffByRoom(roomDepth = 2): Promise<RoomSummary[]> {
    const diff = await this.getAllChanges();
    const roomMap = new Map<string, RoomSummary>();

    for (const file of diff.files) {
      const roomPath = this.getFileRoomPath(file.path, roomDepth);

      const existing = roomMap.get(roomPath);
      if (existing) {
        existing.filesChanged++;
        existing.linesAdded += file.additions;
        existing.linesRemoved += file.deletions;
      } else {
        roomMap.set(roomPath, {
          roomPath,
          filesChanged: 1,
          linesAdded: file.additions,
          linesRemoved: file.deletions,
        });
      }
    }

    return Array.from(roomMap.values());
  }

  /**
   * Create a DiffSummaryEvent for the runner
   */
  async createDiffEvent(
    sessionId: string,
    orgId: string,
    seq: number
  ): Promise<Omit<DiffSummaryEvent, 'repoRef'> | null> {
    const diff = await this.getAllChanges();

    if (diff.filesChanged === 0) {
      return null;
    }

    return {
      type: 'DIFF_SUMMARY',
      sessionId,
      orgId,
      ts: Date.now(),
      seq,
      filesChanged: diff.filesChanged,
      linesAdded: diff.linesAdded,
      linesRemoved: diff.linesRemoved,
      files: diff.files.map((f) => ({
        path: f.path,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
      })),
    };
  }

  /**
   * Reset tracking state
   */
  async reset(): Promise<void> {
    this.lastCommit = await this.getCurrentCommit();
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  private async getCurrentCommit(): Promise<string> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      return log.latest?.hash ?? 'HEAD';
    } catch {
      return 'HEAD';
    }
  }

  private parseDiffNumstat(output: string, _source: string): DiffSummary {
    const files: FileDiff[] = [];
    let totalAdded = 0;
    let totalRemoved = 0;

    const lines = output.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 3) continue;

      const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
      const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
      let path = parts[2];
      let oldPath: string | undefined;
      let status: FileDiff['status'] = 'modified';

      // Handle renamed files (format: "old => new" or "{old => new}")
      if (path.includes('=>')) {
        const match = path.match(/(?:{([^}]+)\s*=>\s*([^}]+)}|([^\s]+)\s*=>\s*([^\s]+))/);
        if (match) {
          oldPath = match[1] || match[3];
          path = match[2] || match[4];
          status = 'renamed';
        }
      }

      // Determine status from additions/deletions if not renamed
      if (status !== 'renamed') {
        if (additions > 0 && deletions === 0) {
          status = 'added';
        } else if (additions === 0 && deletions > 0) {
          status = 'deleted';
        }
      }

      totalAdded += additions;
      totalRemoved += deletions;

      files.push({
        path,
        status,
        additions,
        deletions,
        oldPath,
      });
    }

    return {
      filesChanged: files.length,
      linesAdded: totalAdded,
      linesRemoved: totalRemoved,
      files,
    };
  }

  private getFileRoomPath(filePath: string, depth: number): string {
    const parts = filePath.split('/');
    if (parts.length <= depth) {
      return parts.slice(0, -1).join('/') || '.';
    }
    return parts.slice(0, depth).join('/');
  }
}

/**
 * Create a diff summarizer for a workspace
 */
export function createDiffSummarizer(rootPath: string): DiffSummarizer {
  return new DiffSummarizer(rootPath);
}
