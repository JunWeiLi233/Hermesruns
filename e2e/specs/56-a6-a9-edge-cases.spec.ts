// Third round on the screens built from the Runalyze review (A6 strain, A7 effort bars, A8 races, A9 VO2max over time): the cases the first two
// rounds did not reach, taken from the list of edge cases of the skill: a run on the runner's calendar that is ahead of the device's date, two
// runs on a day, a heavy week, a week with no load before it, a later run that must change nothing before it, a year that turns at midnight on
// the runner's wall, a run that is renamed or deleted after the page has been seen, a name that is long or has emoji, a slow network and no
// network, and a history of thousands of runs.
//
// As in the other specs, what the page prints is worked out again here from what the API lists, so a number that is wrong fails.
import type { Locator, Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { importRunSpecs, type RunSpec } from '../fixtures/analysis.ts';
import { addDays } from '../fixtures/format.ts';
import { gpxRun } from '../fixtures/gpx.ts';
import { sharedHistoryRunner } from '../fixtures/history.ts';
import { markRatios } from '../fixtures/marks.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { browserToday, dailyLoads, weekOf, whole } from '../fixtures/strain.ts';
import { averageOver, expectAverage, meanOfPoints, pointsOf } from '../fixtures/vo2max.ts';
import { expect, expectNoHorizontalOverflow, test } from '../fixtures/test.ts';

const LOAD_ROUTE = '/analysis/load-balance';
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

interface Row {
  id: number;
  name: string;
  distanceKm: number;
  movingTimeSeconds: number;
  startTime: string;
  activityInstant?: string;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  runType: string | null;
}

const rowsOf = async (api: Api): Promise<Row[]> => {
  const response = await api.get('/api/activities/analysis');
  expect(response.status, 'analysis activity list status').toBe(200);
  expect(Array.isArray(response.json), 'analysis returns the owner activity list').toBe(true);
  return response.json;
};
const dayOf = (row: Row): string => row.startTime.slice(0, 10);
const whoOf = (made: { api: Api; email: string }): { token: string; email: string } => ({ token: made.api.token as string, email: made.email });

/** The date on a clock in `timeZone` right now, as `yyyy-MM-dd`. */
const dateIn = (timeZone: string): string => new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());

const loadCard = (page: Page, label: string): Locator =>
  page.locator('.analysis-load-v2-metrics.is-load-row > article').filter({ has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) });

test.describe('X time zones: a run that is ahead of the date on the device', () => {
  // The runner's zone is 25 hours ahead of the device's, so whatever the time, a run that began a few minutes ago has a date on the runner's
  // wall that is after the date on the device (UTC+14 against UTC-11): the runner's calendar has turned and the device's has not.
  const RUNNER_ZONE = 'Pacific/Kiritimati';
  const DEVICE_ZONE = 'Pacific/Pago_Pago';

  /** A runner in that zone with eight runs on the days before and one that began 25 minutes ago. */
  async function runnerAhead(label: string): Promise<{ made: { api: Api; email: string }; rows: Row[]; latest: string; deviceToday: string }> {
    const made = await newRunner(label);
    expect((await made.api.patch('/api/profile/me/time-zone', { timeZone: RUNNER_ZONE })).status).toBe(200);
    await importRunSpecs(made.api, [1, 2, 3, 4, 5, 6, 7, 8].map((daysBack): RunSpec => ({ name: `E2E ${label} d${daysBack}`, daysBack, km: 6, pace: 330, hr: 145 })), { wait: false });
    await made.api.importRun(`${label}-fresh.gpx`, gpxRun({ name: `E2E ${label} fresh`, start: new Date(Date.now() - 25 * 60_000), distanceM: 3000, pace: 360, hr: 150, shape: 'line' }));
    const rows = await rowsOf(made.api);
    expect(rows).toHaveLength(9);
    const latest = rows.map(dayOf).sort().at(-1) as string;
    const deviceToday = dateIn(DEVICE_ZONE);
    expect(latest > deviceToday, `the fresh run is dated ${latest}, the device says ${deviceToday}`).toBe(true);
    return { made, rows, latest, deviceToday };
  }

  test('X-TZ1 (BUG-043) a run that began minutes ago is in the week on Load balance and on Home, though its date is after the device\'s', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const { made, rows, latest, deviceToday } = await runnerAhead('x-tz');

    // The week that ends on the runner's today, and the week the page would have shown when it counted from the device's date.
    const weekKm = (last: string): number => rows.filter((row) => dayOf(row) <= last && dayOf(row) > addDays(last, -7)).reduce((sum, row) => sum + row.distanceKm, 0);
    const expected = weekKm(latest);
    expect(Math.abs(expected - weekKm(deviceToday)), 'the case tells the two weeks apart').toBeGreaterThan(1);

    const page = await pages.open(browser, baseURL, guard, whoOf(made), LOAD_ROUTE, { timezoneId: DEVICE_ZONE });
    await expect(page.getByRole('heading', { level: 2, name: 'Acute vs. chronic load' })).toBeVisible();
    await expect(loadCard(page, 'Weekly volume').locator(':scope > strong')).toHaveText(`${Number(expected.toFixed(1))} km`);
    await expect(page.locator('.analysis-load-v2-driver').filter({ hasText: 'E2E x-tz fresh' })).toHaveCount(1);

    // Home adds up the same seven days.
    await page.goto('/profile');
    const stat = page.locator('.hd-today-stat').filter({ hasText: 'Last 7 days' }).locator('strong');
    await expect(stat).toHaveText(`${expected.toFixed(1)} km`);
  });

  test('X-TZ2 the VO2max page of that runner draws a point for every run, the last one included, and says the number now', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const { made, rows } = await runnerAhead('x-tz2');
    const page = await pages.open(browser, baseURL, guard, whoOf(made), VO2_ROUTE, { timezoneId: DEVICE_ZONE });
    await openVo2Evidence(page);
    await expect(historySection(page)).toBeVisible();

    // The account's calendar is ahead, but the run's activityInstant is still 25 minutes ago. Keep its point and today's point;
    // reading the account-local timestamp as device time would incorrectly drop that final, current estimate.
    await expect(historyDots(page)).toHaveCount(rows.length + 1);
    await expect(historyChart(page).locator('circle.is-now')).toHaveCount(1);
    await expect(historyChart(page)).toHaveAttribute('aria-valuetext', /^Now: /);
    const top = await page.getByRole('region', { name: 'How the number is made' }).locator('article').first().locator('strong').textContent();
    expect(top).toMatch(/^\d+\.\d$/);
    await expect(nowReading(page)).toHaveText(top as string);
  });
});

