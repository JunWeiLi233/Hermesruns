// What a brand-new runner meets first, and what the app does with addresses that lead nowhere. Cases F06-H1, X02-*.
import { Api, newRunner } from '../fixtures/api.ts';
import { daysAgo, gpxRun } from '../fixtures/gpx.ts';
import { contextFor, contextWith, expect, signedIn, test } from '../fixtures/test.ts';

test.use({ storageState: signedIn('a') });

test.describe('X02 a brand-new runner', () => {
  test('X02-H1 the first visit to Home by a runner with no runs makes no failing request', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('fresh');
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/profile');
      await expect(page.getByRole('region', { name: 'Start with one real run' })).toBeVisible();
      await page.waitForTimeout(1500);
    } finally {
      await context.close();
    }
  });

  test('X02-H2 Home, Runs, Analysis, Load balance, a prediction page and Settings all open for a runner with no runs, without errors', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('fresh2');
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      for (const route of ['/profile', '/runs', '/analysis', '/analysis/load-balance', '/prediction/10k', '/settings', '/settings?section=training', '/shoes', '/races', '/schedule', '/rewards', '/heatmap', '/weather', '/today-run']) {
        await page.goto(route);
        await page.waitForTimeout(1200);
        const text = await page.locator('body').innerText();
        expect(text.trim().length, `${route} is not blank`).toBeGreaterThan(40);
        expect(text, `${route} shows no placeholder junk`).not.toMatch(/NaN|Infinity|undefined|\bnull\b|\[object Object\]/);
        expect(text, `${route} did not hit the error boundary`).not.toContain('Something went wrong');
      }
    } finally {
      await context.close();
    }
  });
});

test.describe('F06 nothing in the run analysis is locked', () => {
  test('F06-H1 a free runner (no plan) sees every analysis card with its numbers, and no upgrade prompt anywhere', async ({ browser, baseURL, seed, guard }) => {
    // The recon's S20 locked state is not built on purpose: none of this is metered. Runner C has no plan.
    const c = new Api(seed.baseUrl, seed.c.token);
    const existing = (await c.get('/api/activities')).json as Array<{ id: number; name: string }>;
    const intervals = existing.find((run) => run.name === 'E2E C intervals')?.id ?? (await c.importRun('c-intervals.gpx', gpxRun({ name: 'E2E C intervals', start: daysAgo(5), distanceM: 6000, pace: 300, hr: 160 })));
    const context = await contextFor(browser, 'c', baseURL as string, guard);
    try {
      const page = await context.newPage();
      for (const route of [`/runs/${intervals}`, '/settings?section=training', '/analysis', '/analysis/load-balance', '/prediction/5k']) {
        await page.goto(route);
        await page.waitForTimeout(1500);
        const text = await page.locator('body').innerText();
        expect(text, `${route} offers no upgrade`).not.toMatch(/upgrade|subscribe|go pro|pro only|premium|locked|buy now|purchase/i);
      }
      await page.goto(`/runs/${intervals}`);
      await expect(page.getByRole('region', { name: 'Effort', exact: true })).toContainText(/\d/);
      await expect(page.getByRole('region', { name: 'Heart-rate zones' })).toContainText('Zone');
      await expect(page.getByRole('region', { name: 'Best efforts' }).getByRole('table')).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe('X03 addresses that lead nowhere', () => {
  test('X03-E1 a run id that does not exist shows a message and a way back, not data and not a crash', async ({ page, guard }) => {
    guard.allow(/status of 40[04]/);
    for (const id of ['999999', 'abc', '0', '-5']) {
      await page.goto(`/runs/${id}`);
      await page.waitForTimeout(1500);
      await expect(page.getByText('No run selected')).toBeVisible();
      await expect(page.getByText('Back to All Runs')).toBeVisible();
      await expect(page.locator('body')).not.toContainText('Something went wrong');
    }
  });

  test('X03-E2 an analysis page that does not exist sends you back to Analysis instead of crashing', async ({ page }) => {
    await page.goto('/analysis/nonsense');
    await expect(page).toHaveURL(/\/analysis$/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('X03-E3 a prediction distance that does not exist sends you somewhere useful instead of showing a blank page', async ({ page }) => {
    await page.goto('/prediction/banana');
    await expect(page).toHaveURL(/\/analysis$/);
    await expect.poll(async () => (await page.locator('body').innerText()).trim().length).toBeGreaterThan(20);
  });

  test('X03-E4 a race that does not exist goes back to the race list', async ({ page }) => {
    await page.goto('/races/details/does-not-exist');
    await expect(page).toHaveURL(/\/races$/);
  });

  test('X03-E5 the admin dashboard address is not a way in for a runner', async ({ seed }) => {
    for (const route of ['/dashboard', '/dashboard/workflows', '/api/admin/runners', '/api/admin/jobs']) {
      const res = await fetch(`${seed.baseUrl}${route}`, { headers: { Authorization: `Bearer ${seed.a.token}`, Accept: 'application/json', 'X-Forwarded-For': new Api(seed.baseUrl).clientIp ?? '' } });
      expect([401, 403, 404], `GET ${route} as a runner`).toContain(res.status);
      await res.text();
    }
  });
});
