/**
 * Update Pipeline Package
 *
 * Runtime update and compatibility pipeline for AI Agent Village Monitor.
 *
 * Components:
 * - VersionWatcher: Monitors upstream providers for new versions
 * - CanaryRunner: Runs compatibility tests against candidate builds
 * - RolloutController: Manages staged rollouts across organizations
 * - KnownGoodRegistry: Tracks tested and validated builds
 * - SweepManager: Triggers post-update repository improvement sweeps
 * - UpdatePipeline: Main orchestrator coordinating all components
 */

// Main orchestrator
export { UpdatePipeline } from './UpdatePipeline';
export type { UpdatePipelineConfig, PipelineStatus } from './UpdatePipeline';

// Version watching
export * from './version';

// Canary testing
export * from './canary';

// Rollout management
export * from './rollout';

// Known-good registry
export * from './registry';

// Post-update sweeps
export * from './sweep';

// Types
export type {
  // Version types
  RuntimeVersion,
  AdapterVersion,
  RunnerBuild,

  // Channel types
  ReleaseChannel,
  ChannelConfig,

  // Canary types
  CanaryTestSuite,
  CanaryTestCase,
  CanaryTestResult,
  TestCaseResult,
  CanaryMetrics,
  CompatibilityResult,

  // Rollout types
  RolloutState,
  RolloutEvent,
  ActiveRollout,

  // Organization types
  OrgRuntimeConfig,

  // Sweep types
  SweepConfig,
  SweepRepoTarget,
  SweepResult,

  // Registry types
  KnownGoodEntry,
} from './types';

// Constants
export { CHANNEL_CONFIGS } from './types';

// Schemas
export {
  RuntimeVersionSchema,
  ReleaseChannelSchema,
  CanaryMetricsSchema,
  RolloutStateSchema,
  OrgRuntimeConfigSchema,
} from './types';

// Type guards
export { isRuntimeVersion, isReleaseChannel } from './types';