test.describe('A6 training strain: two runs in a day, a heavy week, a week before with nothing in it', () => {
  const strainOf = (page: Page): Locator => loadCard(page, 'Strain');

  test('A6-E4 two runs on one day are one day: their loads are added, and the week is still seven days', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const made = await newRunner('a6-double');
    await importRunSpecs(made.api, [
      { name: 'E2E a6d d1', daysBack: 1, km: 8, pace: 300, hr: 150 },
      { name: 'E2E a6d d2 early', daysBack: 2, km: 6, pace: 330, hr: 140, hourUtc: 6 },
      { name: 'E2E a6d d2 late', daysBack: 2, km: 5, pace: 320, hr: 150, hourUtc: 15 },
      { name: 'E2E a6d d4', daysBack: 4, km: 12, pace: 315, hr: 165 },
      { name: 'E2E a6d d5', daysBack: 5, km: 5, pace: 340, hr: 135 },
      { name: 'E2E a6d d7', daysBack: 7, km: 10, pace: 300, hr: 158 },
      { name: 'E2E a6d d9', daysBack: 9, km: 7, pace: 320, hr: 146 },
      { name: 'E2E a6d d10', daysBack: 10, km: 9, pace: 305, hr: 155 },
      { name: 'E2E a6d d12', daysBack: 12, km: 12, pace: 300, hr: 160 },
      { name: 'E2E a6d d13', daysBack: 13, km: 14, pace: 325, hr: 150 },
      { name: 'E2E a6d d17', daysBack: 17, km: 6, pace: 260, hr: 178 },
    ], { wait: false });
    const rows = await rowsOf(made.api);
    expect(rows.filter((row) => dayOf(row) === rows.find((other) => other.name === 'E2E a6d d2 early')?.startTime.slice(0, 10)), 'two runs are on that day').toHaveLength(2);

    const loads = dailyLoads(rows, browserToday());
    const week = weekOf(loads.slice(-7));
    const apart = dailyLoads(rows.map((row) => (row.name === 'E2E a6d d2 late' ? { ...row, startTime: `${addDays(dayOf(row), -1)}${row.startTime.slice(10)}` } : row)), browserToday());
    expect(Math.round(weekOf(apart.slice(-7)).strain as number), 'the case tells one day from two').not.toBe(Math.round(week.strain as number));

    const page = await pages.open(browser, baseURL, guard, whoOf(made), LOAD_ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: 'Acute vs. chronic load' })).toBeVisible();
    await expect(strainOf(page).locator(':scope > strong')).toHaveText(whole(week.strain as number));
    await expect(strainOf(page).locator(':scope > small')).toContainText(`Week load ${whole(week.load)} × monotony ${(week.monotony as number).toFixed(2)}`);
    await expect(loadCard(page, 'Monotony').locator(':scope > strong')).toHaveText((week.monotony as number).toFixed(1));
    // Both runs are in the list of what drove the week, one line each.
    await expect(page.locator('.analysis-load-v2-driver').filter({ hasText: 'E2E a6d d2' })).toHaveCount(2);
  });

  test('A6-E5 a heavy week has thousands separators in the strain and in its working, and the same on the Chinese page', async ({ browser, baseURL, guard }) => {
    test.setTimeout(300_000);
    const made = await newRunner('a6-heavy');
    // Seven hard days of one to two and a half hours with an easy one in between, a week before it, and one older and harder run.
    const week = [[20, 165], [10, 140], [24, 172], [10, 140], [20, 165], [12, 150], [24, 170]];
    const specs: RunSpec[] = [
      ...week.map(([km, hr], index): RunSpec => ({ name: `E2E a6h w0 d${index + 1}`, daysBack: index + 1, km, pace: 330, hr })),
      ...week.map(([km, hr], index): RunSpec => ({ name: `E2E a6h w1 d${index + 8}`, daysBack: index + 8, km: km - 4, pace: 335, hr: hr - 8 })),
      { name: 'E2E a6h old', daysBack: 16, km: 8, pace: 270, hr: 178 },
    ];
    await importRunSpecs(made.api, specs, { wait: false });
    const loads = weekOf(dailyLoads(await rowsOf(made.api), browserToday()).slice(-7));
    expect(loads.strain as number, 'a heavy week').toBeGreaterThan(1000);
    expect(whole(loads.strain as number)).toMatch(/^\d{1,3}(,\d{3})+$/);

    const page = await pages.open(browser, baseURL, guard, whoOf(made), LOAD_ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: 'Acute vs. chronic load' })).toBeVisible();
    await expect(strainOf(page).locator(':scope > strong')).toHaveText(whole(loads.strain as number));
    await expect(strainOf(page).locator(':scope > small')).toContainText(`Week load ${whole(loads.load)} × monotony ${(loads.monotony as number).toFixed(2)}`);

    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(LOAD_ROUTE);
    const strainZh = page.locator('.analysis-load-v2-metrics.is-load-row > article').nth(4);
    await expect(strainZh.locator(':scope > strong')).toHaveText(whole(loads.strain as number));
    await expect(strainZh.locator(':scope > small')).toContainText(`周负荷 ${whole(loads.load)} × 单调度`);
  });

  test('A6-E6 (BUG-044) when the week before was a rest week the cards say so, and not that there was no prior week', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const made = await newRunner('a6-gap');
    // Five runs in the last seven days, none in the seven days before them, and runs from 16 days back on (so the history is long enough).
    await importRunSpecs(made.api, [
      ...[1, 2, 4, 5, 6].map((daysBack): RunSpec => ({ name: `E2E a6g d${daysBack}`, daysBack, km: 6 + (daysBack % 3), pace: 320, hr: 140 + daysBack })),
      ...[16, 17, 19, 21].map((daysBack): RunSpec => ({ name: `E2E a6g d${daysBack}`, daysBack, km: 7, pace: 320, hr: 145 })),
    ], { wait: false });
    const loads = dailyLoads(await rowsOf(made.api), browserToday());
    expect(loads.length, 'history of three weeks').toBeGreaterThanOrEqual(21);
    expect(weekOf(loads.slice(-14, -7)).strain, 'the week before had no load').toBeNull();

    const page = await pages.open(browser, baseURL, guard, whoOf(made), LOAD_ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: 'Acute vs. chronic load' })).toBeVisible();
    await expect(strainOf(page).locator(':scope > strong')).toHaveText(whole(weekOf(loads.slice(-7)).strain as number));
    await expect(strainOf(page).locator(':scope > em')).toHaveText('No load the week before');
    await expect(loadCard(page, 'Weekly volume').locator(':scope > em')).toHaveText('No runs the week before');

    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(LOAD_ROUTE);
    await expect(page.locator('.analysis-load-v2-metrics.is-load-row > article').nth(4).locator(':scope > em')).toHaveText('上周没有训练负荷');
    await expect(page.locator('.analysis-load-v2-metrics.is-load-row > article').nth(2).locator(':scope > em')).toHaveText('上周没有跑步');
  });
});

