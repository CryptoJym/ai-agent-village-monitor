import { test, expect } from '@playwright/test';

test.describe('Onboarding flow (smoke)', () => {
  test('opens app and shows header', async ({ page }) => {
    // Skip if server is not running
    try {
      await page.goto('/');
    } catch (e) {
      test.skip(true, 'Base URL not reachable');
    }
    await expect(page.getByText('AI Agent Village Monitor')).toBeVisible();
  });

  test('open dialogue via keyboard shortcut T', async ({ page }) => {
    try { await page.goto('/'); } catch { test.skip(true, 'Base URL not reachable'); }
    await page.keyboard.press('KeyT');
    // Look for dialogue panel
    const dlg = page.getByTestId('dialogue-panel');
    await expect(dlg).toBeVisible();
    // Close with ESC
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
  });
});

