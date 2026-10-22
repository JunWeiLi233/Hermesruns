// A10 Weekly distance, a card of the Load balance page that came out of the Runalyze review (F35, the moving-average mileage): how far the runner ran in each of the last
// weeks, with a line through the average of the four weeks to each week that is over.
//
// Every week is worked out again here, in this file, from the runs the API lists and the rule of the methods document (docs/README-ANALYSIS.md, "Weekly Distance and
// its Moving Average"): Monday to Sunday on the runner's own calendar, a week with no run a real zero, the average of a week that is over and has three weeks of history before
// it. So a card that put a run in the wrong week, left out a rest week or averaged the wrong weeks fails.
import type { Locator, Page } from '@playwright/test';
import { Api, freshClientAddress, newRunner } from '../fixtures/api.ts';
import { KM_PER_MILE, importRunSpecs, sharedRunner, type RunSpec } from '../fixtures/analysis.ts';
import { addDays, shortDay, utcDay, weekStartOf } from '../fixtures/format.ts';
import { gpxRun } from '../fixtures/gpx.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { markRatios } from '../fixtures/marks.ts';
import { elementsBeyondTheEdge, enlargeText, readingsThatCollide, readoutSticksOut } from '../fixtures/reflow.ts';
import { browserToday } from '../fixtures/strain.ts';
import { a11yViolations, contrastProblems, expect, expectNoHorizontalOverflow, expectNoRawKeys, test } from '../fixtures/test.ts';

const ROUTE = '/analysis/load-balance';
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

async function setProfileUnits(api: Api, units: 'metric' | 'imperial' = 'metric'): Promise<void> {
  const profile = (await api.get('/api/training/me')).json;
  if (profile.units === units) return;
  const saved = await api.request('PATCH', '/api/training/me', {
    body: { units }, headers: { 'If-Match': String(profile.revision), 'Idempotency-Key': crypto.randomUUID() },
  });
  expect(saved.status).toBe(200);
}

test.beforeEach(async () => {
  runner.api.clientIp = freshClientAddress();
  await setProfileUnits(runner.api);
});

interface Row {
  id: number;
  name: string;
  distanceKm: number;
  startTime: string;
}
interface Week {
  start: string;
  km: number;
  runs: number;
  open: boolean;
  average: number | null;
}
type Box = { x: number; y: number; width: number; height: number };

const rowsOf = async (api: Api): Promise<Row[]> => {
  const response = await api.get('/api/activities/analysis');
  expect(response.status, 'analysis activity list status').toBe(200);
  expect(Array.isArray(response.json), 'analysis returns the owner activity list').toBe(true);
  return response.json;
};
const whoOf = (made: { api: Api; email: string }): { token: string; email: string } => ({ token: made.api.token as string, email: made.email });

/** The runner's today as the page counts it: the date on the device, or the date of the latest run when that is ahead of it by two days at most. */
function runnersToday(rows: Row[]): string {
  const device = browserToday();
  const limit = addDays(device, 2);
  return rows.map((row) => row.startTime.slice(0, 10)).filter((day) => day > device && day <= limit).sort().pop() ?? device;
}

/** Every week from the first run's to this one, oldest first, with the average of four weeks for a week that is over and has three before it. */
function weeksOf(rows: Row[], today = runnersToday(rows)): Week[] {
  const sums = new Map<string, { km: number; runs: number }>();
  for (const row of rows) {
    const day = row.startTime.slice(0, 10);
    if (!(row.distanceKm > 0) || day > today) continue;
    const start = weekStartOf(day);
    const found = sums.get(start) ?? { km: 0, runs: 0 };
    found.km += row.distanceKm;
    found.runs += 1;
    sums.set(start, found);
  }
  const first = [...sums.keys()].sort()[0];
  const thisWeek = weekStartOf(today);
  const weeks: Week[] = [];
  for (let start = first; start <= thisWeek; start = addDays(start, 7)) {
    const found = sums.get(start);
    weeks.push({ start, km: found?.km ?? 0, runs: found?.runs ?? 0, open: start === thisWeek, average: null });
  }
  weeks.forEach((week, index) => {
    if (week.open || index < 3) return;
    week.average = (weeks[index].km + weeks[index - 1].km + weeks[index - 2].km + weeks[index - 3].km) / 4;
  });
  return weeks;
}

