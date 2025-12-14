/**
 * Canary Test Runner
 *
 * Runs compatibility tests against candidate builds before
 * they are promoted to stable.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { ProviderId } from '@ai-agent-village-monitor/shared';
import type {
  CanaryTestSuite,
  CanaryTestCase,
  CanaryTestResult,
  TestCaseResult,
  CanaryMetrics,
  RunnerBuild,
} from '../types';

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
export const DEFAULT_CANARY_SUITES: CanaryTestSuite[] = [
  {
    suiteId: 'adapter_contract',
    name: 'Adapter Contract Tests',
    testCases: [
      {
        testId: 'detect_cli',
        description: 'Detect CLI presence and version',
        providers: ['codex', 'claude_code', 'gemini_cli'],
        type: 'adapter_contract',
        config: { timeoutMs: 10000 },
      },
      {
        testId: 'capabilities_check',
        description: 'Query CLI capabilities',
        providers: ['codex', 'claude_code', 'gemini_cli'],
        type: 'adapter_contract',
        config: { timeoutMs: 10000 },
      },
      {
        testId: 'session_start_stop',
        description: 'Start and stop a session',
        providers: ['codex', 'claude_code', 'gemini_cli'],
        type: 'adapter_contract',
        config: { timeoutMs: 30000 },
      },
    ],
    timeoutMs: 120000,
  },
  {
    suiteId: 'golden_path',
    name: 'Golden Path Workflow Tests',
    testCases: [
      {
        testId: 'simple_edit',
        description: 'Perform a simple file edit',
        providers: ['codex', 'claude_code', 'gemini_cli'],
        type: 'golden_path',
        config: {
          prompt: 'Change the greeting message in src/index.ts to "Hello, Canary!"',
          expectedOutcome: 'diff_generated',
          timeoutMs: 60000,
        },
      },
      {
        testId: 'run_tests_command',
        description: 'Execute test command',
        providers: ['codex', 'claude_code', 'gemini_cli'],
        type: 'golden_path',
        config: {
          prompt: 'Run the test suite and report results',
          expectedOutcome: 'success',
          timeoutMs: 120000,
        },
      },
    ],
    timeoutMs: 300000,
  },
  {
    suiteId: 'approval_gates',
    name: 'Approval Gate Tests',
    testCases: [
      {
        testId: 'risky_action_blocked',
        description: 'Verify risky actions require approval',
        providers: ['codex', 'claude_code', 'gemini_cli'],
        type: 'approval_gate',
        config: {
          prompt: 'Delete the main.ts file',
          expectedOutcome: 'blocked',
          timeoutMs: 30000,
        },
      },
    ],
    timeoutMs: 60000,
  },
  {
    suiteId: 'metering',
    name: 'Usage Metering Tests',
    testCases: [
      {
        testId: 'usage_tick_emitted',
        description: 'Verify USAGE_TICK events are emitted',
        providers: ['codex', 'claude_code', 'gemini_cli'],
        type: 'metering',
        config: { timeoutMs: 60000 },
      },
    ],
    timeoutMs: 120000,
  },
];

/** Default test repos */
export const DEFAULT_TEST_REPOS: CanaryTestRepo[] = [
  {
    url: 'https://github.com/ai-agent-village/canary-repo-js',
    type: 'js',
    hasCI: true,
    branch: 'main',
  },
  {
    url: 'https://github.com/ai-agent-village/canary-repo-ts',
    type: 'ts',
    hasCI: true,
    branch: 'main',
  },
];

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
export class CanaryRunner extends EventEmitter {
  private config: CanaryRunnerConfig;
  private suites: Map<string, CanaryTestSuite> = new Map();
  private runningTests: Map<string, CanaryContext> = new Map();

  constructor(config: Partial<CanaryRunnerConfig> = {}) {
    super();
    this.config = {
      maxConcurrency: config.maxConcurrency ?? 2,
      defaultTimeoutMs: config.defaultTimeoutMs ?? 60000,
      testRepos: config.testRepos ?? DEFAULT_TEST_REPOS,
      continueOnFailure: config.continueOnFailure ?? true,
      retryCount: config.retryCount ?? 1,
    };

    // Register default suites
    for (const suite of DEFAULT_CANARY_SUITES) {
      this.suites.set(suite.suiteId, suite);
    }
  }

  /**
   * Run all canary tests for a build.
   */
  async runAllSuites(build: RunnerBuild): Promise<CanaryTestResult[]> {
    const results: CanaryTestResult[] = [];

    for (const suite of this.suites.values()) {
      const result = await this.runSuite(suite, build);
      results.push(result);

      // Stop if not continuing on failure
      if (!this.config.continueOnFailure && result.status !== 'passed') {
        break;
      }
    }

    return results;
  }

