import { describe, it, expect, beforeAll, afterAll } from 'vitest';
let nock: any;
try { nock = (await import('nock')).default; } catch { /* no-op, will skip */ }
import { createGitHubClientFromEnv } from '../github/client';

const maybe = (nock && process.env.SKIP_GH_TESTS !== 'true') ? describe : describe.skip;
maybe('GitHubClient languages ETag caching', () => {
  const owner = 'o';
  const repo = 'r';
  const api = 'https://api.github.com';
  const path = `/repos/${owner}/${repo}/languages`;

  beforeAll(() => {
    process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'test-token';
  });

  afterAll(() => {
    delete process.env.GITHUB_TOKEN;
  });

  it('returns cached languages on 304 (ETag hit)', async () => {
    const scope = nock(api)
      .get(path)
      .reply(200, { TypeScript: 100, JavaScript: 50 }, { ETag: 'W/"etag-1"' });

    const client = createGitHubClientFromEnv();
    const first = await client.getRepoLanguages(owner, repo);
    expect(first).toHaveProperty('TypeScript', 100);
    scope.done();

    const scope304 = nock(api)
      .get(path)
      .matchHeader('If-None-Match', 'W/"etag-1"')
      .reply(304);

    const second = await client.getRepoLanguages(owner, repo);
    expect(second).toHaveProperty('TypeScript', 100);
    scope304.done();
  });
});
