import { describe, it, expect, beforeAll, afterAll } from 'vitest';
let nock: any;
try { nock = (await import('nock')).default; } catch { /* no-op, will skip */ }
import { createGitHubClientFromEnv } from '../github/client';

const maybe = (nock && process.env.SKIP_GH_TESTS !== 'true') ? describe : describe.skip;
maybe('GitHubClient GraphQL retry/backoff', () => {
  const api = 'https://api.github.com';

  beforeAll(() => {
    process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'test-token';
  });

  afterAll(() => {
    delete process.env.GITHUB_TOKEN;
  });

  it('retries GraphQL on transient failure and succeeds', async () => {
    const org = 'test-org';
    const scope = nock(api)
      .post('/graphql')
      .reply(502, { message: 'bad gateway' })
      .post('/graphql')
      .reply(200, {
        data: {
          rateLimit: { limit: 5000, remaining: 4999, resetAt: new Date().toISOString() },
          organization: {
            repositories: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  id: 'R_1',
                  name: 'one',
                  nameWithOwner: `${org}/one`,
                  primaryLanguage: { name: 'TypeScript' },
                  stargazerCount: 10,
                  updatedAt: new Date().toISOString(),
                },
              ],
            },
          },
        },
      });

    const client = createGitHubClientFromEnv();
    const page = await (client as any).listOrgReposGraphQL(org);
    expect(page.nodes.length).toBe(1);
    scope.done();
  });
});
