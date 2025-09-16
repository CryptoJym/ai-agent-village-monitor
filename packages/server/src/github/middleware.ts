import type { Request, Response, NextFunction } from 'express';
import { createGitHubClientFromEnv, GitHubClient } from './client';

declare module 'express-serve-static-core' {
  interface Request {
    github?: GitHubClient;
  }
}

export function githubMiddleware() {
  const client = createGitHubClientFromEnv();
  return function attach(req: Request, _res: Response, next: NextFunction) {
    req.github = client;
    next();
  };
}

