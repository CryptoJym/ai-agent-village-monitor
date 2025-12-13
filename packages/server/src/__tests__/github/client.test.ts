import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubClient } from '../../github/client';
import nock from 'nock';

describe('GitHubClient', () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  describe('getRepository', () => {
    it('should fetch repository details via GraphQL', async () => {
      const client = new GitHubClient({ tokens: ['test-token'] });

      const mockResponse = {
        data: {
          rateLimit: {
            limit: 5000,
            remaining: 4999,
            resetAt: '2024-01-01T00:00:00Z',
          },
          repository: {
            id: 'R_123',
            name: 'test-repo',
            nameWithOwner: 'owner/test-repo',
            description: 'Test repository',
            stargazerCount: 100,
            forkCount: 10,
            updatedAt: '2024-01-01T00:00:00Z',
            isPrivate: false,
            isEmpty: false,
            primaryLanguage: {
              name: 'TypeScript',
            },
            defaultBranchRef: {
              name: 'main',
              target: {
                oid: 'abc123',
                committedDate: '2024-01-01T00:00:00Z',
              },
            },
            languages: {
              totalSize: 10000,
              edges: [
                { size: 8000, node: { name: 'TypeScript' } },
                { size: 2000, node: { name: 'JavaScript' } },
              ],
            },
          },
        },
      };

      nock('https://api.github.com')
        .post('/graphql')
        .reply(200, mockResponse);

      const repo = await client.getRepository('owner', 'test-repo');

      expect(repo).toBeDefined();
      expect(repo.name).toBe('test-repo');
      expect(repo.nameWithOwner).toBe('owner/test-repo');
      expect(repo.primaryLanguage).toBe('TypeScript');
      expect(repo.languages?.languages).toHaveLength(2);
    });

    it('should cache repository results', async () => {
      const client = new GitHubClient({ tokens: ['test-token'], cacheTTL: 60000 });

      const mockResponse = {
        data: {
          rateLimit: { limit: 5000, remaining: 4999 },
          repository: {
            id: 'R_123',
            name: 'test-repo',
            nameWithOwner: 'owner/test-repo',
            stargazerCount: 100,
            forkCount: 10,
            updatedAt: '2024-01-01T00:00:00Z',
            isPrivate: false,
            isEmpty: false,
            languages: { totalSize: 0, edges: [] },
          },
        },
      };

      nock('https://api.github.com')
        .post('/graphql')
        .reply(200, mockResponse);

      // First call
      await client.getRepository('owner', 'test-repo');

      // Second call should use cache
      const repo2 = await client.getRepository('owner', 'test-repo');

      expect(repo2.name).toBe('test-repo');
      expect(client.metrics.cacheHits).toBe(1);
    });
  });

  describe('getRepositoryTree', () => {
    it('should fetch repository tree recursively', async () => {
      const client = new GitHubClient({ tokens: ['test-token'] });

      nock('https://api.github.com')
        .get('/repos/owner/test-repo/git/trees/HEAD')
        .query({ recursive: 'true' })
        .reply(200, {
          tree: [
            {
              path: 'src/index.ts',
              mode: '100644',
              type: 'blob',
              sha: 'abc123',
              size: 1000,
            },
            {
              path: 'package.json',
              mode: '100644',
              type: 'blob',
              sha: 'def456',
              size: 500,
            },
          ],
        });

      const tree = await client.getRepositoryTree('owner', 'test-repo');

      expect(tree).toHaveLength(2);
      expect(tree[0].path).toBe('src/index.ts');
      expect(tree[0].type).toBe('blob');
      expect(tree[1].path).toBe('package.json');
    });
  });

  describe('getFileContent', () => {
    it('should fetch and decode file content', async () => {
      const client = new GitHubClient({ tokens: ['test-token'] });

      const content = 'console.log("Hello, World!");';
      const encoded = Buffer.from(content).toString('base64');

      nock('https://api.github.com')
        .get('/repos/owner/test-repo/contents/src/index.ts')
        .reply(200, {
          type: 'file',
          content: encoded,
          encoding: 'base64',
        });

      const fileContent = await client.getFileContent('owner', 'test-repo', 'src/index.ts');

      expect(fileContent).toBe(content);
    });

    it('should throw error for directory paths', async () => {
      const client = new GitHubClient({ tokens: ['test-token'] });

      nock('https://api.github.com')
        .get('/repos/owner/test-repo/contents/src')
        .reply(200, [
          { type: 'file', name: 'index.ts' },
          { type: 'file', name: 'app.ts' },
        ]);

      await expect(
        client.getFileContent('owner', 'test-repo', 'src'),
      ).rejects.toThrow();
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return rate limit status', async () => {
      const client = new GitHubClient({ tokens: ['test-token'], rateLimitBudget: 1000 });

      client.lastRate = {
        limit: 5000,
        remaining: 4500,
        reset: Math.floor(Date.now() / 1000) + 3600,
      };

      const status = client.getRateLimitStatus();

      expect(status.limit).toBe(5000);
      expect(status.remaining).toBe(4500);
      expect(status.used).toBe(500);
      expect(status.budget).toBe(1000);
      expect(status.budgetRemaining).toBe(500);
    });
  });

  describe('batchQuery', () => {
    it('should execute queries in batches', async () => {
      const client = new GitHubClient({ tokens: ['test-token'] });

      const queries = Array.from({ length: 12 }, (_, i) => async () => i);

      const results = await client.batchQuery(queries);

      expect(results).toHaveLength(12);
      expect(results[0]).toBe(0);
      expect(results[11]).toBe(11);
    });

    it('should stop batching when rate limit budget is low', async () => {
      const client = new GitHubClient({ tokens: ['test-token'], rateLimitBudget: 150 });

      client.lastRate = {
        limit: 5000,
        remaining: 4900,
        reset: Math.floor(Date.now() / 1000) + 3600,
      };

      const queries = Array.from({ length: 20 }, (_, i) => async () => i);

      const results = await client.batchQuery(queries);

      // Should stop early due to low budget
      expect(results.length).toBeLessThan(20);
    });
  });

  describe('clearCache', () => {
    it('should clear all caches', async () => {
      const client = new GitHubClient({ tokens: ['test-token'] });

      // Add some cache entries
      const mockResponse = {
        data: {
          rateLimit: { limit: 5000, remaining: 4999 },
          repository: {
            id: 'R_123',
            name: 'test-repo',
            nameWithOwner: 'owner/test-repo',
            stargazerCount: 100,
            forkCount: 10,
            updatedAt: '2024-01-01T00:00:00Z',
            isPrivate: false,
            isEmpty: false,
            languages: { totalSize: 0, edges: [] },
          },
        },
      };

      nock('https://api.github.com')
        .post('/graphql')
        .times(2)
        .reply(200, mockResponse);

      await client.getRepository('owner', 'test-repo');
      expect(client.metrics.cacheHits).toBe(0);

      // Clear cache
      client.clearCache();

      // Next call should not hit cache
      await client.getRepository('owner', 'test-repo');
      expect(client.metrics.cacheHits).toBe(0);
    });
  });
});