test.describe('A7 daily effort bars: every range, a race day, a day far bigger than the rest, and the keyboard', () => {
  const fitnessCard = (page: Page): Locator => page.getByRole('region', { name: 'Fitness, fatigue and form', exact: true });
  const fitnessChart = (page: Page): Locator => fitnessCard(page).getByRole('slider', { name: /^Fitness, fatigue and form for \d+ days/ });
  const effortSwitch = (page: Page): Locator => fitnessCard(page).getByRole('group', { name: 'Lines to show' }).getByRole('button', { name: /^Daily effort/ });
  const strip = (page: Page): Locator => fitnessCard(page).locator('.analysis-fit-v2-effort');
  /** The bars of the strip as drawn: the height of each, and the strip's own height (the two grid lines of its scale). */
  const barsOf = async (page: Page): Promise<{ heights: number[]; stripHeight: number }> => {
    const drawn = (await fitnessCard(page).locator('.analysis-fit-v2-effort-bars').getAttribute('d')) ?? '';
    const heights = [...drawn.matchAll(/M([\d.-]+),([\d.-]+)h([\d.-]+)v([\d.-]+)/g)].map((match) => Number(match[4]));
    const lines = await strip(page).locator('line.analysis-fit-v2-grid').evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('y1'))));
    return { heights, stripHeight: Math.abs(lines[0] - lines[1]) };
  };

  test('A7-E2 the bars follow each range: one for each day with effort in the window, and the chart says how many days it covers', async ({ browser, baseURL, guard }) => {
    test.setTimeout(480_000);
    const runner = await sharedHistoryRunner('fitness', 14);
    const page = await pages.open(browser, baseURL, guard, runner, LOAD_ROUTE);
    await expect(strip(page)).toBeVisible();
    const counts: number[] = [];

    for (const [label, days] of [['6 wk', 42], ['3 mo', 91], ['6 mo', 182], ['1 yr', 365]] as const) {
      await fitnessCard(page).getByRole('group', { name: 'Time range' }).getByRole('button', { name: label, exact: true }).click();
      const series = (await runner.api.get(`/api/training/series?from=${addDays(browserToday(), -(days - 1))}`)).json as { points: Array<{ load: number }> };
      const withEffort = series.points.filter((point) => point.load > 0).length;
      counts.push(withEffort);
      await expect.poll(async () => (await barsOf(page)).heights.length, { message: `bars in ${label}` }).toBe(withEffort);
      await expect(fitnessChart(page)).toHaveAccessibleName(new RegExp(`^Fitness, fatigue and form for ${series.points.length} days, from `));
    }
    // The ranges are not all the same set of days: the history is 14 weeks long, so six weeks and three months show fewer than six months do.
    expect(counts[0]).toBeLessThan(counts[1]);
    expect(counts[1]).toBeLessThan(counts[2]);
    expect(counts[2]).toBe(counts[3]);
  });

  test.describe('with a race, a day of nine hours and a day of a kilometre and a half', () => {
    let made: { api: Api; email: string };

    test.beforeAll(async () => {
      test.setTimeout(480_000);
      made = await newRunner('a7-edge');
      const specs: RunSpec[] = [
        ...Array.from({ length: 16 }, (_, index): RunSpec => ({ name: `E2E a7e d${2 * index + 1}`, daysBack: 2 * index + 1, km: 6 + (index % 4), pace: 320, hr: 140 + (index % 5) * 4 })),
        { name: 'E2E a7e huge', daysBack: 4, km: 60, pace: 540, hr: 150 },
        { name: 'E2E a7e tiny', daysBack: 6, km: 1.6, pace: 420, hr: 120 },
      ];
      const ids = await importRunSpecs(made.api, specs);
      expect((await made.api.patch(`/api/activities/${ids[4]}`, { runType: 'RACE' })).status).toBe(200);
    });

    test('A7-E3 a race day has its line through the strip, and the switch works from the keyboard', async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, whoOf(made), LOAD_ROUTE);
      await expect(strip(page)).toBeVisible();
      const race = fitnessCard(page).locator('line.analysis-fit-v2-race-line');
      await expect(race).toHaveCount(1);
      const ends = async (): Promise<number> => Number(await race.getAttribute('y2'));
      const stripBottom = Math.max(...(await strip(page).locator('line.analysis-fit-v2-grid').evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('y1'))))));
      expect(await ends(), 'the line runs down to the foot of the strip').toBeCloseTo(stripBottom, 1);

      // The switch is a button: Space takes the strip away and the line ends higher up; Enter brings both back.
      await effortSwitch(page).focus();
      await page.keyboard.press('Space');
      await expect(effortSwitch(page)).toHaveAttribute('aria-pressed', 'false');
      await expect(strip(page)).toHaveCount(0);
      expect(await ends()).toBeLessThan(stripBottom);
      await page.keyboard.press('Enter');
      await expect(effortSwitch(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(strip(page)).toBeVisible();
      expect(await ends()).toBeCloseTo(stripBottom, 1);
    });

    test('A7-E4 a day far bigger than the rest sets the scale, and the smallest day still has a bar you can see', async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, whoOf(made), LOAD_ROUTE);
      await expect(strip(page)).toBeVisible();
      const series = (await made.api.get(`/api/training/series?from=${addDays(browserToday(), -181)}`)).json as { points: Array<{ load: number }> };
      const loads = series.points.map((point) => point.load).filter((load) => load > 0);
      expect(Math.max(...loads) / Math.min(...loads), 'one day is over ten times the smallest').toBeGreaterThan(10);

      const drawn = await barsOf(page);
      expect(drawn.heights, 'a bar for each day with effort, the huge one and the tiny one too').toHaveLength(loads.length);
      expect(Math.min(...drawn.heights), 'no bar is thinner than a pixel').toBeGreaterThanOrEqual(1);
      expect(Math.max(...drawn.heights)).toBeLessThanOrEqual(drawn.stripHeight + 0.01);
      expect(Math.max(...drawn.heights) / drawn.stripHeight, 'the biggest day nearly fills the strip').toBeGreaterThan(0.6);
    });

    test('A7-E5 and A6-M2 on a phone 320 px wide the strip, the five cards and the page fit', async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, whoOf(made), null);
      await page.setViewportSize({ width: 320, height: 700 });
      await page.goto(LOAD_ROUTE);
      await expect(strip(page)).toBeVisible();
      await expect(loadCard(page, 'Strain')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const widest = await fitnessCard(page).locator('svg').first().evaluate((node) => node.getBoundingClientRect().width);
      expect(widest, 'the chart is no wider than the phone').toBeLessThanOrEqual(320);
      const tops = await page.locator('.analysis-load-v2-metrics.is-load-row > article').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().left)));
      expect(new Set(tops).size, 'the five cards are one above the other').toBe(1);
    });
  });
});

const VO2_ROUTE = '/analysis#vo2max-estimates';

async function openVo2Evidence(page: Page): Promise<void> {
  await expect(page.locator('#vo2max-estimates')).toBeVisible();
  await expect(page.locator('.vo2max-estimates-v2')).toBeVisible();
  for (const name of ['race-evidence', 'calculation-details', 'history-disclosure']) {
    const disclosure = page.locator(`.vo2max-estimates-v2__${name}`);
    // With no current estimate the race table and working are already expanded; only history remains a disclosure.
    if (name !== 'history-disclosure' && await disclosure.count() === 0) continue;
    await expect(disclosure).toBeVisible();
    if (!(await disclosure.evaluate(node => (node as HTMLDetailsElement).open))) {
      await disclosure.locator(':scope > summary').click();
    }
  }
}


const racesTable = (page: Page): Locator => page.getByRole('table', { name: /^Your races, newest first/ });
const historySection = (page: Page): Locator => page.locator('.vo2max-estimates-v2__history');
const historyChart = (page: Page): Locator => historySection(page).getByRole('slider', { name: /^Your VO2max after/ });
const historyPointTexts = (page: Page): Promise<string[]> => historySection(page).getByRole('list', { name: 'Every point of the line, oldest first' }).locator('li > span:first-child').allTextContents();
const historyDots = (page: Page): Locator => historyChart(page).locator('circle.vo2max-estimates-v2__history-dot');
const yearsTable = (page: Page): Locator => historySection(page).getByRole('table', { name: 'VO2max by year' });
const rangeChip = (page: Page, label: string): Locator => historySection(page).getByRole('group', { name: 'Time range' }).getByRole('button', { name: label, exact: true });
const nowReading = (page: Page): Locator => historySection(page).getByRole('group', { name: /^Your VO2max now/ }).locator('div').filter({ has: page.getByText('Now', { exact: true }) }).locator('strong');
const pointValues = async (page: Page): Promise<string[]> => (await historyPointTexts(page)).map((title) => title.replace(/^[^:]*: /, '').split(',')[0]);

test.describe('A8 and A9: a later run with a higher heart rate changes nothing before it', () => {
  // Two runners with the same seven weekly runs, all with a heart rate and one of them a flagged race; the second has one more run, later, at a
  // far higher heart rate. The number is made from the heart rate against the highest there was, and "as it stood" means the highest there had been
  // by then: so every number up to the later run is the same for the two, and the number now is not.
  let plain: { api: Api; email: string };
  let later: { api: Api; email: string };
  const WEEKS: RunSpec[] = [
    { name: 'E2E hr w1', daysBack: 56, km: 5, pace: 330, hr: 150 },
    { name: 'E2E hr w2', daysBack: 49, km: 5, pace: 322, hr: 152 },
    { name: 'E2E hr w3', daysBack: 42, km: 8, pace: 318, hr: 155 },
    { name: 'E2E hr w4', daysBack: 35, km: 5, pace: 310, hr: 150 },
    { name: 'E2E hr race', daysBack: 28, km: 10, pace: 285, hr: 168 },
    { name: 'E2E hr w6', daysBack: 21, km: 5, pace: 315, hr: 150 },
    { name: 'E2E hr w7', daysBack: 14, km: 6, pace: 312, hr: 152 },
  ];

  test.beforeAll(async () => {
    test.setTimeout(480_000);
    plain = await newRunner('hr-plain');
    later = await newRunner('hr-later');
    for (const runner of [plain, later]) {
      const ids = await importRunSpecs(runner.api, WEEKS, { wait: false });
      expect((await runner.api.patch(`/api/activities/${ids[4]}`, { runType: 'RACE' })).status).toBe(200);
    }
    await importRunSpecs(later.api, [{ name: 'E2E hr later', daysBack: 4, km: 5, pace: 300, hr: 195 }], { wait: false });
  });

  test('A9-E4 the points of the line up to the later run are the same for both runners, and the number now is not', async ({ browser, baseURL, guard }) => {
    const first = await pages.open(browser, baseURL, guard, whoOf(plain), VO2_ROUTE);
    await openVo2Evidence(first);
    await expect(historySection(first)).toBeVisible();
    await rangeChip(first, 'All').click();
    const second = await pages.open(browser, baseURL, guard, whoOf(later), VO2_ROUTE);
    await openVo2Evidence(second);
    await expect(historySection(second)).toBeVisible();
    await rangeChip(second, 'All').click();

    await expect(historyDots(first)).toHaveCount(WEEKS.length + 1);
    await expect(historyDots(second)).toHaveCount(WEEKS.length + 2);
    const before = await pointValues(first);
    const after = await pointValues(second);
    expect(after.slice(0, WEEKS.length), 'every point up to the later run is what it was').toEqual(before.slice(0, WEEKS.length));
    expect(after.at(-1), 'the number now is made against the higher heart rate').not.toBe(before.at(-1));
    expect(await nowReading(second).textContent()).not.toBe(await nowReading(first).textContent());
  });

  test('A8-E3 the number before the race and the number its time gives are the same for both runners', async ({ browser, baseURL, guard }) => {
    const first = await pages.open(browser, baseURL, guard, whoOf(plain), VO2_ROUTE);
    await openVo2Evidence(first);
    const second = await pages.open(browser, baseURL, guard, whoOf(later), VO2_ROUTE);
    await openVo2Evidence(second);
    for (const page of [first, second]) await expect(racesTable(page).locator('tbody tr')).toHaveCount(1);
    const cells = async (page: Page): Promise<string[]> => racesTable(page).locator('tbody tr').first().locator('td').allTextContents();

    const a = await cells(first);
    const b = await cells(second);
    expect(a[3], 'the number the time gives').toMatch(/^\d+\.\d$/);
    expect(a[4], 'the number before the race').toMatch(/^\d+\.\d$/);
    expect(b).toEqual(a);
  });
});

