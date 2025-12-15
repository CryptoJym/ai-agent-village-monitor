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
      preset: 'lighthouse:recommended',
      assertions: {
        // Performance budgets
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.8 }],

        // Core Web Vitals
        'first-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'speed-index': ['error', { maxNumericValue: 3400 }],

        // Interactivity
        interactive: ['error', { maxNumericValue: 3800 }],
        'max-potential-fid': ['error', { maxNumericValue: 100 }],

        // Accessibility
        'color-contrast': 'error',
        'image-alt': 'error',
        label: 'error',
        'aria-required-attr': 'error',
        'aria-valid-attr': 'error',
        'button-name': 'error',
        'link-name': 'error',

        // Best practices
        'errors-in-console': 'warn',
        'uses-https': 'error',
        'no-vulnerable-libraries': 'warn',

        // SEO
        'meta-description': 'warn',
        'document-title': 'error',

        // Resource optimization
        'unminified-css': 'warn',
        'unminified-javascript': 'warn',
        'unused-css-rules': 'warn',
        'unused-javascript': 'warn',
        'modern-image-formats': 'warn',
        'uses-optimized-images': 'warn',
        'uses-text-compression': 'warn',
        'uses-responsive-images': 'warn',

        // Network
        'total-byte-weight': ['warn', { maxNumericValue: 3000000 }], // 3MB
        'network-requests': ['warn', { maxNumericValue: 100 }],
        'uses-long-cache-ttl': 'warn',

        // JavaScript
        'bootup-time': ['warn', { maxNumericValue: 3000 }],
        'mainthread-work-breakdown': ['warn', { maxNumericValue: 4000 }],
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
