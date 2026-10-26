import { test, expect, contextWith } from '../fixtures/test.ts';

test('@mobile chart readouts respond to real touch input', async ({ browser, baseURL, guard, seed }) => {
  const context = await contextWith(browser, seed.a, baseURL as string, guard,
    { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto('/analysis');
    await page.locator('.analysis-overview-vo2-bar-col').last().tap();
    await expect(page.locator('.analysis-overview-vo2-tooltip')).toBeVisible();
    await page.locator('.vo2max-estimates-v2__history-disclosure > summary').tap();
    const history = page.locator('.vo2max-estimates-v2__history [role="slider"]');
    await expect(history).toBeVisible();
    for (const slider of [history]) {
      const box = await slider.boundingBox();
      await slider.tap({ position: { x: 20, y: 100 } });
      const first = await slider.getAttribute('aria-valuenow');
      await slider.tap({ position: { x: box!.width - 20, y: 100 } });
      await expect(slider).not.toHaveAttribute('aria-valuenow', first!);
    }
    await page.locator('#analysis-trends > summary').tap();
    const trends = page.locator('#analysis-trends [role="slider"]');
    await expect(trends).toBeVisible();
    const box = await trends.boundingBox();
    await trends.tap({ position: { x: 20, y: 100 } });
    const first = await trends.getAttribute('aria-valuenow');
    await trends.tap({ position: { x: box!.width - 20, y: 100 } });
    await expect(trends).not.toHaveAttribute('aria-valuenow', first!);
    expect(guard.problems).toEqual([]);
  } finally { await context.close(); }
});