test.describe('A8 races against the number: after the runner has changed a race', () => {
  const nameCell = (page: Page, name: string): Locator => racesTable(page).locator('tbody tr').filter({ hasText: name });
  let made: { api: Api; email: string };
  let ids: number[];

  test.beforeAll(async () => {
    test.setTimeout(480_000);
    made = await newRunner('a8-flow');
    ids = await importRunSpecs(made.api, [
      { name: 'E2E a8f easy one', daysBack: 40, km: 5, pace: 300, hr: null },
      { name: 'E2E a8f easy two', daysBack: 30, km: 5, pace: 300, hr: null },
      { name: 'E2E a8f spring ten', daysBack: 14, km: 10, pace: 270, hr: null },
      { name: 'E2E a8f club five', daysBack: 5, km: 5, pace: 264, hr: null },
    ], { wait: false });
    for (const index of [2, 3]) expect((await made.api.patch(`/api/activities/${ids[index]}`, { runType: 'RACE' })).status).toBe(200);
  });

  test('A8-F3 a race the runner renames on its page has the new name on the VO2max page when they go back', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, whoOf(made), VO2_ROUTE);
    await openVo2Evidence(page);
    await expect(racesTable(page).locator('tbody tr')).toHaveCount(2);
    await nameCell(page, 'E2E a8f spring ten').getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/runs/${ids[2]}$`));

    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Edit run' });
    await drawer.getByRole('textbox', { name: 'Title' }).fill('E2E a8f spring ten renamed');
    await drawer.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Run saved.')).toBeVisible();
    await page.goBack();
    await openVo2Evidence(page);

    await expect(racesTable(page).locator('tbody tr')).toHaveCount(2);
    await expect(nameCell(page, 'E2E a8f spring ten renamed')).toHaveCount(1);
    await expect(nameCell(page, 'E2E a8f spring ten renamed').getByRole('link')).toHaveAttribute('href', `/runs/${ids[2]}`);
  });

  test('A8-F4 a race the runner deletes from the list of runs is not on the VO2max page when they go back, and nor is its point', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, whoOf(made), VO2_ROUTE);
    await openVo2Evidence(page);
    await expect(racesTable(page).locator('tbody tr')).toHaveCount(2);
    await rangeChip(page, 'All').click();
    const points = await historyDots(page).count();

    await page.getByRole('button', { name: 'Runs', exact: true }).first().click();
    await expect(page).toHaveURL(/\/runs$/);
    await page.getByRole('textbox', { name: 'Search runs by name...' }).fill('E2E a8f club five');
    await page.getByRole('button', { name: 'Delete run' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.goBack();

    await expect(page).toHaveURL(new RegExp(`${VO2_ROUTE}$`));
    await openVo2Evidence(page);
    await expect(racesTable(page).locator('tbody tr')).toHaveCount(1);
    await expect(nameCell(page, 'E2E a8f club five')).toHaveCount(0);
    await rangeChip(page, 'All').click();
    await expect(historyDots(page)).toHaveCount(points - 1);
  });
});

test.describe('A9 the average of the number', () => {
  const readingOf = (page: Page, label: string): Locator => historySection(page).getByRole('group', { name: /^Your VO2max now/ }).locator('div').filter({ has: page.getByText(label, { exact: true }) });

  test('A9-E8 the average counts the days a number stood and not the points: four quick runs a day apart, then six weeks with none', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const made = await newRunner('a9-days');
    // The first two points are hollow; from the third run each number is the mean of three. The fourth to the sixth runs are a day apart and each is quicker; the sixth number
    // then stands 43 days, to the seventh run 10 days ago, and that one stands the ten days to today.
    const days = [60, 58, 56, 55, 54, 53, 10];
    const paces = [324, 318, 312, 306, 300, 294, 288];
    await importRunSpecs(made.api, days.map((daysBack, index): RunSpec => ({ name: `E2E a9d ${index + 1}`, daysBack, km: 5, pace: paces[index], hr: null })), { wait: false });
    const points = pointsOf(await rowsOf(made.api));
    const expected = averageOver(points, Date.now());
    // The runs are at 11:00 UTC and it is some other time of day now, so the days are 56 and the part of a day between the two (never more than half a day either way).
    expect(Math.abs((expected?.days as number) - 56), `days of the five firm numbers: ${expected?.days}`).toBeLessThan(1);
    expect(Math.abs((expected?.value as number) - meanOfPoints(points)), 'the case tells days from points').toBeGreaterThan(0.5);

    const page = await pages.open(browser, baseURL, guard, whoOf(made), VO2_ROUTE);
    await openVo2Evidence(page);
    await expect(historySection(page)).toBeVisible();
    await expectAverage(readingOf(page, 'Average'), expected);
    // It lies between the lowest and the highest firm numbers, and the table of the years says the same of the year.
    const high = Number(await readingOf(page, 'Highest').locator('strong').textContent());
    const low = Number(await readingOf(page, 'Lowest').locator('strong').textContent());
    const shown = Number(await readingOf(page, 'Average').locator('strong').textContent());
    expect(shown).toBeGreaterThan(low);
    expect(shown).toBeLessThan(high);
    const thisYear = points.filter((point) => new Date(point.time).getUTCFullYear() === new Date().getFullYear());
    await expectAverage(yearsTable(page).locator('tbody tr').first().locator('td').nth(1), averageOver(thisYear, Date.now()));
  });
});

test.describe('A9 the average of a year', () => {
  test('A9-E9 the average of a year stops at the end of the year: a number that began on 24 December stands a week in that year, not the weeks to the next run', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const made = await newRunner('a9-yearend');
    const at = (iso: string, name: string) => made.api.importRun(`${name.replace(/\W+/g, '-')}.gpx`, gpxRun({ name, start: new Date(iso), distanceM: 5000, pace: 300, hr: null, shape: 'line' }));
    // Three runs in the last days of 2025 (the third gives the first firm number), nothing for 17 days, then three in January.
    await at('2025-12-20T11:00:00Z', 'E2E a9ye 1');
    await at('2025-12-22T11:00:00Z', 'E2E a9ye 2');
    await at('2025-12-24T11:00:00Z', 'E2E a9ye 3');
    await at('2026-01-10T11:00:00Z', 'E2E a9ye 4');
    await at('2026-01-12T11:00:00Z', 'E2E a9ye 5');
    await at('2026-01-14T11:00:00Z', 'E2E a9ye 6');
    const points = pointsOf(await rowsOf(made.api));
    const of2025 = points.filter((point) => new Date(point.time).getUTCFullYear() === 2025);
    const end2025 = new Date(2026, 0, 1).getTime();
    const expected = averageOver(of2025, end2025);
    // The third number stands from the 24th to the end of the year, 8 days, though the next run is 17 days after it.
    expect(expected?.days).toBeGreaterThan(7);
    expect(expected?.days).toBeLessThan(9);

    const page = await pages.open(browser, baseURL, guard, whoOf(made), VO2_ROUTE);
    await openVo2Evidence(page);
    await expect(historySection(page)).toBeVisible();
    const line = yearsTable(page).locator('tbody tr').filter({ has: page.locator('th', { hasText: /^2025$/ }) });
    await expectAverage(line.locator('td').nth(1), expected);
    await expect(line.locator('td').nth(1).locator('small')).toHaveText(/^over [78] days$/);
  });
});

test.describe('A8 and A9: names, years and size', () => {
  test('A8-E4 a race with a long name, emoji and accents, and one with markup in it, are shown as text and the page stays inside the phone', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const made = await newRunner('a8-names');
    const ids = await importRunSpecs(made.api, [
      { name: 'E2E a8n easy', daysBack: 30, km: 5, pace: 300, hr: null },
      { name: 'E2E a8n long', daysBack: 14, km: 10, pace: 270, hr: null },
      { name: 'E2E a8n markup', daysBack: 5, km: 5, pace: 264, hr: null },
    ], { wait: false });
    const longName = `Café Münchner Halbmarathon 🏃‍♂️ 2026 – ${'Straße der Meister '.repeat(5)}Ziel`.slice(0, 118); // a title can be 120 characters
    const markup = '<b>Race</b> & "quotes" <img src=x onerror=alert(1)>';
    for (const [index, name] of [[1, longName], [2, markup]] as const) {
      const saved = await made.api.patch(`/api/activities/${ids[index]}`, { name, runType: 'RACE' });
      expect(saved.status, JSON.stringify(saved.json)).toBe(200);
    }

    for (const width of [1280, 390, 320]) {
      const page = await pages.open(browser, baseURL, guard, whoOf(made), null);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(VO2_ROUTE);
      await openVo2Evidence(page);
      await expect(racesTable(page).locator('tbody tr')).toHaveCount(2);
      await expect(racesTable(page).locator('tbody tr').filter({ hasText: 'Münchner' }).locator('td').first()).toContainText('🏃‍♂️');
      await expect(racesTable(page).locator('tbody tr').filter({ hasText: 'quotes' }).locator('td').first()).toHaveText(markup);
      await expect(racesTable(page).getByRole('img')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      // The points on the line carry the same names in the list for a screen reader, as text.
      await rangeChip(page, 'All').click();
      const titles = await historyPointTexts(page);
      expect(titles.some((title) => title.endsWith(`after ${markup}`))).toBe(true);
      // Read from the keyboard, the long name and the markup are text in the readout too, which stays inside the chart, with the name cut to two lines.
      const slider = historyChart(page);
      await slider.focus();
      await page.keyboard.press('Home');
      await page.keyboard.press('ArrowRight');
      await expect(slider).toHaveAttribute('aria-valuetext', /Café Münchner/);
      const tip = slider.locator('.vo2max-estimates-v2__tooltip');
      await expect(tip.locator('span')).toContainText('Café Münchner');
      const [frame, shown, name] = await Promise.all([slider.boundingBox(), tip.boundingBox(), tip.locator('span').boundingBox()]);
      expect(shown!.x, `${width} px: the readout starts inside the chart`).toBeGreaterThanOrEqual(frame!.x - 1);
      expect(shown!.x + shown!.width, `${width} px: and ends inside it`).toBeLessThanOrEqual(frame!.x + frame!.width + 1);
      expect(name!.height, 'the name is cut to two lines').toBeLessThan(44);
      await page.keyboard.press('ArrowRight');
      await expect(tip.locator('span')).toHaveText(`After ${markup}`);
      await expect(tip.locator('img')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    }
  });

  test('A9-E5 a year turns where the clock on the runner\'s wall turns: a run at 00:10 on 1 January is in the new year, though it is still 31 December in UTC', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const made = await newRunner('a9-newyear');
    expect((await made.api.patch('/api/profile/me/time-zone', { timeZone: 'Pacific/Auckland' })).status).toBe(200);
    const at = (iso: string, name: string) => made.api.importRun(`${name.replace(/\W+/g, '-')}.gpx`, gpxRun({ name, start: new Date(iso), distanceM: 5000, pace: 300, hr: null, shape: 'line' }));
    // In Auckland (UTC+13 that day) these are 23:50 on 31 December and 00:10 on 1 January.
    await at('2025-12-31T10:50:00Z', 'E2E a9y before midnight');
    await at('2025-12-31T11:10:00Z', 'E2E a9y after midnight');
    await importRunSpecs(made.api, [10, 17, 24].map((daysBack): RunSpec => ({ name: `E2E a9y recent ${daysBack}`, daysBack, km: 5, pace: 300, hr: null })), { wait: false });
    const rows = await rowsOf(made.api);
    expect(rows.map(dayOf).filter((day) => day <= '2026-01-01').sort()).toEqual(['2025-12-31', '2026-01-01']);

    const page = await pages.open(browser, baseURL, guard, whoOf(made), VO2_ROUTE);
    await openVo2Evidence(page);
    await expect(historySection(page)).toBeVisible();
    await expect(yearsTable(page).locator('tbody tr')).toHaveCount(2);
    const line = (year: number): Locator => yearsTable(page).locator('tbody tr').filter({ has: page.locator('th', { hasText: new RegExp(`^${year}$`) }) });
    await expect(line(2025).locator('td').nth(4)).toHaveText('1');
    await expect(line(2026).locator('td').nth(4)).toHaveText('4');
    await expect(line(2025).locator('td').nth(5)).toHaveText('5 km');
    await expect(line(2026).locator('td').nth(5)).toHaveText('20 km');
  });

  test('A9-E10 a line of one point can be read: the arrows, Home and End stay on it, and the readout is inside the chart', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const made = await newRunner('a9-onepoint');
    // Keep a real historical run, and pin the browser's Date to its recorded instant. No extra Now point exists at that exact instant;
    // future runs are intentionally excluded from current fitness and cannot be used to manufacture this geometry.
    await made.api.importRun('a9-only.gpx', gpxRun({ name: 'E2E a9 only run', start: new Date(Date.now() - 3_600_000), distanceM: 5000, pace: 330, hr: null, shape: 'line' }));
    const rows = await rowsOf(made.api);
    expect(rows).toHaveLength(1);
    expect(rows[0].activityInstant).toMatch(/Z$/);
    const page = await pages.open(browser, baseURL, guard, whoOf(made), null);
    await page.clock.setFixedTime(new Date(rows[0].activityInstant as string));
    await page.goto(VO2_ROUTE);
    await openVo2Evidence(page);
    const line = historySection(page).getByRole('slider', { name: /^Your VO2max after your run on / });
    await expect(line).toBeVisible();
    await expect(line).toHaveAttribute('aria-valuemax', '0');
    await expect(historyDots(page)).toHaveCount(1);

    await line.focus();
    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      await page.keyboard.press(key);
      await expect(line, key).toHaveAttribute('aria-valuenow', '0');
    }
    const tip = line.locator('.vo2max-estimates-v2__tooltip');
    await expect(tip).toContainText('After E2E a9 only run');
    await expect(tip).toContainText("Hollow dot: one run's estimate");
    const [frame, shown] = await Promise.all([line.boundingBox(), tip.boundingBox()]);
    expect(shown!.x).toBeGreaterThanOrEqual(frame!.x - 1);
    expect(shown!.x + shown!.width).toBeLessThanOrEqual(frame!.x + frame!.width + 1);
    expect(shown!.y + shown!.height).toBeLessThanOrEqual(frame!.y + frame!.height + 1);
    await expect(historyPointTexts(page).then((texts) => texts.length)).resolves.toBe(1);
  });

  test('A9-E6 a history of five thousand runs opens in seconds, with every point, and the ranges answer at once', async ({ browser, baseURL, guard }) => {
    test.setTimeout(180_000);
    const made = await newRunner('a9-big');
    // Five thousand runs over fourteen years, one every day and a bit, with paces and distances that move, a quarter of them with a heart rate.
    const day = 24 * 3600 * 1000;
    const first = Date.now() - 5000 * 1.0 * day;
    const runs = Array.from({ length: 5000 }, (_, index) => {
      const km = 5 + (index % 7);
      const pace = 300 + ((index * 37) % 60);
      return {
        id: 10_000 + index,
        name: `Big ${index}`,
        startTime: new Date(first + index * day + 6 * 3600 * 1000).toISOString().slice(0, 19),
        distanceKm: km,
        movingTimeSeconds: Math.round(km * pace),
        averageHeartRate: index % 4 === 0 ? 150 : null,
        maxHeartRate: index % 4 === 0 ? 170 : null,
        runType: index % 250 === 0 ? 'RACE' : null,
      };
    });
    const page = await pages.open(browser, baseURL, guard, whoOf(made), null);
    await page.route('**/api/activities/analysis', (route) => route.fulfill({ json: runs }));
    const began = Date.now();
    await page.goto(VO2_ROUTE);
    await openVo2Evidence(page);
    await expect(historySection(page)).toBeVisible({ timeout: 30_000 });
    await expect(historyChart(page)).toBeVisible();
    const opened = Date.now() - began;

    await rangeChip(page, 'All').click();
    const clicked = Date.now();
    await expect(historyDots(page)).toHaveCount(5001);
    const drawn = Date.now() - clicked;
    await expect(yearsTable(page).locator('tbody tr')).toHaveCount(new Set(runs.map((run) => run.startTime.slice(0, 4))).size);
    await expect(racesTable(page).locator('tbody tr')).toHaveCount(20);
    console.log(`A9-E6: page open ${opened} ms, all 5,001 points ${drawn} ms`);
    expect(opened, 'the page opens').toBeLessThan(15_000);
    expect(drawn, 'the longest range is drawn').toBeLessThan(10_000);

    // The line can still be read a point at a time: the keyboard and the pointer each answer at once, over five thousand points.
    const slider = historyChart(page);
    const reading = Date.now();
    await slider.focus();
    await page.keyboard.press('Home');
    await expect(slider).toHaveAttribute('aria-valuenow', '0');
    await expect(slider.locator('.vo2max-estimates-v2__tooltip')).toBeVisible();
    const frame = (await slider.boundingBox()) as { x: number; y: number; width: number; height: number };
    for (const fraction of [0.2, 0.5, 0.8]) await page.mouse.move(frame.x + frame.width * fraction, frame.y + frame.height / 2);
    await expect(slider).not.toHaveAttribute('aria-valuenow', '0');
    const read = Date.now() - reading;
    console.log(`A9-E6: reading points of 5,001 ${read} ms`);
    expect(read, 'a point is read at once').toBeLessThan(3000);
  });

  test('A9-E7 the range buttons work from the keyboard: Enter and Space press them, and the focus stays on the one pressed', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('a9-keys');
    await importRunSpecs(made.api, [60, 45, 30, 15, 5].map((daysBack): RunSpec => ({ name: `E2E a9k ${daysBack}`, daysBack, km: 5, pace: 300 - daysBack / 5, hr: null })), { wait: false });
    const page = await pages.open(browser, baseURL, guard, whoOf(made), VO2_ROUTE);
    await openVo2Evidence(page);
    await expect(historyChart(page)).toBeVisible();
    await expect(rangeChip(page, '1 yr')).toHaveAttribute('aria-pressed', 'true');

    await rangeChip(page, '6 mo').focus();
    await page.keyboard.press('Enter');
    await expect(rangeChip(page, '6 mo')).toHaveAttribute('aria-pressed', 'true');
    await expect(rangeChip(page, '1 yr')).toHaveAttribute('aria-pressed', 'false');
    await expect(rangeChip(page, '6 mo')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(rangeChip(page, '1 yr')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(rangeChip(page, 'All')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(rangeChip(page, 'All')).toHaveAttribute('aria-pressed', 'true');
    await expect(rangeChip(page, 'All')).toBeFocused();
    await expect(historyDots(page)).toHaveCount(6);
  });
});

test.describe('X the network and the session: slow, gone, expired', () => {
  test('X-NET1 on a slow network both pages say they are loading, show no error, and then show the numbers', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const made = await newRunner('x-slow');
    await importRunSpecs(made.api, [40, 30, 20, 10, 3].map((daysBack): RunSpec => ({ name: `E2E x-slow d${daysBack}`, daysBack, km: 6, pace: 320, hr: 145 })), { wait: false });
    const page = await pages.open(browser, baseURL, guard, whoOf(made), null);
    const slow = async (route: import('@playwright/test').Route): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    };
    await page.route('**/api/activities/analysis', slow);

    await page.goto(VO2_ROUTE);
    const analysisLoading = page.locator('[data-loading-state="analysis"]');
    await expect(analysisLoading.getByRole('status')).toContainText('Loading your analysis');
    await expect(analysisLoading.locator('[aria-busy="true"]')).toHaveCount(1);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await openVo2Evidence(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Your VO2max over time' })).toBeVisible({ timeout: 20_000 });
    await expect(analysisLoading).toHaveCount(0);

    await page.goto(LOAD_ROUTE);
    const loadLoading = page.locator('[data-loading-state="analysis-load"]');
    await expect(loadLoading.getByRole('status')).toContainText('Loading load balance');
    await expect(loadLoading.locator('[aria-busy="true"]')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 2, name: 'Acute vs. chronic load' })).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Acute vs. chronic load' })).toBeVisible({ timeout: 20_000 });
    await expect(loadCard(page, 'Strain')).toBeVisible();
  });

  test('X-NET2 when the runs cannot be fetched both pages say so and offer to try again, and trying again works once the network is back', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    guard.allow(/Failed to load resource|net::ERR_/);
    const made = await newRunner('x-gone');
    await importRunSpecs(made.api, [40, 30, 20, 10, 3].map((daysBack): RunSpec => ({ name: `E2E x-gone d${daysBack}`, daysBack, km: 6, pace: 320, hr: 145 })), { wait: false });
    const page = await pages.open(browser, baseURL, guard, whoOf(made), null);

    await page.route('**/api/activities/analysis', (route) => route.abort());
    await page.goto(VO2_ROUTE);
    await expect(page.getByRole('alert')).toContainText('Unable to load analysis right now.');
    await expect(page.getByRole('heading', { level: 2, name: 'Your VO2max over time' })).toHaveCount(0);
    await page.unroute('**/api/activities/analysis');
    await page.getByRole('button', { name: 'Try again' }).click();
    await openVo2Evidence(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Your VO2max over time' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    await page.route('**/api/activities/analysis', (route) => route.abort());
    await page.goto(LOAD_ROUTE);
    await expect(page.getByRole('alert')).toContainText('Unable to load analysis right now.');
    await page.unroute('**/api/activities/analysis');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Acute vs. chronic load' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('X-SES1 with a session that has run out both pages go to the sign-in page and show no numbers', async ({ browser, baseURL, guard }) => {
    guard.allow(/status of 401/);
    for (const route of [VO2_ROUTE, LOAD_ROUTE]) {
      const page = await pages.open(browser, baseURL, guard, { token: 'expired.session.token', email: 'gone@example.com' }, route);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('heading', { level: 2, name: /Acute vs\. chronic load|Your VO2max over time/ })).toHaveCount(0);
    }
  });
});

test.describe('A8 and A9: whose runs they are', () => {
  test('A8-N1 each runner sees their own races and their own line, and nothing of anyone else\'s', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const racer = await newRunner('a8-mine');
    const other = await newRunner('a8-theirs');
    const ids = await importRunSpecs(racer.api, [
      { name: 'E2E mine easy', daysBack: 30, km: 5, pace: 300, hr: null },
      { name: 'E2E mine race', daysBack: 9, km: 10, pace: 270, hr: null },
    ], { wait: false });
    const flagged = await racer.api.patch(`/api/activities/${ids[1]}`, { runType: 'RACE' });
    expect(flagged.status, JSON.stringify(flagged.json)).toBe(200);
    await importRunSpecs(other.api, [
      { name: 'E2E theirs one', daysBack: 21, km: 6, pace: 340, hr: null },
      { name: 'E2E theirs two', daysBack: 12, km: 6, pace: 336, hr: null },
      { name: 'E2E theirs three', daysBack: 4, km: 6, pace: 330, hr: null },
    ], { wait: false });

    // The race is in the list the page loads. (Twice in about two hundred runs of this case it was not, a moment after the patch said it was
    // saved; it has not been seen again, and the case now waits and says what it saw if it is still not there.)
    let listed = await rowsOf(racer.api);
    for (let attempt = 0; attempt < 20 && !listed.some((row) => row.runType === 'RACE'); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      listed = await rowsOf(racer.api);
      test.info().annotations.push({ type: 'late', description: `the race was not in the list after ${attempt + 1} look(s) (the run is ${ids[1]}, the patch said ${JSON.stringify(flagged.json)})` });
    }
    expect(listed.filter((row) => row.runType === 'RACE').map((row) => row.name), `the list the page loads has the race (the run is ${ids[1]}, the patch said ${JSON.stringify(flagged.json)}, the list: ${JSON.stringify(listed.map((row) => [row.id, row.name, row.runType]))})`).toEqual(['E2E mine race']);
    const mine = await pages.open(browser, baseURL, guard, whoOf(racer), VO2_ROUTE);
    await openVo2Evidence(mine);
    const theirs = await pages.open(browser, baseURL, guard, whoOf(other), VO2_ROUTE);
    await openVo2Evidence(theirs);
    await expect(racesTable(mine).locator('tbody tr')).toHaveCount(1);
    await expect(racesTable(mine)).toContainText('E2E mine race');
    await expect(mine.locator('body')).not.toContainText('E2E theirs');
    await expect(historySection(theirs)).toBeVisible();
    await expect(theirs.getByRole('heading', { level: 2, name: 'Your races against the number' })).toBeVisible();
    await expect(racesTable(theirs)).toHaveCount(0);
    await expect(theirs.locator('body')).not.toContainText('E2E mine');
    await expect(historyDots(theirs)).toHaveCount(4);
    await expect(historyDots(mine)).toHaveCount(3);
  });
});

test.describe('X the marks of the charts are visible in every theme', () => {
  const THEMES = ['light', 'midnight', 'high-contrast', 'high-contrast-light'];

  for (const theme of THEMES) {
    test(`X-A2 the bars of the effort strip and the race flag show 3 to 1 against the card in the ${theme} theme`, async ({ browser, baseURL, guard }) => {
      test.setTimeout(480_000);
      const runner = await sharedHistoryRunner('fitness', 14);
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(LOAD_ROUTE);
      await expect(page.locator('.analysis-fit-v2-effort-bars')).toBeVisible();
      const found = await markRatios(page, [{ selector: '.analysis-fit-v2-effort-bars', paint: 'fill', what: 'the bars of daily effort' }]);
      for (const item of found) {
        test.info().annotations.push({ type: 'ratio', description: `${theme}: ${item.what} ${item.mark} on ${item.behind} = ${item.ratio.toFixed(2)}` });
        expect(item.ratio, `${item.what}: ${item.mark} on ${item.behind}`).toBeGreaterThanOrEqual(3);
      }
    });

    test(`X-A3 the line, the dots and the hollow dots of the VO2max history show 3 to 1 against the card in the ${theme} theme`, async ({ browser, baseURL, guard }) => {
      test.setTimeout(240_000);
      const made = await newRunner(`x-marks-${theme}`);
      await importRunSpecs(made.api, [70, 63, 56, 49, 42, 35, 28, 21, 14, 7].map((daysBack): RunSpec => ({ name: `E2E marks ${daysBack}`, daysBack, km: 5, pace: 300 + (daysBack % 4) * 6, hr: null })), { wait: false });
      const page = await pages.open(browser, baseURL, guard, whoOf(made), null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(VO2_ROUTE);
      await openVo2Evidence(page);
      await expect(historyChart(page)).toBeVisible();
      await expect(historyChart(page).locator('circle.is-thin')).not.toHaveCount(0);
      await historyChart(page).focus();
      await expect(historyChart(page).locator('circle.vo2max-estimates-v2__history-selected')).toHaveCount(1);
      const found = await markRatios(page, [
        { selector: '.vo2max-estimates-v2__history-line', paint: 'stroke', what: 'the line of the number' },
        { selector: 'circle.vo2max-estimates-v2__history-selected', paint: 'stroke', what: 'the ring on the point read' },
        { selector: 'line.vo2max-estimates-v2__history-cross', paint: 'stroke', what: 'the line through the point read' },
        { selector: 'circle.vo2max-estimates-v2__history-dot:not(.is-thin):not(.is-now)', paint: 'fill', what: 'a dot' },
        { selector: 'circle.vo2max-estimates-v2__history-dot.is-thin', paint: 'stroke', what: 'the ring of a hollow dot' },
      ]);
      for (const item of found) {
        test.info().annotations.push({ type: 'ratio', description: `${theme}: ${item.what} ${item.mark} on ${item.behind} = ${item.ratio.toFixed(2)}` });
        expect(item.ratio, `${item.what}: ${item.mark} on ${item.behind}`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});

test.describe('X the parts of Load balance: a list at the top that takes the reader to one, and the Training log link to the fitness card', () => {
  const PARTS = [
    { id: 'load-chart', label: 'Acute vs. chronic load' },
    { id: 'load-fitness', label: 'Fitness, fatigue and form' },
    { id: 'load-weekly-effort', label: 'Weekly effort' },
    { id: 'load-distance', label: 'Weekly distance' },
    { id: 'load-intensity', label: 'Time in zones' },
    { id: 'load-drivers', label: 'What drove this week\'s load' },
  ];
  const jumpList = (page: Page): Locator => page.getByRole('navigation', { name: 'On this page' });
  const topOf = (page: Page, id: string): Promise<number> => page.locator(`#${id}`).evaluate((node) => Math.round(node.getBoundingClientRect().top));
  const focusedId = (page: Page): Promise<string | undefined> => page.evaluate(() => document.activeElement?.id);
  /** The lowest edge of whatever is stuck to the top of the screen (the page's own header): a part that has been jumped to has to begin below it. */
  const stuckBottom = (page: Page): Promise<number> =>
    page.evaluate(() => {
      const stuck = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((node) => {
        const position = getComputedStyle(node).position;
        const box = node.getBoundingClientRect();
        return (position === 'fixed' || position === 'sticky') && box.top <= 1 && box.bottom > 0 && box.width > window.innerWidth / 2;
      });
      return Math.max(0, ...stuck.map((node) => node.getBoundingClientRect().bottom));
    });
  /** The page is drawn: the heading, the fitness chart and nothing still loading, so nothing above a part moves after the reader has been taken to it. */
  const settled = async (page: Page): Promise<void> => {
    await expect(page.getByRole('heading', { level: 2, name: 'Acute vs. chronic load' })).toBeVisible();
    await expect(page.getByRole('slider', { name: /^Fitness, fatigue and form for \d+ days/ })).toBeVisible();
    await expect(page.locator('#root [class*="skeleton"]')).toHaveCount(0);
  };

  test('X-NAV1 (BUG-046) the Training log link to the fitness card lands on the card, below the header, and not at the top of the page', async ({ browser, baseURL, guard }) => {
    test.setTimeout(480_000);
    const runner = await sharedHistoryRunner('fitness', 14);
    const page = await pages.open(browser, baseURL, guard, runner, '/training-log');
    await page.getByRole('navigation', { name: 'Related pages' }).getByRole('link', { name: 'Fitness and form' }).click();

    await expect(page).toHaveURL(/\/analysis\/load-balance#load-fitness$/);
    await settled(page);
    await expect.poll(() => topOf(page, 'load-fitness'), { message: 'the fitness card has come up to the top of the screen' }).toBeLessThan(300);
    expect(await topOf(page, 'load-fitness'), 'and it is below the header, not under it').toBeGreaterThanOrEqual((await stuckBottom(page)) - 1);
    expect(await page.evaluate(() => window.scrollY), 'the page is not at the top').toBeGreaterThan(400);
    await expect.poll(() => focusedId(page), { message: 'and the keyboard is in the card' }).toBe('load-fitness');
  });

  test('X-NAV2 each link of the list takes the reader to its part, below the header, with the focus there, and the next Tab goes into the part', async ({ browser, baseURL, guard }) => {
    test.setTimeout(480_000);
    const runner = await sharedHistoryRunner('fitness', 14);
    const page = await pages.open(browser, baseURL, guard, runner, LOAD_ROUTE);
    await settled(page);
    await expect(jumpList(page).getByRole('link')).toHaveText(PARTS.map((part) => part.label));
    const below = await stuckBottom(page);
    const viewportHeight = page.viewportSize()?.height ?? 900;

    // Not in the order of the page, so jumps go up as well as down; every other one with the mouse, the rest from the keyboard.
    for (const [step, index] of [4, 1, 5, 0, 2, 3].entries()) {
      const { id, label } = PARTS[index];
      const link = jumpList(page).getByRole('link', { name: label, exact: true });
      if (step % 2 === 0) {
        await link.click();
      } else {
        await link.focus();
        await page.keyboard.press('Enter');
      }

      await expect.poll(() => focusedId(page), { message: `the focus is in "${label}"` }).toBe(id);
      await expect.poll(async () => {
        const top = await topOf(page, id);
        return top >= below - 1 && top < viewportHeight - 100;
      }, { message: `"${label}" begins on the screen, below the header` }).toBe(true);
      await page.keyboard.press('Tab');
      expect(await page.evaluate((part) => document.getElementById(part)?.contains(document.activeElement) ?? false, id), `Tab goes from "${label}" into it`).toBe(true);
      expect(new URL(page.url()).hash, 'the address is as it was').toBe('');
    }
  });

  test('X-NAV3 an address that names a part goes to the part once the page is drawn, and one that names nothing leaves the page at the top', async ({ browser, baseURL, guard }) => {
    test.setTimeout(480_000);
    const runner = await sharedHistoryRunner('fitness', 14);
    for (const id of ['load-weekly-effort', 'load-intensity']) {
      const page = await pages.open(browser, baseURL, guard, runner, `${LOAD_ROUTE}#${id}`);
      await settled(page);
      await expect.poll(() => topOf(page, id), { message: `${id} has come up to the top of the screen` }).toBeLessThan(300);
      await expect.poll(() => focusedId(page), { message: `and the keyboard is in it` }).toBe(id);
    }
    for (const fragment of ['nothing-here', '%E0%A4%A', '']) {
      const page = await pages.open(browser, baseURL, guard, runner, `${LOAD_ROUTE}#${fragment}`);
      await settled(page);
      await page.waitForTimeout(600);
      expect(await page.evaluate(() => window.scrollY), `#${fragment} leaves the page at the top`).toBe(0);
    }
  });

  test('X-NAV5 (BUG-048) an address that names a part, on a slow network: the part stays at the top while the card above it gets its numbers six seconds late', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const runner = await sharedHistoryRunner('fitness', 14);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    // The numbers of the fitness card arrive after the four seconds the page used to hold a part for.
    await page.route('**/api/training/series**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      await route.continue();
    });
    await page.goto(`${LOAD_ROUTE}#load-weekly-effort`);
    await expect(page.getByRole('heading', { level: 2, name: 'Acute vs. chronic load' })).toBeVisible();
    await expect.poll(() => topOf(page, 'load-weekly-effort'), { message: 'the part is at the top while the card above it is still a skeleton' }).toBeLessThan(300);

    await expect(page.getByRole('slider', { name: /^Fitness, fatigue and form for/ })).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => topOf(page, 'load-weekly-effort'), { message: 'and when that card has filled in and pushed it down', timeout: 5000 }).toBeLessThan(300);
    await page.waitForTimeout(1500);
    expect(await topOf(page, 'load-weekly-effort'), 'and stays there').toBeLessThan(300);
    expect(await topOf(page, 'load-weekly-effort')).toBeGreaterThanOrEqual((await stuckBottom(page)) - 1);
  });

  test('X-NAV6 (BUG-049) every part the focus is taken to is a region with a name, so that a screen reader says where the reader is', async ({ browser, baseURL, guard }) => {
    test.setTimeout(480_000);
    const runner = await sharedHistoryRunner('fitness', 14);
    const page = await pages.open(browser, baseURL, guard, runner, LOAD_ROUTE);
    await settled(page);

    for (const { id, label } of PARTS) {
      const region = page.getByRole('region', { name: label, exact: true });
      await expect(region, `"${label}" is a region`).toHaveCount(1);
      await expect(region).toHaveAttribute('id', id);
      await jumpList(page).getByRole('link', { name: label, exact: true }).click();
      await expect(region, `the focus is on "${label}"`).toBeFocused();
    }
  });

  test('X-NAV7 the jump list and the fragment under hand-made use: Back and Forward, a double click, and a reader who scrolls at once is not pulled back', async ({ browser, baseURL, guard }) => {
    test.setTimeout(480_000);
    const runner = await sharedHistoryRunner('fitness', 14);
    const page = await pages.open(browser, baseURL, guard, runner, '/training-log');
    await page.getByRole('navigation', { name: 'Related pages' }).getByRole('link', { name: 'Fitness and form' }).click();
    await settled(page);
    await expect.poll(() => topOf(page, 'load-fitness')).toBeLessThan(300);

    await page.goBack();
    await expect(page).toHaveURL(/\/runs#training-log$/);
    await page.goForward();
    await settled(page);
    await expect.poll(() => topOf(page, 'load-fitness'), { message: 'Forward lands on the card again' }).toBeLessThan(300);

    await jumpList(page).getByRole('link', { name: 'Weekly effort', exact: true }).dblclick();
    await expect.poll(() => focusedId(page)).toBe('load-weekly-effort');
    await expect.poll(() => topOf(page, 'load-weekly-effort'), { message: 'a double click lands once, on the part' }).toBeLessThan(300);

    // A reader who scrolls the moment the page is drawn is not taken back to the part.
    const hurried = await pages.open(browser, baseURL, guard, runner, `${LOAD_ROUTE}#load-intensity`);
    await expect(jumpList(hurried)).toBeVisible();
    await hurried.mouse.move(700, 500);
    await hurried.mouse.wheel(0, -900);
    const afterWheel = await hurried.evaluate(() => window.scrollY);
    await hurried.waitForTimeout(4500);
    expect(await hurried.evaluate(() => window.scrollY), 'left where the reader put it').toBe(afterWheel);
  });

  test('X-NAV8 with reduced motion a jump is at once, not a glide', async ({ browser, baseURL, guard }) => {
    test.setTimeout(480_000);
    const runner = await sharedHistoryRunner('fitness', 14);
    const page = await pages.open(browser, baseURL, guard, runner, LOAD_ROUTE, { reducedMotion: 'reduce' });
    await settled(page);
    await jumpList(page).getByRole('link', { name: 'Time in zones', exact: true }).click();
    const early = await page.evaluate(() => window.scrollY);
    await expect.poll(() => focusedId(page)).toBe('load-intensity');
    await page.waitForTimeout(1200);

    expect(early, 'the page was already where it ends up').toBe(await page.evaluate(() => window.scrollY));
    expect(early).toBeGreaterThan(1000);
  });

  test('X-NAV4 @mobile on a phone the list wraps inside the page, each link is a target of at least 24 px, and a jump still lands below the header', async ({ browser, baseURL, guard }) => {
    test.setTimeout(480_000);
    const runner = await sharedHistoryRunner('fitness', 14);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(LOAD_ROUTE);
    await settled(page);
    await expectNoHorizontalOverflow(page);

    const list = await jumpList(page).boundingBox();
    expect(list!.width, 'the list is inside the phone').toBeLessThanOrEqual(390);
    for (const link of await jumpList(page).getByRole('link').all()) {
      const box = await link.boundingBox();
      expect(box!.height, await link.textContent() ?? '').toBeGreaterThanOrEqual(24);
      expect(box!.width).toBeGreaterThanOrEqual(24);
    }
    await jumpList(page).getByRole('link', { name: 'Time in zones', exact: true }).click();
    await expect.poll(() => focusedId(page)).toBe('load-intensity');
    await expect.poll(async () => {
      const top = await topOf(page, 'load-intensity');
      return top >= (await stuckBottom(page)) - 1 && top < 700;
    }, { message: 'the part begins on the screen, below the header' }).toBe(true);
    await expectNoHorizontalOverflow(page);
  });
});
