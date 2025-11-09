import type { Request, Response, NextFunction } from 'express';
import { createGitHubClientFromEnv, GitHubClient } from './client';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      github?: GitHubClient;
    }
  }
}

export function githubMiddleware() {
  const client = createGitHubClientFromEnv();
  return function attach(req: Request, _res: Response, next: NextFunction) {
    req.github = client;
    next();
  };
}
