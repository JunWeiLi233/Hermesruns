import path from 'node:path';
import { test, expect, contextFor } from '../fixtures/test.ts';

const shots = path.resolve(import.meta.dirname, '../../output/runalyze-integration');

test('reference layout keeps live evidence, disclosure controls and HR windows working', async ({ browser, baseURL, guard }) => {
  const context = await contextFor(browser, 'a', baseURL as string, guard);
  try {
    const page = await context.newPage();
    const paceCalls: string[] = [];
    page.on('request', request => { if (request.url().includes('/api/training/pace-curve?')) paceCalls.push(request.url()); });
    await page.goto('/analysis');
    const estimates = page.locator('#vo2max-estimates');
    await expect(estimates).toHaveAttribute('open');
    const rows = estimates.locator('.vo2max-estimates-v2__runs tbody tr');
    await expect(rows).toHaveCount(6);
    await expect(page.getByRole('heading', { name: 'Go deeper' })).toBeVisible();
    await expect(page.locator('.analysis-v2-intro').getByRole('button', { name: 'Sport totals' })).toBeVisible();
    expect((await page.locator('.analysis-v2-content').boundingBox())?.width).toBeLessThanOrEqual(1440);
    await expect(page.locator('.analysis-v2-soreness-btn').first()).toBeEnabled();
    await page.screenshot({ path: path.join(shots, 'analysis-v3-overview.png') });
    await page.screenshot({ path: path.join(shots, 'analysis-v3-desktop.png'), fullPage: true });
    await estimates.getByRole('button', { name: /Show all \d+ runs/ }).click();
    expect(await rows.count()).toBeGreaterThan(6);
    await estimates.getByRole('button', { name: 'Show fewer runs' }).click();
    await expect(rows).toHaveCount(6);
    await page.locator('#pace-curve > summary').click();
    await expect(page.locator('#pace-curve .pace-curve-v2')).toBeVisible();
    // The summary and expanded chart share one server response.
    expect(paceCalls.filter(url => url.endsWith('days=180'))).toHaveLength(1);
    const hr = page.locator('.measured-hr-block');
    await hr.getByRole('button', { name: '7 days', exact: true }).click();
    await expect(hr).toHaveAttribute('aria-busy', 'false');
    await expect(hr.getByRole('button', { name: '7 days', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await hr.getByRole('button', { name: '28 days', exact: true }).click();
    await expect(hr).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('.runner-shell-sidebar')).toHaveCount(1);
    expect(guard.problems).toEqual([]);
  } finally { await context.close(); }
});

test('overview tools still load their API-backed dialogs from the redesigned header', async ({ browser, baseURL, guard }) => {
  const context = await contextFor(browser, 'a', baseURL as string, guard);
  try {
    const page = await context.newPage();
    await page.goto('/analysis');
    await page.getByRole('button', { name: 'Sport totals', exact: true }).click();
    const totals = page.getByRole('dialog', { name: 'Sport totals' });
    await expect(totals.locator('.sport-totals-summary')).toBeVisible();
    await expect(totals.locator('.sport-totals-list')).toContainText('Running');
    await expect(totals.locator('.sport-totals-summary dt')).toHaveText(['Sessions', 'Time', 'Known load']);
    await totals.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Compare periods', exact: true }).click();
    const comparison = page.getByRole('dialog', { name: 'Compare periods' });
    await expect(comparison.locator('.periods-metrics')).toBeVisible();
    await expect(comparison.locator('.periods-metric')).toHaveCount(3);
    await expect(comparison.getByRole('combobox')).toBeEnabled();
    expect(guard.problems).toEqual([]);
  } finally { await context.close(); }
});

test('@mobile reference layout keeps its default evidence readable at 375px and large text', async ({ browser, baseURL, guard }) => {
  const context = await contextFor(browser, 'a', baseURL as string, guard);
  try {
    const page = await context.newPage();
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/analysis');
    await expect(page.locator('#vo2max-estimates .vo2max-estimates-v2__runs tbody tr')).toHaveCount(6);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: path.join(shots, 'analysis-v3-mobile.png'), fullPage: true });
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const showAll = page.getByRole('button', { name: /Show all \d+ runs/ });
    await showAll.click();
    await expect(page.getByRole('button', { name: 'Show fewer runs' })).toHaveAttribute('aria-expanded', 'true');
    expect(guard.problems).toEqual([]);
  } finally { await context.close(); }
});
