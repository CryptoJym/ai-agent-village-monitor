/**
 * File Watcher
 * Monitors filesystem changes to generate structured events
 *
 * Per spec section 4.2: Structured events via repo instrumentation
 * Even if the provider doesn't emit structured file events, we can generate them:
 * - Watch filesystem changes
 * - Compute git diff on intervals/milestones
 * - Map files to rooms for sprite movement
 */

import { EventEmitter } from 'node:events';
import { watch, type FSWatcher } from 'node:fs';
import { stat, readdir } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';

/**
 * File change event
 */
export type FileChangeEvent = {
  path: string;
  relativePath: string;
  type: 'add' | 'change' | 'unlink';
  timestamp: number;
  roomPath?: string;
};

/**
 * File watcher configuration
 */
export type FileWatcherConfig = {
  /** Root path to watch */
  rootPath: string;
  /** Debounce interval in ms */
  debounceMs: number;
  /** Patterns to ignore (glob-like) */
  ignorePatterns: string[];
  /** Maximum depth to watch */
  maxDepth: number;
};

const DEFAULT_CONFIG: Partial<FileWatcherConfig> = {
  debounceMs: 100,
  ignorePatterns: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '__pycache__',
    '.pytest_cache',
    'coverage',
    '.nyc_output',
    '*.log',
    '.DS_Store',
  ],
  maxDepth: 10,
};

/**
 * Watches filesystem for changes and emits structured events
 */
export class FileWatcher extends EventEmitter {
  private config: FileWatcherConfig;
  private watchers: Map<string, FSWatcher> = new Map();
  private pendingEvents: Map<string, FileChangeEvent> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;
  private isWatching = false;

  constructor(config: FileWatcherConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config } as FileWatcherConfig;
  }

  /**
   * Start watching the filesystem
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      return;
    }

    await this.watchDirectory(this.config.rootPath, 0);
    this.isWatching = true;
  }

  /**
   * Stop watching
   */
  stop(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.isWatching = false;
  }

  /**
   * Get files changed since last check
   */
  getChangedFiles(): FileChangeEvent[] {
    const events = Array.from(this.pendingEvents.values());
    this.pendingEvents.clear();
    return events;
  }

  /**
   * Map a file path to its room path
   */
  getRoomPath(filePath: string): string | undefined {
    const relativePath = relative(this.config.rootPath, filePath);
    const parts = relativePath.split('/');

    // Room is typically the first 1-2 directory levels
    if (parts.length >= 2) {
      return parts.slice(0, 2).join('/');
    } else if (parts.length === 1) {
      return dirname(relativePath);
    }

    return undefined;
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  private async watchDirectory(dirPath: string, depth: number): Promise<void> {
    if (depth > this.config.maxDepth) {
      return;
    }

    if (this.shouldIgnore(dirPath)) {
      return;
    }

    // Watch this directory
    try {
      const watcher = watch(dirPath, { persistent: true }, (eventType, filename) => {
        if (filename) {
          this.handleFileEvent(eventType, join(dirPath, filename));
        }
      });

      watcher.on('error', (error) => {
        this.emit('error', error);
      });

      this.watchers.set(dirPath, watcher);

      // Recursively watch subdirectories
      const entries = await readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !this.shouldIgnore(entry.name)) {
          await this.watchDirectory(join(dirPath, entry.name), depth + 1);
        }
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  private handleFileEvent(eventType: string, filePath: string): void {
    if (this.shouldIgnore(filePath)) {
      return;
    }

    const relativePath = relative(this.config.rootPath, filePath);
    const roomPath = this.getRoomPath(filePath);

    const event: FileChangeEvent = {
      path: filePath,
      relativePath,
      type: eventType === 'rename' ? 'add' : 'change', // Simplified
      timestamp: Date.now(),
      roomPath,
    };

    // Debounce events for the same file
    this.pendingEvents.set(filePath, event);

    // Emit after debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushEvents();
    }, this.config.debounceMs);
  }

  private flushEvents(): void {
    const events = Array.from(this.pendingEvents.values());
    this.pendingEvents.clear();

    for (const event of events) {
      this.emit('change', event);
    }

    if (events.length > 0) {
      this.emit('batch', events);
    }
  }

  private shouldIgnore(pathOrName: string): boolean {
    const name = pathOrName.split('/').pop() ?? pathOrName;

    for (const pattern of this.config.ignorePatterns) {
      // Simple glob matching
      if (pattern.startsWith('*')) {
        const suffix = pattern.slice(1);
        if (name.endsWith(suffix)) {
          return true;
        }
      } else if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        if (name.startsWith(prefix)) {
          return true;
        }
      } else if (name === pattern) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Create a file watcher for a workspace
 */
export function createFileWatcher(rootPath: string, options?: Partial<FileWatcherConfig>): FileWatcher {
  return new FileWatcher({
    rootPath,
    debounceMs: options?.debounceMs ?? 100,
    ignorePatterns: options?.ignorePatterns ?? DEFAULT_CONFIG.ignorePatterns!,
    maxDepth: options?.maxDepth ?? 10,
  });
}
