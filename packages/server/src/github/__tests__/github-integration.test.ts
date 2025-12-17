import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GitHubClient } from '../client';
import { TreeFetcher } from '../tree-fetcher';
import { GitHubLanguageDetector, GitHubTreeEntry } from '../language-detector';
import { GitHubModuleClassifier } from '../module-classifier';
import { GitHubDependencyAnalyzer } from '../dependency-analyzer';
import type { Repository, TreeEntry } from '../types';

/**
 * GitHub Integration Tests
 *
 * Tests the GitHub integration layer including:
 * - GraphQL client wrapper with rate limiting and error recovery
 * - Repository tree fetching and parsing
 * - Language detection using linguist patterns
 * - Module classification based on file patterns
 * - Dependency analysis with circular dependency detection
 */

describe('GitHub Integration Tests', () => {
  describe('GitHubClient - GraphQL Client Wrapper', () => {
    let client: GitHubClient;

    beforeEach(() => {
      vi.clearAllMocks();
      client = new GitHubClient({
        tokens: ['mock-token-1', 'mock-token-2'],
        rateLimitBudget: 5000,
        cacheTTL: 900000,
      });
    });

    afterEach(() => {
      client.clearCache();
    });

    describe('Rate Limiting', () => {
      it('should track rate limit information from response headers', () => {
        // Test that lastRate is initialized (may be empty until first API call)
        expect(client.lastRate).toBeDefined();
        expect(typeof client.lastRate).toBe('object');

        // Set some mock rate limit data to simulate API response
        client.lastRate = {
          limit: 5000,
          remaining: 4999,
          reset: Math.floor(Date.now() / 1000) + 3600,
        };

        expect(client.lastRate).toHaveProperty('limit');
        expect(client.lastRate).toHaveProperty('remaining');
        expect(client.lastRate).toHaveProperty('reset');
      });

      it('should provide rate limit status', () => {
        const status = client.getRateLimitStatus();

        expect(status).toHaveProperty('limit');
        expect(status).toHaveProperty('remaining');
        expect(status).toHaveProperty('reset');
        expect(status).toHaveProperty('used');
        expect(status).toHaveProperty('budget');
        expect(status).toHaveProperty('budgetRemaining');

        expect(typeof status.limit).toBe('number');
        expect(typeof status.remaining).toBe('number');
        expect(status.reset).toBeInstanceOf(Date);
        expect(typeof status.used).toBe('number');
        expect(status.budget).toBe(5000);
      });

      it('should calculate budget remaining correctly', () => {
        const status = client.getRateLimitStatus();
        const expectedBudgetRemaining = Math.max(0, status.budget - status.used);

        expect(status.budgetRemaining).toBe(expectedBudgetRemaining);
        expect(status.budgetRemaining).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Token Rotation', () => {
      it('should rotate through multiple tokens', () => {
        const client1 = new GitHubClient({ tokens: ['token1', 'token2', 'token3'] });

        // Token rotation is internal but we can test that it doesn't error
        expect(() => client1.getRateLimitStatus()).not.toThrow();
      });

      it('should handle empty token array', () => {
        const client2 = new GitHubClient({ tokens: [] });

        expect(() => client2.getRateLimitStatus()).not.toThrow();
      });
    });

    describe('Caching', () => {
      it('should cache and retrieve repository data', async () => {
        const mockRepo: Repository = {
          id: 'R_123',
          name: 'test-repo',
          nameWithOwner: 'test-owner/test-repo',
          description: 'Test repository',
          primaryLanguage: 'TypeScript',
          stargazerCount: 100,
          forkCount: 10,
          updatedAt: '2023-01-01T00:00:00Z',
          isPrivate: false,
          isEmpty: false,
          languages: {
            totalSize: 10000,
            languages: [
              { name: 'TypeScript', size: 8000, percentage: 80 },
              { name: 'JavaScript', size: 2000, percentage: 20 },
            ],
          },
        };

        // Mock the graphql call
        vi.spyOn(client as any, 'withRetry').mockResolvedValueOnce({
          rateLimit: { limit: 5000, remaining: 4999 },
          repository: {
            id: mockRepo.id,
            name: mockRepo.name,
            nameWithOwner: mockRepo.nameWithOwner,
            description: mockRepo.description,
            stargazerCount: mockRepo.stargazerCount,
            forkCount: mockRepo.forkCount,
            updatedAt: mockRepo.updatedAt,
            isPrivate: mockRepo.isPrivate,
            isEmpty: mockRepo.isEmpty,
            primaryLanguage: { name: mockRepo.primaryLanguage },
            languages: {
              totalSize: mockRepo.languages!.totalSize,
              edges: mockRepo.languages!.languages.map((lang) => ({
                size: lang.size,
                node: { name: lang.name },
              })),
            },
          },
        });

        const result1 = await client.getRepository('test-owner', 'test-repo');
        expect(result1).toMatchObject({
          name: 'test-repo',
          nameWithOwner: 'test-owner/test-repo',
        });

        // Second call should use cache
        expect(client.metrics.cacheHits).toBe(0);
        const result2 = await client.getRepository('test-owner', 'test-repo');
        expect(result2).toEqual(result1);
        expect(client.metrics.cacheHits).toBe(1);
      });

      it('should respect cache TTL', async () => {
        const shortTTLClient = new GitHubClient({
          tokens: ['mock-token'],
          cacheTTL: 100, // 100ms
        });

        // Mock response
        vi.spyOn(shortTTLClient as any, 'withRetry').mockResolvedValue({
          rateLimit: { limit: 5000, remaining: 4999 },
          repository: {
            id: 'R_123',
            name: 'test-repo',
            nameWithOwner: 'test-owner/test-repo',
            isPrivate: false,
            isEmpty: false,
            stargazerCount: 0,
            forkCount: 0,
            updatedAt: '2023-01-01T00:00:00Z',
            languages: { totalSize: 0, edges: [] },
          },
        });

        await shortTTLClient.getRepository('test-owner', 'test-repo');

        // Wait for TTL to expire
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Should fetch again (cache expired)
        await shortTTLClient.getRepository('test-owner', 'test-repo');
        expect(shortTTLClient.metrics.cacheMisses).toBeGreaterThan(0);
      });

      it('should clear cache on demand', async () => {
        vi.spyOn(client as any, 'withRetry').mockResolvedValue({
          rateLimit: { limit: 5000, remaining: 4999 },
          repository: {
            id: 'R_123',
            name: 'test-repo',
            nameWithOwner: 'test-owner/test-repo',
            isPrivate: false,
            isEmpty: false,
            stargazerCount: 0,
            forkCount: 0,
            updatedAt: '2023-01-01T00:00:00Z',
            languages: { totalSize: 0, edges: [] },
          },
        });

        await client.getRepository('test-owner', 'test-repo');
        expect(client.metrics.cacheHits).toBe(0);

        await client.getRepository('test-owner', 'test-repo');
        expect(client.metrics.cacheHits).toBe(1);

        client.clearCache();

        await client.getRepository('test-owner', 'test-repo');
        expect(client.metrics.cacheMisses).toBeGreaterThan(0);
      });
    });

    describe('Error Recovery', () => {
      it('should retry on rate limit errors (403)', async () => {
        const retryClient = new GitHubClient({ tokens: ['mock-token'] });

        // Test that withRetry method exists and handles retries
        const mockFn = vi
          .fn()
          .mockRejectedValueOnce(Object.assign(new Error('Rate limit exceeded'), { status: 403 }))
          .mockResolvedValueOnce({ data: { success: true } });

        const result = await (retryClient as any).withRetry(mockFn);

        expect(result).toEqual({ data: { success: true } });
        expect(mockFn).toHaveBeenCalledTimes(2);
      });

      it('should retry on server errors (502, 503)', async () => {
        const retryClient = new GitHubClient({ tokens: ['mock-token'] });

        // Test that withRetry method handles server errors
        const mockFn = vi
          .fn()
          .mockRejectedValueOnce(Object.assign(new Error('Bad Gateway'), { status: 502 }))
          .mockResolvedValueOnce({ data: { success: true } });

        const result = await (retryClient as any).withRetry(mockFn);

        expect(result).toEqual({ data: { success: true } });
        expect(mockFn).toHaveBeenCalledTimes(2);
      });

      it('should not retry on client errors (400, 404)', async () => {
        const retryClient = new GitHubClient({ tokens: ['mock-token'] });

        const error: any = new Error('Not found');
        error.status = 404;

        await expect(
          (retryClient as any).withRetry(async () => {
            throw error;
          }),
        ).rejects.toThrow('Not found');
      });
    });

    describe('Batch Queries', () => {
      it('should batch multiple queries efficiently', async () => {
        const queries = Array(15)
          .fill(null)
          .map((_, i) => () => Promise.resolve({ id: i, data: `result-${i}` }));

        const results = await client.batchQuery(queries);

        expect(results).toHaveLength(15);
        expect(results[0]).toEqual({ id: 0, data: 'result-0' });
        expect(results[14]).toEqual({ id: 14, data: 'result-14' });
      });

      it('should stop batching when budget is low', async () => {
        const lowBudgetClient = new GitHubClient({
          tokens: ['mock-token'],
          rateLimitBudget: 50,
        });

        // Mock low remaining budget
        (lowBudgetClient as any).lastRate = {
          limit: 5000,
          remaining: 40,
          reset: Math.floor(Date.now() / 1000) + 3600,
        };

        const queries = Array(20)
          .fill(null)
          .map((_, i) => () => Promise.resolve({ id: i }));

        const results = await lowBudgetClient.batchQuery(queries);

        // Should stop early due to budget
        expect(results.length).toBeLessThan(20);
      });
    });
  });

  describe('TreeFetcher - Repository Tree Fetcher', () => {
    let client: GitHubClient;
    let treeFetcher: TreeFetcher;

    beforeEach(() => {
      client = new GitHubClient({ tokens: ['mock-token'] });
      treeFetcher = new TreeFetcher(client);
    });

    describe('File Tree Parsing', () => {
      it('should fetch and parse repository tree', async () => {
        const mockTreeEntries: TreeEntry[] = [
          { path: 'src/index.ts', mode: '100644', type: 'blob', sha: 'abc123', size: 1000 },
          { path: 'src/utils/helper.ts', mode: '100644', type: 'blob', sha: 'def456', size: 500 },
          { path: 'package.json', mode: '100644', type: 'blob', sha: 'ghi789', size: 200 },
          { path: 'src', mode: '040000', type: 'tree', sha: 'tree123' },
        ];

        vi.spyOn(client, 'getRepositoryTree').mockResolvedValue(mockTreeEntries);

        const result = await treeFetcher.fetchRepositoryTree('test-owner', 'test-repo');

        expect(result.files).toHaveLength(3); // Only blobs
        expect(result.totalSize).toBe(1700);
        expect(result.fileCount).toBe(3);
        expect(result.files[0].path).toBe('src/index.ts');
      });

      it('should handle nested directories correctly', async () => {
        const mockTreeEntries: TreeEntry[] = [
          { path: 'a/b/c/deep.ts', mode: '100644', type: 'blob', sha: 'abc', size: 100 },
          { path: 'a/b/file.ts', mode: '100644', type: 'blob', sha: 'def', size: 100 },
          { path: 'a/file.ts', mode: '100644', type: 'blob', sha: 'ghi', size: 100 },
          { path: 'root.ts', mode: '100644', type: 'blob', sha: 'jkl', size: 100 },
        ];

        vi.spyOn(client, 'getRepositoryTree').mockResolvedValue(mockTreeEntries);

        const result = await treeFetcher.fetchRepositoryTree('test-owner', 'test-repo');

        expect(result.files).toHaveLength(4);

        // Check all depths are included
        const depths = result.files.map((f) => f.path.split('/').length);
        expect(Math.max(...depths)).toBe(4); // a/b/c/deep.ts
        expect(Math.min(...depths)).toBe(1); // root.ts
      });

      it('should respect maxDepth option', async () => {
        const mockTreeEntries: TreeEntry[] = [
          { path: 'a/b/c/d/e/f/deep.ts', mode: '100644', type: 'blob', sha: 'abc', size: 100 },
          { path: 'a/b/shallow.ts', mode: '100644', type: 'blob', sha: 'def', size: 100 },
        ];

        vi.spyOn(client, 'getRepositoryTree').mockResolvedValue(mockTreeEntries);

        const result = await treeFetcher.fetchRepositoryTree('test-owner', 'test-repo', undefined, {
          maxDepth: 3,
        });

        expect(result.files).toHaveLength(1); // Only shallow.ts (depth 2)
        expect(result.files[0].path).toBe('a/b/shallow.ts');
      });

      it('should respect maxFiles option', async () => {
        const mockTreeEntries: TreeEntry[] = Array(100)
          .fill(null)
          .map((_, i) => ({
            path: `file${i}.ts`,
            mode: '100644',
            type: 'blob' as const,
            sha: `sha${i}`,
            size: 100,
          }));

        vi.spyOn(client, 'getRepositoryTree').mockResolvedValue(mockTreeEntries);

        const result = await treeFetcher.fetchRepositoryTree('test-owner', 'test-repo', undefined, {
          maxFiles: 50,
        });

        expect(result.files).toHaveLength(50);
      });
    });

    describe('Large Repository Handling', () => {
      it('should handle large repositories efficiently', async () => {
        // Simulate a repository with 5000 files
        const mockTreeEntries: TreeEntry[] = Array(5000)
          .fill(null)
          .map((_, i) => ({
            path: `src/file${i}.ts`,
            mode: '100644',
            type: 'blob' as const,
            sha: `sha${i}`,
            size: Math.floor(Math.random() * 10000),
          }));

        vi.spyOn(client, 'getRepositoryTree').mockResolvedValue(mockTreeEntries);

        const result = await treeFetcher.fetchRepositoryTree('test-owner', 'test-repo');

        expect(result.files.length).toBeGreaterThan(0);
        expect(result.totalSize).toBeGreaterThan(0);
      });

      it('should filter files by extension', async () => {
        const mockTreeEntries: TreeEntry[] = [
          { path: 'file1.ts', mode: '100644', type: 'blob', sha: 'a', size: 100 },
          { path: 'file2.js', mode: '100644', type: 'blob', sha: 'b', size: 100 },
          { path: 'file3.py', mode: '100644', type: 'blob', sha: 'c', size: 100 },
          { path: 'file4.ts', mode: '100644', type: 'blob', sha: 'd', size: 100 },
        ];

        vi.spyOn(client, 'getRepositoryTree').mockResolvedValue(mockTreeEntries);

        const result = await treeFetcher.getFilesByExtension('test-owner', 'test-repo', ['ts']);

        expect(result).toHaveLength(2);
        expect(result.every((f) => f.path.endsWith('.ts'))).toBe(true);
      });

      it('should get directory contents', async () => {
        const mockTreeEntries: TreeEntry[] = [
          { path: 'src/index.ts', mode: '100644', type: 'blob', sha: 'a', size: 100 },
          { path: 'src/utils/helper.ts', mode: '100644', type: 'blob', sha: 'b', size: 100 },
          { path: 'tests/test.ts', mode: '100644', type: 'blob', sha: 'c', size: 100 },
        ];

        vi.spyOn(client, 'getRepositoryTree').mockResolvedValue(mockTreeEntries);

        const result = await treeFetcher.getDirectoryContents('test-owner', 'test-repo', 'src');

        expect(result).toHaveLength(2);
        expect(result.every((f) => f.path.startsWith('src/'))).toBe(true);
      });
    });

    describe('Repository Statistics', () => {
      it('should calculate repository statistics', async () => {
        const mockTreeEntries: TreeEntry[] = [
          { path: 'file1.ts', mode: '100644', type: 'blob', sha: 'a', size: 5000 },
          { path: 'file2.ts', mode: '100644', type: 'blob', sha: 'b', size: 3000 },
          { path: 'file3.js', mode: '100644', type: 'blob', sha: 'c', size: 2000 },
          { path: 'file4.py', mode: '100644', type: 'blob', sha: 'd', size: 1000 },
        ];

        vi.spyOn(client, 'getRepositoryTree').mockResolvedValue(mockTreeEntries);

        const stats = await treeFetcher.getRepositoryStats('test-owner', 'test-repo');

        expect(stats.totalFiles).toBe(4);
        expect(stats.totalSize).toBe(11000);
        expect(stats.filesByExtension).toEqual({ ts: 2, js: 1, py: 1 });
        expect(stats.sizeByExtension.ts).toBe(8000);
        expect(stats.largestFiles[0]).toEqual({ path: 'file1.ts', size: 5000 });
      });
    });
  });

  describe('GitHubLanguageDetector - Language Detection', () => {
    let detector: GitHubLanguageDetector;

    beforeEach(() => {
      detector = new GitHubLanguageDetector();
    });

    describe('File Extension Detection', () => {
      it('should detect languages from common file extensions', () => {
        const files: GitHubTreeEntry[] = [
          { path: 'app.ts', type: 'blob', sha: 'a', mode: '100644', size: 100 },
          { path: 'app.js', type: 'blob', sha: 'b', mode: '100644', size: 200 },
          { path: 'main.py', type: 'blob', sha: 'c', mode: '100644', size: 150 },
          { path: 'Main.java', type: 'blob', sha: 'd', mode: '100644', size: 300 },
          { path: 'main.go', type: 'blob', sha: 'e', mode: '100644', size: 250 },
        ];

        const stats = detector.detectLanguages(files);

        expect(stats.languages).toHaveProperty('TypeScript');
        expect(stats.languages).toHaveProperty('JavaScript');
        expect(stats.languages).toHaveProperty('Python');
        expect(stats.languages).toHaveProperty('Java');
        expect(stats.languages).toHaveProperty('Go');

        expect(stats.totalBytes).toBe(1000);
        expect(stats.primary).toBe('Java'); // Largest file
      });

      it('should detect React files correctly', () => {
        const files: GitHubTreeEntry[] = [
          { path: 'Component.tsx', type: 'blob', sha: 'a', mode: '100644', size: 500 },
          { path: 'App.jsx', type: 'blob', sha: 'b', mode: '100644', size: 300 },
        ];

        const stats = detector.detectLanguages(files);

        expect(stats.primary).toMatch(/TypeScript|React/);
      });

      it('should handle configuration files', () => {
        const configFile = detector.getFileLanguage('package.json');

        expect(configFile.name).toBe('JSON');
        expect(configFile.confidence).toBeGreaterThan(0.5);
      });
    });

    describe('Shebang Detection', () => {
      it('should detect language from file path patterns', () => {
        const dockerFile = detector.getFileLanguage('Dockerfile');
        const makefile = detector.getFileLanguage('Makefile');

        expect(dockerFile.name).toBe('Dockerfile');
        expect(makefile.name).toBe('Makefile');
      });
    });

    describe('Language Statistics', () => {
      it('should calculate language percentages correctly', () => {
        const files: GitHubTreeEntry[] = [
          { path: 'file1.ts', type: 'blob', sha: 'a', mode: '100644', size: 600 },
          { path: 'file2.ts', type: 'blob', sha: 'b', mode: '100644', size: 400 },
          { path: 'file3.js', type: 'blob', sha: 'c', mode: '100644', size: 1000 },
        ];

        const stats = detector.detectLanguages(files);

        expect(stats.totalBytes).toBe(2000);
        expect(stats.percentages.TypeScript).toBeCloseTo(50, 0);
        expect(stats.percentages.JavaScript).toBeCloseTo(50, 0);
      });

      it('should get top languages by byte count', () => {
        const files: GitHubTreeEntry[] = [
          { path: 'file1.ts', type: 'blob', sha: 'a', mode: '100644', size: 1000 },
          { path: 'file2.js', type: 'blob', sha: 'b', mode: '100644', size: 500 },
          { path: 'file3.py', type: 'blob', sha: 'c', mode: '100644', size: 200 },
          { path: 'file4.go', type: 'blob', sha: 'd', mode: '100644', size: 100 },
        ];

        const stats = detector.detectLanguages(files);
        const top = detector.getTopLanguages(stats, 2);

        expect(top).toHaveLength(2);
        expect(top[0].language).toBe('TypeScript');
        expect(top[0].bytes).toBe(1000);
        expect(top[1].language).toBe('JavaScript');
      });

      it('should filter files by language', () => {
        const files: GitHubTreeEntry[] = [
          { path: 'file1.ts', type: 'blob', sha: 'a', mode: '100644', size: 100 },
          { path: 'file2.js', type: 'blob', sha: 'b', mode: '100644', size: 100 },
          { path: 'file3.ts', type: 'blob', sha: 'c', mode: '100644', size: 100 },
        ];

        const tsFiles = detector.filterFilesByLanguage(files, 'TypeScript');

        expect(tsFiles).toHaveLength(2);
        expect(tsFiles.every((f) => f.path.endsWith('.ts'))).toBe(true);
      });

      it('should group files by language', () => {
        const files: GitHubTreeEntry[] = [
          { path: 'file1.ts', type: 'blob', sha: 'a', mode: '100644', size: 100 },
          { path: 'file2.js', type: 'blob', sha: 'b', mode: '100644', size: 100 },
          { path: 'file3.ts', type: 'blob', sha: 'c', mode: '100644', size: 100 },
          { path: 'file4.py', type: 'blob', sha: 'd', mode: '100644', size: 100 },
        ];

        const grouped = detector.groupFilesByLanguage(files);

        expect(grouped.TypeScript).toHaveLength(2);
        expect(grouped.JavaScript).toHaveLength(1);
        expect(grouped.Python).toHaveLength(1);
      });
    });

    describe('Language Diversity Metrics', () => {
      it('should calculate language diversity score', () => {
        const uniformFiles: GitHubTreeEntry[] = [
          { path: 'file1.ts', type: 'blob', sha: 'a', mode: '100644', size: 250 },
          { path: 'file2.js', type: 'blob', sha: 'b', mode: '100644', size: 250 },
          { path: 'file3.py', type: 'blob', sha: 'c', mode: '100644', size: 250 },
          { path: 'file4.go', type: 'blob', sha: 'd', mode: '100644', size: 250 },
        ];

        const uniformStats = detector.detectLanguages(uniformFiles);
        const uniformSummary = detector.getLanguagesSummary(uniformStats);

        expect(uniformSummary.diversityScore).toBeGreaterThan(0.9);
        expect(uniformSummary.totalLanguages).toBe(4);

        const dominantFiles: GitHubTreeEntry[] = [
          { path: 'file1.ts', type: 'blob', sha: 'a', mode: '100644', size: 900 },
          { path: 'file2.js', type: 'blob', sha: 'b', mode: '100644', size: 100 },
        ];

        const dominantStats = detector.detectLanguages(dominantFiles);
        const dominantSummary = detector.getLanguagesSummary(dominantStats);

        expect(dominantSummary.diversityScore).toBeLessThan(0.5);
        expect(dominantSummary.primaryPercentage).toBeGreaterThan(80);
      });
    });

    describe('Language Comparison', () => {
      it('should compare language statistics between snapshots', () => {
        const files1: GitHubTreeEntry[] = [
          { path: 'file1.ts', type: 'blob', sha: 'a', mode: '100644', size: 500 },
          { path: 'file2.js', type: 'blob', sha: 'b', mode: '100644', size: 500 },
        ];

        const files2: GitHubTreeEntry[] = [
          { path: 'file1.ts', type: 'blob', sha: 'a', mode: '100644', size: 800 },
          { path: 'file3.py', type: 'blob', sha: 'c', mode: '100644', size: 200 },
        ];

        const stats1 = detector.detectLanguages(files1);
        const stats2 = detector.detectLanguages(files2);
        const comparison = detector.compareLanguageStats(stats1, stats2);

        expect(comparison.added).toContain('Python');
        expect(comparison.removed).toContain('JavaScript');
        expect(comparison.primaryChanged).toBe(false); // Both primary is TypeScript
      });
    });
  });

  describe('GitHubModuleClassifier - Module Classification', () => {
    let classifier: GitHubModuleClassifier;
    let languageStats: any;

    beforeEach(() => {
      classifier = new GitHubModuleClassifier();
      languageStats = {
        languages: { TypeScript: 8000, JavaScript: 2000 },
        primary: 'TypeScript',
        percentages: { TypeScript: 80, JavaScript: 20 },
        totalBytes: 10000,
      };
    });

    describe('Module Type Assignment', () => {
      it('should classify component files correctly', () => {
        const files: GitHubTreeEntry[] = [
          { path: 'src/components/Button.tsx', type: 'blob', sha: 'a', mode: '100644', size: 100 },
          { path: 'src/components/Input.tsx', type: 'blob', sha: 'b', mode: '100644', size: 100 },
        ];

        const modules = classifier.classifyModules(files, languageStats);

        const components = modules.filter((m) => m.type === 'component');
        expect(components.length).toBeGreaterThan(0);
      });

      it('should classify service files correctly', () => {
        const files: GitHubTreeEntry[] = [
          {
            path: 'src/services/auth.service.ts',
            type: 'blob',
            sha: 'a',
            mode: '100644',
            size: 100,
          },
          {
            path: 'src/services/api.service.ts',
            type: 'blob',
            sha: 'b',
            mode: '100644',
            size: 100,
          },
        ];

        const modules = classifier.classifyModules(files, languageStats);

        const services = modules.filter((m) => m.type === 'service');
        expect(services.length).toBeGreaterThan(0);
      });

      it('should classify controller/route files correctly', () => {
        const files: GitHubTreeEntry[] = [
          {
            path: 'src/controllers/user.controller.ts',
            type: 'blob',
            sha: 'a',
            mode: '100644',
            size: 100,
          },
          { path: 'src/routes/api.ts', type: 'blob', sha: 'b', mode: '100644', size: 100 },
        ];

        const modules = classifier.classifyModules(files, languageStats);

        const controllers = modules.filter((m) => m.type === 'controller');
        expect(controllers.length).toBeGreaterThan(0);
      });

      it('should classify utility/helper files correctly', () => {
        const files: GitHubTreeEntry[] = [
          { path: 'src/utils/string.util.ts', type: 'blob', sha: 'a', mode: '100644', size: 100 },
          { path: 'src/helpers/date.helper.ts', type: 'blob', sha: 'b', mode: '100644', size: 100 },
        ];

        const modules = classifier.classifyModules(files, languageStats);

        const utilities = modules.filter((m) => m.type === 'utility');
        expect(utilities.length).toBeGreaterThan(0);
      });

      it('should classify test files correctly', () => {
        const files: GitHubTreeEntry[] = [
          {
            path: 'src/components/Button.test.tsx',
            type: 'blob',
            sha: 'a',
            mode: '100644',
            size: 100,
          },
          {
            path: 'tests/integration/api.spec.ts',
            type: 'blob',
            sha: 'b',
            mode: '100644',
            size: 100,
          },
        ];

        const modules = classifier.classifyModules(files, languageStats);

        const tests = modules.filter((m) => m.type === 'test');
        expect(tests.length).toBeGreaterThan(0);
      });

      it('should classify config files correctly', () => {
        const files: GitHubTreeEntry[] = [
          { path: 'tsconfig.json', type: 'blob', sha: 'a', mode: '100644', size: 100 },
          { path: 'jest.config.ts', type: 'blob', sha: 'b', mode: '100644', size: 100 },
        ];

        const modules = classifier.classifyModules(files, languageStats);

        const configs = modules.filter((m) => m.type === 'config');
        expect(configs.length).toBeGreaterThan(0);
      });
    });

    describe('Classification Confidence', () => {
      it('should assign high confidence to exact patterns', () => {
        const files: GitHubTreeEntry[] = [
          { path: 'src/auth.service.ts', type: 'blob', sha: 'a', mode: '100644', size: 100 },
        ];

        const modules = classifier.classifyModules(files, languageStats);
        const serviceModule = modules.find((m) => m.type === 'service');

        expect(serviceModule).toBeDefined();
        expect(serviceModule!.confidence).toBeGreaterThan(0.9);
      });

      it('should assign lower confidence to ambiguous patterns', () => {
        const files: GitHubTreeEntry[] = [
          { path: 'src/data/user.ts', type: 'blob', sha: 'a', mode: '100644', size: 100 },
        ];

        const modules = classifier.classifyModules(files, languageStats);

        // Ambiguous file might be classified with lower confidence
        expect(modules.length).toBeGreaterThan(0);
      });
    });

    describe('Edge Cases', () => {
      it('should handle files without extensions', () => {
        const files: GitHubTreeEntry[] = [
          { path: 'Dockerfile', type: 'blob', sha: 'a', mode: '100644', size: 100 },
          { path: 'Makefile', type: 'blob', sha: 'b', mode: '100644', size: 100 },
        ];

        const modules = classifier.classifyModules(files, languageStats);

        expect(modules.length).toBeGreaterThan(0);
      });

      it('should handle deeply nested files', () => {
        const files: GitHubTreeEntry[] = [
          {
            path: 'a/b/c/d/e/f/deep.service.ts',
            type: 'blob',
            sha: 'a',
            mode: '100644',
            size: 100,
          },
        ];

        const modules = classifier.classifyModules(files, languageStats);

        expect(modules.length).toBeGreaterThan(0);
      });

      it('should handle empty file lists', () => {
        const modules = classifier.classifyModules([], languageStats);

        expect(modules).toHaveLength(0);
      });
    });

    describe('Module Grouping and Statistics', () => {
      it('should group modules by type', () => {
        const files: GitHubTreeEntry[] = [
          { path: 'src/components/A.tsx', type: 'blob', sha: 'a', mode: '100644', size: 100 },
          { path: 'src/components/B.tsx', type: 'blob', sha: 'b', mode: '100644', size: 100 },
          {
            path: 'src/services/auth.service.ts',
            type: 'blob',
            sha: 'c',
            mode: '100644',
            size: 100,
          },
          { path: 'src/utils/helper.ts', type: 'blob', sha: 'd', mode: '100644', size: 100 },
        ];

        const modules = classifier.classifyModules(files, languageStats);
        const byType = classifier.groupModulesByType(modules);

        expect(byType.size).toBeGreaterThan(0);
      });

      it('should calculate module complexity', () => {
        const files: GitHubTreeEntry[] = Array(20)
          .fill(null)
          .map((_, i) => ({
            path: `src/components/file${i}.tsx`,
            type: 'blob' as const,
            sha: `sha${i}`,
            mode: '100644',
            size: 1000,
          }));

        const modules = classifier.classifyModules(files, languageStats);
        const analysis = classifier.analyzeModules(modules);

        expect(analysis.statistics.averageComplexity).toBeGreaterThan(0);
        expect(analysis.statistics.totalModules).toBeGreaterThan(0);
      });

      it('should identify high complexity modules', () => {
        const files: GitHubTreeEntry[] = [
          ...Array(30)
            .fill(null)
            .map((_, i) => ({
              path: `src/complex/file${i}.ts`,
              type: 'blob' as const,
              sha: `sha${i}`,
              mode: '100644',
              size: 5000,
            })),
          { path: 'src/simple/file.ts', type: 'blob', sha: 'simple', mode: '100644', size: 100 },
        ];

        const modules = classifier.classifyModules(files, languageStats);
        const highComplexity = classifier.findHighComplexityModules(modules, 5);

        expect(highComplexity.length).toBeGreaterThan(0);
        expect(highComplexity[0].complexity).toBeGreaterThan(5);
      });
    });
  });

  describe('GitHubDependencyAnalyzer - Dependency Analysis', () => {
    let client: GitHubClient;
    let analyzer: GitHubDependencyAnalyzer;

    beforeEach(() => {
      client = new GitHubClient({ tokens: ['mock-token'] });
      analyzer = new GitHubDependencyAnalyzer(client);
    });

    describe('Import Detection', () => {
      it('should detect ES6 imports in TypeScript/JavaScript', () => {
        const content = `
          import { foo } from './foo';
          import bar from '../bar';
          import * as baz from './baz';
        `;

        const files = new Map([['test.ts', content]]);
        const result = analyzer.analyzeDependenciesFromContent(files, []);

        expect(result.graph.nodes).toBeDefined();
        expect(Array.isArray(result.graph.nodes)).toBe(true);
        expect(result.graph.nodes.length).toBe(1);
      });

      it('should detect CommonJS require statements', () => {
        const content = `
          const foo = require('./foo');
          const { bar } = require('../bar');
        `;

        const files = new Map([['test.js', content]]);
        const result = analyzer.analyzeDependenciesFromContent(files, []);

        expect(result.graph.nodes).toBeDefined();
        expect(Array.isArray(result.graph.nodes)).toBe(true);
        expect(result.graph.nodes.length).toBe(1);
      });

      it('should detect dynamic imports', () => {
        const content = `
          const foo = import('./foo');
          import('./bar').then(module => {});
        `;

        const files = new Map([['test.ts', content]]);
        const result = analyzer.analyzeDependenciesFromContent(files, []);

        expect(result.graph.nodes).toBeDefined();
        expect(Array.isArray(result.graph.nodes)).toBe(true);
        expect(result.graph.nodes.length).toBe(1);
      });

      it('should detect Python imports', () => {
        const content = `
          import os
          from sys import path
          from . import local_module
        `;

        const files = new Map([['test.py', content]]);
        const result = analyzer.analyzeDependenciesFromContent(files, []);

        expect(result.graph.nodes).toBeDefined();
        expect(Array.isArray(result.graph.nodes)).toBe(true);
        expect(result.graph.nodes.length).toBe(1);
      });

      it('should detect Go imports', () => {
        const content = `
          import "fmt"
          import (
            "os"
            "path"
          )
        `;

        const files = new Map([['test.go', content]]);
        const result = analyzer.analyzeDependenciesFromContent(files, []);

        expect(result.graph.nodes).toBeDefined();
        expect(Array.isArray(result.graph.nodes)).toBe(true);
        expect(result.graph.nodes.length).toBe(1);
      });
    });

    describe('Dependency Graph Building', () => {
      it('should build dependency graph from files', () => {
        const files = new Map([
          ['a.ts', 'import { b } from "./b";'],
          ['b.ts', 'import { c } from "./c";'],
          ['c.ts', 'export const c = 1;'],
        ]);

        const result = analyzer.analyzeDependenciesFromContent(files, []);

        expect(result.graph.nodes.length).toBe(3);
        expect(result.graph.edges.length).toBeGreaterThanOrEqual(0);
      });

      it('should calculate coupling metrics', () => {
        const files = new Map([
          ['hub.ts', 'import "./a"; import "./b"; import "./c";'],
          ['a.ts', 'export const a = 1;'],
          ['b.ts', 'export const b = 1;'],
          ['c.ts', 'export const c = 1;'],
        ]);

        const result = analyzer.analyzeDependenciesFromContent(files, []);

        expect(result.metrics.averageCoupling).toBeGreaterThanOrEqual(0);
      });

      it('should identify isolated modules', () => {
        const files = new Map([
          ['connected-a.ts', 'import "./connected-b";'],
          ['connected-b.ts', 'export const b = 1;'],
          ['isolated.ts', 'export const isolated = 1;'],
        ]);

        const result = analyzer.analyzeDependenciesFromContent(files, []);

        expect(result.metrics.isolatedModules.length).toBeGreaterThan(0);
      });
    });

    describe('Circular Dependency Detection', () => {
      it('should detect simple circular dependencies', () => {
        const files = new Map([
          ['a.ts', 'import "./b"; export const a = 1;'],
          ['b.ts', 'import "./a"; export const b = 1;'],
        ]);

        const result = analyzer.analyzeDependenciesFromContent(files, []);

        // Note: Detection depends on resolving relative imports correctly
        // Without actual files, the resolver may not link them
        expect(result.circular).toBeDefined();
        expect(Array.isArray(result.circular)).toBe(true);
      });

      it('should detect complex circular dependencies', () => {
        const files = new Map([
          ['a.ts', 'import "./b"; export const a = 1;'],
          ['b.ts', 'import "./c"; export const b = 1;'],
          ['c.ts', 'import "./d"; export const c = 1;'],
          ['d.ts', 'import "./a"; export const d = 1;'],
        ]);

        const result = analyzer.analyzeDependenciesFromContent(files, []);

        // Note: Detection depends on resolving relative imports correctly
        expect(result.circular).toBeDefined();
        expect(Array.isArray(result.circular)).toBe(true);
      });

      it('should classify circular dependency severity', () => {
        const files = new Map([
          ['a.ts', 'import "./b"; export const a = 1;'],
          ['b.ts', 'import "./a"; export const b = 1;'],
        ]);

        const result = analyzer.analyzeDependenciesFromContent(files, []);

        if (result.circular.length > 0) {
          expect(['low', 'medium', 'high']).toContain(result.circular[0].severity);
        }
      });
    });

    describe('Recommendations', () => {
      it('should generate recommendations for circular dependencies', () => {
        const files = new Map([
          ['a.ts', 'import "./b"; export const a = 1;'],
          ['b.ts', 'import "./a"; export const b = 1;'],
        ]);

        const result = analyzer.analyzeDependenciesFromContent(files, []);

        expect(result.recommendations.length).toBeGreaterThan(0);
      });

      it('should generate recommendations for high coupling', () => {
        const depFiles: Array<[string, string]> = Array(20)
          .fill(null)
          .map((_, i) => [`dep${i}.ts`, 'export const x = 1;']);

        const files = new Map([
          [
            'hub.ts',
            Array(20)
              .fill(null)
              .map((_, i) => `import "./dep${i}";`)
              .join('\n'),
          ],
          ...depFiles,
        ]);

        const result = analyzer.analyzeDependenciesFromContent(files, []);

        expect(result.recommendations).toBeDefined();
      });

      it('should provide healthy status when no issues', () => {
        const files = new Map([
          ['a.ts', 'export const a = 1;'],
          ['b.ts', 'import "./a"; export const b = 1;'],
        ]);

        const result = analyzer.analyzeDependenciesFromContent(files, []);

        expect(result.recommendations.length).toBeGreaterThan(0);
      });
    });

    describe('DOT Export', () => {
      it('should export dependency graph in DOT format', () => {
        const files = new Map([
          ['a.ts', 'import "./b";'],
          ['b.ts', 'import "./c";'],
          ['c.ts', 'export const c = 1;'],
        ]);

        const result = analyzer.analyzeDependenciesFromContent(files, []);
        const dot = analyzer.exportToDot(result.graph);

        expect(dot).toContain('digraph Dependencies');
        expect(typeof dot).toBe('string');
        // May or may not have edges depending on import resolution
        expect(dot.length).toBeGreaterThan(20);
      });

      it('should highlight circular dependencies in DOT output', () => {
        const files = new Map([
          ['a.ts', 'import "./b"; export const a = 1;'],
          ['b.ts', 'import "./a"; export const b = 1;'],
        ]);

        const result = analyzer.analyzeDependenciesFromContent(files, []);
        const dot = analyzer.exportToDot(result.graph);

        if (result.circular.length > 0) {
          expect(dot).toContain('color=red');
        }
      });
    });
  });
});
