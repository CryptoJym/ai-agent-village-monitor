import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createGitHubClientFromEnv, GitHubClient } from './client';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      github?: GitHubClient;
    }
  }
}

export function githubMiddleware(): RequestHandler {
  const client = createGitHubClientFromEnv();
  return function attach(req: Request, _res: Response, next: NextFunction): void {
    (req as any).github = client;
    next();
  };
}

