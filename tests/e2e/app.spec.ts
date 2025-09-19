import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('console', (msg) => {
    console.log('[browser]', msg.type(), msg.text());
  });
  page.on('pageerror', (err) => {
    console.log('[pageerror]', err?.message || String(err));
  });
});

test('app loads and shows title', async ({ page }) => {
  const resp = await page.goto('/');
  expect(resp?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/AI Agent Village Monitor/i);
  // Wait for DOM to be ready and root to render
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('h1', { timeout: 10000 });
  await expect(page.getByRole('heading', { name: /AI Agent Village Monitor/i })).toBeVisible();
});
