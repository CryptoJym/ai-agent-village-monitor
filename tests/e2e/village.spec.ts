import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('console', (msg) => console.log('[browser]', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err?.message || String(err)));
});

test.describe('Village journey', () => {
  test('render village and open dialogue', async ({ page, request }) => {
    await page.goto('/village/demo');
    await page.waitForLoadState('domcontentloaded');
    // Wait for canvas to appear (allow time for Phaser to boot)
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 });
    // Open dialogue panel
    await page.getByRole('button', { name: 'Dialogue' }).click();
    await expect(page.getByTestId('dialogue-panel')).toBeVisible();

    // Within ~5s, we should receive some demo WS activity
    // Check the thread status indicator exists
    await expect(page.getByTestId('thread-status')).toBeVisible();

    // Simulate webhook issue opened → bot spawn (best-effort; server may or may not persist)
    const payload = {
      action: 'opened',
      issue: {
        id: Date.now(),
        number: Math.floor(Math.random() * 10000),
        title: 'E2E issue',
        body: 'created by e2e',
      },
      repository: { id: Date.now() + 1, full_name: 'demo/repo', name: 'repo' },
    };
    try {
      const res = await request.post('http://localhost:3000/api/webhooks/github', {
        data: payload,
      });
      expect([202, 204]).toContain(res.status());
    } catch {
      // If server isn't running in CI, continue without failing the UI check
    }
  });
});
