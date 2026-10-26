import { test, expect, contextWith } from '../fixtures/test.ts';

for (const mobile of [false, true]) {
  test(`${mobile ? '@mobile ' : ''}all four prediction links retain the overview forecast and render history`, async ({ browser, baseURL, guard, seed }) => {
    const context = await contextWith(browser, seed.a, baseURL as string, guard, mobile
      ? { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 } });
    try {
      const page = await context.newPage();
      for (const key of ['5k', '10k', 'half', 'marathon']) {
        await page.goto('/analysis');
        const link = page.locator(`a[href="/prediction/${key}"]`);
        await expect(link.locator('strong').last()).not.toHaveText('--');
        const expected = await link.locator('strong').last().innerText();
        const response = page.waitForResponse(r => r.url().endsWith('/api/activities/analysis') && r.status() === 200);
        await link.click();
        await response;
        await expect(page.locator('.prediction-forecast-time')).toHaveText(expected);
        await expect(page.locator('canvas')).toBeVisible();
        const size = await page.locator('canvas').boundingBox();
        expect(size?.width).toBeGreaterThan(100);
        expect(size?.height).toBeGreaterThan(100);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
      expect(guard.problems).toEqual([]);
    } finally { await context.close(); }
  });
}
