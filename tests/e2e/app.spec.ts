import { test, expect } from '@playwright/test';

test('app loads and shows title', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /AI Agent Village Monitor/i })).toBeVisible();
});

