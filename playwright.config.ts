import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: process.env.PW_WEB_SERVER || 'node scripts/preview-and-wait.mjs',
    url: process.env.PW_BASE_URL || 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
