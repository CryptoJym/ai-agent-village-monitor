import { defineConfig, devices } from '@playwright/test';

/**
 * Enhanced Playwright E2E Testing Configuration
 *
 * Features:
 * - Multi-browser testing (Chromium, Firefox, WebKit)
 * - Visual regression testing with screenshots
 * - Accessibility testing support
 * - Performance metrics capture
 * - CI/CD optimization
 */

export default defineConfig({
  testDir: 'tests/e2e',

  // Test execution
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporting
  reporter: [
    ['html', { outputFolder: 'test-results/playwright-html' }],
    ['json', { outputFile: 'test-results/playwright-report.json' }],
    ['junit', { outputFile: 'test-results/playwright-junit.xml' }],
    ['list'],
  ],

  // Global configuration
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Performance metrics
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  // Multi-browser projects
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    // Mobile browsers
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Web server
  webServer: {
    command: process.env.PW_WEB_SERVER || 'node scripts/preview-and-wait.mjs',
    url: process.env.PW_BASE_URL || 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  // Output
  outputDir: 'test-results/playwright-artifacts',
});