const km1 = (km: number): string => `${km.toFixed(1)} km`;
const runsText = (count: number): string => (count === 0 ? 'No run' : count === 1 ? '1 run' : `${count} runs`);

const card = (page: Page): Locator => page.locator('#load-distance');
const chart = (page: Page): Locator => card(page).getByRole('slider', { name: /^Distance for each of the last/ });
const readout = (page: Page): Locator => chart(page).locator('.analysis-wd-tooltip');
const bars = (page: Page): Locator => chart(page).locator('rect.analysis-fit-v2-bar.is-distance');
const rangeChip = (page: Page, label: string): Locator => card(page).getByRole('group', { name: 'Time range' }).getByRole('button', { name: label, exact: true });
const tile = (page: Page, label: string): Locator => card(page).getByRole('region', { name: /^This week so far/ }).locator('article').filter({ has: page.getByText(label, { exact: true }) });

/** The table for a screen reader, as rows of text: the week, then the distance, the runs and the average. */
const tableOf = (page: Page): Promise<string[][]> =>
  card(page).locator('table[data-analysis-history="distance"] tbody tr').evaluateAll((rows) => rows.map((row) => [
    (row.querySelector('th') as HTMLElement).textContent as string,
    ...Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent as string),
  ]));
const expectedTable = (weeks: Week[]): string[][] => weeks.map((week) => [
  `Week of ${shortDay(week.start)}${week.open ? ', still going' : ''}`,
  km1(week.km),
  String(week.runs),
  week.average != null ? km1(week.average) : '–',
]);
/** What the slider says for a week. */
const said = (week: Week): string => [
  `Week of ${shortDay(week.start)}${week.open ? ', still going' : ''}: ${km1(week.km)}`,
  runsText(week.runs),
  week.average != null ? `4-week average ${km1(week.average)}` : null,
].filter(Boolean).join(', ');

/**
 * Thirty blocks of seven days of running, two runs in most, from today back, and three blocks in the middle with none (so there are rest weeks of a real zero
 * inside the history and the average has to count them).
 */
const FIXTURE: RunSpec[] = Array.from({ length: 30 }, (_, block) => block).flatMap((block): RunSpec[] => {
  if (block >= 17 && block <= 19) return [];
  const specs: RunSpec[] = [{ name: `E2E a10 ${block} a`, daysBack: 7 * block + 1, km: 5 + ((block * 3) % 7), pace: 330, hr: null }];
  if (block % 3 !== 2) specs.push({ name: `E2E a10 ${block} b`, daysBack: 7 * block + 4, km: 8 + ((block * 5) % 6), pace: 330, hr: null });
  return specs;
});

let runner: Awaited<ReturnType<typeof sharedRunner<null>>>;

test.beforeAll(async () => {
  test.setTimeout(900_000);
  runner = await sharedRunner('a10', async ({ api }) => {
    await importRunSpecs(api, FIXTURE, { wait: false });
    return null;
  });
});

async function openCard(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 2, name: 'Weekly distance' })).toBeVisible();
  await expect(chart(page)).toBeVisible();
}

