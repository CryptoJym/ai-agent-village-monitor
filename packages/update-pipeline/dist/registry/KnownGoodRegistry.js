/**
 * Known-Good Registry
 *
 * Maintains a registry of tested and validated builds,
 * their compatibility results, and recommendations.
 */
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as semver from 'semver';
const DEFAULT_CONFIG = {
    maxVersionsPerProvider: 20,
    maxBuilds: 100,
    autoDeprecateDays: 90,
    persistenceEnabled: false,
};
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
export class KnownGoodRegistry extends EventEmitter {
    config;
    // Version storage
    runtimeVersions = new Map();
    // Build storage
    builds = new Map();
    buildEntries = new Map();
    // Compatibility results
    compatResults = new Map();
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        // Initialize provider maps
        const providers = ['codex', 'claude_code', 'gemini_cli'];
        for (const providerId of providers) {
            this.runtimeVersions.set(providerId, new Map());
        }
    }
    // ===========================================================================
    // VERSION MANAGEMENT
    // ===========================================================================
    /**
     * Register a runtime version.
     */
    registerVersion(version) {
        const providerMap = this.runtimeVersions.get(version.providerId);
        if (!providerMap) {
            throw new Error(`Unknown provider: ${version.providerId}`);
        }
        providerMap.set(version.version, version);
        // Trim old versions if needed
        this.trimVersions(version.providerId);
        this.emit('version_registered', version);
    }
    /**
     * Get a specific version.
     */
    getVersion(providerId, version) {
        return this.runtimeVersions.get(providerId)?.get(version);
    }
    /**
     * Get all versions for a provider.
     */
    getVersions(providerId) {
        const versions = Array.from(this.runtimeVersions.get(providerId)?.values() ?? []);
        return versions.sort((a, b) => semver.rcompare(a.version, b.version) // Newest first
        );
    }
    /**
     * Get latest canary-passed version.
     */
    getLatestStableVersion(providerId) {
        return this.getVersions(providerId)
            .filter(v => v.canaryPassed)
            .sort((a, b) => semver.rcompare(a.version, b.version))[0];
    }
    /**
     * Mark a version as canary-passed.
     */
    markVersionCanaryPassed(providerId, version, result) {
        const runtimeVersion = this.getVersion(providerId, version);
        if (!runtimeVersion) {
            throw new Error(`Version ${providerId}@${version} not found`);
        }
        if (result.status === 'passed') {
            runtimeVersion.canaryPassed = true;
            runtimeVersion.canaryPassedAt = new Date();
        }
    }
    /**
     * Get provider version summary.
     */
    getProviderSummary(providerId) {
        const versions = this.getVersions(providerId);
        return {
            providerId,
            versions: versions.map(v => ({
                version: v.version,
                canaryPassed: v.canaryPassed,
                canaryPassedAt: v.canaryPassedAt,
                knownGoodBuilds: this.countBuildsWithVersion(providerId, v.version),
            })),
            latestStable: versions.find(v => v.canaryPassed)?.version,
            latestBeta: versions[0]?.version,
        };
    }
    // ===========================================================================
    // BUILD MANAGEMENT
    // ===========================================================================
    /**
     * Register a new build.
     */
    registerBuild(build) {
        if (this.builds.has(build.buildId)) {
            throw new Error(`Build ${build.buildId} already registered`);
        }
        this.builds.set(build.buildId, build);
        const entry = {
            entryId: uuidv4(),
            buildId: build.buildId,
            status: 'testing',
            compatResults: [],
            recommendation: 'not_recommended',
        };
        this.buildEntries.set(build.buildId, entry);
        this.compatResults.set(build.buildId, []);
        // Trim old builds if needed
        this.trimBuilds();
        this.emit('build_registered', { build, entry });
        return entry;
    }
    /**
     * Get a build.
     */
    getBuild(buildId) {
        return this.builds.get(buildId);
    }
    /**
     * Get build entry.
     */
    getBuildEntry(buildId) {
        return this.buildEntries.get(buildId);
    }
    /**
     * Get all builds with their entries.
     */
    getAllBuilds() {
        return Array.from(this.builds.values())
            .map(build => ({
            build,
            entry: this.buildEntries.get(build.buildId),
        }))
            .sort((a, b) => b.build.builtAt.getTime() - a.build.builtAt.getTime());
    }
    /**
     * Promote a build to known_good status.
     */
    promoteBuild(buildId) {
        const entry = this.buildEntries.get(buildId);
        if (!entry) {
            throw new Error(`Build ${buildId} not found`);
        }
        if (entry.compatResults.length === 0) {
            throw new Error(`Build ${buildId} has no compatibility results`);
        }
        const compatibleCount = entry.compatResults.filter(r => r.status === 'compatible').length;
        if (compatibleCount === 0) {
            throw new Error(`Build ${buildId} has no compatible results`);
        }
        entry.status = 'known_good';
        entry.promotedAt = new Date();
        entry.recommendation = 'recommended';
        this.emit('build_promoted', entry);
        return entry;
    }
    /**
     * Deprecate a build.
     */
    deprecateBuild(buildId, reason) {
        const entry = this.buildEntries.get(buildId);
        if (!entry) {
            throw new Error(`Build ${buildId} not found`);
        }
        entry.status = 'deprecated';
        entry.deprecatedAt = new Date();
        entry.deprecationReason = reason;
        entry.recommendation = 'not_recommended';
        this.emit('build_deprecated', { entry, reason });
        return entry;
    }
    /**
     * Mark a build as known_bad.
     */
    markBuildBad(buildId, reason) {
        const entry = this.buildEntries.get(buildId);
        if (!entry) {
            throw new Error(`Build ${buildId} not found`);
        }
        entry.status = 'known_bad';
        entry.deprecatedAt = new Date();
        entry.deprecationReason = reason;
        entry.recommendation = 'blocked';
        return entry;
    }
    // ===========================================================================
    // COMPATIBILITY RESULTS
    // ===========================================================================
    /**
     * Add compatibility result for a build.
     */
    addCompatibilityResult(buildId, result) {
        const entry = this.buildEntries.get(buildId);
        if (!entry) {
            throw new Error(`Build ${buildId} not found`);
        }
        const fullResult = {
            ...result,
            resultId: uuidv4(),
        };
        const results = this.compatResults.get(buildId) ?? [];
        results.push(fullResult);
        this.compatResults.set(buildId, results);
        entry.compatResults.push(fullResult);
        // Update entry recommendation based on results
        this.updateBuildRecommendation(entry);
        this.emit('compat_result_added', { buildId, result: fullResult });
        return fullResult;
    }
    /**
     * Get compatibility results for a build.
     */
    getCompatibilityResults(buildId) {
        return this.compatResults.get(buildId) ?? [];
    }
    // ===========================================================================
    // QUERIES
    // ===========================================================================
    /**
     * Get the recommended build for a channel.
     */
    getRecommendedBuild(channel) {
        const allEntries = Array.from(this.buildEntries.values());
        // For stable, only return known_good
        if (channel === 'stable') {
            const stableEntries = allEntries
                .filter(e => e.status === 'known_good' && e.recommendation === 'recommended')
                .sort((a, b) => (b.promotedAt?.getTime() ?? 0) - (a.promotedAt?.getTime() ?? 0));
            if (stableEntries.length > 0) {
                return this.builds.get(stableEntries[0].buildId);
            }
        }
        // For beta, include testing builds with acceptable results
        const betaEntries = allEntries
            .filter(e => (e.status === 'known_good' || e.status === 'testing') &&
            e.recommendation !== 'blocked' &&
            e.recommendation !== 'not_recommended')
            .sort((a, b) => {
            const buildA = this.builds.get(a.buildId);
            const buildB = this.builds.get(b.buildId);
            return buildB.builtAt.getTime() - buildA.builtAt.getTime();
        });
        if (betaEntries.length > 0) {
            return this.builds.get(betaEntries[0].buildId);
        }
        return undefined;
    }
    /**
     * Get build status summaries.
     */
    getBuildSummaries() {
        return Array.from(this.buildEntries.values()).map(entry => {
            const build = this.builds.get(entry.buildId);
            const latestResult = entry.compatResults[entry.compatResults.length - 1];
            return {
                buildId: entry.buildId,
                runnerVersion: build.runnerVersion,
                runtimeVersions: build.runtimeVersions,
                status: entry.status,
                recommendation: entry.recommendation,
                compatCount: entry.compatResults.length,
                lastTested: latestResult?.testedAt,
                promotedAt: entry.promotedAt,
                deprecatedAt: entry.deprecatedAt,
            };
        });
    }
    /**
     * Find builds compatible with a specific provider version.
     */
    findCompatibleBuilds(providerId, version) {
        return Array.from(this.builds.values()).filter(build => {
            const bundledVersion = build.runtimeVersions[providerId];
            if (!bundledVersion)
                return false;
            // Check if bundled version satisfies the requested version
            return semver.satisfies(bundledVersion, `^${version}`) ||
                bundledVersion === version;
        });
    }
    // ===========================================================================
    // MAINTENANCE
    // ===========================================================================
    /**
     * Auto-deprecate old builds.
     */
    autoDeprecate() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.autoDeprecateDays);
        let deprecatedCount = 0;
        for (const [buildId, entry] of this.buildEntries) {
            if (entry.status === 'known_good' || entry.status === 'testing') {
                const build = this.builds.get(buildId);
                if (build.builtAt < cutoffDate) {
                    this.deprecateBuild(buildId, 'Auto-deprecated due to age');
                    deprecatedCount++;
                }
            }
        }
        return deprecatedCount;
    }
    /**
     * Export registry data.
     */
    exportData() {
        const versions = {};
        for (const [providerId, versionMap] of this.runtimeVersions) {
            versions[providerId] = Array.from(versionMap.values());
        }
        return {
            versions: versions,
            builds: this.getAllBuilds(),
        };
    }
    /**
     * Import registry data.
     */
    importData(data) {
        // Import versions
        for (const [_providerId, versions] of Object.entries(data.versions)) {
            for (const version of versions) {
                this.registerVersion(version);
            }
        }
        // Import builds
        for (const { build, entry } of data.builds) {
            this.builds.set(build.buildId, build);
            this.buildEntries.set(build.buildId, entry);
            this.compatResults.set(build.buildId, entry.compatResults);
        }
    }
    // ===========================================================================
    // PRIVATE HELPERS
    // ===========================================================================
    /**
     * Trim old versions for a provider.
     */
    trimVersions(providerId) {
        const providerMap = this.runtimeVersions.get(providerId);
        if (providerMap.size <= this.config.maxVersionsPerProvider) {
            return;
        }
        const versions = Array.from(providerMap.values())
            .sort((a, b) => semver.rcompare(a.version, b.version));
        // Keep newest versions, remove oldest
        const toRemove = versions.slice(this.config.maxVersionsPerProvider);
        for (const v of toRemove) {
            // Don't remove if it's used by a known_good build
            const usedByGood = this.countBuildsWithVersion(providerId, v.version, 'known_good') > 0;
            if (!usedByGood) {
                providerMap.delete(v.version);
            }
        }
    }
    /**
     * Trim old builds.
     */
    trimBuilds() {
        if (this.builds.size <= this.config.maxBuilds) {
            return;
        }
        const entries = Array.from(this.buildEntries.values())
            .filter(e => e.status !== 'known_good') // Never remove known_good
            .sort((a, b) => {
            const buildA = this.builds.get(a.buildId);
            const buildB = this.builds.get(b.buildId);
            return buildA.builtAt.getTime() - buildB.builtAt.getTime(); // Oldest first
        });
        const toRemove = entries.slice(0, this.builds.size - this.config.maxBuilds);
        for (const entry of toRemove) {
            this.builds.delete(entry.buildId);
            this.buildEntries.delete(entry.buildId);
            this.compatResults.delete(entry.buildId);
        }
    }
    /**
     * Count builds with a specific provider version.
     */
    countBuildsWithVersion(providerId, version, status) {
        return Array.from(this.builds.values()).filter(build => {
            if (build.runtimeVersions[providerId] !== version) {
                return false;
            }
            if (status) {
                const entry = this.buildEntries.get(build.buildId);
                return entry?.status === status;
            }
            return true;
        }).length;
    }
    /**
     * Update build recommendation based on compat results.
     */
    updateBuildRecommendation(entry) {
        const results = entry.compatResults;
        if (results.length === 0) {
            entry.recommendation = 'not_recommended';
            return;
        }
        const latestResult = results[results.length - 1];
        switch (latestResult.status) {
            case 'compatible':
                entry.recommendation = 'acceptable';
                break;
            case 'partial':
                entry.recommendation = 'acceptable';
                break;
            case 'incompatible':
                entry.recommendation = 'not_recommended';
                break;
            case 'unknown':
                entry.recommendation = 'not_recommended';
                break;
        }
    }
}
export default KnownGoodRegistry;
