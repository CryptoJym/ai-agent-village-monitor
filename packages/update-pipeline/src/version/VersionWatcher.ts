/**
 * Version Watcher
 *
 * Monitors upstream providers for new versions and tracks
 * installed versions across runners.
 */

import { EventEmitter } from 'events';
import type { ProviderId } from '@ai-agent-village-monitor/shared';
import type { RuntimeVersion } from '../types';

/** Upstream source configuration */
export interface UpstreamSource {
  /** Provider this source tracks */
  providerId: ProviderId;
  /** Source type */
  type: 'npm' | 'github_releases' | 'homebrew' | 'custom';
  /** Source URL or package name */
  source: string;
  /** Check interval (ms) */
  checkIntervalMs: number;
  /** Custom version extractor */
  versionExtractor?: (response: unknown) => string | null;
}

/** Version watcher configuration */
export interface VersionWatcherConfig {
  /** Upstream sources to watch */
  sources: UpstreamSource[];
  /** Default check interval (ms) */
  defaultCheckIntervalMs: number;
  /** HTTP timeout (ms) */
  httpTimeoutMs: number;
  /** Whether to enable polling */
  enablePolling: boolean;
}

/** Version discovered event */
export interface VersionDiscoveredEvent {
  providerId: ProviderId;
  version: string;
  previousVersion?: string;
  sourceUrl?: string;
  discoveredAt: Date;
}

/** Default upstream sources */
export const DEFAULT_UPSTREAM_SOURCES: UpstreamSource[] = [
  {
    providerId: 'claude_code',
    type: 'npm',
    source: '@anthropic-ai/claude-code',
    checkIntervalMs: 3600000, // 1 hour
  },
  {
    providerId: 'codex',
    type: 'npm',
    source: '@openai/codex',
    checkIntervalMs: 3600000,
  },
  {
    providerId: 'gemini_cli',
    type: 'npm',
    source: '@google/gemini-cli',
    checkIntervalMs: 3600000,
  },
];

/**
 * VersionWatcher monitors upstream providers for new versions.
 *
 * Emits:
 * - 'version_discovered': When a new version is found
 * - 'check_error': When version check fails
 * - 'poll_started': When a poll cycle starts
 * - 'poll_completed': When a poll cycle completes
 */
export class VersionWatcher extends EventEmitter {
  private config: VersionWatcherConfig;
  private knownVersions: Map<ProviderId, RuntimeVersion> = new Map();
  private pollingTimers: Map<ProviderId, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor(config: Partial<VersionWatcherConfig> = {}) {
    super();
    this.config = {
      sources: config.sources ?? DEFAULT_UPSTREAM_SOURCES,
      defaultCheckIntervalMs: config.defaultCheckIntervalMs ?? 3600000,
      httpTimeoutMs: config.httpTimeoutMs ?? 30000,
      enablePolling: config.enablePolling ?? true,
    };
  }

  /**
   * Start watching for version updates.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.emit('poll_started');

    // Initial check for all sources
    await this.checkAllSources();

    // Set up polling if enabled
    if (this.config.enablePolling) {
      for (const source of this.config.sources) {
        const interval = source.checkIntervalMs || this.config.defaultCheckIntervalMs;
        const timer = setInterval(() => {
          void this.checkSource(source);
        }, interval);

        this.pollingTimers.set(source.providerId, timer);
      }
    }
  }

  /**
   * Stop watching for version updates.
   */
  stop(): void {
    this.isRunning = false;

    for (const timer of this.pollingTimers.values()) {
      clearInterval(timer);
    }
    this.pollingTimers.clear();
  }

  /**
   * Check all upstream sources for updates.
   */
  async checkAllSources(): Promise<RuntimeVersion[]> {
    const results: RuntimeVersion[] = [];

    for (const source of this.config.sources) {
      try {
        const version = await this.checkSource(source);
        if (version) {
          results.push(version);
        }
      } catch (error) {
        this.emit('check_error', {
          providerId: source.providerId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
        });
      }
    }

    this.emit('poll_completed', { results, timestamp: new Date() });
    return results;
  }

  /**
   * Check a single upstream source for updates.
   */
  async checkSource(source: UpstreamSource): Promise<RuntimeVersion | null> {
    try {
      const latestVersion = await this.fetchLatestVersion(source);

      if (!latestVersion) {
        return null;
      }

      const known = this.knownVersions.get(source.providerId);
      const isNew = !known || known.version !== latestVersion.version;

      if (isNew) {
        this.knownVersions.set(source.providerId, latestVersion);

        const event: VersionDiscoveredEvent = {
          providerId: source.providerId,
          version: latestVersion.version,
          previousVersion: known?.version,
          sourceUrl: latestVersion.sourceUrl,
          discoveredAt: new Date(),
        };

        this.emit('version_discovered', event);
      }

      return latestVersion;
    } catch (error) {
      this.emit('check_error', {
        providerId: source.providerId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });
      return null;
    }
  }

