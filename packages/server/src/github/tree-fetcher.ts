import { GitHubClient } from './client';
import { FileMetadata, CommitInfo } from './types';

export interface TreeFetcherOptions {
  maxDepth?: number;
  maxFiles?: number;
  includeLanguageStats?: boolean;
}

export interface RepositoryTreeData {
  files: FileMetadata[];
  totalSize: number;
  fileCount: number;
  commitInfo?: CommitInfo;
  languageStats?: Record<string, number>;
}

export class TreeFetcher {
  constructor(private client: GitHubClient) {}

  async fetchRepositoryTree(
    owner: string,
    repo: string,
    ref?: string,
    options: TreeFetcherOptions = {},
  ): Promise<RepositoryTreeData> {
    const { maxDepth = 100, maxFiles = 10000, includeLanguageStats = true } = options;

    // Get the repository tree using the GitHub client
    const treeEntries = await this.client.getRepositoryTree(owner, repo, ref);

    // Filter and convert to FileMetadata
    const files: FileMetadata[] = [];
    let totalSize = 0;

    for (const entry of treeEntries) {
      if (files.length >= maxFiles) break;

      // Only process blob (file) entries
      if (entry.type === 'blob') {
        // Check depth
        const depth = entry.path.split('/').length;
        if (depth > maxDepth) continue;

        const fileMetadata: FileMetadata = {
          path: entry.path,
          size: entry.size || 0,
          type: 'file',
          sha: entry.sha,
          mode: entry.mode,
        };

        files.push(fileMetadata);
        totalSize += entry.size || 0;
      }
    }

    // Get commit information for deterministic seeding
    const result: RepositoryTreeData = {
      files,
      totalSize,
      fileCount: files.length,
    };

    // Fetch commit info if ref is provided
    if (ref) {
      try {
        const commitInfo = await this.client.getCommitInfo(owner, repo, ref);
        result.commitInfo = commitInfo;
      } catch (error) {
        console.warn(`Failed to fetch commit info for ${ref}:`, error);
      }
    }

    // Fetch language statistics if requested
    if (includeLanguageStats) {
      try {
        const languageStats = await this.client.getRepoLanguages(owner, repo);
        result.languageStats = languageStats;
      } catch (error) {
        console.warn(`Failed to fetch language stats:`, error);
      }
    }

    return result;
  }

  async fetchFileMetadata(
    owner: string,
    repo: string,
    paths: string[],
    ref?: string,
  ): Promise<FileMetadata[]> {
    const tree = await this.client.getRepositoryTree(owner, repo, ref);
    const pathSet = new Set(paths);

    return tree
      .filter((entry) => entry.type === 'blob' && pathSet.has(entry.path))
      .map((entry) => ({
        path: entry.path,
        size: entry.size || 0,
        type: 'file' as const,
        sha: entry.sha,
        mode: entry.mode,
      }));
  }

  async fetchTreeWithPagination(
    owner: string,
    repo: string,
    ref?: string,
    pageSize: number = 1000,
  ): Promise<AsyncGenerator<FileMetadata[], void, unknown>> {
    const treeEntries = await this.client.getRepositoryTree(owner, repo, ref);
    const files = treeEntries
      .filter((entry) => entry.type === 'blob')
      .map((entry) => ({
        path: entry.path,
        size: entry.size || 0,
        type: 'file' as const,
        sha: entry.sha,
        mode: entry.mode,
      }));

    return this.paginateArray(files, pageSize);
  }

  private async *paginateArray<T>(
    items: T[],
    pageSize: number,
  ): AsyncGenerator<T[], void, unknown> {
    for (let i = 0; i < items.length; i += pageSize) {
      yield items.slice(i, i + pageSize);
    }
  }

  async getDirectoryContents(
    owner: string,
    repo: string,
    dirPath: string,
    ref?: string,
  ): Promise<FileMetadata[]> {
    const tree = await this.client.getRepositoryTree(owner, repo, ref);
    const normalizedPath = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;

    return tree
      .filter((entry) => entry.path.startsWith(normalizedPath) && entry.type === 'blob')
      .map((entry) => ({
        path: entry.path,
        size: entry.size || 0,
        type: 'file' as const,
        sha: entry.sha,
        mode: entry.mode,
      }));
  }

  async getFilesByExtension(
    owner: string,
    repo: string,
    extensions: string[],
    ref?: string,
  ): Promise<FileMetadata[]> {
    const tree = await this.client.getRepositoryTree(owner, repo, ref);
    const extSet = new Set(extensions.map((ext) => ext.toLowerCase()));

    return tree
      .filter((entry) => {
        if (entry.type !== 'blob') return false;
        const ext = entry.path.split('.').pop()?.toLowerCase();
        return ext && extSet.has(ext);
      })
      .map((entry) => ({
        path: entry.path,
        size: entry.size || 0,
        type: 'file' as const,
        sha: entry.sha,
        mode: entry.mode,
      }));
  }

  async getRepositoryStats(
    owner: string,
    repo: string,
    ref?: string,
  ): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByExtension: Record<string, number>;
    sizeByExtension: Record<string, number>;
    largestFiles: Array<{ path: string; size: number }>;
  }> {
    const tree = await this.client.getRepositoryTree(owner, repo, ref);
    const files = tree.filter((entry) => entry.type === 'blob');

    const filesByExtension: Record<string, number> = {};
    const sizeByExtension: Record<string, number> = {};
    let totalSize = 0;

    for (const file of files) {
      const ext = file.path.split('.').pop()?.toLowerCase() || 'no-ext';
      filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;
      sizeByExtension[ext] = (sizeByExtension[ext] || 0) + (file.size || 0);
      totalSize += file.size || 0;
    }

    const largestFiles = files
      .filter((f) => f.size)
      .sort((a, b) => (b.size || 0) - (a.size || 0))
      .slice(0, 10)
      .map((f) => ({ path: f.path, size: f.size || 0 }));

    return {
      totalFiles: files.length,
      totalSize,
      filesByExtension,
      sizeByExtension,
      largestFiles,
    };
  }
}

export function createTreeFetcher(client: GitHubClient): TreeFetcher {
  return new TreeFetcher(client);
}
