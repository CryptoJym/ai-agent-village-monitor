/*
  Utilities for rate-limit aware backoff with jitter for GitHub API calls.

  Behavior:
  - Honor Retry-After (seconds) if provided
  - If X-RateLimit-Remaining = 0 and X-RateLimit-Reset present, wait until reset time
  - Otherwise use exponential backoff with jitter
*/

import { inc, observe } from '../metrics';

export function computeBackoffDelayMs(
  err: any,
  attempt: number,
  opts: { baseMs?: number; capMs?: number; jitterMs?: number } = {}
): number {
  const baseMs = opts.baseMs ?? 500;
  const capMs = opts.capMs ?? 30_000;
  const jitterMs = opts.jitterMs ?? 250;

  const headers: Record<string, any> | undefined = err?.response?.headers || err?.headers;

  // Retry-After (seconds) from abuse or secondary rate limits
  const ra = Number(headers?.['retry-after']);
  if (!Number.isNaN(ra) && ra > 0) {
    const ms = Math.min(ra * 1000 + Math.floor(Math.random() * jitterMs), capMs);
    observe('github_backoff_ms', ms, { reason: 'retry_after' });
    inc('github_backoff', { reason: 'retry_after' });
    return ms;
  }

  // Primary core rate limit
  const remaining = Number(headers?.['x-ratelimit-remaining']);
  const reset = Number(headers?.['x-ratelimit-reset']); // epoch seconds
  if (!Number.isNaN(remaining) && remaining === 0 && !Number.isNaN(reset)) {
    const untilReset = Math.max(0, reset * 1000 - Date.now());
    const ms = Math.min(untilReset + Math.floor(Math.random() * jitterMs), capMs);
    observe('github_backoff_ms', ms, { reason: 'rate_reset' });
    inc('github_backoff', { reason: 'rate_reset' });
    return ms;
  }

  // Default exponential backoff with jitter
  const backoff = baseMs * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * jitterMs);
  const ms = Math.min(backoff + jitter, capMs);
  observe('github_backoff_ms', ms, { reason: 'exponential' });
  inc('github_backoff', { reason: 'exponential' });
  return ms;
}