test.describe('A10 weekly distance: what the card says', () => {
  test('A10-H1 each week of the range is a row with its distance, its runs and its four-week average, worked out again from the runs', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    const weeks = weeksOf(await rowsOf(runner.api));
    expect(weeks.length, 'the fixture has more weeks than the first range shows').toBeGreaterThan(26);
    expect(weeks.filter((week) => week.km === 0).length, 'and has weeks of rest inside it').toBeGreaterThanOrEqual(2);

    await expect(rangeChip(page, '26 weeks')).toHaveAttribute('aria-pressed', 'true');
    expect(await tableOf(page)).toEqual(expectedTable(weeks.slice(-26)));
    await expect(bars(page)).toHaveCount(26);
    await expect(chart(page).locator('rect.is-open')).toHaveCount(1);
  });

  test('A10-H2 the ranges are 12 weeks, 26 and 52, and follow the weeks there are', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    const weeks = weeksOf(await rowsOf(runner.api));

    for (const [label, count] of [['12 weeks', 12], ['52 weeks', Math.min(52, weeks.length)], ['26 weeks', 26]] as const) {
      await rangeChip(page, label).click();
      await expect(rangeChip(page, label)).toHaveAttribute('aria-pressed', 'true');
      await expect(bars(page)).toHaveCount(count);
      expect(await tableOf(page)).toEqual(expectedTable(weeks.slice(-count)));
      await expect(chart(page)).toHaveAttribute('aria-valuemax', String(count - 1));
    }
  });

  test('A10-H3 the three readings are this week so far, the average of the last four weeks that are over, and the highest of them in the range', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    const weeks = weeksOf(await rowsOf(runner.api));
    const open = weeks[weeks.length - 1];
    const finished = weeks.slice(0, -1);
    const lastAverage = [...finished].reverse().find((week) => week.average != null) as Week;

    await expect(tile(page, 'This week so far').locator('strong')).toHaveText(km1(open.km));
    await expect(tile(page, 'This week so far').locator('small')).toHaveText(runsText(open.runs));
    await expect(tile(page, 'Last 4 weeks').locator('strong')).toHaveText(km1(lastAverage.average as number));
    await expect(tile(page, 'Last 4 weeks').locator('small')).toHaveText(`a week on average, to the week of ${shortDay(lastAverage.start)}`);

    for (const [label, count] of [['12 weeks', 12], ['26 weeks', 26], ['52 weeks', 52]] as const) {
      await rangeChip(page, label).click();
      const inRange = finished.slice(-(count - 1));
      const highest = inRange.reduce((top, week) => (week.km >= top.km ? week : top));
      await expect(tile(page, 'Highest week').locator('strong'), label).toHaveText(km1(highest.km));
      await expect(tile(page, 'Highest week').locator('small'), label).toHaveText(`Week of ${shortDay(highest.start)}`);
      // The average is the last finished week's whatever the range.
      await expect(tile(page, 'Last 4 weeks').locator('strong'), label).toHaveText(km1(lastAverage.average as number));
    }
  });

  test('A10-H4 a bar is as tall as its distance, the line has a dot for each week with an average, and a dot is as high as its average', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    const shown = weeksOf(await rowsOf(runner.api)).slice(-26);

    const heights = await bars(page).evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('height'))));
    expect(heights).toHaveLength(shown.length);
    const tall = shown.map((week, index) => ({ week, height: heights[index] })).filter((item) => item.week.km >= 5);
    const biggest = tall.reduce((top, item) => (item.week.km > top.week.km ? item : top));
    for (const item of tall) {
      expect(item.height / biggest.height, `the week of ${item.week.start}`).toBeCloseTo(item.week.km / biggest.week.km, 1);
    }
    for (const [index, week] of shown.entries()) if (week.km === 0) expect(heights[index], `a week of rest has no bar (${week.start})`).toBe(0);

    const withAverage = shown.filter((week) => week.average != null);
    const dots = await chart(page).locator('circle.analysis-wd-average-dot').evaluateAll((nodes) => nodes.map((node) => ({ x: Number(node.getAttribute('cx')), y: Number(node.getAttribute('cy')) })));
    expect(dots).toHaveLength(withAverage.length);
    // Left to right in the order of the weeks, and a higher average is a higher dot (a smaller y).
    expect(dots.map((dot) => dot.x)).toEqual([...dots.map((dot) => dot.x)].sort((a, b) => a - b));
    for (let index = 1; index < dots.length; index += 1) {
      const [before, now] = [withAverage[index - 1].average as number, withAverage[index].average as number];
      if (Math.abs(now - before) > 0.5) expect(now > before ? dots[index].y < dots[index - 1].y : dots[index].y > dots[index - 1].y, `the average of ${withAverage[index].start}`).toBe(true);
    }
    // A bar is under its own dot.
    const barXs = await bars(page).evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('x')) + Number(node.getAttribute('width')) / 2));
    const first = shown.findIndex((week) => week.average != null);
    expect(Math.abs(dots[0].x - barXs[first])).toBeLessThan(1);
  });

  test('A10-H5 the week going is drawn lighter and dashed, and has no average', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    const open = chart(page).locator('rect.is-open');

    await expect(open).toHaveCount(1);
    await expect(open).toHaveCSS('stroke-dasharray', /\d/);
    await expect(chart(page)).toHaveAttribute('aria-valuetext', /still going/);
    expect(await tableOf(page).then((rows) => rows[rows.length - 1][3])).toBe('–');
    const closed = chart(page).locator('rect.analysis-fit-v2-bar.is-distance:not(.is-open)').first();
    expect(Number(await open.evaluate((node) => getComputedStyle(node).fillOpacity))).toBeLessThan(Number(await closed.evaluate((node) => getComputedStyle(node).fillOpacity)));
  });
});

