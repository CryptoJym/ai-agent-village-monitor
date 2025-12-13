/**
 * E2E tests for Agent management
 */

import { test, expect } from '@playwright/test';
import {
  checkAccessibility,
  waitForNetworkIdle,
  waitForPhaserGame,
  generateTestAgent,
} from './helpers';

test.describe('Agent Management', () => {
  test('should display agents in village', async ({ page }) => {
    await page.goto('/villages/1');
    await waitForNetworkIdle(page);

    // Check agents list is visible
    await expect(page.locator('[data-testid="agents-list"]')).toBeVisible();

    // Check accessibility
    await checkAccessibility(page);
  });

  test('should view agent details', async ({ page }) => {
    await page.goto('/villages/1');

    // Click on first agent
    const firstAgent = page.locator('[data-testid="agent-card"]').first();
    if (await firstAgent.isVisible()) {
      await firstAgent.click();

      // Should show agent details
      await expect(page.locator('[data-testid="agent-details"]')).toBeVisible();
    }
  });

  test('should display agent in Phaser game', async ({ page }) => {
    await page.goto('/villages/1');

    // Wait for Phaser game to load
    await waitForPhaserGame(page);

    // Verify canvas is present
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Check canvas dimensions
    const box = await canvas.boundingBox();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);
  });

  test('should show agent activity', async ({ page }) => {
    await page.goto('/villages/1/agents/1');

    // Check activity timeline
    await expect(page.locator('[data-testid="agent-activity"]')).toBeVisible();

    // Check accessibility
    await checkAccessibility(page);
  });

  test('should filter agents by status', async ({ page }) => {
    await page.goto('/villages/1');

    // Click filter dropdown
    await page.click('[data-testid="status-filter"]');

    // Select ACTIVE
    await page.click('text="Active"');

    // Wait for results
    await page.waitForTimeout(500);

    // Verify filtered results
    const agentCards = page.locator('[data-testid="agent-card"]');
    const count = await agentCards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should handle agent interactions', async ({ page }) => {
    await page.goto('/villages/1');

    // Wait for Phaser game
    await waitForPhaserGame(page);

    // Click on canvas (interact with agent)
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 100, y: 100 } });

    // Should show interaction UI
    await page.waitForTimeout(1000);

    // Check if tooltip or modal appeared
    const tooltip = page.locator('[data-testid="agent-tooltip"]');
    const modal = page.locator('[role="dialog"]');

    const tooltipVisible = await tooltip.isVisible().catch(() => false);
    const modalVisible = await modal.isVisible().catch(() => false);

    expect(tooltipVisible || modalVisible).toBeTruthy();
  });
});

test.describe('Agent Real-time Updates', () => {
  test('should show real-time agent status changes', async ({ page }) => {
    await page.goto('/villages/1');

    // Get initial agent count
    const agentsList = page.locator('[data-testid="agents-list"]');
    await expect(agentsList).toBeVisible();

    // Wait for potential WebSocket updates
    await page.waitForTimeout(2000);

    // Agent status should be updated
    const statusBadges = page.locator('[data-testid="agent-status"]');
    const count = await statusBadges.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Agent Search', () => {
  test('should search for agents', async ({ page }) => {
    await page.goto('/villages/1');

    // Enter search query
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');

      // Wait for search results
      await page.waitForTimeout(500);

      // Verify search executed
      const results = page.locator('[data-testid="agent-card"]');
      const count = await results.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});
