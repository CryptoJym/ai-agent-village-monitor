# @ai-agent-village-monitor/update-pipeline

Version management and progressive rollout system for AI agent runtimes.

## Overview

The Update Pipeline package provides infrastructure for:

- Monitoring AI provider version releases
- Managing known-good build registry
- Progressive rollout with canary testing
- Organization-specific version targeting
- Automated and manual rollback capabilities

## Installation

```bash
pnpm add @ai-agent-village-monitor/update-pipeline
```

## Usage

### UpdatePipeline (Main Orchestrator)

```typescript
import { UpdatePipeline, UpdatePipelineConfig } from '@ai-agent-village-monitor/update-pipeline';

const config: UpdatePipelineConfig = {
  versionWatcher: {
    pollIntervalMs: 300000, // 5 minutes
    providers: ['codex', 'claude_code', 'gemini_cli', 'omnara'],
  },
  rolloutController: {
    stages: [
      { percentage: 1, durationMinutes: 60 },   // 1% for 1 hour
      { percentage: 10, durationMinutes: 120 }, // 10% for 2 hours
      { percentage: 50, durationMinutes: 240 }, // 50% for 4 hours
      { percentage: 100, durationMinutes: 0 },  // 100% complete
    ],
    canaryDurationMinutes: 60,
    autoAdvance: true,
  },
};

const pipeline = new UpdatePipeline(config);
await pipeline.start();

// Listen for events
pipeline.on('version_discovered', (version) => {
  console.log(`New version: ${version.providerId} ${version.version}`);
});

pipeline.on('rollout_completed', (rollout) => {
  console.log(`Rollout ${rollout.rolloutId} completed`);
});
```

### Version Watcher

```typescript
import { VersionWatcher } from '@ai-agent-village-monitor/update-pipeline';

const watcher = new VersionWatcher({
  pollIntervalMs: 60000,
  providers: ['codex', 'claude_code'],
});

watcher.start();

// Register a discovered version
watcher.registerVersion({
  providerId: 'codex',
  version: '1.2.0',
  releasedAt: new Date(),
  channel: 'stable',
});

// Get latest version
const latest = watcher.getLatestVersion('codex', 'stable');
console.log(`Latest Codex: ${latest?.version}`);

// Check for newer version
if (watcher.hasNewerVersion('codex', '1.0.0', 'stable')) {
  console.log('Update available!');
}

// Mark as canary-tested
watcher.markCanaryPassed('codex', '1.2.0');
```

### Rollout Controller

```typescript
import { RolloutController } from '@ai-agent-village-monitor/update-pipeline';

const controller = new RolloutController({
  stages: [
    { percentage: 1, durationMinutes: 30 },
    { percentage: 10, durationMinutes: 60 },
    { percentage: 100, durationMinutes: 0 },
  ],
  canaryDurationMinutes: 60,
  autoAdvance: false,
});

// Create a rollout
const rollout = controller.createRollout({
  buildId: 'build-001',
  channel: 'stable',
  initiatedBy: 'admin-user',
});

// Rollout lifecycle
controller.startCanary(rollout.rolloutId);
// ... monitor canary ...
controller.passCanary(rollout.rolloutId);
controller.startRollout(rollout.rolloutId);

// Manual stage advancement (if autoAdvance is false)
controller.advanceStage(rollout.rolloutId);

// Pause/Resume
controller.pauseRollout(rollout.rolloutId);
controller.resumeRollout(rollout.rolloutId);

// Emergency rollback
controller.rollback(rollout.rolloutId, 'Critical bug detected');
```

### Known-Good Registry

```typescript
import { KnownGoodRegistry } from '@ai-agent-village-monitor/update-pipeline';

const registry = new KnownGoodRegistry();

// Register a build
registry.registerBuild({
  buildId: 'build-001',
  runnerVersion: '2.0.0',
  builtAt: new Date(),
  runtimeVersions: {
    codex: '1.2.0',
    claude_code: '3.5.0',
    gemini_cli: '2.0.0',
    omnara: '1.0.0',
  },
});

// Promote to known-good
registry.promoteToKnownGood('build-001', 'codex');

// Get recommended build
const recommended = registry.getRecommendedBuild('codex', 'stable');
```

## Rollout States

```
pending -> canary_testing -> canary_passed -> rolling_out -> completed
                          -> canary_failed
           rolling_out -> paused -> rolling_out
           rolling_out -> rolled_back
```

## Events

### UpdatePipeline Events

| Event | Description |
|-------|-------------|
| `version_discovered` | New provider version detected |
| `canary_passed` | Version passed canary testing |
| `rollout_started` | Rollout began |
| `rollout_completed` | Rollout finished successfully |
| `rollback_initiated` | Emergency rollback started |

### RolloutController Events

| Event | Description |
|-------|-------------|
| `rollout_created` | New rollout created |
| `state_changed` | Rollout state transition |
| `stage_advanced` | Moved to next percentage stage |
| `rollout_completed` | Reached 100% |

## Configuration

### VersionWatcher Config

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pollIntervalMs` | number | 300000 | Polling interval (5 min) |
| `providers` | ProviderId[] | All | Providers to monitor |

### RolloutController Config

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `stages` | Stage[] | 4-stage | Rollout percentage stages |
| `canaryDurationMinutes` | number | 60 | Canary testing duration |
| `autoAdvance` | boolean | false | Auto-advance stages |

## Types

```typescript
type RolloutState =
  | 'pending'
  | 'canary_testing'
  | 'canary_passed'
  | 'canary_failed'
  | 'rolling_out'
  | 'paused'
  | 'completed'
  | 'rolled_back';

type ReleaseChannel = 'stable' | 'beta' | 'pinned';

interface RuntimeVersion {
  providerId: ProviderId;
  version: string;
  releasedAt: Date;
  channel: 'stable' | 'beta';
  canaryPassed?: boolean;
  canaryPassedAt?: Date;
}

interface ActiveRollout {
  rolloutId: string;
  targetBuildId: string;
  channel: ReleaseChannel;
  state: RolloutState;
  currentPercentage: number;
  startedAt: Date;
  lastUpdatedAt: Date;
  affectedOrgs: string[];
}
```

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## License

MIT
