/**
 * Canary Test Runner
 *
 * Runs compatibility tests against candidate builds before
 * they are promoted to stable.
 */
import { EventEmitter } from 'events';
import type { ProviderId } from '@ai-agent-village-monitor/shared';
import type { CanaryTestSuite, CanaryTestCase, CanaryTestResult, TestCaseResult, RunnerBuild } from '../types';
/** Canary runner configuration */
export interface CanaryRunnerConfig {
    /** Maximum concurrent tests */
    maxConcurrency: number;
    /** Default test timeout (ms) */
    defaultTimeoutMs: number;
    /** Test repos to use */
    testRepos: CanaryTestRepo[];
    /** Whether to continue on test failure */
    continueOnFailure: boolean;
    /** Retry count for flaky tests */
    retryCount: number;
}
/** Repository used for canary testing */
export interface CanaryTestRepo {
    /** Repository URL */
    url: string;
    /** Repository type */
    type: 'js' | 'ts' | 'python' | 'generic';
    /** Whether CI is configured */
    hasCI: boolean;
    /** Branch to use */
    branch: string;
}
/** Canary test execution context */
export interface CanaryContext {
    /** Build being tested */
    build: RunnerBuild;
    /** Session ID for this test */
    sessionId: string;
    /** Working directory */
    workDir: string;
    /** Provider being tested */
    providerId: ProviderId;
}
/** Default canary test suites */
export declare const DEFAULT_CANARY_SUITES: CanaryTestSuite[];
/** Default test repos */
export declare const DEFAULT_TEST_REPOS: CanaryTestRepo[];
/**
 * CanaryRunner executes compatibility tests against candidate builds.
 *
 * Emits:
 * - 'suite_started': When a test suite starts
 * - 'suite_completed': When a test suite completes
 * - 'test_started': When a test case starts
 * - 'test_completed': When a test case completes
 * - 'test_retried': When a test is retried
 */
export declare class CanaryRunner extends EventEmitter {
    private config;
    private suites;
    private runningTests;
    constructor(config?: Partial<CanaryRunnerConfig>);
    /**
     * Run all canary tests for a build.
     */
    runAllSuites(build: RunnerBuild): Promise<CanaryTestResult[]>;
    /**
     * Run a specific test suite.
     */
    runSuite(suite: CanaryTestSuite, build: RunnerBuild): Promise<CanaryTestResult>;
    /**
     * Run individual test cases.
     */
    private runTestCases;
    /**
     * Run a single test case with retry support.
     */
    runTestCase(testCase: CanaryTestCase, build: RunnerBuild, sessionId: string): Promise<TestCaseResult>;
    /**
     * Execute a test based on its type.
     */
    private executeTest;
    /**
     * Execute adapter contract test.
     */
    private executeAdapterContractTest;
    /**
     * Execute golden path test.
     */
    private executeGoldenPathTest;
    /**
     * Execute approval gate test.
     */
    private executeApprovalGateTest;
    /**
     * Execute metering test.
     */
    private executeMeteringTest;
    /**
     * Determine if a test result is retriable.
     */
    private isRetriable;
    /**
     * Calculate aggregated metrics from test results.
     */
    private calculateMetrics;
    /**
     * Determine overall status from test results.
     */
    private determineOverallStatus;
    /**
     * Register a custom test suite.
     */
    registerSuite(suite: CanaryTestSuite): void;
    /**
     * Get a registered suite.
     */
    getSuite(suiteId: string): CanaryTestSuite | undefined;
    /**
     * Get all registered suites.
     */
    getAllSuites(): CanaryTestSuite[];
    /**
     * Check if any tests are running.
     */
    isRunning(): boolean;
}
export default CanaryRunner;
//# sourceMappingURL=CanaryRunner.d.ts.map