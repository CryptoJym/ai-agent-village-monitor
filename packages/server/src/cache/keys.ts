// Cache key helpers for GitHub-derived data
// Schema follows: org:{org}:repos, repo:{repo}:languages, repo:{repo}:issues:{state}
// Values are JSON-serialized payloads; TTL policy defined by callers.

export type IssueState = 'open' | 'closed' | 'all';

// Organization repositories listing (e.g., list of { id, nameWithOwner, ... })
export function keyOrgRepos(orgLoginOrId: string | number) {
  return `org:${String(orgLoginOrId)}:repos`;
}

// Repository languages histogram from GitHub API
export function keyRepoLanguages(repoIdOrName: string | number) {
  return `repo:${String(repoIdOrName)}:languages`;
}

// Repository issues list cache. When state omitted, default is 'open'.
export function keyRepoIssues(repoIdOrName: string | number, state: IssueState = 'open') {
  return `repo:${String(repoIdOrName)}:issues:${state}`;
}

// Suggested TTLs (in seconds). Callers can choose per datum.
export const TTL = {
  SHORT: 60 * 5,       // 5 minutes
  MEDIUM: 60 * 15,     // 15 minutes
  LONG: 60 * 60,       // 60 minutes
} as const;

