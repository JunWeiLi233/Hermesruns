// A3 The VO2max estimates page, which came out of the Runalyze review: every run of the last 90 days that gives an estimate, the three
// the VO2max is the mean of, the sum written out, and what the rule needs from the runner's data (the highest heart rate, the median pace).
//
// The estimates on the page are worked out again here, in this file, from the runs the API lists and the rule the methods document
// gives (docs/README-ANALYSIS.md, "VDOT and VO2max", "The runs behind the number"): so a page that drew a wrong estimate, picked the wrong
// three, or drifted from the number on Analysis fails. Case numbers are the rows of replica/runalyze/test-plan.md.
import type { Locator, Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { KM_PER_MILE, importRunSpecs, sharedRunner, type RunSpec } from '../fixtures/analysis.ts';
import { heartRateVo2max, mmss, raceEquationVo2max, shortDate } from '../fixtures/format.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { enlargeText, readingsThatCollide } from '../fixtures/reflow.ts';
import { a11yViolations, contrastProblems, expect, expectNoHorizontalOverflow, expectNoRawKeys, test } from '../fixtures/test.ts';

const ROUTE = '/analysis/vo2max-estimates';
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

interface Row {
  id: number;
  name: string;
  distanceKm: number;
  movingTimeSeconds: number;
  startTime: string;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
}

interface Expected {
  id: number;
  name: string;
  date: string;
  km: number;
  paceSecPerKm: number;
  averageHeartRate: number | null;
  method: 'hr' | 'race';
  estimate: number;
  eligible: boolean;
  counted: boolean;
}

interface Evidence {
  rows: Expected[];
  value: number;
  terms: number[];
  mean: number;
  poolCount: number;
  pool: 'strict' | 'all';
  hrMax: number | null;
  median: number | null;
  leftOut: number;
  withoutBest: { value: number; drop: number } | null;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;
const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * The rule of docs/README-ANALYSIS.md, "VDOT and VO2max", written out again: an estimate for each run of 1.5 km or more in the last 90 days,
 * from heart rate where the run has one (and the runner has a highest heart rate of 130 or more, on any run), else by the race equation
 * unless the run is more than 1.18 times slower than the median pace of all the runner's runs of 1.5 km or more; the three best of the
 * runs of 3 km or more (every run if none is that long) make the number.
 */
function evidenceFrom(rows: Row[], now = Date.now()): Evidence {
  const highest = Math.max(0, ...rows.map((row) => row.maxHeartRate ?? 0));
  const hrMax = highest >= 130 ? highest : 0;
  const paces = rows.filter((row) => row.distanceKm >= 1.5 && row.movingTimeSeconds > 0).map((row) => row.movingTimeSeconds / row.distanceKm).sort((a, b) => a - b);
  const median = paces.length ? paces[Math.floor(paces.length / 2)] : null;

  const found: Expected[] = [];
  let leftOut = 0;
  for (const row of rows) {
    const km = row.distanceKm;
    if (km < 1.5 || row.movingTimeSeconds <= 0) continue;
    const age = now - new Date(`${row.startTime}Z`).getTime();
    if (age > 90 * 24 * 3600 * 1000) continue;
    const pace = row.movingTimeSeconds / km;
    const averageHeartRate = row.averageHeartRate && row.averageHeartRate > 40 ? row.averageHeartRate : null;
    let method: 'hr' | 'race';
    let estimate: number;
    if (averageHeartRate && hrMax >= 130) {
      method = 'hr';
      estimate = heartRateVo2max(km * 1000, row.movingTimeSeconds, averageHeartRate, hrMax);
    } else {
      if (median !== null && pace > median * 1.18) {
        leftOut += 1;
        continue;
      }
      method = 'race';
      estimate = raceEquationVo2max(km * 1000, row.movingTimeSeconds);
    }
    found.push({ id: row.id, name: row.name, date: row.startTime.slice(0, 10), km, paceSecPerKm: pace, averageHeartRate, method, estimate, eligible: true, counted: false });
  }

  const strict = found.some((item) => item.km >= 3);
  for (const item of found) item.eligible = !strict || item.km >= 3;
  const pool = found.filter((item) => item.eligible).sort((a, b) => b.estimate - a.estimate);
  const top = pool.slice(0, 3);
  for (const item of top) item.counted = true;
  found.sort((a, b) => b.estimate - a.estimate || Number(b.counted) - Number(a.counted));

  let withoutBest: Evidence['withoutBest'] = null;
  if (pool.length > 3) {
    const without = mean(pool.slice(1, 4).map((item) => item.estimate));
    const drop = round1(mean(top.map((item) => item.estimate)) - without);
    if (drop >= 0.1) withoutBest = { value: round1(without), drop };
  }
  const terms = top.map((item) => item.estimate);
  return {
    rows: found,
    value: terms.length ? round1(mean(terms)) : 0,
    terms,
    mean: terms.length ? mean(terms) : 0,
    poolCount: pool.length,
    pool: strict ? 'strict' : 'all',
    hrMax: hrMax > 0 ? hrMax : null,
    median,
    leftOut,
    withoutBest,
  };
}

const rowsOf = async (api: Api): Promise<Row[]> => (await api.get('/api/activities/analysis')).json;
const two = (value: number): string => value.toFixed(2);
const one = (value: number): string => value.toFixed(1);

const table = (page: Page): Locator => page.getByRole('table', { name: /^Runs of the last 90 days with an estimate, highest first$/ });
const tiles = (page: Page): Locator => page.getByRole('region', { name: 'How the number is made' });
const body = (page: Page): Locator => page.locator('.vo2max-estimates-v2');

/** The runs of the unit fixture, as GPX files: a heart-rate run, a race-equation run, an old peak, a 2 km run and a slow jog. */
const MIXED: RunSpec[] = [
  { name: 'E2E vo2 tempo', daysBack: 2, km: 10, pace: 300, hr: 150 },
  { name: 'E2E vo2 park five', daysBack: 6, km: 5, pace: 264, hr: null },
  { name: 'E2E vo2 hills', daysBack: 10, km: 8, pace: 300, hr: 148 },
  { name: 'E2E vo2 long steady', daysBack: 14, km: 12, pace: 330, hr: 140 },
  { name: 'E2E vo2 easy six', daysBack: 20, km: 6, pace: 330, hr: 138 },
  { name: 'E2E vo2 strides', daysBack: 3, km: 2, pace: 285, hr: 160 },
  { name: 'E2E vo2 old peak', daysBack: 100, km: 10, pace: 270, hr: 190 },
  { name: 'E2E vo2 recovery jog', daysBack: 4, km: 5, pace: 480, hr: null },
];

let runner: Awaited<ReturnType<typeof sharedRunner<null>>>;

test.beforeAll(async () => {
  test.setTimeout(480_000);
  runner = await sharedRunner('vo2', async ({ api }) => {
    await importRunSpecs(api, MIXED);
    return null;
  });
});

async function openPage(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: 'VO2max estimates' })).toBeVisible();
  await expect(table(page)).toBeVisible();
}

