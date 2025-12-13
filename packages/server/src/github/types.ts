export type RateInfo = {
  limit?: number;
  remaining?: number;
  reset?: number;
};

export type NormalizedError = {
  status: number;
  code?: string;
  message: string;
};

export type GitHubTokens = {
  tokens: string[];
};

// Repository types
export type Repository = {
  id: string;
  name: string;
  nameWithOwner: string;
  description?: string;
  primaryLanguage?: string;
  stargazerCount: number;
  forkCount: number;
  updatedAt: string;
  defaultBranchRef?: {
    name: string;
    target: {
      oid: string;
      committedDate: string;
    };
  };
  languages?: LanguageStats;
  isPrivate: boolean;
  isEmpty: boolean;
};

export type LanguageStats = {
  totalSize: number;
  languages: Array<{
    name: string;
    size: number;
    percentage: number;
  }>;
};

// Tree types
export type TreeEntry = {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
  url?: string;
};

export type FileMetadata = {
  path: string;
  size: number;
  type: 'file' | 'directory';
  sha: string;
  mode: string;
  language?: string;
};

// Commit types
export type CommitInfo = {
  sha: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  message: string;
  committedDate: string;
};

// Rate limiting
export type RateLimitStatus = {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
  budget: number;
  budgetRemaining: number;
};

// Cache types
export type CacheEntry<T> = {
  data: T;
  timestamp: number;
  etag?: string;
};

export type CacheOptions = {
  ttl?: number;
  useRedis?: boolean;
};

