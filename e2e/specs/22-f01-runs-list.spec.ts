// The Runs list: the recon's Training log (S11) is its closest relative in HermesRuns. It is where F01 starts.
import type { Page } from '@playwright/test';
import { toSeconds } from '../fixtures/format.ts';
import { contextFor, expect, signedIn, test } from '../fixtures/test.ts';

test.use({ storageState: signedIn('a') });

/** One list row's numbers, read from the row's text: day, weekday, name, source, time, then distance, pace and moving time. */
interface RowFacts {
  name: string;
  km: number;
  moving: number;
  pace: string;
}

async function openList(page: Page): Promise<void> {
  await page.goto('/runs');
  await expect(page.getByRole('heading', { level: 1, name: 'Recent Runs' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Full History' })).toBeVisible();
}

const rowsOf = (scope: ReturnType<Page['getByRole']>) => scope.getByRole('button', { name: /Distance [\d.]+ km Average Pace .* Moving Time/ });

async function readRows(rows: ReturnType<typeof rowsOf>): Promise<RowFacts[]> {
  const texts = await rows.evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).innerText));
  const facts: RowFacts[] = [];
  for (const text of texts) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    // 09 | Fri | E2E Tiny scrap | GARMIN | 11:00 AM | (Fastest) | 0.1 km | 5:50 /km | 0:21
    const km = lines.find((line) => /^[\d.]+ km$/.test(line));
    const pace = lines.find((line) => /^\d+:\d\d \/km$/.test(line));
    const moving = lines[lines.length - 1];
    if (lines.length >= 7 && km && pace) facts.push({ name: lines[2], km: parseFloat(km), pace, moving: toSeconds(moving) });
  }
  return facts;
}