  /**
   * Fetch the latest version from an upstream source.
   */
  private async fetchLatestVersion(source: UpstreamSource): Promise<RuntimeVersion | null> {
    switch (source.type) {
      case 'npm':
        return this.fetchFromNpm(source);
      case 'github_releases':
        return this.fetchFromGitHub(source);
      case 'homebrew':
        return this.fetchFromHomebrew(source);
      case 'custom':
        if (source.versionExtractor) {
          return this.fetchFromCustom(source);
        }
        return null;
      default:
        return null;
    }
  }

  /**
   * Fetch latest version from npm registry.
   */
  private async fetchFromNpm(source: UpstreamSource): Promise<RuntimeVersion | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.httpTimeoutMs);

    try {
      const response = await fetch(
        `https://registry.npmjs.org/${source.source}/latest`,
        {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error(`npm registry returned ${response.status}`);
      }

      const data = (await response.json()) as { version?: string; time?: { modified?: string } };

      if (!data.version) {
        return null;
      }

      return {
        providerId: source.providerId,
        version: data.version,
        releasedAt: data.time?.modified ? new Date(data.time.modified) : new Date(),
        sourceUrl: `https://www.npmjs.com/package/${source.source}`,
        canaryPassed: false,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Fetch latest version from GitHub releases.
   */
  private async fetchFromGitHub(source: UpstreamSource): Promise<RuntimeVersion | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.httpTimeoutMs);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${source.source}/releases/latest`,
        {
          signal: controller.signal,
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'ai-agent-village-monitor',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const data = (await response.json()) as {
        tag_name?: string;
        published_at?: string;
        html_url?: string;
      };

      if (!data.tag_name) {
        return null;
      }

      // Strip 'v' prefix if present
      const version = data.tag_name.replace(/^v/, '');

      return {
        providerId: source.providerId,
        version,
        releasedAt: data.published_at ? new Date(data.published_at) : new Date(),
        sourceUrl: data.html_url,
        canaryPassed: false,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Fetch latest version from Homebrew.
   */
  private async fetchFromHomebrew(source: UpstreamSource): Promise<RuntimeVersion | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.httpTimeoutMs);

    try {
      const response = await fetch(
        `https://formulae.brew.sh/api/formula/${source.source}.json`,
        {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error(`Homebrew API returned ${response.status}`);
      }

      const data = (await response.json()) as {
        versions?: { stable?: string };
        analytics?: { install?: { '30d'?: { [key: string]: number } } };
      };

      if (!data.versions?.stable) {
        return null;
      }

      return {
        providerId: source.providerId,
        version: data.versions.stable,
        releasedAt: new Date(), // Homebrew doesn't provide release date
        sourceUrl: `https://formulae.brew.sh/formula/${source.source}`,
        canaryPassed: false,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Fetch latest version from custom source.
   */
  private async fetchFromCustom(source: UpstreamSource): Promise<RuntimeVersion | null> {
    if (!source.versionExtractor) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.httpTimeoutMs);

    try {
      const response = await fetch(source.source, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`Custom source returned ${response.status}`);
      }

      const data = await response.json();
      const version = source.versionExtractor(data);

      if (!version) {
        return null;
      }

      return {
        providerId: source.providerId,
        version,
        releasedAt: new Date(),
        sourceUrl: source.source,
        canaryPassed: false,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Get the current known version for a provider.
   */
  getKnownVersion(providerId: ProviderId): RuntimeVersion | undefined {
    return this.knownVersions.get(providerId);
  }

  /**
   * Get all known versions.
   */
  getAllKnownVersions(): Map<ProviderId, RuntimeVersion> {
    return new Map(this.knownVersions);
  }

  /**
   * Register a new known version from runner heartbeat.
   */
  registerHeartbeatVersion(providerId: ProviderId, version: string): void {
    const existing = this.knownVersions.get(providerId);

    if (!existing || existing.version !== version) {
      const runtimeVersion: RuntimeVersion = {
        providerId,
        version,
        releasedAt: new Date(),
        canaryPassed: false, // Will be updated by canary runner
      };

      this.knownVersions.set(providerId, runtimeVersion);
    }
  }

  /**
   * Check if running.
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

export default VersionWatcher;
