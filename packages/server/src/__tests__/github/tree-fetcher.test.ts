import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TreeFetcher } from '../../github/tree-fetcher';
import { TreeEntry } from '../../github/types';

describe('TreeFetcher', () => {
  let mockClient: any;
  let treeFetcher: TreeFetcher;

  beforeEach(() => {
    mockClient = {
      getRepositoryTree: vi.fn(),
      getCommitInfo: vi.fn(),
      getRepoLanguages: vi.fn(),
    } as any;

    treeFetcher = new TreeFetcher(mockClient);
  });

  describe('fetchRepositoryTree', () => {
    it('should fetch and process repository tree', async () => {
      const mockTree: TreeEntry[] = [
        { path: 'src/index.ts', mode: '100644', type: 'blob', sha: 'abc123', size: 1000 },
        { path: 'src/app.ts', mode: '100644', type: 'blob', sha: 'def456', size: 500 },
        { path: 'README.md', mode: '100644', type: 'blob', sha: 'ghi789', size: 200 },
      ];

      mockClient.getRepositoryTree.mockResolvedValue(mockTree);
      mockClient.getRepoLanguages.mockResolvedValue({
        TypeScript: 8000,
        JavaScript: 2000,
      });

      const result = await treeFetcher.fetchRepositoryTree('owner', 'repo');

      expect(result.files).toHaveLength(3);
      expect(result.totalSize).toBe(1700);
      expect(result.fileCount).toBe(3);
      expect(result.languageStats).toBeDefined();
      expect(mockClient.getRepositoryTree).toHaveBeenCalledWith('owner', 'repo', undefined);
    });

    it('should respect maxFiles option', async () => {
      const mockTree: TreeEntry[] = Array.from({ length: 100 }, (_, i) => ({
        path: `file${i}.ts`,
        mode: '100644',
        type: 'blob' as const,
        sha: `sha${i}`,
        size: 100,
      }));

      mockClient.getRepositoryTree.mockResolvedValue(mockTree);

      const result = await treeFetcher.fetchRepositoryTree('owner', 'repo', undefined, {
        maxFiles: 50,
        includeLanguageStats: false,
      });

      expect(result.files).toHaveLength(50);
    });

    it('should respect maxDepth option', async () => {
      const mockTree: TreeEntry[] = [
        { path: 'file.ts', mode: '100644', type: 'blob', sha: 'abc', size: 100 },
        { path: 'src/file.ts', mode: '100644', type: 'blob', sha: 'def', size: 100 },
        { path: 'src/deep/file.ts', mode: '100644', type: 'blob', sha: 'ghi', size: 100 },
        { path: 'src/very/deep/file.ts', mode: '100644', type: 'blob', sha: 'jkl', size: 100 },
      ];

      mockClient.getRepositoryTree.mockResolvedValue(mockTree);

      const result = await treeFetcher.fetchRepositoryTree('owner', 'repo', undefined, {
        maxDepth: 2,
        includeLanguageStats: false,
      });

      expect(result.files).toHaveLength(2);
      expect(result.files.some((f) => f.path.split('/').length > 2)).toBe(false);
    });

    it('should fetch commit info when ref is provided', async () => {
      const mockTree: TreeEntry[] = [
        { path: 'file.ts', mode: '100644', type: 'blob', sha: 'abc', size: 100 },
      ];

      const mockCommit = {
        sha: 'commit-sha',
        author: { name: 'Test Author', email: 'test@example.com', date: '2024-01-01' },
        message: 'Test commit',
        committedDate: '2024-01-01T00:00:00Z',
      };

      mockClient.getRepositoryTree.mockResolvedValue(mockTree);
      mockClient.getCommitInfo.mockResolvedValue(mockCommit);

      const result = await treeFetcher.fetchRepositoryTree('owner', 'repo', 'main');

      expect(result.commitInfo).toBeDefined();
      expect(result.commitInfo?.sha).toBe('commit-sha');
      expect(mockClient.getCommitInfo).toHaveBeenCalledWith('owner', 'repo', 'main');
    });
  });

  describe('fetchFileMetadata', () => {
    it('should fetch metadata for specific files', async () => {
      const mockTree: TreeEntry[] = [
        { path: 'src/index.ts', mode: '100644', type: 'blob', sha: 'abc', size: 1000 },
        { path: 'src/app.ts', mode: '100644', type: 'blob', sha: 'def', size: 500 },
        { path: 'README.md', mode: '100644', type: 'blob', sha: 'ghi', size: 200 },
      ];

      mockClient.getRepositoryTree.mockResolvedValue(mockTree);

      const result = await treeFetcher.fetchFileMetadata('owner', 'repo', [
        'src/index.ts',
        'README.md',
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('src/index.ts');
      expect(result[1].path).toBe('README.md');
    });
  });

  describe('getDirectoryContents', () => {
    it('should get all files in a directory', async () => {
      const mockTree: TreeEntry[] = [
        { path: 'src/index.ts', mode: '100644', type: 'blob', sha: 'abc', size: 1000 },
        { path: 'src/app.ts', mode: '100644', type: 'blob', sha: 'def', size: 500 },
        { path: 'tests/test.ts', mode: '100644', type: 'blob', sha: 'ghi', size: 200 },
      ];

      mockClient.getRepositoryTree.mockResolvedValue(mockTree);

      const result = await treeFetcher.getDirectoryContents('owner', 'repo', 'src');

      expect(result).toHaveLength(2);
      expect(result.every((f) => f.path.startsWith('src/'))).toBe(true);
    });
  });

  describe('getFilesByExtension', () => {
    it('should filter files by extension', async () => {
      const mockTree: TreeEntry[] = [
        { path: 'src/index.ts', mode: '100644', type: 'blob', sha: 'abc', size: 1000 },
        { path: 'src/app.js', mode: '100644', type: 'blob', sha: 'def', size: 500 },
        { path: 'README.md', mode: '100644', type: 'blob', sha: 'ghi', size: 200 },
      ];

      mockClient.getRepositoryTree.mockResolvedValue(mockTree);

      const result = await treeFetcher.getFilesByExtension('owner', 'repo', ['ts', 'js']);

      expect(result).toHaveLength(2);
      expect(result.some((f) => f.path.endsWith('.md'))).toBe(false);
    });
  });

  describe('getRepositoryStats', () => {
    it('should calculate repository statistics', async () => {
      const mockTree: TreeEntry[] = [
        { path: 'src/index.ts', mode: '100644', type: 'blob', sha: 'abc', size: 1000 },
        { path: 'src/app.ts', mode: '100644', type: 'blob', sha: 'def', size: 800 },
        { path: 'src/utils.ts', mode: '100644', type: 'blob', sha: 'ghi', size: 600 },
        { path: 'README.md', mode: '100644', type: 'blob', sha: 'jkl', size: 200 },
        { path: 'package.json', mode: '100644', type: 'blob', sha: 'mno', size: 400 },
      ];

      mockClient.getRepositoryTree.mockResolvedValue(mockTree);

      const stats = await treeFetcher.getRepositoryStats('owner', 'repo');

      expect(stats.totalFiles).toBe(5);
      expect(stats.totalSize).toBe(3000);
      expect(stats.filesByExtension.ts).toBe(3);
      expect(stats.filesByExtension.md).toBe(1);
      expect(stats.filesByExtension.json).toBe(1);
      expect(stats.largestFiles).toHaveLength(5);
      expect(stats.largestFiles[0].size).toBe(1000);
    });
  });
});
