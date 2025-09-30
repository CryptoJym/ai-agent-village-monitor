import { defineConfig } from '@playwright/test';
import { resolve } from 'path';

export default defineConfig({
  testDir: resolve(__dirname, 'tests/e2e'),
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.LIVE_BASE_URL || 'https://ai-agent-village-monitor-vuplicity.vercel.app',
    trace: 'retain-on-failure',
  },
});
