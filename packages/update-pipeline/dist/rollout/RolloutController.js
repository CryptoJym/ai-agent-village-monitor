/**
 * Rollout Controller
 *
 * Manages staged rollouts of new builds across organizations,
 * with support for percentage-based deployments and rollback.
 */
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { CHANNEL_CONFIGS } from '../types';
const DEFAULT_CONFIG = {
    channelConfigs: CHANNEL_CONFIGS,
    maxConcurrentRollouts: 3,
    checkIntervalMs: 60000, // 1 minute
    autoProgress: true,
    rollbackThresholds: {
        maxFailureRate: 0.1,
        maxDisconnectRate: 0.15,
        minSessionCount: 100,
    },
};
/**
 * RolloutController manages staged rollouts of new builds.
 *
 * Emits:
 * - 'rollout_started': When a new rollout begins
 * - 'stage_advanced': When rollout progresses to next stage
 * - 'rollout_completed': When rollout reaches 100%
 * - 'rollout_paused': When rollout is paused
 * - 'rollback_initiated': When rollback begins
 * - 'rollback_completed': When rollback finishes
 */
export class RolloutController extends EventEmitter {
    config;
    activeRollouts = new Map();
    orgConfigs = new Map();
    orgAssignments = new Map();
    eventLog = [];
    checkTimer = null;
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Start the rollout controller.
     */
    start() {
        if (this.checkTimer) {
            return;
        }
        this.checkTimer = setInterval(() => {
            void this.checkAndProgressRollouts();
        }, this.config.checkIntervalMs);
    }
    /**
     * Stop the rollout controller.
     */
    stop() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
    }
    /**
     * Initiate a new rollout for a build.
     */
    async initiateRollout(build, channel, canaryResult) {
        const channelConfig = this.config.channelConfigs[channel];
        // Validate canary requirement
        if (channelConfig.requiresCanary) {
            if (!canaryResult) {
                throw new Error(`Channel ${channel} requires canary testing`);
            }
            if (canaryResult.status !== 'passed') {
                throw new Error(`Canary tests did not pass (status: ${canaryResult.status})`);
            }
            if (canaryResult.metrics.passRate < channelConfig.canaryThreshold) {
                throw new Error(`Canary pass rate ${canaryResult.metrics.passRate} below threshold ${channelConfig.canaryThreshold}`);
            }
        }
        // Check concurrent rollout limit
        const activeCount = this.getActiveRolloutCount(channel);
        if (activeCount >= this.config.maxConcurrentRollouts) {
            throw new Error(`Maximum concurrent rollouts (${this.config.maxConcurrentRollouts}) reached`);
        }
        // Create rollout
        const rolloutId = uuidv4();
        const now = new Date();
        const initialPercentage = channelConfig.rolloutStages[0] ?? 1;
        const rollout = {
            rolloutId,
            targetBuildId: build.buildId,
            channel,
            state: 'rolling_out',
            currentPercentage: initialPercentage,
            targetPercentage: 100,
            startedAt: now,
            lastUpdatedAt: now,
            affectedOrgs: [],
            canaryResultId: canaryResult?.buildId,
        };
        this.activeRollouts.set(rolloutId, rollout);
        // Log event
        this.logEvent({
            eventId: uuidv4(),
            orgId: '*', // Applies to all orgs in channel
            fromBuildId: null,
            toBuildId: build.buildId,
            channel,
            eventType: 'rollout_started',
            currentPercentage: initialPercentage,
            timestamp: now,
            actor: { type: 'system', id: 'rollout_controller' },
        });
        // Assign initial orgs
        await this.assignOrgsToPercentage(rollout, initialPercentage);
        this.emit('rollout_started', rollout);
        return rollout;
    }
    /**
     * Advance a rollout to the next stage.
     */
    async advanceRollout(rolloutId) {
        const rollout = this.activeRollouts.get(rolloutId);
        if (!rollout) {
            throw new Error(`Rollout ${rolloutId} not found`);
        }
        if (rollout.state !== 'rolling_out') {
            throw new Error(`Cannot advance rollout in state ${rollout.state}`);
        }
        const channelConfig = this.config.channelConfigs[rollout.channel];
        const currentStageIndex = channelConfig.rolloutStages.indexOf(rollout.currentPercentage);
        const nextStage = channelConfig.rolloutStages[currentStageIndex + 1];
        if (nextStage === undefined) {
            // Already at 100%, mark completed
            rollout.state = 'completed';
            rollout.lastUpdatedAt = new Date();
            this.logEvent({
                eventId: uuidv4(),
                orgId: '*',
                fromBuildId: null,
                toBuildId: rollout.targetBuildId,
                channel: rollout.channel,
                eventType: 'rollout_completed',
                currentPercentage: rollout.currentPercentage,
                timestamp: rollout.lastUpdatedAt,
                actor: { type: 'system', id: 'rollout_controller' },
            });
            this.emit('rollout_completed', rollout);
            return rollout;
        }
        // Advance to next stage
        rollout.currentPercentage = nextStage;
        rollout.lastUpdatedAt = new Date();
        // Assign more orgs
        await this.assignOrgsToPercentage(rollout, nextStage);
        this.logEvent({
            eventId: uuidv4(),
            orgId: '*',
            fromBuildId: null,
            toBuildId: rollout.targetBuildId,
            channel: rollout.channel,
            eventType: 'stage_advanced',
            currentPercentage: nextStage,
            timestamp: rollout.lastUpdatedAt,
            actor: { type: 'system', id: 'rollout_controller' },
        });
        this.emit('stage_advanced', rollout);
        return rollout;
    }
    /**
     * Pause a rollout.
     */
    pauseRollout(rolloutId, reason) {
        const rollout = this.activeRollouts.get(rolloutId);
        if (!rollout) {
            throw new Error(`Rollout ${rolloutId} not found`);
        }
        if (rollout.state !== 'rolling_out') {
            throw new Error(`Cannot pause rollout in state ${rollout.state}`);
        }
        rollout.state = 'paused';
        rollout.lastUpdatedAt = new Date();
        this.logEvent({
            eventId: uuidv4(),
            orgId: '*',
            fromBuildId: null,
            toBuildId: rollout.targetBuildId,
            channel: rollout.channel,
            eventType: 'rollout_paused',
            currentPercentage: rollout.currentPercentage,
            timestamp: rollout.lastUpdatedAt,
            actor: { type: 'system', id: 'rollout_controller' },
            metadata: reason ? { reason } : undefined,
        });
        this.emit('rollout_paused', { ...rollout, reason });
        return rollout;
    }
    /**
     * Resume a paused rollout.
     */
    resumeRollout(rolloutId) {
        const rollout = this.activeRollouts.get(rolloutId);
        if (!rollout) {
            throw new Error(`Rollout ${rolloutId} not found`);
        }
        if (rollout.state !== 'paused') {
            throw new Error(`Cannot resume rollout in state ${rollout.state}`);
        }
        rollout.state = 'rolling_out';
        rollout.lastUpdatedAt = new Date();
        this.logEvent({
            eventId: uuidv4(),
            orgId: '*',
            fromBuildId: null,
            toBuildId: rollout.targetBuildId,
            channel: rollout.channel,
            eventType: 'rollout_resumed',
            currentPercentage: rollout.currentPercentage,
            timestamp: rollout.lastUpdatedAt,
            actor: { type: 'system', id: 'rollout_controller' },
        });
        this.emit('rollout_resumed', rollout);
        return rollout;
    }
    /**
     * Rollback a rollout to previous version.
     */
    async rollback(rolloutId, reason) {
        const rollout = this.activeRollouts.get(rolloutId);
        if (!rollout) {
            throw new Error(`Rollout ${rolloutId} not found`);
        }
        rollout.state = 'rolled_back';
        rollout.error = reason;
        rollout.lastUpdatedAt = new Date();
        // Revert org assignments
        await this.revertOrgAssignments(rollout);
        this.logEvent({
            eventId: uuidv4(),
            orgId: '*',
            fromBuildId: rollout.targetBuildId,
            toBuildId: null, // Previous versions vary by org
            channel: rollout.channel,
            eventType: 'rollback_initiated',
            currentPercentage: 0,
            timestamp: rollout.lastUpdatedAt,
            actor: { type: 'system', id: 'rollout_controller' },
            metadata: { reason },
        });
        this.emit('rollback_initiated', { ...rollout, reason });
        // Complete rollback
        this.logEvent({
            eventId: uuidv4(),
            orgId: '*',
            fromBuildId: rollout.targetBuildId,
            toBuildId: null,
            channel: rollout.channel,
            eventType: 'rollback_completed',
            currentPercentage: 0,
            timestamp: new Date(),
            actor: { type: 'system', id: 'rollout_controller' },
        });
        this.emit('rollback_completed', rollout);
        return rollout;
    }
    /**
     * Check and progress rollouts automatically.
     */
    async checkAndProgressRollouts() {
        if (!this.config.autoProgress) {
            return;
        }
        for (const rollout of this.activeRollouts.values()) {
            if (rollout.state !== 'rolling_out') {
                continue;
            }
            // Check if enough time has passed since last stage
            const channelConfig = this.config.channelConfigs[rollout.channel];
            const hoursSinceUpdate = (Date.now() - rollout.lastUpdatedAt.getTime()) / (1000 * 60 * 60);
            if (hoursSinceUpdate < channelConfig.rolloutDelayHours) {
                continue;
            }
            // Check metrics
            const metrics = await this.collectRolloutMetrics(rollout);
            // Check if should rollback
            if (this.shouldRollback(metrics)) {
                await this.rollback(rollout.rolloutId, `Metrics exceeded thresholds: failure=${metrics.failureRate}, disconnect=${metrics.disconnectRate}`);
                continue;
            }
            // Advance if metrics are good
            if (metrics.sessionsStarted >= this.config.rollbackThresholds.minSessionCount) {
                try {
                    await this.advanceRollout(rollout.rolloutId);
                }
                catch {
                    // Rollout may already be complete
                }
            }
        }
    }
    /**
     * Assign organizations to a rollout percentage.
     */
    async assignOrgsToPercentage(rollout, percentage) {
        // Get all orgs on this channel
        const eligibleOrgs = Array.from(this.orgConfigs.values())
            .filter(org => org.channel === rollout.channel)
            .filter(org => !org.enterprise?.approvalRequired || percentage === 100);
        // Calculate number to assign
        const targetCount = Math.ceil((eligibleOrgs.length * percentage) / 100);
        const currentlyAssigned = rollout.affectedOrgs.length;
        const toAssign = targetCount - currentlyAssigned;
        if (toAssign <= 0) {
            return;
        }
        // Select orgs not yet assigned
        const unassigned = eligibleOrgs
            .filter(org => !rollout.affectedOrgs.includes(org.orgId))
            .slice(0, toAssign);
        for (const org of unassigned) {
            const currentAssignment = this.orgAssignments.get(org.orgId);
            const assignment = {
                orgId: org.orgId,
                currentBuildId: currentAssignment?.targetBuildId ?? null,
                targetBuildId: rollout.targetBuildId,
                percentage,
                assignedAt: new Date(),
                channel: rollout.channel,
            };
            this.orgAssignments.set(org.orgId, assignment);
            rollout.affectedOrgs.push(org.orgId);
        }
    }
    /**
     * Revert org assignments for a rolled-back rollout.
     */
    async revertOrgAssignments(rollout) {
        for (const orgId of rollout.affectedOrgs) {
            const assignment = this.orgAssignments.get(orgId);
            if (assignment && assignment.targetBuildId === rollout.targetBuildId) {
                // Revert to previous build
                if (assignment.currentBuildId) {
                    assignment.targetBuildId = assignment.currentBuildId;
                    assignment.currentBuildId = null;
                    assignment.assignedAt = new Date();
                }
                else {
                    this.orgAssignments.delete(orgId);
                }
            }
        }
        rollout.affectedOrgs = [];
    }
    /**
     * Collect metrics for a rollout.
     */
    async collectRolloutMetrics(_rollout) {
        // Placeholder - would collect from actual session data
        return {
            sessionsStarted: 1000,
            sessionsCompleted: 950,
            sessionsFailed: 30,
            disconnects: 20,
            avgStartLatencyMs: 500,
            avgDurationMs: 120000,
            failureRate: 0.03,
            disconnectRate: 0.02,
        };
    }
    /**
     * Check if metrics warrant a rollback.
     */
    shouldRollback(metrics) {
        if (metrics.sessionsStarted < this.config.rollbackThresholds.minSessionCount) {
            return false;
        }
        return (metrics.failureRate > this.config.rollbackThresholds.maxFailureRate ||
            metrics.disconnectRate > this.config.rollbackThresholds.maxDisconnectRate);
    }
    /**
     * Get count of active rollouts for a channel.
     */
    getActiveRolloutCount(channel) {
        return Array.from(this.activeRollouts.values())
            .filter(r => r.channel === channel && r.state === 'rolling_out')
            .length;
    }
    /**
     * Log a rollout event.
     */
    logEvent(event) {
        this.eventLog.push(event);
        // Keep only last 10000 events
        if (this.eventLog.length > 10000) {
            this.eventLog = this.eventLog.slice(-10000);
        }
    }
    /**
     * Register an organization's runtime config.
     */
    registerOrgConfig(config) {
        this.orgConfigs.set(config.orgId, config);
    }
    /**
     * Get an organization's current assignment.
     */
    getOrgAssignment(orgId) {
        return this.orgAssignments.get(orgId);
    }
    /**
     * Get an active rollout.
     */
    getRollout(rolloutId) {
        return this.activeRollouts.get(rolloutId);
    }
    /**
     * Get all active rollouts.
     */
    getAllActiveRollouts() {
        return Array.from(this.activeRollouts.values())
            .filter(r => r.state === 'rolling_out' || r.state === 'paused');
    }
    /**
     * Get rollout events for audit.
     */
    getEventLog(filter) {
        let events = this.eventLog;
        if (filter?.orgId) {
            events = events.filter(e => e.orgId === filter.orgId || e.orgId === '*');
        }
        if (filter?.channel) {
            events = events.filter(e => e.channel === filter.channel);
        }
        if (filter?.since) {
            events = events.filter(e => e.timestamp >= filter.since);
        }
        return events;
    }
}
export default RolloutController;
