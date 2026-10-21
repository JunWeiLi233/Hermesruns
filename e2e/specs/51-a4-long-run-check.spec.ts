// A4 The long-run check on the prediction pages, which came out of the Runalyze review: under the time, whether the longest run of the last
// eight weeks reached three quarters of the distance (docs/README-ANALYSIS.md, "Race Predictions and Their History", "The long-run check").
//
// The facts on the page (the longest run, the runs in the window, the average a week) are worked out again here from the runs the API
// lists. Case numbers are the rows of replica/runalyze/test-plan.md.
import type { Locator, Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { importRunSpecs, sharedRunner, type RunSpec } from '../fixtures/analysis.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { a11yViolations, contrastProblems, expect, expectNoHorizontalOverflow, expectNoRawKeys, test } from '../fixtures/test.ts';

const pages = pageOpener();
test.afterEach(() => pages.closeAll());

interface Row {
  id: number;
  name: string;
  distanceKm: number;
  startTime: string;
}

const DISTANCES: Array<{ key: string; label: string; meters: number }> = [
  { key: '5k', label: '5K', meters: 5000 },
  { key: '10k', label: '10K', meters: 10000 },
  { key: 'half', label: 'Half marathon', meters: 21097.5 },
  { key: 'marathon', label: 'Marathon', meters: 42195 },
];

const rowsOf = async (api: Api): Promise<Row[]> => (await api.get('/api/activities/analysis')).json;
const check = (page: Page): Locator => page.getByRole('region', { name: 'Long run check' });
const km = (value: number): string => `${value.toFixed(1)} km`;
const mi = (value: number): string => `${(value * 0.621371).toFixed(1)} mi`;

/** The facts the page gives, worked out again: the runs of the last 56 days, the longest, and the distance in an average week of eight. */
function facts(rows: Row[], now = Date.now()): { count: number; longest: number | null; weekly: number } {
  const inWindow = rows.filter((row) => now - new Date(`${row.startTime}Z`).getTime() <= 56 * 24 * 3600 * 1000 && row.distanceKm > 0);
  const total = inWindow.reduce((sum, row) => sum + row.distanceKm, 0);
  return { count: inWindow.length, longest: inWindow.length ? Math.max(...inWindow.map((row) => row.distanceKm)) : null, weekly: total / 8 };
}

/** The verdict the way the page words it: the two distances compared as printed, to one decimal in the runner's unit. */
const reaches = (longestKm: number, raceMeters: number, unit: 'km' | 'mile' = 'km'): boolean => {
  const shown = (value: number): number => Number((unit === 'mile' ? value * 0.621371 : value).toFixed(1));
  return shown(longestKm) >= shown((raceMeters / 1000) * 0.75);
};

/**
 * Four runs in the last eight weeks, the longest 14.2 km, and one of 33 km seventy days ago: inside the 90 days the VDOT is taken from,
 * outside the eight weeks the check looks at.
 */
const BASE_RUNS: RunSpec[] = [
  { name: 'E2E long short one', daysBack: 2, km: 6, pace: 330, hr: null },
  { name: 'E2E long mid one', daysBack: 9, km: 10, pace: 330, hr: null },
  { name: 'E2E long longest', daysBack: 20, km: 14.2, pace: 340, hr: null },
  { name: 'E2E long mid two', daysBack: 30, km: 8, pace: 335, hr: null },
  { name: 'E2E long old marathon pace', daysBack: 70, km: 33, pace: 345, hr: null },
];

let base: Awaited<ReturnType<typeof sharedRunner<null>>>;

test.beforeAll(async () => {
  test.setTimeout(480_000);
  base = await sharedRunner('longrun', async ({ api }) => {
    await importRunSpecs(api, BASE_RUNS);
    return null;
  });
});

async function openPrediction(page: Page, key: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(check(page)).toBeVisible();
  expect(key).toBeTruthy();
}

test.describe('A4 long-run check: what the page says', () => {
  test('A4-H1 on the marathon page a runner whose longest run of eight weeks is 14.2 km is told what the check looks for', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, base, '/prediction/marathon');
    await openPrediction(page, 'marathon');
    const f = facts(await rowsOf(base.api));
    expect(f.longest).not.toBeNull();
    expect(Math.round((f.longest as number) * 10) / 10).toBeCloseTo(14.2, 1);

    await expect(check(page).locator('.endurance-check__result')).toHaveText(`Your longest run in the last 8 weeks was ${km(f.longest as number)}. The check looks for 31.6 km, three quarters of this distance. The time above is what your fitness would allow over it, not a sign that you have trained for it.`);
    await expect(check(page).locator('.endurance-check__facts')).toHaveText(`Runs in the last 8 weeks: ${f.count}. Average per week: ${km(f.weekly)}.`);
    await expect(check(page)).toHaveClass(/is-short/);
    await expect(check(page).locator('.endurance-check__basis')).toContainText('A HermesRuns rule of thumb, not a research result');
    await expect(check(page).locator('.endurance-check__basis')).toContainText('It does not change the time.');
    expect(f.count, 'the 33 km run from seventy days ago is outside the eight weeks').toBe(4);
  });

  for (const distance of DISTANCES) {
    test(`A4-H2 ${distance.label}: three quarters of the distance is ${km((distance.meters / 1000) * 0.75)}, and the longest run reaches it or it does not`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, base, `/prediction/${distance.key}`);
      await openPrediction(page, distance.key);
      const f = facts(await rowsOf(base.api));
      const threshold = km((distance.meters / 1000) * 0.75);
      const enough = reaches(f.longest as number, distance.meters);

      if (enough) {
        await expect(check(page).locator('.endurance-check__result')).toHaveText(`Your longest run in the last 8 weeks was ${km(f.longest as number)}, which reaches the ${threshold} the check looks for (three quarters of this distance).`);
        await expect(check(page)).not.toHaveClass(/is-short/);
      } else {
        await expect(check(page).locator('.endurance-check__result')).toContainText(`The check looks for ${threshold}, three quarters of this distance.`);
        await expect(check(page)).toHaveClass(/is-short/);
      }
      // 14.2 km: enough for 5K and 10K, short of the half marathon (15.8 km) and the marathon.
      expect(enough).toBe(distance.key === '5k' || distance.key === '10k');
    });
  }

  test('A4-H3 the page names the rule and links to it, and the link goes to the methods document at the right heading', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, base, '/prediction/half');
    await openPrediction(page, 'half');
    const link = check(page).getByRole('link', { name: 'How it is worked out' });
    await expect(link).toHaveAttribute('href', /docs\/README-ANALYSIS\.md#the-long-run-check$/);
    await expect(link).toHaveAttribute('target', '_blank');
    await link.focus();
    await expect(link).toBeFocused();
  });
});

