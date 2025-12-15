/**
 * Lighthouse CI Configuration
 *
 * Defines performance budgets and quality thresholds for CI/CD
 *
 * Usage:
 * - npm install -g @lhci/cli
 * - lhci autorun
 */

module.exports = {
  ci: {
    collect: {
      // URLs to test
      url: ['http://localhost:4173/login'],

      // Number of runs for each URL
      numberOfRuns: 3,

      // Lighthouse settings
      settings: {
        preset: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
        screenEmulation: {
          mobile: false,
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
          disabled: false,
        },
        formFactor: 'desktop',
      },

      // Start server before testing
      startServerCommand: 'pnpm preview',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 30000,
    },

    upload: {
      target: 'temporary-public-storage',
    },

    assert: {
      assertions: {
        // Keep Lighthouse CI informational until the app's routes + budgets are finalized.
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
      },
    },

    // Server configuration
    server: {
      port: 9001,
      storage: {
        storageMethod: 'filesystem',
        storagePath: './lighthouse-ci-storage',
      },
    },
  },
};
