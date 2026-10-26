import { test, expect, contextFor } from '../fixtures/test.ts';

test('analysis features open within the existing Analysis page and retain their filter anchors', async ({ browser, baseURL, guard }) => {
  const context = await contextFor(browser, 'a', baseURL as string, guard);
  try {
    const page = await context.newPage();
    await page.goto('/analysis/trends?metric=distance&days=90');
    await expect(page).toHaveURL(/\/analysis\?metric=distance&days=90#analysis-trends$/);
    const trends = page.locator('#analysis-trends');
    await expect(trends).toHaveAttribute('open');
    await expect(trends.locator('.metric-trend-v2')).toBeVisible();
    await expect(trends.getByRole('button', { name: 'Distance', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await trends.getByRole('button', { name: 'Cadence', exact: true }).click();
    await expect(page).toHaveURL(/\/analysis\?metric=cadence&days=90#analysis-trends$/);
    await expect(page.locator('.runner-shell-sidebar')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);

    await page.getByRole('link', { name: 'The runs behind this number', exact: true }).click();
    await expect(page).toHaveURL(/\/analysis#vo2max-estimates$/);
    await expect(page.locator('#vo2max-estimates')).toHaveAttribute('open');
    await expect(page.locator('#vo2max-estimates .vo2max-estimates-v2')).toBeVisible();
    await page.getByRole('link', { name: 'Pace curve and critical pace', exact: true }).click();
    await expect(page).toHaveURL(/\/analysis#pace-curve$/);
    await expect(page.locator('#pace-curve .pace-curve-v2')).toBeVisible();
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('.authenticated-page-chrome')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('Quality sessions and the training log belong to the current Intensity and Runs pages', async ({ browser, baseURL, guard }) => {
  const context = await contextFor(browser, 'a', baseURL as string, guard);
  try {
    const page = await context.newPage();
    await page.goto('/analysis/quality-sessions?types=workout,long');
    await expect(page).toHaveURL(/\/analysis\/intensity\?types=workout,long#quality-sessions$/);
    await expect(page.locator('#quality-sessions .quality-sessions-v2')).toBeVisible();
    await expect(page.locator('.analysis-intensity-profile-content')).toBeVisible();
    await expect(page.locator('.runner-shell-sidebar')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);
    await page.goto('/training-log?metric=time');
    await expect(page).toHaveURL(/\/runs\?metric=time#training-log$/);
    await expect(page.locator('#training-log .training-log-v2')).toBeVisible();
    await expect(page.locator('.runs-ledger-v2')).toBeVisible();
    await expect(page.locator('.training-log-v2__week').first()).toBeVisible();
    await expect(page.locator('#training-log')).toHaveCount(1);
    await expect(page.locator('.runner-shell-sidebar')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);
  } finally {
    await context.close();
  }
});

test('@mobile embedded Trends fits the current Analysis page with large text', async ({ browser, baseURL, guard }) => {
  const context = await contextFor(browser, 'a', baseURL as string, guard);
  try {
    const page = await context.newPage();
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/analysis#analysis-trends');
    await expect(page.locator('#analysis-trends .metric-trend-v2')).toBeVisible();
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await expect(page.locator('.runner-shell-sidebar')).toHaveCount(1);
  } finally {
    await context.close();
  }
});