test.describe('A4 long-run check: runs that do not fit the usual picture', () => {
  test('A4-E1 at the line: a run just over three quarters of the marathon reaches it, one just under does not', async ({ browser, baseURL, guard }) => {
    const over = await newRunner('longrun-over');
    await importRunSpecs(over.api, [{ name: 'E2E long just over', daysBack: 5, km: 31.7, pace: 330, hr: null }], { wait: true });
    const under = await newRunner('longrun-under');
    await importRunSpecs(under.api, [{ name: 'E2E long just under', daysBack: 5, km: 31.5, pace: 330, hr: null }]);

    for (const [made, label] of [[over, 'over'], [under, 'under']] as const) {
      const f = facts(await rowsOf(made.api));
      const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, '/prediction/marathon');
      await expect(check(page)).toBeVisible();
      const enough = reaches(f.longest as number, 42195);
      expect(enough, `${label}: ${km(f.longest as number)} against 31.6 km`).toBe(label === 'over');
      await expect(check(page).locator('.endurance-check__result')).toContainText(`Your longest run in the last 8 weeks was ${km(f.longest as number)}`);
      await expect(check(page)).toHaveClass(enough ? /^((?!is-short).)*$/ : /is-short/);
    }
  });

  test('A4-E2 a runner with no run in the last eight weeks is told there is no long run to check, and the time is still there', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('longrun-lapsed');
    await importRunSpecs(made.api, [{ name: 'E2E long lapsed', daysBack: 70, km: 12, pace: 330, hr: null }]);
    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, '/prediction/marathon');
    await expect(check(page)).toBeVisible();
    await expect(check(page).locator('.endurance-check__result')).toHaveText('You have no run in the last 8 weeks, so there is no long run to check.');
    await expect(check(page).locator('.endurance-check__facts')).toHaveCount(0);
    await expect(page.locator('.prediction-forecast-time')).toHaveText(/\d:\d\d:\d\d/);
  });

  test('A4-E3 a runner with no runs at all gets no broken sentence: no NaN, no undefined, no console error', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('longrun-none');
    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, '/prediction/marathon');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.waitForTimeout(1500);
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/\bNaN\b|undefined|\[object Object\]|Infinity/);
    if (await check(page).count()) await expect(check(page)).toContainText('no long run to check');
  });

  test('A4-E4 in miles the distances, the line and the average are in miles', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, base, null);
    await page.addInitScript(() => localStorage.setItem('hermes_unit', 'mile'));
    await page.goto('/prediction/marathon');
    await expect(check(page)).toBeVisible();
    const f = facts(await rowsOf(base.api));

    await expect(check(page).locator('.endurance-check__result')).toContainText(`Your longest run in the last 8 weeks was ${mi(f.longest as number)}. The check looks for ${mi(42.195 * 0.75)}, three quarters of this distance.`);
    await expect(check(page).locator('.endurance-check__facts')).toHaveText(`Runs in the last 8 weeks: ${f.count}. Average per week: ${mi(f.weekly)}.`);
    await expect(check(page)).not.toContainText(' km');
  });

  test('A4-E5 the weekly distance is shown and not judged: nothing about it is called low or high', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, base, '/prediction/marathon');
    await expect(check(page)).toBeVisible();
    await expect(check(page)).not.toContainText(/too (low|little|high)|not enough|increase|should/i);
  });
});

