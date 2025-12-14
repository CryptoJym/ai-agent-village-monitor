/**
 * Known-Good Registry
 *
 * Maintains a registry of tested and validated builds,
 * their compatibility results, and recommendations.
 */
import { EventEmitter } from 'events';
import type { ProviderId } from '@ai-agent-village-monitor/shared';
import type { RuntimeVersion, RunnerBuild, CompatibilityResult, KnownGoodEntry, CanaryTestResult } from '../types';
/** Registry configuration */
export interface KnownGoodRegistryConfig {
    /** Maximum versions to keep per provider */
    maxVersionsPerProvider: number;
    /** Maximum builds to keep */
    maxBuilds: number;
    /** Auto-deprecate builds older than (days) */
    autoDeprecateDays: number;
    /** Persist to external storage */
    persistenceEnabled: boolean;
}
/** Build status summary */
export interface BuildStatusSummary {
    buildId: string;
    runnerVersion: string;
    runtimeVersions: Record<ProviderId, string>;
    status: KnownGoodEntry['status'];
    recommendation: KnownGoodEntry['recommendation'];
    compatCount: number;
    lastTested?: Date;
    promotedAt?: Date;
    deprecatedAt?: Date;
}
/** Provider version summary */
export interface ProviderVersionSummary {
    providerId: ProviderId;
    versions: Array<{
        version: string;
        canaryPassed: boolean;
        canaryPassedAt?: Date;
        knownGoodBuilds: number;
    }>;
    latestStable?: string;
    latestBeta?: string;
}
/**
 * KnownGoodRegistry maintains tested and validated builds.
 *
 * Emits:
 * - 'version_registered': When a new version is added
 * - 'build_registered': When a new build is added
 * - 'build_promoted': When a build is promoted to known_good
 * - 'build_deprecated': When a build is deprecated
 * - 'compat_result_added': When compatibility result is added
 */
export declare class KnownGoodRegistry extends EventEmitter {
    private config;
    private runtimeVersions;
    private builds;
    private buildEntries;
    private compatResults;
    constructor(config?: Partial<KnownGoodRegistryConfig>);
    /**
     * Register a runtime version.
     */
    registerVersion(version: RuntimeVersion): void;
    /**
     * Get a specific version.
     */
    getVersion(providerId: ProviderId, version: string): RuntimeVersion | undefined;
    /**
     * Get all versions for a provider.
     */
    getVersions(providerId: ProviderId): RuntimeVersion[];
    /**
     * Get latest canary-passed version.
     */
    getLatestStableVersion(providerId: ProviderId): RuntimeVersion | undefined;
    /**
     * Mark a version as canary-passed.
     */
    markVersionCanaryPassed(providerId: ProviderId, version: string, result: CanaryTestResult): void;
    /**
     * Get provider version summary.
     */
    getProviderSummary(providerId: ProviderId): ProviderVersionSummary;
    /**
     * Register a new build.
     */
    registerBuild(build: RunnerBuild): KnownGoodEntry;
    /**
     * Get a build.
     */
    getBuild(buildId: string): RunnerBuild | undefined;
    /**
     * Get build entry.
     */
    getBuildEntry(buildId: string): KnownGoodEntry | undefined;
    /**
     * Get all builds with their entries.
     */
    getAllBuilds(): Array<{
        build: RunnerBuild;
        entry: KnownGoodEntry;
    }>;
    /**
     * Promote a build to known_good status.
     */
    promoteBuild(buildId: string): KnownGoodEntry;
    /**
     * Deprecate a build.
     */
    deprecateBuild(buildId: string, reason: string): KnownGoodEntry;
    /**
     * Mark a build as known_bad.
     */
    markBuildBad(buildId: string, reason: string): KnownGoodEntry;
    /**
     * Add compatibility result for a build.
     */
    addCompatibilityResult(buildId: string, result: Omit<CompatibilityResult, 'resultId'>): CompatibilityResult;
    /**
     * Get compatibility results for a build.
     */
    getCompatibilityResults(buildId: string): CompatibilityResult[];
    /**
     * Get the recommended build for a channel.
     */
    getRecommendedBuild(channel: 'stable' | 'beta'): RunnerBuild | undefined;
    /**
     * Get build status summaries.
     */
    getBuildSummaries(): BuildStatusSummary[];
    /**
     * Find builds compatible with a specific provider version.
     */
    findCompatibleBuilds(providerId: ProviderId, version: string): RunnerBuild[];
    /**
     * Auto-deprecate old builds.
     */
    autoDeprecate(): number;
    /**
     * Export registry data.
     */
    exportData(): {
        versions: Record<ProviderId, RuntimeVersion[]>;
        builds: Array<{
            build: RunnerBuild;
            entry: KnownGoodEntry;
        }>;
    };
    /**
     * Import registry data.
     */
    importData(data: {
        versions: Record<ProviderId, RuntimeVersion[]>;
        builds: Array<{
            build: RunnerBuild;
            entry: KnownGoodEntry;
        }>;
    }): void;
    /**
     * Trim old versions for a provider.
     */
    private trimVersions;
    /**
     * Trim old builds.
     */
    private trimBuilds;
    /**
     * Count builds with a specific provider version.
     */
    private countBuildsWithVersion;
    /**
     * Update build recommendation based on compat results.
     */
    private updateBuildRecommendation;
}
export default KnownGoodRegistry;
//# sourceMappingURL=KnownGoodRegistry.d.ts.map