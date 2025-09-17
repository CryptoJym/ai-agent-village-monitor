import { describe, it, expect } from 'vitest';
import { mapGitHubEventToTransitions } from '../houses/githubActivityMap';

const repo = { id: 123, full_name: 'acme/repo' };

describe('GitHub activity mapping', () => {
  it('maps push to lights on', () => {
    const t = mapGitHubEventToTransitions('push', { repository: repo, after: 'sha' });
    expect(t.some((x) => x.kind === 'lights' && x.on)).toBe(true);
  });

  it('maps pull_request opened to banner on and closed to off', () => {
    const on = mapGitHubEventToTransitions('pull_request', {
      repository: repo,
      action: 'opened',
      pull_request: { number: 42 },
    });
    expect(on.some((x) => x.kind === 'banner' && x.on && x.prNumber === 42)).toBe(true);
    const off = mapGitHubEventToTransitions('pull_request', {
      repository: repo,
      action: 'closed',
      pull_request: { number: 42 },
    });
    expect(off.some((x) => x.kind === 'banner' && !x.on)).toBe(true);
  });

  it('maps check_run created/in_progress to smoke on and completed success to off', () => {
    const on = mapGitHubEventToTransitions('check_run', {
      repository: repo,
      action: 'in_progress',
      check_run: { id: 7 },
    });
    expect(on.some((x) => x.kind === 'smoke' && x.on)).toBe(true);
    const off = mapGitHubEventToTransitions('check_run', {
      repository: repo,
      action: 'completed',
      check_run: { id: 7, conclusion: 'success' },
    });
    expect(off.some((x) => x.kind === 'smoke' && !x.on)).toBe(true);
  });
});
