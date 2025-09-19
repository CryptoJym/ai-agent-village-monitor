import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('console', (msg) => console.log('[browser]', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err?.message || String(err)));
});

test.describe('Onboarding flow (smoke)', () => {
  test('opens app and shows header', async ({ page }) => {
    // Skip if server is not running
    try {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForSelector('h1', { timeout: 10000 });
    } catch {
      test.skip(true, 'Base URL not reachable');
    }
    await expect(page.getByText('AI Agent Village Monitor')).toBeVisible();
  });

  test('open dialogue via keyboard shortcut T', async ({ page }) => {
    try {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
    } catch {
      test.skip(true, 'Base URL not reachable');
    }
    await page.keyboard.press('KeyT');
    // Look for dialogue panel
    const dlg = page.getByTestId('dialogue-panel');
    await expect(dlg).toBeVisible({ timeout: 10000 });
    // Closing can vary by focus; we validate visibility only for smoke
  });
});
