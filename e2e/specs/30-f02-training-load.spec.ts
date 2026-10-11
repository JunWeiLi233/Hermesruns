// F02 Check whether training is building or overreaching. Recon path: Progress -> weekly effort against a range -> Fitness and
// Freshness. This file tests the older half of Analysis > Load balance (acute against chronic load, the load budget for the week
// ahead). The fitness / fatigue / form chart and the weekly effort range (M4) are in 31-f02-fitness-and-weekly-effort, and the
// training log (M5, M5b) is in 32-f02-training-log.
import type { Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { daysAgo, gpxRun } from '../fixtures/gpx.ts';
import { a11yViolations, contextFor, contextWith, expect, expectNoHorizontalOverflow, expectNoRawKeys, signedIn, test } from '../fixtures/test.ts';

test.use({ storageState: signedIn('a') });

interface Snapshot {
  acute: number;
  chronic: number;
  ratio: number;
  band: string;
  heading: string;
}

const mainText = async (page: Page): Promise<string> => (await page.locator('main').first().innerText()).replace(/\s+/g, ' ');

async function openLoad(page: Page): Promise<void> {
  await page.goto('/analysis/load-balance');
  await expect(page.getByRole('heading', { level: 2, name: 'Acute vs. chronic load' }).first()).toBeVisible();
  await expect(page.getByRole('group', { name: 'Load chart time range' })).toBeVisible();
}

async function readLoad(page: Page): Promise<Snapshot> {
  const text = await mainText(page);
  const numbers = text.match(/Acute \(7d\) (\d+) Chronic \(28d\) (\d+) Ratio ([\d.]+)/);
  expect(numbers, `the chart legend reads "Acute (7d) 40 Chronic (28d) 52 Ratio 0.77": ${text.slice(0, 400)}`).toBeTruthy();
  const header = text.match(/workload ratio ([\d.]+) (Underload|Productive|Overreach|High load)/);
  expect(header, `the header reads "acute : chronic workload ratio 0.77 Underload": ${text.slice(0, 260)}`).toBeTruthy();
  const heading = await page.getByRole('heading', { level: 1 }).innerText();
  return { acute: Number(numbers![1]), chronic: Number(numbers![2]), ratio: Number(numbers![3]), band: header![2], heading };
}

test.describe('F02 load balance, seeded runner', () => {
  test('F02-H1 the ratio is the acute load over the chronic load, and the header agrees with the chart', async ({ page }) => {
    await openLoad(page);
    const load = await readLoad(page);
    expect(Math.abs(load.ratio - load.acute / load.chronic), `${load.acute} / ${load.chronic} against ${load.ratio}`).toBeLessThan(0.02);
    const header = (await mainText(page)).match(/workload ratio ([\d.]+)/);
    expect(Number(header![1])).toBe(load.ratio);
  });

  test('F02-H2 the band named is the band the ratio falls in: under 0.8, 0.8 to 1.3, over 1.3', async ({ page }) => {
    await openLoad(page);
    const load = await readLoad(page);
    // Above 1.3 the page says Overreach and, when the ratio gets high enough, "High load"; the legend lists only the first.
    const allowed = load.ratio < 0.8 ? ['Underload'] : load.ratio <= 1.3 ? ['Productive'] : ['Overreach', 'High load'];
    expect(allowed).toContain(load.band);
  });

  test('F02-H3 the sentence under the heading quotes the same distance from the base as the numbers', async ({ page }) => {
    await openLoad(page);
    const load = await readLoad(page);
    const text = await mainText(page);
    const claim = text.match(/Your acute load is (\d+)% (below|above) your 28-day base/);
    expect(claim, 'the page says how far the acute load is from the base').toBeTruthy();
    const signed = (Number(claim![1]) * (claim![2] === 'below' ? -1 : 1)) / 100;
    expect(Math.abs(signed - (load.acute / load.chronic - 1))).toBeLessThan(0.02);
  });

  test('F02-H4 the time range buttons show 4, 8 and 12 weeks of days, one per day, ending today', async ({ page }) => {
    await openLoad(page);
    const range = page.getByRole('group', { name: 'Load chart time range' });
    const days = page.getByRole('heading', { level: 3, name: 'Acute vs. chronic load' }).locator('xpath=following-sibling::ul[1]/li');
    for (const [label, count] of [['4 wk', 28], ['8 wk', 56]] as const) {
      await range.getByRole('button', { name: label }).click();
      await expect(range.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
      await expect(days).toHaveCount(count);
    }
    // 12 weeks reaches back only as far as the first run: more days than 8 weeks, never more than 84.
    await range.getByRole('button', { name: '12 wk' }).click();
    await expect(days.first()).toBeVisible();
    const twelve = await days.count();
    expect(twelve).toBeGreaterThan(56);
    expect(twelve).toBeLessThanOrEqual(84);
    const labels = await days.evaluateAll((items) => items.map((item) => (item.textContent ?? '').slice(0, 6)));
    const parsed = labels.map((text) => new Date(`${text.replace(/(\d)[A-Za-z].*$/, '$1')}, 2026`).getTime());
    for (let index = 1; index < parsed.length; index += 1) {
      expect(parsed[index] - parsed[index - 1], `day ${index} follows day ${index - 1}`).toBeGreaterThan(20 * 3600 * 1000);
      expect(parsed[index] - parsed[index - 1]).toBeLessThan(28 * 3600 * 1000);
    }
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    await expect(days.last()).toContainText(today);
  });

  test('F02-H5 the last day of the chart carries the numbers in the header', async ({ page }) => {
    await openLoad(page);
    const load = await readLoad(page);
    const last = (await page.getByRole('heading', { level: 3, name: 'Acute vs. chronic load' }).locator('xpath=following-sibling::ul[1]/li').last().innerText()).replace(/\s+/g, ' ');
    expect(last).toContain(`Acute (7d): ${load.acute}`);
    expect(last).toContain(`Chronic (28d): ${load.chronic}`);
  });

  test('F02-H6 the load budget lists the next seven days, one after another, with no negative load', async ({ page }) => {
    await openLoad(page);
    const budget = page.getByRole('complementary').filter({ has: page.getByRole('heading', { level: 2, name: 'Next 7 days · load budget' }) }).getByRole('listitem');
    await expect(budget).toHaveCount(7);
    const names: string[] = [];
    for (const item of await budget.all()) {
      names.push((await item.locator('time').innerText()).trim());
      expect(Number((await item.locator('strong').innerText()).trim())).toBeGreaterThanOrEqual(0);
    }
    const tomorrow = new Date();
    const expected = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1 + offset);
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    });
    expect(names).toEqual(expected);
  });

  test('F02-H7 the Analysis page and the Load balance page report the same ratio, and the VO2max matches the prediction pages', async ({ page }) => {
    await openLoad(page);
    const load = await readLoad(page);
    await page.goto('/analysis');
    await expect(page.getByRole('region', { name: 'Race predictions' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'VO2max trend' })).toBeVisible();
    const hub = await mainText(page);
    expect(hub).toContain(`ACWR ${load.ratio.toFixed(2)}`);
    const vo2Text = await page.getByRole('article').filter({ has: page.getByRole('heading', { level: 2, name: 'VO2max trend' }) }).locator('strong').first().innerText();
    const vo2 = [vo2Text, vo2Text.trim()];
    await page.goto('/prediction/5k');
    await expect(page.getByRole('region', { name: 'Supporting Evidence' })).toBeVisible();
    const vdot = (await mainText(page)).match(/Current VDOT ([\d.]+)/);
    expect(vo2 && vdot && vo2[1] === vdot[1], `VO2max ${vo2?.[1]} on Analysis, VDOT ${vdot?.[1]} on the prediction page`).toBe(true);
  });
});

