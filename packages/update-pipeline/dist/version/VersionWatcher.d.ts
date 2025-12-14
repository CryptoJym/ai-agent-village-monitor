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
export declare const DEFAULT_UPSTREAM_SOURCES: UpstreamSource[];
/**
 * VersionWatcher monitors upstream providers for new versions.
 *
 * Emits:
 * - 'version_discovered': When a new version is found
 * - 'check_error': When version check fails
 * - 'poll_started': When a poll cycle starts
 * - 'poll_completed': When a poll cycle completes
 */
export declare class VersionWatcher extends EventEmitter {
    private config;
    private knownVersions;
    private pollingTimers;
    private isRunning;
    constructor(config?: Partial<VersionWatcherConfig>);
    /**
     * Start watching for version updates.
     */
    start(): Promise<void>;
    /**
     * Stop watching for version updates.
     */
    stop(): void;
    /**
     * Check all upstream sources for updates.
     */
    checkAllSources(): Promise<RuntimeVersion[]>;
    /**
     * Check a single upstream source for updates.
     */
    checkSource(source: UpstreamSource): Promise<RuntimeVersion | null>;
    /**
     * Fetch the latest version from an upstream source.
     */
    private fetchLatestVersion;
    /**
     * Fetch latest version from npm registry.
     */
    private fetchFromNpm;
    /**
     * Fetch latest version from GitHub releases.
     */
    private fetchFromGitHub;
    /**
     * Fetch latest version from Homebrew.
     */
    private fetchFromHomebrew;
    /**
     * Fetch latest version from custom source.
     */
    private fetchFromCustom;
    /**
     * Get the current known version for a provider.
     */
    getKnownVersion(providerId: ProviderId): RuntimeVersion | undefined;
    /**
     * Get all known versions.
     */
    getAllKnownVersions(): Map<ProviderId, RuntimeVersion>;
    /**
     * Register a new known version from runner heartbeat.
     */
    registerHeartbeatVersion(providerId: ProviderId, version: string): void;
    /**
     * Check if running.
     */
    isActive(): boolean;
}
export default VersionWatcher;
//# sourceMappingURL=VersionWatcher.d.ts.map