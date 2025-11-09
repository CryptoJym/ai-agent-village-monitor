import { createGitHubClientFromEnv, GitHubClient } from './client';
import { withCache } from '../cache/cache';
import { keyOrgRepos } from '../cache/keys';
import { isCacheEnabled, ttlForOrgRepos } from '../cache/policy';

export type RepoInfo = {
  id: string;
  name: string;
  owner?: string;
  primaryLanguage?: string | null;
  stargazers?: number;
  updatedAt?: string;
};

export class GitHubService {
  private client: GitHubClient;
  constructor(client: GitHubClient = createGitHubClientFromEnv()) {
    this.client = client;
  }

  async listOrgReposREST(org: string): Promise<RepoInfo[]> {
    const repos = await this.client.listOrgRepos(org);
    return repos.map((r: any) => ({ id: String(r.id), name: r.name, updatedAt: r.updated_at }));
  }

  async listOrgReposGraphQL(org: string): Promise<RepoInfo[]> {
    const out: RepoInfo[] = [];
    let cursor: string | undefined = undefined;
    // paginate using client's GraphQL helper
    while (true) {
      const page = await (this.client as any).listOrgReposGraphQL(org, cursor);
      const nodes = page?.nodes ?? [];
      for (const n of nodes) {
        const owner =
          typeof n.nameWithOwner === 'string' ? String(n.nameWithOwner).split('/')[0] : undefined;
        out.push({
          id: n.id,
          name: n.name,
          owner,
          primaryLanguage: n.primaryLanguage,
          stargazers: n.stargazerCount,
          updatedAt: n.updatedAt,
        });
      }
      const info: { hasNextPage: boolean; endCursor?: string | null } = page?.pageInfo ?? {
        hasNextPage: false,
      };
      if (!info.hasNextPage) break;
      cursor = info.endCursor || undefined;
    }
    return out;
  }

  // Cached GraphQL repo listing with REST fallback for resilience.
  async listOrgReposPreferGraphQLWithFallback(
    org: string,
    opts?: { bypassCache?: boolean },
  ): Promise<RepoInfo[]> {
    const key = keyOrgRepos(org);
    const ttl = ttlForOrgRepos();
    const useCache = isCacheEnabled() && !opts?.bypassCache;
    const fetcher = async () => {
      try {
        return await this.listOrgReposGraphQL(org);
      } catch {
        return await this.listOrgReposREST(org);
      }
    };
    if (!useCache) return fetcher();
    return withCache(key, ttl, fetcher);
  }

  async getRepoLanguages(owner: string, repo: string): Promise<Record<string, number>> {
    return this.client.getRepoLanguages(owner, repo) as unknown as Record<string, number>;
  }
}