test.describe('F02 load balance, edge states', () => {
  test('F02-E1 an account with no runs sees dashes and an explanation, never NaN or Infinity', async ({ browser, baseURL, guard }) => {
    const context = await contextFor(browser, 'b', baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/analysis/load-balance');
      await expect(page.getByText('Not enough data yet to classify your load zone.').first()).toBeVisible();
      const text = await mainText(page);
      expect(text).toContain('More data needed');
      expect(text).not.toMatch(/NaN|Infinity|undefined|\bnull\b/);
    } finally {
      await context.close();
    }
  });

  test('F02-E2 a hard run lifts the acute load and changes the band, and deleting it puts the numbers back', async ({ browser, baseURL, guard }) => {
    // A runner with a month of easy running, then one long hard run yesterday.
    const made = await newRunner('load');
    const api: Api = made.api;
    const context = await contextWith(browser, { token: api.token as string, email: made.email }, baseURL as string, guard);
    let hardId: number | null = null;
    try {
      for (const [index, days] of [27, 24, 21, 18, 15, 12, 9, 6, 3].entries()) {
        await api.importRun(`easy-${index}.gpx`, gpxRun({ name: `E2E load easy ${index}`, start: daysAgo(days), distanceM: 5000, pace: 360, hr: 140 }));
      }
      const page = await context.newPage();
      await openLoad(page);
      const before = await readLoad(page);
      expect(before.chronic).toBeGreaterThan(0);

      hardId = await api.importRun('hard.gpx', gpxRun({ name: 'E2E load hard', start: daysAgo(1), distanceM: 25000, pace: 270, hr: 172 }));
      await openLoad(page);
      const after = await readLoad(page);
      expect(after.acute, 'acute load after a 25 km run at 4:30 /km').toBeGreaterThan(before.acute * 1.5);
      expect(after.ratio).toBeGreaterThan(before.ratio);
      expect(after.ratio).toBeGreaterThan(1.3);
      expect(['Overreach', 'High load']).toContain(after.band);

      expect((await api.delete(`/api/activities/${hardId}`)).status).toBeLessThan(300);
      hardId = null;
      await openLoad(page);
      const back = await readLoad(page);
      expect(back.acute).toBe(before.acute);
      expect(back.ratio).toBe(before.ratio);
    } finally {
      if (hardId) await api.delete(`/api/activities/${hardId}`);
      await context.close();
    }
  });

  test('F02-E3 another runner\'s training is not in your load: B\'s numbers stay dashes while A has runs', async ({ browser, baseURL, guard }) => {
    const context = await contextFor(browser, 'b', baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto('/analysis/load-balance');
      await expect(page.getByRole('region', { name: 'ACWR' })).toContainText('Baseline forming');
    } finally {
      await context.close();
    }
  });

  test('F02-E4 the Open today\'s run button on Load balance opens the plan for today', async ({ page }) => {
    await openLoad(page);
    await page.getByRole('button', { name: "Open today's run" }).first().click();
    await expect(page).toHaveURL(/\/today-run/);
  });

  test('F02-E15 a VO2max that has not moved in 30 days is called unchanged, not a VO2max of 0.0', async ({ browser, baseURL, guard }) => {
    // The same run in the last 30 days and in the 30 before: the two windows come out equal. (BUG-029)
    const made = await newRunner('vo2-flat');
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      for (const days of [8, 40]) {
        await made.api.importRun(`flat-${days}.gpx`, gpxRun({ name: `E2E flat ${days}`, start: daysAgo(days), distanceM: 5000, pace: 330, hr: 150 }));
      }
      const page = await context.newPage();
      await page.goto('/analysis');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('VO2max unchanged over 30 days')).toBeVisible();
      await expect(page.getByText('unchanged in 30 d')).toBeVisible();
      const text = await mainText(page);
      expect(text).not.toMatch(/VO2max [+-]?0\.0/);
      expect(text).not.toContain('+0.0');
    } finally {
      await context.close();
    }
  });
});

test.describe('F02 whole page', () => {
  test('F02-E5 Load balance has no serious accessibility violations', async ({ page }) => {
    await openLoad(page);
    expect(await a11yViolations(page, { ignoreRules: ['color-contrast'] })).toEqual([]);
  });

  test('F02-E6 in Chinese the Load balance page shows no raw translation key', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto('/analysis/load-balance');
    await page.waitForTimeout(2000);
    await expectNoRawKeys(page);
  });

  test('F02-E16 in Chinese the distances on Load balance say 公里, as every other page does (BUG-034)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto('/analysis/load-balance');
    await expect(page.locator('main').getByText(/\d 公里/).first()).toBeVisible();
    const text = await mainText(page);
    expect(text).toMatch(/\d(\.\d)? 公里/);
    expect(text).not.toMatch(/\d\s?km\b/);
  });

  test('F02-E7 @mobile Load balance and the Analysis page fit a phone', async ({ page }) => {
    await openLoad(page);
    await expectNoHorizontalOverflow(page);
    await page.goto('/analysis');
    await expect(page.getByRole('region', { name: 'Race predictions' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
