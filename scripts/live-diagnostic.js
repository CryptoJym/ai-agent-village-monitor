import { chromium } from 'playwright';

const url = process.env.LIVE_BASE_URL || 'https://ai-agent-village-monitor-vuplicity.vercel.app';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('response', (resp) => {
    const status = resp.status();
    if (status >= 400) {
      console.log('response', status, resp.url());
    }
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log('console', msg.type(), msg.text());
    }
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);
  const visibleCanvas = await page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    return canvases.filter((c) => c.offsetParent !== null).length;
  });

  const dialogueOpen = await page.getByTestId('dialogue-panel').isVisible().catch(() => false);

  console.log('canvasCount', canvasCount);
  console.log('visibleCanvas', visibleCanvas);
  console.log('dialogueVisible', dialogueOpen);

  await browser.close();
})();
