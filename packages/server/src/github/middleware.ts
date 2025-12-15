import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createGitHubClientFromEnv, GitHubClient } from './client';

declare module 'express-serve-static-core' {
  interface Request {
    github?: GitHubClient;
  }
}

export function githubMiddleware(): RequestHandler {
  const client = createGitHubClientFromEnv();
  return function attach(req: Request, _res: Response, next: NextFunction): void {
    req.github = client;
    next();
  };
}