test.describe('A3 VO2max estimates: what the page says', () => {
  test('A3-H1 every run of the window that gives an estimate is a row, highest first, with the estimate the rule gives it', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const expected = evidenceFrom(await rowsOf(runner.api));
    // The old run and the slow jog are not on it; the 2 km run is, outside the pool.
    expect(expected.rows.map((row) => row.name).sort()).toEqual(['E2E vo2 easy six', 'E2E vo2 hills', 'E2E vo2 long steady', 'E2E vo2 park five', 'E2E vo2 strides', 'E2E vo2 tempo']);

    const rows = table(page).locator('tbody tr');
    await expect(rows).toHaveCount(expected.rows.length);
    for (const [index, item] of expected.rows.entries()) {
      const row = rows.nth(index);
      await expect(row.locator('th')).toHaveText(shortDate(new Date(`${item.date}T12:00:00Z`)));
      await expect(row.locator('td').nth(0)).toHaveText(item.name);
      await expect(row.locator('td').nth(0).getByRole('link')).toHaveAttribute('href', `/runs/${item.id}`);
      await expect(row.locator('td').nth(1)).toHaveText(`${one(item.km)} km`);
      await expect(row.locator('td').nth(2)).toHaveText(`${mmss(item.paceSecPerKm)} /km`);
      await expect(row.locator('td').nth(4)).toHaveText(item.method === 'hr' ? 'Heart rate' : 'Race equation');
      const shown = Number((await row.locator('td').nth(5).locator('strong').innerText()).replace(/,/g, ''));
      expect(shown, `${item.name}: ${two(item.estimate)} by the rule`).toBeCloseTo(item.estimate, 1);
      expect(two(shown)).toBe(two(item.estimate));
    }
    // A run's heart rate and the share of the highest one it was held at, or a dash.
    for (const [index, item] of expected.rows.entries()) {
      const text = await rows.nth(index).locator('td').nth(3).innerText();
      if (item.method === 'hr') expect(text).toBe(`${item.averageHeartRate} bpm · ${Math.round((item.averageHeartRate as number) / (expected.hrMax as number) * 100)}% of highest`);
      else expect(text).toBe('–');
    }
  });

  test('A3-H2 the three best of the pool are the ones counted, and a high estimate outside the pool is not', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const expected = evidenceFrom(await rowsOf(runner.api));
    expect(expected.pool).toBe('strict');
    expect(expected.poolCount).toBe(5);

    const rows = table(page).locator('tbody tr');
    for (const [index, item] of expected.rows.entries()) {
      const row = rows.nth(index);
      if (item.counted) {
        await expect(row.locator('.vo2max-estimates-v2__tag.is-counted')).toHaveText('Counted');
        await expect(row).toHaveClass(/is-counted/);
      } else {
        await expect(row.locator('.vo2max-estimates-v2__tag.is-counted')).toHaveCount(0);
      }
      if (!item.eligible) {
        await expect(row.locator('.vo2max-estimates-v2__tag').last()).toHaveText('Under 3 km, not used');
        await expect(row).toHaveClass(/is-outside/);
      }
    }
    expect(expected.rows.filter((item) => item.counted)).toHaveLength(3);
    const strides = expected.rows.find((item) => item.name === 'E2E vo2 strides');
    expect(strides?.eligible, 'the 2 km run is outside the pool while a longer run exists').toBe(false);
    expect(strides?.counted).toBe(false);
  });

  test('A3-H3 the number, its sum and what it would be without the best run are the rule\'s arithmetic', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const expected = evidenceFrom(await rowsOf(runner.api));

    await expect(tiles(page).locator('article').nth(0).locator('span')).toHaveText('Current VO2max');
    await expect(tiles(page).locator('article').nth(0).locator('strong')).toHaveText(one(expected.value));
    await expect(tiles(page).locator('article').nth(0).locator('small')).toHaveText('The mean of the best 3 of 5 runs of 3 km or more.');
    await expect(tiles(page).locator('article').nth(1).locator('strong')).toHaveText(String(expected.rows.length));
    const hrRuns = expected.rows.filter((row) => row.method === 'hr').length;
    await expect(tiles(page).locator('article').nth(1).locator('small')).toHaveText(`${hrRuns} from heart rate, ${expected.rows.length - hrRuns} from the race equation.`);

    await expect(body(page)).toContainText(`(${expected.terms.map(two).join(' + ')}) ÷ 3 = ${two(expected.mean)}, shown as ${one(expected.value)}.`);
    expect(expected.withoutBest).not.toBeNull();
    const without = expected.withoutBest as { value: number; drop: number };
    await expect(body(page)).toContainText(`Without your highest estimate in the pool the number would be ${one(without.value)}, ${one(without.drop)} lower: the next run in line takes its place.`);
  });

  test('A3-H4 the inputs of the rule are shown: the highest heart rate of any run, however old, and the pace a slow run is left out at', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const expected = evidenceFrom(await rowsOf(runner.api));
    expect(expected.hrMax, 'the peak is the 100-day-old run\'s').toBe(190);
    expect(expected.leftOut).toBe(1);

    const peak = tiles(page).locator('article').nth(2);
    await expect(peak.locator('span')).toHaveText('Highest heart rate on record');
    await expect(peak.locator('strong')).toHaveText('190 bpm');
    await expect(peak.locator('small')).toContainText('however old');
    await expect(body(page)).toContainText(`1 of your runs in these 90 days got no estimate. A run that has no heart-rate estimate is left out when it is more than 18% slower than your median pace (${mmss(expected.median as number)} /km), that is slower than ${mmss((expected.median as number) * 1.18)} /km;`);
    // Neither is a row of the table of the window (the line over time, further down, names the runs it has a point for, these two included).
    await expect(table(page)).not.toContainText('E2E vo2 recovery jog');
    await expect(table(page)).not.toContainText('E2E vo2 old peak');
  });

  test('A3-H5 the page agrees with the VO2max on Analysis, and with the line on the prediction pages', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, '/analysis');
    const card = page.locator('.analysis-v2-vo2');
    await expect(card).toBeVisible();
    const onAnalysis = (await card.locator('.analysis-v2-vo2-value strong').innerText()).trim();
    const expected = evidenceFrom(await rowsOf(runner.api));
    expect(onAnalysis).toBe(one(expected.value));

    await card.getByRole('link', { name: 'The runs behind this number' }).click();
    await expect(page).toHaveURL(/\/analysis\/vo2max-estimates$/);
    await openPage(page);
    await expect(page).toHaveTitle('VO2max estimates | HermesRuns');
    await expect(tiles(page).locator('article').nth(0).locator('strong')).toHaveText(onAnalysis);

    // From the prediction page, which is made from the same estimates, to the page and back.
    await page.goto('/prediction/half');
    await page.getByRole('link', { name: 'The runs behind this number' }).click();
    await expect(page).toHaveURL(/\/analysis\/vo2max-estimates$/);
    await openPage(page);
    await page.getByRole('navigation', { name: 'Related pages' }).getByRole('link', { name: 'Analysis' }).click();
    await expect(page).toHaveURL(/\/analysis$/);
  });

  test('A3-H6 the dot chart has a dot for each row, three of them counted, one outside the pool, and the number as a line', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const expected = evidenceFrom(await rowsOf(runner.api));
    const plot = page.getByRole('region', { name: 'Estimates over time' });

    await expect(plot.getByRole('img')).toHaveAccessibleName(/^A dot for each run of the last 90 days: the day across, its VO2max estimate up, with your current VO2max as a dashed line\./);
    await expect(plot.locator('circle.vo2max-estimates-v2__dot')).toHaveCount(expected.rows.length);
    await expect(plot.locator('circle.is-counted')).toHaveCount(3);
    await expect(plot.locator('circle.is-short')).toHaveCount(1);
    await expect(plot.locator('circle.is-other')).toHaveCount(expected.rows.length - 4);
    await expect(plot.locator('line.vo2max-estimates-v2__mean')).toHaveCount(1);
    await expect(plot.locator('text.vo2max-estimates-v2__mean-label')).toHaveText(`VO2max ${one(expected.value)}`);
    await expect(plot.locator('.vo2max-estimates-v2__legend')).toContainText('Outside the pool');
  });
});

