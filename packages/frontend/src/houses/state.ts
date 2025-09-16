import type { House } from './House';

export type HouseState = {
  name: string;
  stars?: number;
  primaryLanguage?: string;
  openIssues?: number;
  lastCommitAt?: number; // epoch ms
  buildStatus?: 'idle' | 'in_progress' | 'failed' | 'passed';
  activityPulse?: boolean;
};

export type MappingOptions = {
  issueThresholds?: { low: number; med: number; high: number };
  commitPulseMs?: number;
};

const DEFAULTS: Required<MappingOptions> = {
  issueThresholds: { low: 5, med: 10, high: 25 },
  commitPulseMs: 3000,
};

export function applyRepoStateToHouse(
  house: House,
  state: HouseState,
  now: number = Date.now(),
  options?: MappingOptions,
) {
  const opts = { ...DEFAULTS, ...(options || {}) };

  // Name/label
  if (state.name) house.setLabel(state.name);

  // Language-based styling (non-destructive)
  if (state.primaryLanguage) house.applyLanguageStyle(state.primaryLanguage);

  // Health/scaffolding from issues
  const issues = state.openIssues ?? 0;
  let sev: 'none' | 'low' | 'med' | 'high' = 'none';
  if (issues >= opts.issueThresholds.high) sev = 'high';
  else if (issues >= opts.issueThresholds.med) sev = 'med';
  else if (issues >= opts.issueThresholds.low) sev = 'low';
  house.setScaffoldingSeverity(sev);
  // Compatibility with existing tint behavior
  house.setHealth(issues);

  // Activity: commit pulse lights for recent commits
  const lastCommit = state.lastCommitAt ?? 0;
  if (lastCommit > 0 && now - lastCommit <= opts.commitPulseMs) {
    // Avoid replaying for the same commit timestamp
    const k = '__lastCommitFlashAt' as any;
    const last: number | undefined = (house as any)[k];
    if (!last || last < lastCommit) {
      (house as any)[k] = lastCommit;
      house.triggerCommitFlash(Math.max(500, opts.commitPulseMs / 2));
    }
  }

  // Builds → chimney smoke
  switch (state.buildStatus) {
    case 'in_progress':
      house.startSmoke('building');
      break;
    case 'failed':
      house.stopSmoke();
      // Single red puff to indicate result
      house.startSmoke('failed');
      // Stop after one burst if timer exists
      house.stopSmoke();
      break;
    case 'passed':
      house.stopSmoke();
      // Green celebratory puff
      house.startSmoke('passed');
      house.stopSmoke();
      break;
    default:
      house.stopSmoke();
  }
}
