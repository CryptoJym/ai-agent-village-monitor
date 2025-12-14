/**
 * Provider Adapters Module
 * Export all adapter-related functionality
 */

// Base adapter
export { BaseAdapter, type BaseAdapterConfig } from './BaseAdapter';

// Claude Code adapter
export {
  ClaudeCodeAdapter,
  createClaudeCodeAdapter,
  type ClaudeCodeAdapterConfig,
} from './ClaudeCodeAdapter';

// File watching instrumentation
export {
  FileWatcher,
  createFileWatcher,
  type FileWatcherConfig,
  type FileChangeEvent,
} from './FileWatcher';

// Diff summarization
export {
  DiffSummarizer,
  createDiffSummarizer,
  type DiffSummary,
  type FileDiff,
  type RoomSummary,
} from './DiffSummarizer';

// Re-export shared adapter types
export type {
  ProviderAdapter,
  ProviderId,
  Capability,
  DetectionResult,
  StartSessionArgs,
  TaskSpec,
  PolicySpec,
  ProviderEvent,
} from '@ai-agent-village-monitor/shared';
