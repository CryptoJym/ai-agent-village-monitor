/**
 * E2E Test Helpers
 * Utilities for Playwright tests including accessibility testing
 */

import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility testing helper
 */
export async function checkAccessibility(
  page: Page,
  options: { includedImpacts?: string[] } = {},
) {
  const { includedImpacts = ['critical', 'serious'] } = options;

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = accessibilityScanResults.violations.filter((violation) =>
    includedImpacts.includes(violation.impact || ''),
  );

  expect(violations).toEqual([]);

  return accessibilityScanResults;
}

/**
 * Performance metrics helper
 */
export async function measurePerformance(page: Page) {
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');

    return {
      // Navigation timing
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      domInteractive: navigation.domInteractive - navigation.fetchStart,

      // Paint timing
      firstPaint: paint.find((p) => p.name === 'first-paint')?.startTime || 0,
      firstContentfulPaint:
        paint.find((p) => p.name === 'first-contentful-paint')?.startTime || 0,

      // Resource timing
      resourcesCount: performance.getEntriesByType('resource').length,
    };
  });

  return metrics;
}

/**
 * Visual regression helper
 */
export async function takeSnapshot(page: Page, name: string) {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    animations: 'disabled',
  });
}

/**
 * Wait for network idle
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Mock API response
 */
export async function mockApiResponse(
  page: Page,
  url: string | RegExp,
  response: any,
  status = 200,
) {
  await page.route(url, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Login helper
 */
export async function login(page: Page, username = 'testuser', password = 'testpass') {
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

/**
 * Wait for Phaser game to load
 */
export async function waitForPhaserGame(page: Page) {
  await page.waitForSelector('canvas', { timeout: 10000 });
  // Wait for game to initialize
  await page.waitForTimeout(1000);
}

/**
 * Console error collector
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  return errors;
}

/**
 * Network request logger
 */
export interface NetworkRequest {
  url: string;
  method: string;
  status?: number;
  duration?: number;
}

export function collectNetworkRequests(page: Page): NetworkRequest[] {
  const requests: NetworkRequest[] = [];

  page.on('request', (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
    });
  });

  page.on('response', (response) => {
    const request = requests.find((r) => r.url === response.url() && !r.status);
    if (request) {
      request.status = response.status();
    }
  });

  return requests;
}

/**
 * Test data generators
 */

export function generateTestVillage() {
  return {
    name: `test-village-${Date.now()}`,
    githubOrgId: String(Math.floor(Math.random() * 1000000)),
  };
}

export function generateTestAgent() {
  return {
    name: `test-agent-${Date.now()}`,
    githubRepoId: String(Math.floor(Math.random() * 1000000)),
  };
}

/**
 * Retry helper for flaky operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; delay?: number } = {},
): Promise<T> {
  const { retries = 3, delay = 1000 } = options;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Retry failed');
}