test.describe('A4 long-run check: in other conditions', () => {
  test('A4-L1 in Chinese the check is translated and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, base, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto('/prediction/marathon');
    const zh = page.getByRole('region', { name: '长距离跑检查' });
    await expect(zh).toBeVisible();
    const f = facts(await rowsOf(base.api));
    await expect(zh.locator('.endurance-check__result')).toContainText(`你最近 8 周最长的一次跑步是 ${f.longest?.toFixed(1)} 公里。检查看的是 31.6 公里，也就是这个距离的四分之三。`);
    await expect(zh).not.toContainText('Your longest run');
    await expectNoRawKeys(page);
  });

  for (const theme of ['light', 'midnight']) {
    test(`A4-A1 the check, short or reached, is readable in the ${theme} theme and has no accessibility violations`, async ({ browser, baseURL, guard }) => {
      for (const key of ['marathon', '10k']) {
        const page = await pages.open(browser, baseURL, guard, base, null);
        await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
        await page.goto(`/prediction/${key}`);
        await expect(check(page)).toBeVisible();
        expect(await contrastProblems(page, { include: ['.endurance-check'] }), `${theme}, ${key}, contrast`).toEqual([]);
        expect(await a11yViolations(page, { include: ['.endurance-check'] }), `${theme}, ${key}, axe`).toEqual([]);
      }
    });
  }

  test('A4-M1 @mobile the check fits a phone', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, base, '/prediction/marathon');
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(check(page)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const box = await check(page).boundingBox();
    expect((box as { x: number; width: number }).x + (box as { x: number; width: number }).width).toBeLessThanOrEqual(375);
  });
});