test.describe('A10 weekly distance: reading one week', () => {
  async function expectReadoutInChart(page: Page): Promise<void> {
    const frame = (await chart(page).boundingBox()) as Box;
    const tip = (await readout(page).boundingBox()) as Box;
    expect(tip.x, 'the readout starts inside the chart').toBeGreaterThanOrEqual(frame.x - 1);
    expect(tip.x + tip.width, 'and ends inside it').toBeLessThanOrEqual(frame.x + frame.width + 1);
    expect(tip.y).toBeGreaterThanOrEqual(frame.y - 1);
    expect(tip.y + tip.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
  }

  test('A10-K1 from the keyboard: Tab brings the chart the week going, and the arrows, Home, End and Escape move a week at a time', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    const shown = weeksOf(await rowsOf(runner.api)).slice(-26);
    const last = shown.length - 1;

    await expect(readout(page)).toHaveCount(0);
    await rangeChip(page, '52 weeks').focus();
    await page.keyboard.press('Tab');
    await expect(chart(page)).toBeFocused();
    await expect(chart(page)).toHaveAttribute('aria-valuenow', String(last));
    await expect(chart(page)).toHaveAttribute('aria-valuetext', said(shown[last]));
    await expect(readout(page).locator('time')).toHaveText(`Week of ${shortDay(shown[last].start)}`);
    await expect(readout(page)).toContainText('still going');

    await page.keyboard.press('ArrowLeft');
    await expect(chart(page)).toHaveAttribute('aria-valuetext', said(shown[last - 1]));
    await expect(readout(page)).toContainText(km1(shown[last - 1].km));
    await expect(readout(page)).toContainText(km1(shown[last - 1].average as number));
    await expect(readout(page)).not.toContainText('still going');
    await expect(chart(page).locator('rect.is-selected')).toHaveCount(1);

    await page.keyboard.press('Home');
    await expect(chart(page)).toHaveAttribute('aria-valuetext', said(shown[0]));
    await page.keyboard.press('ArrowLeft');
    await expect(chart(page)).toHaveAttribute('aria-valuenow', '0');
    await page.keyboard.press('End');
    await expect(chart(page)).toHaveAttribute('aria-valuenow', String(last));
    await page.keyboard.press('Escape');
    await expect(readout(page)).toHaveCount(0);
  });

  test('A10-K2 the whole range can be walked a week at a time, and every week says what the table says', async ({ browser, baseURL, guard }) => {
    test.setTimeout(120_000);
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    const shown = weeksOf(await rowsOf(runner.api)).slice(-26);

    await chart(page).focus();
    await page.keyboard.press('Home');
    for (const [index, week] of shown.entries()) {
      await expect(chart(page), `week ${index + 1} of ${shown.length}`).toHaveAttribute('aria-valuetext', said(week));
      if (index < shown.length - 1) await page.keyboard.press('ArrowRight');
    }
  });

  test('A10-K3 with the mouse: the readout follows the pointer to the nearest week and stays inside the chart, and goes when the pointer leaves', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    const shown = weeksOf(await rowsOf(runner.api)).slice(-26);
    await chart(page).scrollIntoViewIfNeeded();
    const box = (await chart(page).boundingBox()) as Box;
    const viewWidth = await chart(page).locator('svg').evaluate((node) => Number((node.getAttribute('viewBox') ?? '').split(' ')[2]));
    const centres = await bars(page).evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('x')) + Number(node.getAttribute('width')) / 2));
    const scale = box.width / viewWidth;

    for (const fraction of [0.1, 0.35, 0.5, 0.75, 0.97]) {
      const x = box.x + box.width * fraction;
      await page.mouse.move(x, box.y + box.height / 2);
      const nearest = centres.reduce((best, centre, index) => (Math.abs(centre * scale - (x - box.x)) < Math.abs(centres[best] * scale - (x - box.x)) ? index : best), 0);
      await expect(chart(page), `at ${Math.round(fraction * 100)}% of the width`).toHaveAttribute('aria-valuenow', String(nearest));
      await expect(chart(page)).toHaveAttribute('aria-valuetext', said(shown[nearest]));
      await expectReadoutInChart(page);
    }
    await card(page).getByRole('heading', { level: 2, name: 'Weekly distance' }).hover();
    await expect(readout(page)).toHaveCount(0);
  });

  test('A10-K4 with a finger: a tap picks a week and keeps it after the finger lifts, and a tap elsewhere lets go', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE, { hasTouch: true, viewport: { width: 390, height: 844 } });
    await openCard(page);
    await chart(page).scrollIntoViewIfNeeded();
    const box = (await chart(page).boundingBox()) as Box;

    await page.touchscreen.tap(box.x + box.width * 0.4, box.y + box.height / 2);
    await expect(readout(page)).toBeVisible();
    const picked = (await chart(page).getAttribute('aria-valuenow')) as string;
    await page.waitForTimeout(400);
    await expect(readout(page), 'the finger has lifted and the week is still read').toBeVisible();
    await expect(chart(page)).toHaveAttribute('aria-valuenow', picked);
    await expectReadoutInChart(page);
    await page.getByRole('heading', { level: 2, name: 'Weekly distance' }).tap();
    await expect(readout(page)).toHaveCount(0);
  });

  test('A10-M2 @mobile at 320 px with the text at 200% nothing of Load balance runs off the screen: the range chips wrap and so does the status of the week (BUG-050)', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(ROUTE);
    await openCard(page);
    await enlargeText(page, 200);
    await expect(page.locator('#load-weekly-effort .analysis-load-v2-zone')).toBeVisible();

    expect(await elementsBeyondTheEdge(page), 'elements cut off at the edge of a 320 px screen').toEqual([]);
    for (const chip of ['12 weeks', '26 weeks', '52 weeks']) {
      await rangeChip(page, chip).scrollIntoViewIfNeeded();
      const box = (await rangeChip(page, chip).boundingBox()) as Box;
      expect(box.x, `${chip} starts on the screen`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${chip} ends on the screen`).toBeLessThanOrEqual(320);
    }
  });

  for (const [width, percent] of [[1280, 150], [1280, 200], [390, 150], [390, 200]] as const) {
    test(`A10-K7 (BUG-054) at ${width} px with the text at ${percent}% the readout of a week stays inside the chart`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.setViewportSize({ width, height: 800 });
      await page.goto(ROUTE);
      await openCard(page);
      await enlargeText(page, percent);
      // A year of weeks, rests inside it: a week of rest has no bar and the readout is at the foot of the chart, where there is the least room.
      await rangeChip(page, '52 weeks').click();
      await chart(page).scrollIntoViewIfNeeded();
      await chart(page).focus();
      const count = Number(await chart(page).getAttribute('aria-valuemax')) + 1;
      await page.keyboard.press('Home');
      for (let index = 0; index < count; index += 1) {
        await expect(readout(page), `week ${index + 1}`).toBeVisible();
        expect(await readoutSticksOut(chart(page), '.analysis-wd-tooltip'), `week ${index + 1} of ${count}`).toBe('');
        if (index < count - 1) await page.keyboard.press('ArrowRight');
      }
    });
  }

  test('A10-M3 @mobile at 320 px with the text at 150% and 200% the name of a reading never runs into its number (BUG-053)', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(ROUTE);
    await openCard(page);
    for (const percent of [150, 200]) {
      await enlargeText(page, percent);
      expect(await readingsThatCollide(page, '#load-distance .analysis-load-v2-metric'), `the three readings at ${percent}%`).toEqual([]);
    }
  });

  for (const theme of ['light', 'midnight', 'high-contrast', 'high-contrast-light']) {
    test(`A10-K6 the readout of a week of distance, of a day of fitness and of a week of effort is on a solid background in the ${theme} theme`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await openCard(page);
      const sliders = [chart(page), page.getByRole('slider', { name: /^Fitness, fatigue and form for/ }), page.getByRole('slider', { name: /^Effort for each of the last/ })];
      for (const slider of sliders) {
        await slider.focus();
        const tip = slider.locator('.analysis-fit-v2-tooltip');
        await expect(tip).toBeVisible();
        // A colour with an alpha under 1 is written rgba(...): a bar or a line behind such a readout shows through its words.
        expect(await tip.evaluate((node) => getComputedStyle(node).backgroundColor), `${theme}: ${await slider.getAttribute('aria-label')}`).toMatch(/^rgb\(/);
      }
    });
  }

  test('A10-K5 @mobile on a phone the card fits, and the readout of every week of the range is inside the chart', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await page.setViewportSize({ width: 375, height: 812 });
    await openCard(page);
    await chart(page).scrollIntoViewIfNeeded();
    await expectNoHorizontalOverflow(page);
    const frame = (await chart(page).boundingBox()) as Box;
    expect(frame.width).toBeLessThanOrEqual(375);
    for (const chip of ['12 weeks', '26 weeks', '52 weeks']) expect(((await rangeChip(page, chip).boundingBox()) as Box).height).toBeGreaterThanOrEqual(30);
    // The three readings are the rows of one card: a name and its number on one line, and the three together under 260 px.
    const tiles = card(page).getByRole('region', { name: /^This week so far/ });
    expect(((await tiles.boundingBox()) as Box).height).toBeLessThan(260);
    for (const index of [0, 1, 2]) {
      const tops = await tiles.locator('article').nth(index).evaluate((article) => ['span', 'strong', 'small'].map((tag) => Math.round((article.querySelector(tag) as HTMLElement).getBoundingClientRect().top)));
      expect(Math.abs(tops[0] - tops[1]), `row ${index}: the name and the number are on one line`).toBeLessThan(14);
      expect(tops[2], `row ${index}: the explanation is under them`).toBeGreaterThan(tops[0]);
    }

    // Every week of the range, from the first to the last: weeks of rest have no bar, so their readout is the lowest and the one most likely to run off the foot.
    await chart(page).focus();
    await page.keyboard.press('Home');
    const count = Number(await chart(page).getAttribute('aria-valuemax')) + 1;
    for (let index = 0; index < count; index += 1) {
      await expect(chart(page)).toHaveAttribute('aria-valuenow', String(index));
      await expectReadoutInChart(page);
      if (index < count - 1) await page.keyboard.press('ArrowRight');
    }
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('A10 weekly distance: runners it has little to say to, and other conditions', () => {
  test('A10-E1 a runner with three weeks of running has bars and no line, and the card says that four weeks are needed', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('a10-young');
    await importRunSpecs(made.api, [2, 9, 16].map((daysBack, index): RunSpec => ({ name: `E2E a10y ${index}`, daysBack, km: 6 + index, pace: 330, hr: null })), { wait: false });
    const page = await pages.open(browser, baseURL, guard, whoOf(made), ROUTE);
    await openCard(page);
    const weeks = weeksOf(await rowsOf(made.api));

    expect(await tableOf(page)).toEqual(expectedTable(weeks));
    await expect(bars(page)).toHaveCount(weeks.length);
    await expect(chart(page).locator('path.analysis-wd-average')).toHaveCount(0);
    await expect(chart(page).locator('circle.analysis-wd-average-dot')).toHaveCount(0);
    await expect(tile(page, 'Last 4 weeks').locator('small')).toHaveText('Needs four weeks of running');
    await expect(tile(page, 'Last 4 weeks').locator('strong')).toHaveText('–');
  });

  test('A10-E4 (BUG-051) a runner with one week of running: the labels of the two charts say the one week there is, not "the last 1 weeks"', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const made = await newRunner('a10-oneweek');
    await made.api.importRun('a10-now.gpx', gpxRun({ name: 'E2E a10 just now', start: new Date(Date.now() - 5 * 60_000), distanceM: 6000, pace: 330, hr: 140, shape: 'line' }));
    await expect.poll(async () => ((await made.api.get('/api/training/weekly-effort?weeks=12')).json?.weeks ?? []).length, { timeout: 120_000 }).toBeGreaterThan(0);
    const page = await pages.open(browser, baseURL, guard, whoOf(made), ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: 'Weekly distance' })).toBeVisible();

    const distance = card(page).getByRole('slider');
    await expect(distance).toHaveAttribute('aria-valuemax', '0');
    await expect(distance).toHaveAccessibleName(/^Distance for the one week you have so far\./);
    await expect(distance).not.toHaveAccessibleName(/1 weeks/);
    const effort = page.locator('#load-weekly-effort').getByRole('slider');
    await expect(effort).toHaveAttribute('aria-valuemax', '0');
    await expect(effort).toHaveAccessibleName(/^Effort for the one week you have so far/);
    await expect(effort).not.toHaveAccessibleName(/1 weeks/);
  });

  test('A10-E2 a week of rest inside the history is a week of zero: no bar, "No run", and the average of the four weeks around it counts it', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    await rangeChip(page, '52 weeks').click();
    const weeks = weeksOf(await rowsOf(runner.api));
    const resting = weeks.map((week, index) => ({ week, index })).filter(({ week, index }) => week.km === 0 && week.average != null && index >= 3);
    expect(resting.length).toBeGreaterThanOrEqual(1);
    const { week, index } = resting[0];
    const shownIndex = index - (weeks.length - Math.min(52, weeks.length));
    expect(shownIndex).toBeGreaterThanOrEqual(0);

    await chart(page).focus();
    await page.keyboard.press('Home');
    for (let step = 0; step < shownIndex; step += 1) await page.keyboard.press('ArrowRight');
    await expect(chart(page)).toHaveAttribute('aria-valuetext', said(week));
    await expect(chart(page)).toHaveAttribute('aria-valuetext', /: 0\.0 km, No run, 4-week average/);
    expect(Number(await bars(page).nth(shownIndex).getAttribute('height'))).toBe(0);
    // Its average is the mean of itself and the three before, the zero in it.
    expect(week.average).toBeCloseTo((weeks[index - 3].km + weeks[index - 2].km + weeks[index - 1].km + 0) / 4, 9);
  });

  test('A10-E3 a week begins and ends at the runner\'s own midnight: a run at 23:50 on Sunday and one at 00:10 on Monday are in two weeks, whatever the hour in UTC', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const made = await newRunner('a10-zone');
    // Kiritimati is UTC+14 all year, so the two runs are on the same UTC day and on two days of the runner's wall.
    expect((await made.api.patch('/api/profile/me/time-zone', { timeZone: 'Pacific/Kiritimati' })).status).toBe(200);
    const monday = weekStartOf(utcDay(24));
    const sunday = addDays(monday, -1);
    await made.api.importRun('a10-sunday.gpx', gpxRun({ name: 'E2E a10 Sunday night', start: new Date(`${sunday}T09:50:00Z`), distanceM: 5000, pace: 330, hr: null, shape: 'line' }));
    await made.api.importRun('a10-monday.gpx', gpxRun({ name: 'E2E a10 Monday morning', start: new Date(`${sunday}T10:10:00Z`), distanceM: 7000, pace: 330, hr: null, shape: 'line' }));
    await importRunSpecs(made.api, [3, 9].map((daysBack): RunSpec => ({ name: `E2E a10z ${daysBack}`, daysBack, km: 4, pace: 330, hr: null })), { wait: false });
    const rows = await rowsOf(made.api);
    const days = rows.filter((row) => row.name.startsWith('E2E a10 ')).map((row) => row.startTime.slice(0, 10)).sort();
    expect(days, 'the server moved them onto the runner\'s wall').toEqual([sunday, monday]);

    const page = await pages.open(browser, baseURL, guard, whoOf(made), ROUTE);
    await openCard(page);
    const weeks = weeksOf(rows);
    const before = weeks.find((week) => week.start === addDays(monday, -7)) as Week;
    const after = weeks.find((week) => week.start === monday) as Week;
    expect(before.km).toBeCloseTo(5, 0);
    expect(after.km).toBeCloseTo(7, 0);
    expect(await tableOf(page)).toEqual(expectedTable(weeks));
  });

  test('A10-U1 in miles the distances and the scale are in miles', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await setProfileUnits(runner.api, 'imperial');
    await page.addInitScript(() => localStorage.setItem('hermes_unit', 'mile'));
    await page.goto(ROUTE);
    await openCard(page);
    const weeks = weeksOf(await rowsOf(runner.api));
    const open = weeks[weeks.length - 1];
    const mi1 = (km: number): string => `${(km / KM_PER_MILE).toFixed(1)} mi`;

    await expect(tile(page, 'This week so far').locator('strong')).toHaveText(mi1(open.km));
    await expect(chart(page)).toHaveAttribute('aria-valuetext', new RegExp(`${mi1(open.km).replace('.', '\\.')}`));
    const rows = await tableOf(page);
    expect(rows[rows.length - 2][1]).toBe(mi1(weeks[weeks.length - 2].km));
    // The scale is in whole miles: 0 and four steps of the same size.
    const scale = (await chart(page).locator('svg text').allTextContents()).filter((text) => /^\d+$/.test(text)).map(Number).slice(0, 5);
    expect(scale[0]).toBe(0);
    expect(scale.every((value, index) => value === index * scale[1])).toBe(true);
    expect(scale[1]).toBeGreaterThanOrEqual(1);
    // And it is the scale of the bars: the tallest week, in miles, is that share of the way up the scale (it is not the same share when a number in kilometres is read as miles).
    const tallest = Math.max(...weeks.slice(-26).map((week) => week.km)) / KM_PER_MILE;
    const grid = await chart(page).locator('line.analysis-fit-v2-grid').evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('y1'))));
    const heights = await bars(page).evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('height'))));
    expect(Math.max(...heights) / (Math.max(...grid) - Math.min(...grid))).toBeCloseTo(tallest / scale[4], 2);
  });

  test('A10-L1 in Chinese the card is translated and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: '每周距离' })).toBeVisible();
    const weeks = weeksOf(await rowsOf(runner.api));

    await expect(card(page).getByRole('button', { name: '近 12 周', exact: true })).toBeVisible();
    await expect(card(page).getByRole('region', { name: /^本周至今/ }).locator('article').first().locator('strong')).toHaveText(`${weeks[weeks.length - 1].km.toFixed(1)} 公里`);
    await expect(card(page).getByRole('slider')).toHaveAttribute('aria-valuetext', /进行中/);
    await expect(card(page).getByRole('slider')).not.toHaveAttribute('aria-valuetext', /[,:] /);
    await expectNoRawKeys(page);
  });

  for (const theme of ['light', 'midnight', 'high-contrast', 'high-contrast-light']) {
    test(`A10-A2 the bars, the line and the dots of the chart show 3 to 1 against the card in the ${theme} theme`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await openCard(page);
      await chart(page).focus();
      await page.keyboard.press('ArrowLeft');
      await expect(chart(page).locator('rect.is-selected')).toHaveCount(1);
      const found = await markRatios(page, [
        { selector: '#load-distance rect.analysis-fit-v2-bar.is-distance:not(.is-open):not(.is-selected)', paint: 'fill', what: 'a bar' },
        { selector: '#load-distance rect.analysis-fit-v2-bar.is-distance.is-open', paint: 'stroke', what: 'the outline of the week going' },
        { selector: '#load-distance rect.analysis-fit-v2-bar.is-distance.is-selected', paint: 'stroke', what: 'the outline of the week read' },
        { selector: '#load-distance path.analysis-wd-average', paint: 'stroke', what: 'the line of the average' },
        { selector: '#load-distance circle.analysis-wd-average-dot', paint: 'fill', what: 'a dot of the average' },
      ]);
      for (const item of found) {
        test.info().annotations.push({ type: 'ratio', description: `${theme}: ${item.what} ${item.mark} on ${item.behind} = ${item.ratio.toFixed(2)}` });
        expect(item.ratio, `${item.what}: ${item.mark} on ${item.behind}`).toBeGreaterThanOrEqual(3);
      }
    });
  }

  for (const theme of ['light', 'midnight']) {
    test(`A10-A1 the card is readable in the ${theme} theme and has no accessibility violations, with a week read`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await openCard(page);
      expect(await contrastProblems(page, { include: ['#load-distance'] }), `${theme}, contrast`).toEqual([]);
      expect(await a11yViolations(page, { include: ['#load-distance'] }), `${theme}, axe`).toEqual([]);
      await chart(page).focus();
      await page.keyboard.press('ArrowLeft');
      await expect(readout(page)).toBeVisible();
      expect(await contrastProblems(page, { include: ['#load-distance'] }), `${theme}, contrast with a week read`).toEqual([]);
      expect(await a11yViolations(page, { include: ['#load-distance'] }), `${theme}, axe with a week read`).toEqual([]);
    });
  }

  test('A10-N1 each runner sees their own weeks and nothing of anyone else\'s', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const mine = await newRunner('a10-mine');
    await importRunSpecs(mine.api, [{ name: 'E2E a10 mine', daysBack: 3, km: 6, pace: 330, hr: null }, { name: 'E2E a10 mine 2', daysBack: 24, km: 9, pace: 330, hr: null }], { wait: false });
    const page = await pages.open(browser, baseURL, guard, whoOf(mine), ROUTE);
    await openCard(page);
    const weeks = weeksOf(await rowsOf(mine.api));

    expect(await tableOf(page)).toEqual(expectedTable(weeks));
    expect(weeks.reduce((sum, week) => sum + week.km, 0)).toBeCloseTo(15, 0);
    await expect(card(page)).not.toContainText('E2E a10 w');
    // The shared runner has far more weeks: none of them shows here.
    expect((await tableOf(page)).length).toBeLessThan(10);
  });
});
