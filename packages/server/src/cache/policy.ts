import { config } from '../config';
import { TTL } from './keys';

export function isCacheEnabled(): boolean {
  return !!config.CACHE_ENABLED;
}

export function ttlForOrgRepos(): number {
  return Number(config.CACHE_TTL_ORG_REPOS || TTL.MEDIUM);
}

export function ttlForRepoLanguages(): number {
  return Number(config.CACHE_TTL_REPO_LANGUAGES || TTL.LONG);
}

export function ttlForRepoIssues(): number {
  return Number(config.CACHE_TTL_REPO_ISSUES || TTL.SHORT);
}

