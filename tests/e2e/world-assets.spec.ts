import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';

const KNOWN_API_FAILURES = ['/api/villages', '/api/analytics/collect'];

const isKnownApiFailure = (message: string) =>
  KNOWN_API_FAILURES.some((path) => message.includes(path));

test.describe('world immersion diagnostics', () => {
  test('collects console and network issues on world load', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (msg) => {
      const entry = `[${msg.type()}] ${msg.text()}`;
      if (msg.type() === 'error') {
        consoleErrors.push(entry);
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(entry);
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(`[pageerror] ${err?.message ?? String(err)}`);
    });

    page.on('requestfailed', (request) => {
      failedRequests.push(`[requestfailed] ${request.url()} :: ${request.failure()?.errorText}`);
    });

    page.on('response', (response) => {
      const status = response.status();
      if (status >= 400) {
        failedRequests.push(`[response ${status}] ${response.url()}`);
      }
    });

    const resp = await page.goto('/');
    expect.soft(resp?.ok()).toBeTruthy();

    await page.waitForFunction(
      () => {
        const game = (window as any)._phaserGame;
        const sceneManager = game?.scene;
        return Boolean(sceneManager && Object.keys(sceneManager.keys || {}).length > 0);
      },
      undefined,
      { timeout: 15_000 },
    );

    await page.waitForTimeout(2_500);

    const glWarnings = consoleWarnings.filter((msg) => msg.includes('GL Driver Message'));
    const textureWarnings = consoleWarnings.filter((msg) => msg.includes('Texture'));
    const routerWarnings = consoleWarnings.filter((msg) => msg.includes('React Router'));
    const otherWarnings = consoleWarnings.filter(
      (msg) =>
        !glWarnings.includes(msg) &&
        !textureWarnings.includes(msg) &&
        !routerWarnings.includes(msg),
    );

    const ignoredGlWarnings = glWarnings.filter((msg) => msg.includes('ReadPixels'));
    const actionableGlWarnings = glWarnings.filter((msg) => !ignoredGlWarnings.includes(msg));
    const networkConsoleErrors = consoleErrors.filter(
      (msg) =>
        isKnownApiFailure(msg) ||
        msg.includes('Failed to load resource: the server responded with a status of 500'),
    );
    const actionableConsoleErrors = consoleErrors.filter(
      (msg) => !networkConsoleErrors.includes(msg),
    );
    const ignoredFailedRequests = failedRequests.filter((msg) => isKnownApiFailure(msg));
    const actionableFailedRequests = failedRequests.filter(
      (msg) => !ignoredFailedRequests.includes(msg),
    );

    const diagnostics = [
      `Console errors (count=${actionableConsoleErrors.length})`,
      actionableConsoleErrors.join('\n') || 'none',
      `Console errors (ignored known API failures count=${networkConsoleErrors.length})`,
      networkConsoleErrors.join('\n') || 'none',
      `Texture warnings (count=${textureWarnings.length})`,
      textureWarnings.join('\n') || 'none',
      `WebGL warnings (count=${actionableGlWarnings.length})`,
      actionableGlWarnings.join('\n') || 'none',
      `WebGL warnings (ignored driver noise count=${ignoredGlWarnings.length})`,
      ignoredGlWarnings.join('\n') || 'none',
      `React Router warnings (count=${routerWarnings.length})`,
      routerWarnings.join('\n') || 'none',
      `Other warnings (count=${otherWarnings.length})`,
      otherWarnings.join('\n') || 'none',
      `Failed requests (count=${actionableFailedRequests.length})`,
      actionableFailedRequests.join('\n') || 'none',
      `Failed requests (ignored known API failures count=${ignoredFailedRequests.length})`,
      ignoredFailedRequests.join('\n') || 'none',
    ].join('\n\n');

    testInfo.attachments.push({
      name: 'world-diagnostics',
      contentType: 'text/plain',
      body: Buffer.from(diagnostics, 'utf-8'),
    });

    await test.step('capture world canvas screenshot', async () => {
      await page.screenshot({ path: testInfo.outputPath('world-canvas.png'), fullPage: true });
    });

    expect(textureWarnings, 'texture warnings').toHaveLength(0);
    expect.soft(actionableGlWarnings, 'webgl driver warnings').toHaveLength(0);
    expect.soft(routerWarnings, 'React Router warnings').toHaveLength(0);
    expect(actionableFailedRequests, 'failed requests').toHaveLength(0);
    expect(actionableConsoleErrors, 'console errors').toHaveLength(0);
  });
  test('reports NPC population summary', async ({ page }) => {
    test.fail(true, 'Pending asset pipeline fixes for NPC readiness');
    await page.goto('/');

    await page.waitForFunction(
      () => {
        const game = (window as any)._phaserGame;
        if (!game?.scene?.getScene) return false;
        try {
          const main = game.scene.getScene('MainScene');
          return Boolean((main as any)?.npcManager);
        } catch {
          return false;
        }
      },
      undefined,
      { timeout: 15_000 },
    );

    const summary = await page.evaluate(() => {
      const game = (window as any)._phaserGame;
      const main = game.scene.getScene('MainScene');
      const interior = game.scene.getScene('InteriorScene');
      const npcManager = (main as any)?.npcManager;
      const population = npcManager ? ((npcManager as any).npcs?.size ?? null) : null;
      const houses = npcManager
        ? Array.from(((npcManager as any).houseMap?.keys?.() as Iterable<string>) ?? [])
        : [];
      return {
        sceneKeys: Object.keys(game.scene.keys || {}),
        population,
        houses,
        interiorReady: Boolean(interior),
      };
    });

    expect(summary.sceneKeys).toContain('MainScene');
    expect(summary.interiorReady).toBeTruthy();
    expect(summary.population ?? 0).toBeGreaterThan(0);
    expect(summary.houses.length).toBeGreaterThan(0);
  });
});
