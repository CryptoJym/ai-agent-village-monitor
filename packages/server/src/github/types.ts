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

