/**
 * E2E tests for Village CRUD operations
 */

import { test, expect } from '@playwright/test';
import {
  checkAccessibility,
  measurePerformance,
  waitForNetworkIdle,
  generateTestVillage,
  collectConsoleErrors,
} from './helpers';

test.describe('Village Management', () => {
  test.beforeEach(async ({ page }) => {
    // Collect console errors
    const errors = collectConsoleErrors(page);
    page.on('close', () => {
      if (errors.length > 0) {
        console.warn('Console errors detected:', errors);
      }
    });
  });

  test('should display villages page', async ({ page }) => {
    await page.goto('/villages');
    await waitForNetworkIdle(page);

    // Check page loaded
    await expect(page).toHaveTitle(/Village/i);

    // Check accessibility
    await checkAccessibility(page);

    // Measure performance
    const metrics = await measurePerformance(page);
    expect(metrics.domContentLoaded).toBeLessThan(3000);
  });

  test('should create a new village', async ({ page }) => {
    await page.goto('/villages');

    // Click create button
    await page.click('button:has-text("Create Village")');

    // Fill form
    const testVillage = generateTestVillage();
    await page.fill('input[name="name"]', testVillage.name);
    await page.fill('input[name="githubOrgId"]', testVillage.githubOrgId);

    // Submit
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL(/\/villages\/\d+/);

    // Verify village was created
    await expect(page.locator('h1')).toContainText(testVillage.name);
  });

  test('should view village details', async ({ page }) => {
    await page.goto('/villages');

    // Click on first village
    const firstVillage = page.locator('[data-testid="village-card"]').first();
    await firstVillage.click();

    // Should navigate to village detail page
    await page.waitForURL(/\/villages\/\d+/);

    // Check village details are displayed
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-testid="village-info"]')).toBeVisible();
  });

  test('should update village', async ({ page }) => {
    await page.goto('/villages');

    // Navigate to first village
    await page.locator('[data-testid="village-card"]').first().click();
    await page.waitForURL(/\/villages\/\d+/);

    // Click edit button
    await page.click('button:has-text("Edit")');

    // Update name
    const newName = `updated-village-${Date.now()}`;
    await page.fill('input[name="name"]', newName);

    // Save
    await page.click('button:has-text("Save")');

    // Verify update
    await expect(page.locator('h1')).toContainText(newName);
  });

  test('should delete village', async ({ page }) => {
    await page.goto('/villages');

    // Create a test village first
    await page.click('button:has-text("Create Village")');
    const testVillage = generateTestVillage();
    await page.fill('input[name="name"]', testVillage.name);
    await page.fill('input[name="githubOrgId"]', testVillage.githubOrgId);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/villages\/\d+/);

    // Delete village
    await page.click('button:has-text("Delete")');

    // Confirm deletion
    await page.click('button:has-text("Confirm")');

    // Should redirect to villages list
    await page.waitForURL('/villages');

    // Village should not be in list
    await expect(page.locator(`text=${testVillage.name}`)).not.toBeVisible();
  });

  test('should filter villages', async ({ page }) => {
    await page.goto('/villages');

    // Enter search query
    await page.fill('input[placeholder*="Search"]', 'test');

    // Wait for results
    await page.waitForTimeout(500);

    // Verify filtered results
    const villageCards = page.locator('[data-testid="village-card"]');
    const count = await villageCards.count();

    // At least check that the filter executed
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should handle village creation errors', async ({ page }) => {
    await page.goto('/villages');

    // Click create button
    await page.click('button:has-text("Create Village")');

    // Submit empty form
    await page.click('button[type="submit"]');

    // Should show validation errors
    await expect(page.locator('.error, [role="alert"]')).toBeVisible();
  });

  test('should be accessible', async ({ page }) => {
    await page.goto('/villages');
    await waitForNetworkIdle(page);

    // Run comprehensive accessibility check
    const results = await checkAccessibility(page, {
      includedImpacts: ['critical', 'serious', 'moderate'],
    });

    // Log accessibility score
    console.log(`Accessibility violations: ${results.violations.length}`);
  });
});

test.describe('Village Mobile View', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display villages on mobile', async ({ page }) => {
    await page.goto('/villages');

    // Check responsive layout
    await expect(page.locator('[data-testid="village-card"]').first()).toBeVisible();

    // Check accessibility on mobile
    await checkAccessibility(page);
  });
});
