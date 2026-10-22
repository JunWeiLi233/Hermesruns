import { sharedRunner } from '../fixtures/analysis.ts';
import { daysAgo, gpxRun } from '../fixtures/gpx.ts';
import { waitForEffort } from '../fixtures/history.ts';
import { contextWith, expect, test } from '../fixtures/test.ts';

async function historyRunner() {
  return sharedRunner('reconciled-pagination', async ({ api }) => {
    for (let index = 0; index < 61; index += 1) {
      const imported = await api.importFile(`pagination-${index}.gpx`, gpxRun({
        name: index === 0 ? 'Pagination oldest' : `Pagination run ${index}`,
        start: daysAgo(61 - index), distanceM: 1000, pace: 360, hr: 145, shape: 'line',
      }));
      expect(imported.status).toBe(200);
      expect(imported.json.importedActivities).toBe(1);
    }
    await waitForEffort(api, 61);
    return { count: 61 };
  });
}

for (const mobile of [false, true]) {
  test(`${mobile ? '@mobile ' : ''}bounded history loads more explicitly and finds an older run before its page is loaded`, async ({ browser, baseURL, guard }) => {
    test.setTimeout(180_000);
    const runner = await historyRunner();
    const stored = await runner.api.get('/api/activities');
    expect(stored.status).toBe(200);
    expect(stored.json).toHaveLength(61);
    const km = stored.json.reduce((total: number, run: { distanceKm: number }) => total + run.distanceKm, 0);
    expect(Math.abs(km - 61), 'the parsed GPS tracks retain their intended distance').toBeLessThan(0.31);
    const context = await contextWith(browser, runner, baseURL!, guard, mobile
      ? { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 } });
    try {
      const page = await context.newPage();
      const queries: URL[] = [];
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.pathname === '/api/activities/page') queries.push(url);
      });
      const firstResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/activities/page');
      await page.goto('/runs');
      const first = await firstResponse;
      expect(first.status()).toBe(200);
      const payload = await first.json();
      expect(payload.items).toHaveLength(60);
      expect(payload.summary.count).toBe(61);
      expect(payload.totalCount).toBe(61);
      expect(payload.hasMore).toBe(true);
      expect(payload.summary.distanceKm).toBeCloseTo(km, 6);
      const history = page.getByRole('region', { name: 'Full History', exact: true });
      const rows = history.locator('[data-run-id]');
      await expect(rows).toHaveCount(60);
      await expect(page.locator('.recent-runs-pagination-status')).toHaveText('Showing 60 of 61 runs');
      await expect(page.getByRole('region', { name: 'Training Rhythm', exact: true })).toContainText(`${km.toFixed(1)} km`);
      await expect(rows.filter({ hasText: 'Pagination oldest' })).toHaveCount(0);
      expect(queries.every(url => url.searchParams.get('limit') === '60')).toBe(true);
      expect(queries.some(url => url.searchParams.has('cursor'))).toBe(false);

      const search = page.getByRole('textbox', { name: 'Search runs by name...', exact: true });
      await search.fill('Pagination oldest');
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText('Pagination oldest');
      await expect(page.locator('.recent-runs-pagination-status')).toHaveText('Showing 1 of 1 runs');
      await search.fill('');
      await expect(rows).toHaveCount(60);
      await expect(page.locator('.recent-runs-pagination-status')).toHaveText('Showing 60 of 61 runs');
      await page.getByRole('button', { name: 'Load More Runs', exact: true }).click();
      await expect(rows).toHaveCount(61);
      await expect(page.locator('.recent-runs-pagination-status')).toHaveText('Showing 61 of 61 runs');
      await expect(page.getByText('All matching runs are shown.', { exact: true })).toBeVisible();
      await expect(rows.filter({ hasText: 'Pagination oldest' })).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Load More Runs', exact: true })).toHaveCount(0);
      expect(queries.filter(url => url.searchParams.has('cursor'))).toHaveLength(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    } finally {
      await context.close();
    }
  });
}
