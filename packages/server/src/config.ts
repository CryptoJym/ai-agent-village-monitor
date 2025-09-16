import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Attempt to load .env from both package cwd and repo root
export function loadEnv() {
  const inVitest = !!process.env.VITEST || !!process.env.VITEST_WORKER_ID;
  // Load local .env (packages/server/.env) if present — but skip during Vitest
  if (!inVitest) {
    dotenvConfig();
  }
  // Also attempt to load monorepo root .env
  if (!inVitest) {
    const repoEnv = path.resolve(__dirname, '../../../.env');
    dotenvConfig({ path: repoEnv });
  }

  // Aliases for environment variables to support common naming
  if (!process.env.GITHUB_OAUTH_CLIENT_ID && process.env.GITHUB_CLIENT_ID) {
    process.env.GITHUB_OAUTH_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
  }
  if (!process.env.GITHUB_OAUTH_CLIENT_SECRET && process.env.GITHUB_CLIENT_SECRET) {
    process.env.GITHUB_OAUTH_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
  }
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  // Cache configuration
  CACHE_ENABLED: z.coerce.boolean().default(true),
  CACHE_TTL_ORG_REPOS: z.coerce.number().int().positive().default(900), // 15m
  CACHE_TTL_REPO_LANGUAGES: z.coerce.number().int().positive().default(3600), // 60m
  CACHE_TTL_REPO_ISSUES: z.coerce.number().int().positive().default(300), // 5m
  GITHUB_OAUTH_CLIENT_ID: z.string().optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  GITHUB_TOKENS: z.string().optional(),
  // MCP Agent Controller (HTTP adapter)
  MCP_HTTP_ENDPOINT: z.string().url().optional(),
  MCP_HTTP_API_KEY: z.string().optional(),
  // OAuth and web configuration
  PUBLIC_SERVER_URL: z.string().url().optional(),
  PUBLIC_APP_URL: z.string().url().optional(),
  OAUTH_REDIRECT_URI: z.string().url().optional(),
  // Space-delimited list per GitHub OAuth spec (e.g. "read:user read:org workflow")
  OAUTH_SCOPES: z.string().default('read:user read:org workflow'),
  COOKIE_DOMAIN: z.string().optional(),
  GITHUB_TOKEN_SALT: z.string().optional(),
  // Optional 32-byte key (hex or base64) to enable AES-256-GCM encryption for OAuth tokens
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  // Optional KMS key identifier for future secrets-at-rest encryption
  KMS_KEY_ID: z.string().optional(),
  // Optional webhook secret for GitHub webhook signature validation
  WEBHOOK_SECRET: z.string().optional(),
  // Comma-separated list of allowed WS/CORS origins (overrides PUBLIC_APP_URL if provided)
  WS_ALLOWED_ORIGINS: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;

  // Additional runtime validation for production
  if (env.NODE_ENV === 'production') {
    const missing: string[] = [];
    if (!env.GITHUB_OAUTH_CLIENT_ID) missing.push('GITHUB_OAUTH_CLIENT_ID');
    if (!env.GITHUB_OAUTH_CLIENT_SECRET) missing.push('GITHUB_OAUTH_CLIENT_SECRET');
    if (!env.JWT_SECRET) missing.push('JWT_SECRET');
    // Require either explicit redirect or a server URL to derive it from
    if (!env.OAUTH_REDIRECT_URI && !env.PUBLIC_SERVER_URL) missing.push('OAUTH_REDIRECT_URI or PUBLIC_SERVER_URL');
    if (missing.length) {
      throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
    }
  }

  return env;
}

// Auto-load env and export a resolved config for convenience
loadEnv();
export const config: Env = getEnv();
export type Config = Env;
