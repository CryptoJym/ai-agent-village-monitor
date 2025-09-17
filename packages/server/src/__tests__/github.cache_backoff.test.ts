import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
let nock: any;
try { nock = (await import('nock')).default; } catch { /* optional; skip if unavailable */ }
import { createGitHubClientFromEnv } from '../github/client';
import { GitHubService } from '../github/service';
import { cacheGetJSON, cacheSetJSON } from '../cache/cache';
import { keyRepoIssues } from '../cache/keys';
import request from 'supertest';
import { createApp } from '../app';

const maybe = (nock && process.env.SKIP_GH_TESTS !== 'true') ? describe : describe.skip;

maybe('GitHub caching and rate-limit backoff', () => {
  const api = 'https://api.github.com';
  const org = 'test-org';

  beforeAll(() => {
    process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'test-token';
    nock.disableNetConnect();
  });

  afterAll(() => {
    delete process.env.GITHUB_TOKEN;
    nock.enableNetConnect();
    nock.cleanAll();
  });

  beforeEach(() => {
    nock.cleanAll();
  });

  it('backs off on rate-limit and succeeds (GraphQL)', async () => {
    const scope = nock(api)
      .post('/graphql')
      .reply(403, { message: 'rate limited' }, {
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000)),
      })
      .post('/graphql')
      .reply(200, {
        data: {
          rateLimit: { limit: 5000, remaining: 4999, resetAt: new Date().toISOString() },
          organization: {
            repositories: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                { id: 'R_1', name: 'one', nameWithOwner: `${org}/one`, primaryLanguage: { name: 'TypeScript' }, stargazerCount: 1, updatedAt: new Date().toISOString() },
              ],
            },
          },
        },
      });

    const client = createGitHubClientFromEnv();
    // @ts-expect-error - use client helper directly for test
    const page = await (client as any).listOrgReposGraphQL(org);
    expect(page.nodes.length).toBe(1);
    scope.done();
  });

  it('caches org repos (GraphQL) and serves from cache on second call', async () => {
    const scope = nock(api)
      .post('/graphql')
      .reply(200, {
        data: {
          rateLimit: { limit: 5000, remaining: 4999, resetAt: new Date().toISOString() },
          organization: {
            repositories: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                { id: 'R_2', name: 'two', nameWithOwner: `${org}/two`, primaryLanguage: { name: 'TS' }, stargazerCount: 2, updatedAt: new Date().toISOString() },
              ],
            },
          },
        },
      });

    const service = new GitHubService(createGitHubClientFromEnv());
    const first = await service.listOrgReposPreferGraphQLWithFallback(org);
    expect(first.length).toBe(1);
    // Second call should be served from cache without additional HTTP
    const second = await service.listOrgReposPreferGraphQLWithFallback(org);
    expect(second.length).toBe(1);
    expect(scope.isDone()).toBe(true);
  });

  it('webhook invalidation clears issue list cache', async () => {
    const repoId = '123';
    const key = keyRepoIssues(repoId, 'open');
    await cacheSetJSON(key, { list: [1, 2, 3] }, 300);
    expect(await cacheGetJSON(key)).not.toBeNull();

    const app = createApp();
    await request(app)
      .post('/api/webhooks/github')
      .set('x-github-event', 'issues')
      .send({ action: 'opened', repository: { id: Number(repoId), full_name: 'o/r' }, issue: { id: 1, number: 4 } })
      .expect(202);

    const after = await cacheGetJSON(key);
    expect(after).toBeNull();
  });
});