test.describe('Runs list', () => {
  test('F01-H15 every month heading counts its own rows, adds up their distance and adds up their time', async ({ page }) => {
    await openList(page);
    const history = page.getByRole('region', { name: 'Full History' });
    const months = history.getByRole('region');
    const monthCount = await months.count();
    expect(monthCount).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < monthCount; index += 1) {
      const month = months.nth(index);
      await month.scrollIntoViewIfNeeded();
      await expect(rowsOf(month).first()).toBeInViewport({ ratio: 0.01 });
      const heading = (await month.getByRole('heading', { level: 2 }).innerText()).replace(/\s+/g, ' ');
      const parsed = heading.match(/^(.*?) (\d+) runs? ([\d.]+) km ([\d:]+)$/);
      expect(parsed, `month heading "${heading}" has a name, a count, a distance and a time`).toBeTruthy();
      const rows = await readRows(rowsOf(month));
      expect(rows.length, `${parsed![1]}: rows listed`).toBe(Number(parsed![2]));
      const km = rows.reduce((sum, row) => sum + row.km, 0);
      expect(Math.abs(km - Number(parsed![3])), `${parsed![1]}: ${km.toFixed(2)} km in the rows, ${parsed![3]} km in the heading`).toBeLessThanOrEqual(0.1 + 0.05 * rows.length);
      const seconds = rows.reduce((sum, row) => sum + row.moving, 0);
      expect(Math.abs(seconds - toSeconds(parsed![4])), `${parsed![1]}: ${seconds} s in the rows, ${parsed![4]} in the heading`).toBeLessThanOrEqual(2 * rows.length);
    }
  });

  test('F01-H16 the Training Rhythm numbers are the sums of the runs the API holds', async ({ page, api }) => {
    await openList(page);
    const runs = (await api.get('/api/activities')).json as Array<{ distanceKm: number; movingTimeSeconds: number }>;
    const rhythm = page.getByRole('region', { name: 'Training Rhythm' });
    await expect(rhythm).toContainText(String(runs.length));
    const km = runs.reduce((sum, run) => sum + run.distanceKm, 0);
    await expect(rhythm).toContainText(`${km.toFixed(1)} km`);
  });

  test('F01-H17 search narrows the list to the runs whose name matches, and clearing it brings them back', async ({ page }) => {
    await openList(page);
    const box = page.getByRole('textbox', { name: 'Search runs by name...' });
    await box.fill('E2E Park loop');
    const rows = rowsOf(page.getByRole('region', { name: 'Full History' }));
    await expect(rows).toHaveCount(4); // oldest, middle, newest and reversed
    expect((await readRows(rows)).every((row) => row.name.includes('E2E Park loop'))).toBe(true);
    await box.fill('');
    await expect(rows.nth(10)).toBeVisible();
  });

  test('F01-E30 search copes with odd input: regex characters, markup, accents, emoji and a very long string', async ({ page }) => {
    await openList(page);
    const box = page.getByRole('textbox', { name: 'Search runs by name...' });
    for (const text of ['(((', '[a-z]+', '<script>alert(1)</script>', 'Café 🏃‍♀️', 'x'.repeat(5000)]) {
      await box.fill(text);
      await expect(page.getByRole('heading', { level: 1, name: 'Recent Runs' })).toBeVisible();
      await expect(rowsOf(page.getByRole('region', { name: 'Full History' }))).toHaveCount(0);
    }
    await box.fill('');
    await expect(rowsOf(page.getByRole('region', { name: 'Full History' })).first()).toBeVisible();
  });

  test('F01-H18 sort by Longest puts the longest run first; by Fastest the fastest real run', async ({ page }) => {
    await openList(page);
    const history = page.getByRole('region', { name: 'Full History' });
    await page.getByRole('group', { name: 'Sort runs' }).getByRole('button', { name: 'Longest' }).click();
    const longest = await readRows(rowsOf(history));
    expect(longest[0].km).toBe(Math.max(...longest.map((row) => row.km)));
    await page.getByRole('group', { name: 'Sort runs' }).getByRole('button', { name: 'Fastest' }).click();
    // Among runs of a kilometre or more (the 60 m scrap and the run with no times are BUG-011's business).
    const fastest = (await readRows(rowsOf(history))).filter((row) => row.km >= 1 && row.pace !== '0:00 /km');
    expect(fastest[0].name).toBe('E2E Fast 10k negative split');
  });

  test('F01-E38 sort by Fastest does not rank a run with no time, or a 60 m scrap, above real runs', async ({ page }) => {
    test.fail(true, 'BUG-011: the pace sort divides by max(0.1 km, distance) and does not skip runs with no moving time');
    await openList(page);
    await page.getByRole('group', { name: 'Sort runs' }).getByRole('button', { name: 'Fastest' }).click();
    const rows = await readRows(rowsOf(page.getByRole('region', { name: 'Full History' })));
    expect(rows.slice(0, 3).map((row) => row.name)).not.toContain('E2E Route without times');
    expect(rows.slice(0, 3).map((row) => row.name)).not.toContain('E2E Tiny scrap');
  });

  test('F01-H19 grid and list layouts show the same runs', async ({ page }) => {
    await openList(page);
    const layout = page.getByRole('group', { name: 'Change run layout' });
    await layout.getByRole('button', { name: 'Grid' }).click();
    await expect(layout.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /E2E Hill intervals/ }).first()).toBeVisible();
    await layout.getByRole('button', { name: 'List' }).click();
    await expect(layout.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('F01-H20 Year, Month and Day filters each show a picker and keep the page working', async ({ page }) => {
    await openList(page);
    const filter = page.getByRole('group', { name: 'Filter runs by date range' });
    for (const mode of ['Year', 'Month', 'Day', 'All']) {
      await filter.getByRole('button', { name: mode }).click();
      await expect(filter.getByRole('button', { name: mode })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('heading', { level: 1, name: 'Recent Runs' })).toBeVisible();
    }
  });

  test('F01-E31 deleting needs a confirmation: Cancel keeps the run', async ({ page, seed }) => {
    await openList(page);
    await page.getByRole('textbox', { name: 'Search runs by name...' }).fill('E2E Tiny scrap');
    await page.getByRole('button', { name: 'Delete run' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).toHaveCount(0);
    await expect(rowsOf(page.getByRole('region', { name: 'Full History' }))).toHaveCount(1);
    const runs = (await (await page.request.get(`${seed.baseUrl}/api/activities`, { headers: { Authorization: `Bearer ${seed.a.token}` } })).json()) as Array<{ id: number }>;
    expect(runs.some((run) => run.id === seed.ids.scrap)).toBe(true);
  });

  test('F01-E32 an empty account sees how to get its first run, not an empty table, and Import activity files opens the import dialog', async ({ browser, baseURL, guard }) => {
    const context = await contextFor(browser, 'b', baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/runs');
      await expect(page.getByRole('heading', { level: 2, name: 'Link a data source to start building your run library' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Full History' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Import activity files' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Import Workout Data' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('F01-E33 a month with a single run says "1 run", not "1 runs"', async ({ browser, baseURL, guard }) => {
    test.fail(true, 'BUG-009: the month heading never singularises');
    const context = await contextFor(browser, 'c', baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/runs');
      await expect(page.getByRole('region', { name: 'Full History' })).toBeVisible();
      const headings = await page.getByRole('region', { name: 'Full History' }).getByRole('heading', { level: 2 }).allInnerTexts();
      expect(headings.length).toBeGreaterThan(0);
      expect(headings.filter((text) => /\b1 runs\b/.test(text)), 'month headings that count one run').toEqual([]);
    } finally {
      await context.close();
    }
  });
});

test.describe('Runs list: defects found on the seeded data', () => {
  test('F01-E34 the header does not say "No activity has landed yet" while the list is full of runs', async ({ page }) => {
    test.fail(true, 'BUG-007: the connection status line is the empty-state sentence for anyone who is not linked to Strava');
    await openList(page);
    await expect(rowsOf(page.getByRole('region', { name: 'Full History' })).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Recent Runs' }).locator('xpath=..')).not.toContainText('No activity has landed yet', { timeout: 1500 });
  });

  test('F01-E35 a route with no timestamps is not filed under December 1969 with a 0:00 pace', async ({ page }) => {
    test.fail(true, 'BUG-008: a run with no start time is dated 31 December 1969 and shown at 0:00 /km');
    await openList(page);
    const headings = await page.getByRole('region', { name: 'Full History' }).getByRole('heading', { level: 2 }).allInnerTexts();
    expect(headings.filter((text) => /1969|1970/.test(text)), 'month headings from the Unix epoch').toEqual([]);
    const row = page.getByRole('button', { name: /E2E Route without times/ });
    await expect(row).not.toContainText('0:00 /km');
  });
});

test.describe('Runs list: first run', () => {
  test('F01-E36 the "Import now" link in the first-run card opens the import dialog when clicked with the mouse', async ({ browser, baseURL, guard }) => {
    const context = await contextFor(browser, 'b', baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/runs');
      const link = page.getByRole('button', { name: 'Import now' });
      await link.scrollIntoViewIfNeeded();
      const box = (await link.boundingBox())!;
      // A real click at the centre of the link, which is what a person does; no actionability shortcut.
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.getByRole('dialog', { name: 'Import Workout Data' })).toBeVisible({ timeout: 3000 });
    } finally {
      await context.close();
    }
  });
});

test.describe('Runs list: load', () => {
  test('F01-E37 route thumbnails for every run arrive within seconds, and the API keeps answering while they are fetched (BUG-002)', async ({ api, seed }) => {
    const runs = (await api.get('/api/activities')).json as Array<{ id: number }>;
    const ids = runs.map((run) => run.id).join(',');
    const started = Date.now();
    // Six page loads at once, as a few open tabs would make; each asks for the thumbnails of every run on the page.
    const previews = Array.from({ length: 6 }, async () => {
      const res = await api.get(`/api/activities/route-previews?ids=${ids}`);
      return { status: res.status, ms: Date.now() - started };
    });
    // A request that needs a database connection, sent while those are running.
    const ping = (async () => {
      const t0 = Date.now();
      const res = await api.get('/api/auth/protected/ping');
      return { status: res.status, ms: Date.now() - t0 };
    })();
    const results = await Promise.all(previews);
    for (const result of results) {
      expect(result.status).toBe(200);
      expect(result.ms, 'time for a batch of route previews').toBeLessThan(5000);
    }
    const answered = await ping;
    expect(answered.status).toBe(200);
    expect(answered.ms, 'time for an ordinary request sent during that burst').toBeLessThan(2000);
    expect(seed.ids.hills).toBeGreaterThan(0);
  });
});