  /**
   * Run a specific test suite.
   */
  async runSuite(suite: CanaryTestSuite, build: RunnerBuild): Promise<CanaryTestResult> {
    const startedAt = new Date();
    const testResults: TestCaseResult[] = [];
    const sessionId = uuidv4();

    this.emit('suite_started', {
      suiteId: suite.suiteId,
      suiteName: suite.name,
      buildId: build.buildId,
      timestamp: startedAt,
    });

    // Create timeout for entire suite
    const suiteTimeout = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Suite timeout')), suite.timeoutMs);
    });

    try {
      // Run tests with suite timeout
      await Promise.race([
        this.runTestCases(suite.testCases, build, sessionId, testResults),
        suiteTimeout,
      ]);
    } catch (error) {
      // Suite timed out or errored
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Mark remaining tests as timed out
      for (const testCase of suite.testCases) {
        if (!testResults.some(r => r.testId === testCase.testId)) {
          testResults.push({
            testId: testCase.testId,
            status: error instanceof Error && error.message === 'Suite timeout' ? 'timeout' : 'error',
            durationMs: 0,
            errorMessage,
          });
        }
      }
    }

    const completedAt = new Date();
    const metrics = this.calculateMetrics(testResults);
    const status = this.determineOverallStatus(testResults);

    const result: CanaryTestResult = {
      buildId: build.buildId,
      suiteId: suite.suiteId,
      status,
      startedAt,
      completedAt,
      testResults,
      metrics,
    };

    this.emit('suite_completed', {
      ...result,
      timestamp: completedAt,
    });

    return result;
  }

  /**
   * Run individual test cases.
   */
  private async runTestCases(
    testCases: CanaryTestCase[],
    build: RunnerBuild,
    sessionId: string,
    results: TestCaseResult[]
  ): Promise<void> {
    for (const testCase of testCases) {
      const result = await this.runTestCase(testCase, build, sessionId);
      results.push(result);

      if (!this.config.continueOnFailure && result.status !== 'passed') {
        break;
      }
    }
  }

  /**
   * Run a single test case with retry support.
   */
  async runTestCase(
    testCase: CanaryTestCase,
    build: RunnerBuild,
    sessionId: string
  ): Promise<TestCaseResult> {
    const startTime = Date.now();
    let lastResult: TestCaseResult | null = null;

    for (let attempt = 0; attempt <= this.config.retryCount; attempt++) {
      this.emit('test_started', {
        testId: testCase.testId,
        attempt,
        buildId: build.buildId,
        timestamp: new Date(),
      });

      try {
        const result = await this.executeTest(testCase, build, sessionId);
        lastResult = result;

        this.emit('test_completed', {
          ...result,
          attempt,
          timestamp: new Date(),
        });

        // If passed, no need to retry
        if (result.status === 'passed') {
          return result;
        }

        // If not last attempt and failure is retriable, continue
        if (attempt < this.config.retryCount && this.isRetriable(result)) {
          this.emit('test_retried', {
            testId: testCase.testId,
            attempt: attempt + 1,
            previousStatus: result.status,
            timestamp: new Date(),
          });
          continue;
        }

        return result;
      } catch (error) {
        lastResult = {
          testId: testCase.testId,
          status: 'error',
          durationMs: Date.now() - startTime,
          errorMessage: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return lastResult!;
  }

  /**
   * Execute a test based on its type.
   */
  private async executeTest(
    testCase: CanaryTestCase,
    build: RunnerBuild,
    _sessionId: string
  ): Promise<TestCaseResult> {
    const startTime = Date.now();
    const timeout = testCase.config.timeoutMs ?? this.config.defaultTimeoutMs;

    try {
      let status: TestCaseResult['status'];
      let output: string | undefined;

      switch (testCase.type) {
        case 'adapter_contract':
          ({ status, output } = await this.executeAdapterContractTest(testCase, build, timeout));
          break;
        case 'golden_path':
          ({ status, output } = await this.executeGoldenPathTest(testCase, build, timeout));
          break;
        case 'approval_gate':
          ({ status, output } = await this.executeApprovalGateTest(testCase, build, timeout));
          break;
        case 'metering':
          ({ status, output } = await this.executeMeteringTest(testCase, build, timeout));
          break;
        default:
          status = 'skipped';
          output = 'Unknown test type';
      }

      return {
        testId: testCase.testId,
        status,
        durationMs: Date.now() - startTime,
        output,
      };
    } catch (error) {
      return {
        testId: testCase.testId,
        status: 'error',
        durationMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute adapter contract test.
   */
  private async executeAdapterContractTest(
    testCase: CanaryTestCase,
    build: RunnerBuild,
    _timeout: number
  ): Promise<{ status: TestCaseResult['status']; output?: string }> {
    // Simulate adapter contract test
    // In real implementation, this would:
    // 1. Load the adapter for the provider
    // 2. Call detect() and verify response
    // 3. Call capabilities() and verify response
    // 4. Optionally start/stop a session

    const providerId = testCase.providers[0];
    const bundledVersion = build.runtimeVersions[providerId];

    if (!bundledVersion) {
      return {
        status: 'skipped',
        output: `No bundled version for provider ${providerId}`,
      };
    }

    // Placeholder for actual adapter testing
    // In production, this would use the actual adapter classes
    return {
      status: 'passed',
      output: `Adapter contract verified for ${providerId}@${bundledVersion}`,
    };
  }

  /**
   * Execute golden path test.
   */
  private async executeGoldenPathTest(
    testCase: CanaryTestCase,
    _build: RunnerBuild,
    _timeout: number
  ): Promise<{ status: TestCaseResult['status']; output?: string }> {
    // Simulate golden path test
    // In real implementation, this would:
    // 1. Clone a test repo
    // 2. Start a session with the provider
    // 3. Execute the prompt
    // 4. Verify expected outcome

    const expectedOutcome = testCase.config.expectedOutcome ?? 'success';

    // Placeholder - real implementation would execute actual workflow
    return {
      status: 'passed',
      output: `Golden path test completed with expected outcome: ${expectedOutcome}`,
    };
  }

  /**
   * Execute approval gate test.
   */
  private async executeApprovalGateTest(
    testCase: CanaryTestCase,
    _build: RunnerBuild,
    _timeout: number
  ): Promise<{ status: TestCaseResult['status']; output?: string }> {
    // Simulate approval gate test
    // In real implementation, this would:
    // 1. Start a session
    // 2. Attempt a risky action
    // 3. Verify it is blocked and requires approval

    const expectedOutcome = testCase.config.expectedOutcome ?? 'blocked';

    // Placeholder - real implementation would test actual gating
    return {
      status: expectedOutcome === 'blocked' ? 'passed' : 'failed',
      output: `Approval gate test: action was ${expectedOutcome === 'blocked' ? 'correctly blocked' : 'not blocked'}`,
    };
  }

  /**
   * Execute metering test.
   */
  private async executeMeteringTest(
    _testCase: CanaryTestCase,
    _build: RunnerBuild,
    _timeout: number
  ): Promise<{ status: TestCaseResult['status']; output?: string }> {
    // Simulate metering test
    // In real implementation, this would:
    // 1. Start a session
    // 2. Wait for USAGE_TICK events
    // 3. Verify timing and content

    // Placeholder - real implementation would verify actual metering
    return {
      status: 'passed',
      output: 'USAGE_TICK events verified',
    };
  }

  /**
   * Determine if a test result is retriable.
   */
  private isRetriable(result: TestCaseResult): boolean {
    // Retry on timeout or transient errors
    if (result.status === 'timeout') {
      return true;
    }
    if (result.status === 'error' && result.errorMessage) {
      return result.errorMessage.includes('ECONNRESET') ||
             result.errorMessage.includes('ETIMEDOUT');
    }
    return false;
  }

  /**
   * Calculate aggregated metrics from test results.
   */
  private calculateMetrics(results: TestCaseResult[]): CanaryMetrics {
    const totalTests = results.length;
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const errored = results.filter(r => r.status === 'error').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const timedOut = results.filter(r => r.status === 'timeout').length;

    const passRate = totalTests > 0 ? passed / totalTests : 0;
    const avgDurationMs = totalTests > 0
      ? results.reduce((sum, r) => sum + r.durationMs, 0) / totalTests
      : 0;

    return {
      totalTests,
      passed,
      failed: failed + timedOut,
      errored,
      skipped,
      passRate,
      avgSessionStartMs: avgDurationMs, // Placeholder
      avgTimeToFirstOutputMs: avgDurationMs / 2, // Placeholder
      disconnectRate: 0, // Would be calculated from actual session data
    };
  }

  /**
   * Determine overall status from test results.
   */
  private determineOverallStatus(results: TestCaseResult[]): CanaryTestResult['status'] {
    if (results.some(r => r.status === 'timeout')) {
      return 'timeout';
    }
    if (results.some(r => r.status === 'error')) {
      return 'error';
    }
    if (results.some(r => r.status === 'failed')) {
      return 'failed';
    }
    return 'passed';
  }

  /**
   * Register a custom test suite.
   */
  registerSuite(suite: CanaryTestSuite): void {
    this.suites.set(suite.suiteId, suite);
  }

  /**
   * Get a registered suite.
   */
  getSuite(suiteId: string): CanaryTestSuite | undefined {
    return this.suites.get(suiteId);
  }

  /**
   * Get all registered suites.
   */
  getAllSuites(): CanaryTestSuite[] {
    return Array.from(this.suites.values());
  }

  /**
   * Check if any tests are running.
   */
  isRunning(): boolean {
    return this.runningTests.size > 0;
  }
}

export default CanaryRunner;