test.describe('A3 VO2max estimates: runs that do not fit the usual picture', () => {
  test('A3-E1 with no run of 3 km or more every run is in the pool, and with one run the number is that run', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('vo2-short');
    await importRunSpecs(made.api, [
      { name: 'E2E vo2 shakeout', daysBack: 3, km: 2.2, pace: 300, hr: 150 },
      { name: 'E2E vo2 more strides', daysBack: 8, km: 2, pace: 285, hr: 160 },
    ]);
    const who = { token: made.api.token as string, email: made.email };
    const expected = evidenceFrom(await rowsOf(made.api));
    expect(expected.pool).toBe('all');

    const page = await pages.open(browser, baseURL, guard, who, ROUTE);
    await openPage(page);
    await expect(tiles(page).locator('article').nth(0).locator('strong')).toHaveText(one(expected.value));
    await expect(tiles(page).locator('article').nth(0).locator('small')).toHaveText('The mean of the best 2 of 2 runs. None is 3 km or longer, so every run is in the pool.');
    await expect(table(page).locator('.vo2max-estimates-v2__tag')).toHaveText(['Counted', 'Counted']);
    await expect(body(page)).toContainText(`(${expected.terms.map(two).join(' + ')}) ÷ 2 = ${two(expected.mean)}, shown as ${one(expected.value)}.`);
    await expect(body(page)).not.toContainText('Without your highest estimate');

    // One run: the number is its estimate, and the page says there is nothing to average.
    const one1 = await newRunner('vo2-one');
    await importRunSpecs(one1.api, [{ name: 'E2E vo2 the only run', daysBack: 2, km: 7, pace: 310, hr: 150 }]);
    const only = evidenceFrom(await rowsOf(one1.api));
    const page2 = await pages.open(browser, baseURL, guard, { token: one1.api.token as string, email: one1.email }, ROUTE);
    await openPage(page2);
    await expect(tiles(page2).locator('article').nth(0).locator('small')).toHaveText('There is one run in the pool, so its estimate is the number.');
    await expect(body(page2)).toContainText(`The one estimate is ${two(only.mean)}, shown as ${one(only.value)}.`);
  });

  test('A3-E2 with no heart rate anywhere every estimate is by the race equation and there is no highest heart rate to show', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('vo2-nohr');
    await importRunSpecs(made.api, [
      { name: 'E2E vo2 watchless five', daysBack: 3, km: 5, pace: 300, hr: null },
      { name: 'E2E vo2 watchless eight', daysBack: 6, km: 8, pace: 310, hr: null },
      { name: 'E2E vo2 watchless ten', daysBack: 9, km: 10, pace: 320, hr: null },
    ]);
    const expected = evidenceFrom(await rowsOf(made.api));
    expect(expected.rows.every((row) => row.method === 'race')).toBe(true);
    expect(expected.hrMax).toBeNull();

    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await openPage(page);
    // The row header is the first child: the heart rate is the fifth and the method the sixth.
    await expect(table(page).locator('tbody tr td:nth-child(6)')).toHaveText(['Race equation', 'Race equation', 'Race equation']);
    await expect(table(page).locator('tbody tr td:nth-child(5)')).toHaveText(['–', '–', '–']);
    await expect(tiles(page).locator('article').nth(2).locator('strong')).toHaveText('None');
    await expect(tiles(page).locator('article').nth(2).locator('small')).toHaveText('No run has a peak of 130 bpm or more, so every estimate comes from the race equation.');
    await expect(tiles(page).locator('article').nth(1).locator('small')).toHaveText('0 from heart rate, 3 from the race equation.');
    await expect(tiles(page).locator('article').nth(0).locator('strong')).toHaveText(one(expected.value));
  });

  test('A3-E3 a runner with no runs, or whose runs are all older than 90 days, is told what a run needs and where to find their runs', async ({ browser, baseURL, guard }) => {
    const none = await newRunner('vo2-none');
    const page = await pages.open(browser, baseURL, guard, { token: none.api.token as string, email: none.email }, ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: 'No run gives an estimate yet' })).toBeVisible();
    await expect(body(page)).toContainText('Your VO2max is worked out from the runs of the last 90 days, and none of them gives an estimate.');
    await expect(body(page)).toContainText('A run counts if it is at least 1.5 km and has a heart rate, or has a pace close to your usual.');
    await expect(table(page)).toHaveCount(0);
    await page.getByRole('link', { name: 'Open your runs' }).click();
    await expect(page).toHaveURL(/\/runs$/);

    const old = await newRunner('vo2-old');
    await importRunSpecs(old.api, [{ name: 'E2E vo2 last summer', daysBack: 120, km: 10, pace: 300, hr: 150 }]);
    const second = await pages.open(browser, baseURL, guard, { token: old.api.token as string, email: old.email }, ROUTE);
    await expect(second.getByRole('heading', { level: 2, name: 'No run gives an estimate yet' })).toBeVisible();
    // The run is no row of the window: there is no table of it at all (the line over time still has its point).
    await expect(table(second)).toHaveCount(0);
  });

  test('A3-E4 a long name with accents and an emoji keeps its row, its link and the page\'s width', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('vo2-names');
    const longName = `Zürich café 🏃‍♀️ ${'très long '.repeat(12)}`.trim();
    const ids = await importRunSpecs(made.api, [
      { name: longName, daysBack: 2, km: 8, pace: 300, hr: 150 },
      { name: 'E2E vo2 plain', daysBack: 5, km: 6, pace: 320, hr: 145 },
    ]);
    const kept = (await rowsOf(made.api)).find((row) => row.id === ids[0])?.name as string;
    expect(kept.startsWith('Zürich café 🏃‍♀️')).toBe(true);

    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await openPage(page);
    const link = table(page).getByRole('link', { name: kept });
    await expect(link).toHaveAttribute('href', `/runs/${ids[0]}`);
    await expectNoHorizontalOverflow(page);
    // The name is cut by its cell, not by the page: the link still holds the whole of it.
    await expect(link).toHaveText(kept);
  });

  test('A3-E5 deleting a run changes the page: the row goes and the number is worked out again', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('vo2-delete');
    const ids = await importRunSpecs(made.api, [
      { name: 'E2E vo2 delete best', daysBack: 2, km: 8, pace: 280, hr: 160 },
      { name: 'E2E vo2 delete second', daysBack: 5, km: 8, pace: 310, hr: 150 },
      { name: 'E2E vo2 delete third', daysBack: 8, km: 8, pace: 320, hr: 148 },
      { name: 'E2E vo2 delete fourth', daysBack: 11, km: 8, pace: 330, hr: 146 },
    ]);
    const who = { token: made.api.token as string, email: made.email };
    const before = evidenceFrom(await rowsOf(made.api));
    const page = await pages.open(browser, baseURL, guard, who, ROUTE);
    await openPage(page);
    await expect(tiles(page).locator('article').nth(0).locator('strong')).toHaveText(one(before.value));
    await expect(table(page).locator('tbody tr')).toHaveCount(4);

    expect((await made.api.delete(`/api/activities/${ids[0]}`)).status).toBe(200);
    const after = evidenceFrom(await rowsOf(made.api));
    expect(after.value).toBeLessThan(before.value);
    // The list is cached for a short while in the page; a reload asks again.
    await page.reload();
    await openPage(page);
    await expect(table(page).locator('tbody tr')).toHaveCount(3);
    await expect(body(page)).not.toContainText('E2E vo2 delete best');
    await expect(tiles(page).locator('article').nth(0).locator('strong')).toHaveText(one(after.value));
    await expect(tiles(page).locator('article').nth(0).locator('small')).toHaveText('The mean of the best 3 of 3 runs of 3 km or more.');
  });

  test('A3-E8 a run deleted in the app is gone from the page at once, though the list of runs was read a moment before', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('vo2-delete-ui');
    await importRunSpecs(made.api, [
      { name: 'E2E vo2 ui best', daysBack: 2, km: 8, pace: 280, hr: 160 },
      { name: 'E2E vo2 ui second', daysBack: 5, km: 8, pace: 310, hr: 150 },
      { name: 'E2E vo2 ui third', daysBack: 8, km: 8, pace: 320, hr: 148 },
    ]);
    const who = { token: made.api.token as string, email: made.email };
    const page = await pages.open(browser, baseURL, guard, who, '/analysis');
    // Analysis has read the list of runs (the page keeps it for a couple of minutes); from here every move is inside the app, so nothing reloads it.
    await expect(page.locator('.analysis-v2-vo2')).toBeVisible();
    await page.getByRole('navigation').getByRole('button', { name: 'Runs', exact: true }).first().click();
    await expect(page).toHaveURL(/\/runs$/);
    await page.getByRole('textbox', { name: 'Search runs by name...' }).fill('E2E vo2 ui best');
    await expect(page.getByRole('button', { name: /E2E vo2 ui best/ }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Delete run' }).first().click();
    const confirm = page.getByRole('dialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: /delete/i }).last().click();
    await expect(page.getByRole('button', { name: /E2E vo2 ui best/ })).toHaveCount(0);

    // Back to Analysis and to the page, without a reload.
    await page.getByRole('navigation').getByRole('button', { name: 'Analysis', exact: true }).first().click();
    await expect(page.locator('.analysis-v2-vo2')).toBeVisible();
    const after = evidenceFrom(await rowsOf(made.api));
    expect(after.rows).toHaveLength(2);
    await expect(page.locator('.analysis-v2-vo2 .analysis-v2-vo2-value strong')).toHaveText(one(after.value));
    await page.locator('.analysis-v2-vo2').getByRole('link', { name: 'The runs behind this number' }).click();
    await openPage(page);
    await expect(table(page).locator('tbody tr')).toHaveCount(2);
    await expect(body(page)).not.toContainText('E2E vo2 ui best');
    await expect(tiles(page).locator('article').nth(0).locator('strong')).toHaveText(one(after.value));
  });

  test('A3-E6 in miles the distances, paces and the length of the pool are in miles', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_unit', 'mile'));
    await page.goto(ROUTE);
    await openPage(page);
    const expected = evidenceFrom(await rowsOf(runner.api));
    const first = expected.rows[0];

    await expect(table(page).locator('tbody tr').first().locator('td').nth(1)).toHaveText(`${(first.km * 0.621371).toFixed(1)} mi`);
    await expect(table(page).locator('tbody tr').first().locator('td').nth(2)).toHaveText(`${mmss(first.paceSecPerKm * KM_PER_MILE)} /mi`);
    await expect(tiles(page).locator('article').nth(0).locator('small')).toHaveText('The mean of the best 3 of 5 runs of 1.9 mi or more.');
    await expect(table(page).getByText('Under 1.9 mi, not used')).toBeVisible();
    await expect(body(page)).toContainText(`than your median pace (${mmss((expected.median as number) * KM_PER_MILE)} /mi), that is slower than ${mmss((expected.median as number) * 1.18 * KM_PER_MILE)} /mi;`);
  });

  test('A3-E7 the keyboard reaches every link in turn, each shows where it is, and Enter follows a run', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });

    // Every link and button of the page's own content is a stop, and so is the line of the number over time (a slider); the loop ends when they have all been reached
    // (and not later, or the focus wraps round).
    const stops = await body(page).locator('a[href], button, [role="slider"]').count();
    const seen: string[] = [];
    for (let step = 0; step < 200 && seen.length < stops; step += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body || !el.closest('.vo2max-estimates-v2')) return null;
        const style = getComputedStyle(el);
        const name = el.getAttribute('role') === 'slider' ? 'the line of the number' : (el.textContent || '').trim().slice(0, 40);
        return { name, outline: `${style.outlineStyle} ${style.outlineWidth}` };
      });
      if (info) {
        expect(info.outline, `${info.name} shows the keyboard focus`).toMatch(/solid 2px/);
        seen.push(info.name);
      }
    }
    const expected = evidenceFrom(await rowsOf(runner.api));
    // The page's order: the line over time (its three ranges are buttons, which hold the focus as the links do, then the line itself, and the rule of the line), then
    // the races (this runner has flagged none, so one link, to choose a run to flag), then the runs of the table, then the rule of the number itself.
    expect(seen).toEqual(['Analysis', 'Race predictions', '6 mo', '1 yr', 'All', 'the line of the number', 'How it is worked out', 'Choose a run to flag', ...expected.rows.map((row) => row.name), 'How it is worked out']);

    await table(page).getByRole('link', { name: expected.rows[0].name }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/runs/${expected.rows[0].id}$`));
  });
});

test.describe('A3 VO2max estimates: when the server or the network does not play along', () => {
  test('A3-N1 a failed load says so, offers another try, and the try works', async ({ browser, baseURL, guard }) => {
    guard.allow(/ERR_FAILED|Failed to load resource/);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.route('**/api/activities/analysis', (route) => route.abort());
    await page.goto(ROUTE);
    await expect(page.getByRole('alert')).toHaveText('Your runs could not be loaded.');
    await expect(table(page)).toHaveCount(0);

    await page.unroute('**/api/activities/analysis');
    await page.getByRole('button', { name: 'Try again' }).click();
    await openPage(page);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('A3-N2 a server error and an answer that is not a list are both a failed load, not a runner with no runs', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|Failed to load resource/);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.route('**/api/activities/analysis', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }));
    await page.goto(ROUTE);
    await expect(page.getByRole('alert')).toHaveText('Your runs could not be loaded.');
    await expect(page.getByRole('heading', { level: 2, name: 'No run gives an estimate yet' })).toHaveCount(0);

    await page.unroute('**/api/activities/analysis');
    await page.route('**/api/activities/analysis', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"runs":[]}' }));
    await page.goto(ROUTE);
    await expect(page.getByRole('alert')).toHaveText('Your runs could not be loaded.');
    await expect(page.getByRole('heading', { level: 2, name: 'No run gives an estimate yet' })).toHaveCount(0);
  });

  test('A3-N3 a slow answer shows a busy page with a skeleton, never the empty sentence', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.route('**/api/activities/analysis', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await page.goto(ROUTE);
    await expect(body(page)).toHaveAttribute('aria-busy', 'true');
    await expect(body(page).getByRole('status')).toHaveText('Loading your runs...');
    await expect(page.locator('.vo2max-estimates-v2__skeleton')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'No run gives an estimate yet' })).toHaveCount(0);
    await expect(table(page)).toBeVisible({ timeout: 15_000 });
  });

  test('A3-N4 a signed-out visitor is sent to sign in, and another runner\'s runs are never on the page', async ({ browser, baseURL, guard }) => {
    guard.allow(/status of 401/);
    const context = await browser.newContext({ baseURL });
    guard.watch(context);
    const anonymous = await context.newPage();
    await anonymous.goto(ROUTE);
    await expect(anonymous).toHaveURL(/\/login/);
    await context.close();

    const other = await newRunner('vo2-other');
    const page = await pages.open(browser, baseURL, guard, { token: other.api.token as string, email: other.email }, ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: 'No run gives an estimate yet' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('E2E vo2');
    expect((await rowsOf(other.api))).toEqual([]);
  });
});

test.describe('A3 VO2max estimates: in other conditions', () => {
  test('A3-L1 in Chinese the page is translated and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(ROUTE);
    await expect(page.getByRole('heading', { level: 1, name: 'VO2max 估算' })).toBeVisible();
    // The page has more than one table now (the runs, the races, the years): the runs are the one with this name.
    await expect(page.getByRole('table', { name: /^最近 90 天内有估算值的跑步，从高到低$/ })).toBeVisible();
    await expect(page).toHaveTitle('VO2max 估算 | HermesRuns');
    const expected = evidenceFrom(await rowsOf(runner.api));
    await expect(body(page)).toContainText(`（${expected.terms.map(two).join(' + ')}）÷ 3 = ${two(expected.mean)}，显示为 ${one(expected.value)}。`);
    await expect(body(page)).not.toContainText('Counted');
    await expectNoRawKeys(page);
  });

  for (const theme of ['light', 'midnight']) {
    test(`A3-A1 the page is readable in the ${theme} theme and has no accessibility violations`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await openPage(page);
      expect(await contrastProblems(page, { include: ['.vo2max-estimates-v2'] }), `${theme}, contrast`).toEqual([]);
      expect(await a11yViolations(page, { include: ['.vo2max-estimates-v2'] }), `${theme}, axe`).toEqual([]);
    });
  }

  test('A3-H9 the line of the number over time and the races come before the table of runs, so the line starts within two screens', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const top = (selector: string): Promise<number> => page.locator(selector).first().evaluate((node) => node.getBoundingClientRect().top + window.scrollY);
    const [plot, history, races, runs, working] = [
      await top('.vo2max-estimates-v2__plot'),
      await top('.vo2max-estimates-v2__history'),
      await top('.vo2max-estimates-v2__races'),
      await table(page).evaluate((node) => node.getBoundingClientRect().top + window.scrollY),
      await top('.vo2max-estimates-v2__working'),
    ];

    expect([plot, history, races, runs, working], 'dots of the 90 days, line over time, races, table of runs, working').toEqual([...[plot, history, races, runs, working]].sort((a, b) => a - b));
    expect(history, 'the line over time starts within two screens of 900 px').toBeLessThan(1800);
  });

  test('A3-M2 @mobile on a phone the three tiles are the rows of one card and take under 340 px, so the first chart is within one screen', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await page.setViewportSize({ width: 375, height: 812 });
    await openPage(page);
    const box = await tiles(page).evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { height: rect.height, rows: Array.from(node.querySelectorAll('article')).map((article) => Math.round(article.getBoundingClientRect().top)) };
    });

    expect(box.height).toBeLessThan(340);
    expect(new Set(box.rows).size, 'three rows, one above the other').toBe(3);
    // Each row still says what it is, its number and its explanation: the label and the number are on one line.
    for (const index of [0, 1, 2]) {
      const parts = await tiles(page).locator('article').nth(index).evaluate((article) => ['span', 'strong', 'small'].map((tag) => Math.round((article.querySelector(tag) as HTMLElement).getBoundingClientRect().top)));
      expect(Math.abs(parts[0] - parts[1]), `row ${index}: the label and the number sit on one line`).toBeLessThan(14);
      expect(parts[2], `row ${index}: the explanation is under them`).toBeGreaterThan(parts[0]);
    }
    const chartTop = await page.locator('.vo2max-estimates-v2__plot').first().evaluate((node) => node.getBoundingClientRect().top);
    expect(chartTop, 'the first chart starts within the screen').toBeLessThan(812);
  });

  test('A3-M3 @mobile at 320 px with the text at 150% and 200% the name of a tile or of a reading never runs into its number (BUG-053)', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await page.setViewportSize({ width: 320, height: 640 });
    await openPage(page);
    for (const percent of [150, 200]) {
      await enlargeText(page, percent);
      expect(await readingsThatCollide(page, '.vo2max-estimates-v2__tiles article'), `the three tiles at ${percent}%`).toEqual([]);
      expect(await readingsThatCollide(page, '.vo2max-estimates-v2__history-reads > div'), `the four readings at ${percent}%`).toEqual([]);
    }
  });

  test('A3-M1 @mobile the page fits a phone: the table scrolls inside its frame, the page does not, and the tiles stack', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await page.setViewportSize({ width: 375, height: 812 });
    await openPage(page);
    await expectNoHorizontalOverflow(page);
    const frame = await page.locator('.vo2max-estimates-v2__table-wrap').filter({ has: table(page) }).evaluate((node) => ({ scroll: node.scrollWidth, client: node.clientWidth }));
    expect(frame.scroll, 'the table is wider than its frame and scrolls there').toBeGreaterThan(frame.client);
    const boxes = await tiles(page).locator('article').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()));
    expect(boxes[1].top, 'the tiles are one above the other').toBeGreaterThan(boxes[0].bottom - 1);
    const svg = await page.getByRole('region', { name: 'Estimates over time' }).locator('svg').evaluate((node) => node.getBoundingClientRect().width);
    expect(svg).toBeLessThanOrEqual(375);
  });
});
