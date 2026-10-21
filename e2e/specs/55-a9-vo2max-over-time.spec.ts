// A9 Your VO2max over time, a section of the VO2max estimates page that came out of the Runalyze review: the number as the page would have shown
// it right after each run, a line over six months, a year or all of it, the highest and the lowest of the range, and a table by year.
//
// Every point is worked out again here, in this file, from the runs the API lists and the rule the methods document gives (docs/README-ANALYSIS.md,
// "VDOT and VO2max", "The number over time"): the estimates of the runs of the 90 days ending at each run, the mean of the best three of the pool,
// firm when it is the mean of three. So a line that drew the wrong points, looked at the wrong 90 days, called a thin point firm or took the year's
// highest from the wrong runs fails. The runs are a week apart (so a run is never exactly 90 days from another, which a change of clocks would
// move either way) and a few days from where a range begins.
import type { Locator, Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { importRunSpecs, sharedRunner, type RunSpec } from '../fixtures/analysis.ts';
import { shortDate, utcDay } from '../fixtures/format.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { enlargeText, readoutSticksOut } from '../fixtures/reflow.ts';
import { DAY, averageOver, expectAverage, pointsOf, timeOf, type Point, type Row } from '../fixtures/vo2max.ts';
import { a11yViolations, contrastProblems, expect, expectNoHorizontalOverflow, expectNoRawKeys, test } from '../fixtures/test.ts';

const ROUTE = '/analysis/vo2max-estimates';
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

const rowsOf = async (api: Api): Promise<Row[]> => (await api.get('/api/activities/analysis')).json;

const section = (page: Page): Locator => page.locator('.vo2max-estimates-v2__history');
const chart = (page: Page): Locator => section(page).getByRole('slider', { name: /^Your VO2max after/ });
const pointList = (page: Page): Locator => section(page).getByRole('list', { name: 'Every point of the line, oldest first' });
/** The sentence of each point, as the list for a screen reader has it (a hollow point has a note after it, in a second span). */
const pointTexts = (page: Page): Promise<string[]> => pointList(page).locator('li > span:first-child').allTextContents();
const dots = (page: Page): Locator => chart(page).locator('circle.vo2max-estimates-v2__history-dot');
const yearsTable = (page: Page): Locator => section(page).getByRole('table', { name: 'VO2max by year' });
const readOf = (page: Page, label: string): Locator => section(page).getByRole('group', { name: /^Your VO2max now/ }).locator('div').filter({ has: page.getByText(label, { exact: true }) });
const rangeButton = (page: Page, label: string): Locator => section(page).getByRole('group', { name: 'Time range' }).getByRole('button', { name: label, exact: true });

/**
 * Sixty weekly runs of 5 km, from 3 to 416 days back, none with a heart rate. The quickest are in the middle (a good spell 213 days back, the
 * 31st run counting from the latest) and they get slower both ways from there, so the line rises, peaks and falls, and how far back a point
 * looks decides what it says: the good spell is in the window of the runs after it for 90 days, and not after that.
 */
const FIXTURE: RunSpec[] = Array.from({ length: 60 }, (_, k) => ({
  name: `E2E a9 week ${60 - k}`,
  daysBack: 3 + 7 * k,
  km: 5,
  pace: Math.round(282 + (Math.abs(k - 30) * 40) / 30),
  hr: null,
}));

let runner: Awaited<ReturnType<typeof sharedRunner<null>>>;

test.beforeAll(async () => {
  test.setTimeout(900_000);
  runner = await sharedRunner('a9', async ({ api }) => {
    await importRunSpecs(api, FIXTURE, { wait: false });
    return null;
  });
});

async function openPage(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: 'VO2max estimates' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Your VO2max over time' })).toBeVisible();
}

/** The points a range shows: those from `days` back, or all of them. */
const inRange = (points: Point[], days: number | null, now = Date.now()): Point[] => points.filter((point) => days === null || point.time >= now - days * DAY);

test.describe('A9 your VO2max over time: what the line and the readings say', () => {
  test('A9-H1 the line has a point after each run of the year and one for today, and the number now is the number at the top of the page', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const rows = await rowsOf(runner.api);
    expect(rows).toHaveLength(60);
    const points = pointsOf(rows);
    const year = inRange(points, 365);

    await expect(rangeButton(page, '1 yr')).toHaveAttribute('aria-pressed', 'true');
    await expect(dots(page)).toHaveCount(year.length);
    await expect(chart(page).locator('circle.is-now')).toHaveCount(1);
    const today = points[points.length - 1];
    expect(today.now).toBe(true);
    await expect(readOf(page, 'Now').locator('strong')).toHaveText(today.value.toFixed(1));
    await expect(page.getByRole('region', { name: 'How the number is made' }).locator('article').first().locator('strong')).toHaveText(today.value.toFixed(1));
    await expect(chart(page)).toHaveAccessibleName(new RegExp(`^Your VO2max after each run, ${year.length} points from `));
  });

  test('A9-H2 the highest and the lowest are the highest and lowest firm points of the range, with their days', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const points = pointsOf(await rowsOf(runner.api));
    const firm = inRange(points, 365).filter((point) => point.firm);
    expect(firm.length).toBeGreaterThan(10);
    const highest = firm.reduce((best, point) => (point.value >= best.value ? point : best));
    const lowest = firm.reduce((best, point) => (point.value < best.value ? point : best));

    await expect(readOf(page, 'Highest').locator('strong')).toHaveText(highest.value.toFixed(1));
    await expect(readOf(page, 'Highest').locator('small')).toHaveText(shortDate(new Date(`${highest.date}T12:00:00Z`)));
    await expect(readOf(page, 'Lowest').locator('strong')).toHaveText(lowest.value.toFixed(1));
    await expect(readOf(page, 'Lowest').locator('small')).toHaveText(shortDate(new Date(`${lowest.date}T12:00:00Z`)));
    // The average lies between the two, and is of the days each number stood.
    const average = averageOver(inRange(points, 365), Date.now());
    expect(average).not.toBeNull();
    expect(average?.value).toBeGreaterThan(lowest.value);
    expect(average?.value).toBeLessThan(highest.value);
    await expectAverage(readOf(page, 'Average'), average);
    // The good spell of the runner is 213 days back, and the number is at its highest for as long as the three best runs are in the 90 days before
    // a point: the highest is the last of those days, in the 90 days after the spell, and the lowest is nowhere near it.
    expect(highest.date >= utcDay(215) && highest.date <= utcDay(120), `the highest is on ${highest.date}`).toBe(true);
    expect(lowest.date >= utcDay(230) && lowest.date <= utcDay(120)).toBe(false);
  });

  test('A9-H3 the ranges are six months, a year and all of it, and the points and the readings follow', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const points = pointsOf(await rowsOf(runner.api));

    for (const [label, days] of [['6 mo', 182], ['1 yr', 365], ['All', null]] as const) {
      await rangeButton(page, label).click();
      await expect(rangeButton(page, label)).toHaveAttribute('aria-pressed', 'true');
      const shown = inRange(points, days);
      await expect(dots(page)).toHaveCount(shown.length);
      const firm = shown.filter((point) => point.firm);
      const lowest = firm.reduce((best, point) => (point.value < best.value ? point : best));
      await expect(readOf(page, 'Lowest').locator('strong')).toHaveText(lowest.value.toFixed(1));
      await expectAverage(readOf(page, 'Average'), averageOver(shown, Date.now()));
    }
    // Only in all of it are there points of one run's number and two runs'; they are drawn hollow and say so.
    await expect(chart(page).locator('circle.is-thin')).toHaveCount(2);
    await expect(section(page)).toContainText('A hollow dot is a point where the number was the mean of fewer than 3 runs');
    await expect(section(page)).toContainText('left out of the highest, the lowest and the average');
    await rangeButton(page, '1 yr').click();
    await expect(chart(page).locator('circle.is-thin')).toHaveCount(0);
    await expect(section(page)).not.toContainText('A hollow dot');
  });

  test('A9-H4 a point is the number as it stood after its run: the 90 days before it, not the 90 days before today', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    await rangeButton(page, 'All').click();
    const rows = await rowsOf(runner.api);
    const points = pointsOf(rows);

    // The point after the oldest run of the sixty is one run's number.
    const titles = await pointTexts(page);
    expect(titles).toHaveLength(points.length);
    expect(titles[0]).toContain(`: ${points[0].value.toFixed(1)}, after E2E a9 week 1`);
    expect(titles[titles.length - 1]).toBe(`Now: ${points[points.length - 1].value.toFixed(1)}`);
    // Among them the points from 7 to 19 weeks after the good spell, where a window of 180 days would still hold it and one of 90 days does not.
    for (const index of [2, 20, 40, 43, 45, 48, 52, 58]) expect(titles[index]).toContain(`: ${points[index].value.toFixed(1)}, after `);
    // A point from the good spell looks at the 90 days before its own run, not at today's: the number then was well above today's.
    expect(points[30].value - points[points.length - 1].value).toBeGreaterThan(2);
    // And the points after it fall as the good spell leaves their 90 days: the number is not what the best runs of the 180 days would give.
    const after = points.slice(36, 48).map((point) => point.value);
    expect(after[after.length - 1]).toBeLessThan(after[0]);
  });
});

test.describe('A9 your VO2max over time: the years', () => {
  test('A9-Y1 each year with a run is a row, newest first, with the highest, the lowest, the number at the end, and the runs and the distance of the year', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const rows = await rowsOf(runner.api);
    const points = pointsOf(rows);
    const years = [...new Set(rows.map((row) => Number(row.startTime.slice(0, 4))))].sort((a, b) => b - a);
    expect(years.length, 'the fixture reaches back into the year before').toBeGreaterThanOrEqual(2);

    const lines = yearsTable(page).locator('tbody tr');
    await expect(lines).toHaveCount(years.length);
    for (const [index, year] of years.entries()) {
      const mine = rows.filter((row) => Number(row.startTime.slice(0, 4)) === year);
      const ofYear = points.filter((point) => Number(point.date.slice(0, 4)) === year);
      const firm = ofYear.filter((point) => point.firm);
      const high = firm.reduce((best, point) => (point.value >= best.value ? point : best));
      const low = firm.reduce((best, point) => (point.value < best.value ? point : best));
      const line = lines.nth(index);

      await expect(line.locator('th')).toHaveText(String(year));
      await expect(line.locator('td').nth(0).locator('strong')).toHaveText(high.value.toFixed(1));
      await expect(line.locator('td').nth(2).locator('strong')).toHaveText(low.value.toFixed(1));
      await expect(line.locator('td').nth(3).locator('strong')).toHaveText(ofYear[ofYear.length - 1].value.toFixed(1));
      await expect(line.locator('td').nth(4)).toHaveText(String(mine.length));
      await expect(line.locator('td').nth(5)).toHaveText(`${Math.round(mine.reduce((sum, row) => sum + row.distanceKm, 0))} km`);
      // The average of the year: its own points, to the end of the year (to today for this year).
      const yearEnd = year === new Date().getFullYear() ? Date.now() : new Date(year + 1, 0, 1).getTime();
      await expectAverage(line.locator('td').nth(1), averageOver(ofYear, yearEnd));
    }
    // The current year says its end is today.
    await expect(lines.first().locator('td').nth(3).locator('.vo2max-estimates-v2__tag')).toHaveText('now');
    await expect(lines.nth(1).locator('.vo2max-estimates-v2__tag')).toHaveCount(0);
  });
});

test.describe('A9 your VO2max over time: runners it has little to say to', () => {
  test('A9-E1 when no run of the range gave a number the section says so, keeps the years, and the longer range shows the line', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('a9-old');
    await importRunSpecs(made.api, [400, 398, 396, 394].map((daysBack): RunSpec => ({ name: `E2E a9 old d${daysBack}`, daysBack, km: 5, pace: 300, hr: null })), { wait: false });
    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await openPage(page);

    await expect(section(page)).toContainText('No run in this range gave a number. Try a longer one.');
    await expect(chart(page)).toHaveCount(0);
    await expect(yearsTable(page).locator('tbody tr')).toHaveCount(1);
    await rangeButton(page, 'All').click();
    await expect(chart(page)).toBeVisible();
    await expect(dots(page)).toHaveCount(4);
    await expect(readOf(page, 'Now').locator('strong')).toHaveText('–');
    await expect(section(page)).not.toContainText('No run in this range');
    // The average is of the days the numbers stood: the third run's for two days and the fourth's for 90, and not the 394 days to today.
    const average = averageOver(pointsOf(await rowsOf(made.api)), Date.now());
    expect(average?.days).toBeCloseTo(92, 0);
    await expectAverage(readOf(page, 'Average'), average);
  });

  test('A9-E2 a runner with no run has no such section, and the page says what it said before', async ({ browser, baseURL, guard }) => {
    const none = await newRunner('a9-none');
    const page = await pages.open(browser, baseURL, guard, { token: none.api.token as string, email: none.email }, ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: 'No run gives an estimate yet' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Your VO2max over time' })).toHaveCount(0);
  });

  test('A9-E3 a runner with a few runs has hollow points for the first two and a line that ends at today', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('a9-few');
    await importRunSpecs(made.api, [20, 13, 6].map((daysBack, index): RunSpec => ({ name: `E2E a9 few ${index}`, daysBack, km: 5, pace: 300 - index * 12, hr: null })), { wait: false });
    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await openPage(page);
    const points = pointsOf(await rowsOf(made.api));

    await expect(dots(page)).toHaveCount(4);
    await expect(chart(page).locator('circle.is-thin')).toHaveCount(2);
    await expect(readOf(page, 'Now').locator('strong')).toHaveText(points[points.length - 1].value.toFixed(1));
    // The highest and the lowest come from the firm points, which are the third run's and today's, whatever the first two said.
    expect(points.map((point) => point.firm)).toEqual([false, false, true, true]);
    // So does the average: the third run's number, which stood the six days to today. The two before it, hollow, count for nothing.
    const average = averageOver(points, Date.now());
    expect(average?.value).toBeCloseTo(points[2].value, 6);
    await expectAverage(readOf(page, 'Average'), average);
  });
});

test.describe('A9 your VO2max over time: in other conditions', () => {
  test('A9-U1 in miles the distance of a year is in miles', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_unit', 'mile'));
    await page.goto(ROUTE);
    await openPage(page);
    const rows = await rowsOf(runner.api);
    const year = String(new Date().getFullYear());
    const km = rows.filter((row) => row.startTime.startsWith(year)).reduce((sum, row) => sum + row.distanceKm, 0);

    await expect(yearsTable(page).locator('tbody tr').first().locator('td').nth(5)).toHaveText(`${Math.round(km * 0.621371)} mi`);
  });

  test('A9-L1 in Chinese the section is translated and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: '你的 VO2max 随时间的变化' })).toBeVisible();
    const today = pointsOf(await rowsOf(runner.api)).at(-1) as Point;

    await expect(page.getByRole('button', { name: '6 个月', exact: true })).toBeVisible();
    await expect(page.getByRole('group', { name: /^你现在的 VO2max/ }).locator('div').first().locator('strong')).toHaveText(today.value.toFixed(1));
    await expect(page.getByRole('table', { name: '按年份的 VO2max' })).toBeVisible();
    await expect(page.getByRole('group', { name: /^你现在的 VO2max/ }).locator('div').filter({ has: page.getByText('平均', { exact: true }) }).locator('small')).toHaveText(/^共 \d+ 天$/);
    await expectNoRawKeys(page);
  });

  for (const theme of ['light', 'midnight', 'high-contrast', 'high-contrast-light']) {
    test(`A9-A1 the section is readable in the ${theme} theme and has no accessibility violations`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await openPage(page);
      await expect(chart(page)).toBeVisible();
      expect(await contrastProblems(page, { include: ['.vo2max-estimates-v2__history'] }), `${theme}, contrast`).toEqual([]);
      expect(await a11yViolations(page, { include: ['.vo2max-estimates-v2__history'] }), `${theme}, axe`).toEqual([]);
      // And with a point being read: its readout is on the card too.
      await chart(page).focus();
      await expect(chart(page).locator('.vo2max-estimates-v2__tooltip')).toBeVisible();
      expect(await chart(page).locator('.vo2max-estimates-v2__tooltip').evaluate((node) => getComputedStyle(node).backgroundColor), `${theme}: the readout is on a solid background`).toMatch(/^rgb\(/);
      expect(await contrastProblems(page, { include: ['.vo2max-estimates-v2__history'] }), `${theme}, contrast with a point read`).toEqual([]);
      expect(await a11yViolations(page, { include: ['.vo2max-estimates-v2__history'] }), `${theme}, axe with a point read`).toEqual([]);
    });
  }

  test('A9-M1 @mobile the section fits a phone: the chart fits, the four readings are two to a line, the table scrolls in its frame', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await page.setViewportSize({ width: 375, height: 812 });
    await openPage(page);
    await expect(chart(page)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const width = await chart(page).evaluate((node) => node.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(375);
    const tops = await section(page).getByRole('group', { name: /^Your VO2max now/ }).locator('div').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
    expect(tops, 'four readings').toHaveLength(4);
    expect(new Set(tops).size, 'two readings to a line on a phone').toBe(2);
    const frame = await yearsTable(page).evaluate((node) => ({ scroll: (node.parentElement as HTMLElement).scrollWidth, client: (node.parentElement as HTMLElement).clientWidth }));
    expect(frame.scroll).toBeGreaterThan(frame.client);
  });
});

test.describe('A9 your VO2max over time: reading one point of the line', () => {
  type Box = { x: number; y: number; width: number; height: number };
  const readout = (page: Page): Locator => chart(page).locator('.vo2max-estimates-v2__tooltip');

  /** The sentence the page says for each point of the year, worked out again here: the date as it is printed, the number, and the run it came after. */
  async function sayings(api: Api): Promise<{ year: Point[]; said: string[] }> {
    const rows = [...(await rowsOf(api))].sort((a, b) => timeOf(a) - timeOf(b));
    const points = pointsOf(rows);
    const first = points.findIndex((point) => point.time >= Date.now() - 365 * DAY);
    const said = points.slice(first).map((point, index) => (point.now
      ? `Now: ${point.value.toFixed(1)}`
      : `${shortDate(new Date(`${point.date}T12:00:00Z`))}: ${point.value.toFixed(1)}, after ${rows[first + index].name}`));
    return { year: points.slice(first), said };
  }

  /** The readout is inside the chart's box, and not over the point it is about. */
  async function expectReadoutBeside(page: Page, position: number): Promise<void> {
    const box = (await chart(page).boundingBox()) as Box;
    const tip = (await readout(page).boundingBox()) as Box;
    const dot = (await dots(page).nth(position).boundingBox()) as Box;
    expect(tip.x, 'the readout starts inside the chart').toBeGreaterThanOrEqual(box.x - 1);
    expect(tip.x + tip.width, 'and ends inside it').toBeLessThanOrEqual(box.x + box.width + 1);
    expect(tip.y).toBeGreaterThanOrEqual(box.y - 1);
    expect(tip.y + tip.height).toBeLessThanOrEqual(box.y + box.height + 1);
    const [cx, cy] = [dot.x + dot.width / 2, dot.y + dot.height / 2];
    expect(cx < tip.x || cx > tip.x + tip.width || cy < tip.y || cy > tip.y + tip.height, 'the readout is not over its point').toBe(true);
  }

  test('A9-K1 from the keyboard: Tab brings the chart the newest point, and the arrows, Home, End and Escape move through the line', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const { year, said } = await sayings(runner.api);
    const last = year.length - 1;

    await expect(readout(page)).toHaveCount(0);
    await rangeButton(page, 'All').focus();
    await page.keyboard.press('Tab');
    await expect(chart(page)).toBeFocused();
    await expect(readout(page)).toBeVisible();
    await expect(chart(page)).toHaveAttribute('aria-valuenow', String(last));
    await expect(chart(page)).toHaveAttribute('aria-valuetext', said[last]);
    await expect(readout(page).locator('time')).toHaveText('Now');
    await expect(readout(page).locator('strong')).toHaveText(year[last].value.toFixed(1));

    await page.keyboard.press('ArrowLeft');
    await expect(chart(page)).toHaveAttribute('aria-valuetext', said[last - 1]);
    await expect(readout(page).locator('time')).toHaveText(shortDate(new Date(`${year[last - 1].date}T12:00:00Z`)));
    await expect(readout(page).locator('strong')).toHaveText(year[last - 1].value.toFixed(1));
    await expect(readout(page).locator('span')).toHaveText(/^After E2E a9 week \d+$/);

    await page.keyboard.press('Home');
    await expect(chart(page)).toHaveAttribute('aria-valuetext', said[0]);
    await page.keyboard.press('ArrowLeft');
    await expect(chart(page)).toHaveAttribute('aria-valuenow', '0');
    await page.keyboard.press('End');
    await expect(chart(page)).toHaveAttribute('aria-valuenow', String(last));
    await page.keyboard.press('ArrowRight');
    await expect(chart(page)).toHaveAttribute('aria-valuenow', String(last));

    await page.keyboard.press('Escape');
    await expect(readout(page)).toHaveCount(0);
    await expect(chart(page)).toHaveAttribute('aria-valuenow', String(last));
    // Tab goes on, past the chart, and nothing is left picked.
    await page.keyboard.press('Tab');
    await expect(chart(page)).not.toBeFocused();
    await expect(readout(page)).toHaveCount(0);
  });

  test('A9-K2 the list for a screen reader has the sentence of every point, the one the slider gives, and the whole line can be walked a point at a time', async ({ browser, baseURL, guard }) => {
    test.setTimeout(120_000);
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const { year, said } = await sayings(runner.api);

    await expect(pointList(page).locator('li')).toHaveCount(year.length);
    expect(await pointTexts(page)).toEqual(said);
    const size = await pointList(page).evaluate((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }));
    expect(Math.max(size.width, size.height), 'the list is for a screen reader and is not drawn').toBeLessThanOrEqual(1);
    await chart(page).focus();
    await page.keyboard.press('Home');
    for (let index = 0; index < year.length; index += 1) {
      await expect(chart(page), `point ${index + 1} of ${year.length}`).toHaveAttribute('aria-valuetext', said[index]);
      if (index < year.length - 1) await page.keyboard.press('ArrowRight');
    }
  });

  test('A9-K3 a hollow point says what it is when it is read: the estimate of one run, the mean of two, and nothing of the kind for a firm one', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    await rangeButton(page, 'All').click();
    await expect(chart(page).locator('circle.is-thin')).toHaveCount(2);
    await chart(page).focus();
    await page.keyboard.press('Home');

    const one = "One run's estimate: left out of the highest, the lowest and the average.";
    const two = 'The mean of 2 runs only: left out of the highest, the lowest and the average.';
    await expect(chart(page)).toHaveAttribute('aria-valuetext', new RegExp(`\\. ${one}$`));
    await expect(readout(page).locator('small')).toHaveText("Hollow dot: one run's estimate");
    await page.keyboard.press('ArrowRight');
    await expect(chart(page)).toHaveAttribute('aria-valuetext', new RegExp(`\\. ${two}$`));
    await expect(readout(page).locator('small')).toHaveText('Hollow dot: the mean of 2 runs');
    await page.keyboard.press('ArrowRight');
    await expect(chart(page)).not.toHaveAttribute('aria-valuetext', /left out of/);
    await expect(readout(page).locator('small')).toHaveCount(0);
    // The list says it as well, for the two hollow points and no others.
    await expect(pointList(page).locator('li > span:nth-child(2)')).toHaveText([one, two]);
  });

  test('A9-K4 with the mouse: the readout follows the pointer to the nearest point, stays inside the chart beside its point, and goes when the pointer leaves', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const { said } = await sayings(runner.api);
    await chart(page).scrollIntoViewIfNeeded();
    const box = (await chart(page).boundingBox()) as Box;
    const viewWidth = await chart(page).locator('svg').evaluate((node) => Number((node.getAttribute('viewBox') ?? '').split(' ')[2]));
    const xs = await dots(page).evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('cx'))));
    expect(xs).toHaveLength(said.length);
    const scale = box.width / viewWidth;

    for (const fraction of [0.08, 0.33, 0.5, 0.71, 0.97]) {
      const x = box.x + box.width * fraction;
      await page.mouse.move(x, box.y + box.height / 2);
      const nearest = xs.reduce((best, cx, index) => (Math.abs(cx * scale - (x - box.x)) < Math.abs(xs[best] * scale - (x - box.x)) ? index : best), 0);
      await expect(chart(page), `at ${Math.round(fraction * 100)}% of the width`).toHaveAttribute('aria-valuenow', String(nearest));
      await expect(chart(page)).toHaveAttribute('aria-valuetext', said[nearest]);
      await expectReadoutBeside(page, nearest);
      // The ring and the thin line are on that point.
      const ring = chart(page).locator('circle.vo2max-estimates-v2__history-selected');
      await expect(ring).toHaveAttribute('cx', (await dots(page).nth(nearest).getAttribute('cx')) as string);
      await expect(ring).toHaveAttribute('cy', (await dots(page).nth(nearest).getAttribute('cy')) as string);
      await expect(chart(page).locator('line.vo2max-estimates-v2__history-cross')).toHaveAttribute('x1', (await dots(page).nth(nearest).getAttribute('cx')) as string);
    }
    await page.getByRole('heading', { level: 1, name: 'VO2max estimates' }).hover();
    await expect(readout(page)).toHaveCount(0);
  });

  test('A9-K7 in Chinese the readout, the sentence of a point and the note of a hollow point are translated, and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: '你的 VO2max 随时间的变化' })).toBeVisible();
    await section(page).getByRole('group', { name: '时间范围' }).getByRole('button', { name: '全部', exact: true }).click();
    const line = section(page).getByRole('slider', { name: /^每次跑步之后的 VO2max/ });
    const tip = line.locator('.vo2max-estimates-v2__tooltip');

    await line.focus();
    await page.keyboard.press('Home');
    await expect(line).toHaveAttribute('aria-valuetext', /。只取自一次跑步的估算：不计入最高值、最低值和平均值。$/);
    await expect(tip.locator('small')).toHaveText('空心点：只取自一次跑步');
    await expect(tip.locator('span')).toHaveText(/^在“E2E a9 week \d+”之后$/);
    await page.keyboard.press('ArrowRight');
    await expect(tip.locator('small')).toHaveText('空心点：只取自 2 次跑步的平均');
    await page.keyboard.press('End');
    await expect(tip.locator('time')).toHaveText('现在');
    const list = section(page).getByRole('list', { name: '线上的每个点，从最早到最近' });
    await expect(list.locator('li').first()).toContainText('。只取自一次跑步的估算');
    await expectNoRawKeys(page);
  });

  for (const [width, percent] of [[1280, 150], [1280, 200], [390, 150], [390, 200]] as const) {
    test(`A9-K9 (BUG-054) at ${width} px with the text at ${percent}% the readout of a point stays inside the chart`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.setViewportSize({ width, height: 800 });
      await page.goto(ROUTE);
      await openPage(page);
      await enlargeText(page, percent);
      // The whole history: its first points are the lowest on the chart, and hollow, so they have the longest readout, under which there is the least room.
      await rangeButton(page, 'All').click();
      await chart(page).scrollIntoViewIfNeeded();
      await chart(page).focus();
      for (const key of ['ArrowLeft', 'ArrowLeft', 'Home', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'End']) {
        await page.keyboard.press(key);
        await expect(readout(page), key).toBeVisible();
        expect(await readoutSticksOut(chart(page), '.vo2max-estimates-v2__tooltip'), `after ${key}`).toBe('');
      }
    });
  }

  test('A9-K5 with a finger: a tap picks a point and keeps it after the finger lifts, another tap on the chart picks another, and a tap elsewhere lets go', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE, { hasTouch: true, viewport: { width: 390, height: 844 } });
    await openPage(page);
    await chart(page).scrollIntoViewIfNeeded();
    const box = (await chart(page).boundingBox()) as Box;

    await page.touchscreen.tap(box.x + box.width * 0.4, box.y + box.height / 2);
    await expect(readout(page)).toBeVisible();
    const picked = (await chart(page).getAttribute('aria-valuenow')) as string;
    await page.waitForTimeout(400);
    await expect(readout(page), 'the finger has lifted and the point is still read').toBeVisible();
    await expect(chart(page)).toHaveAttribute('aria-valuenow', picked);
    await expectReadoutBeside(page, Number(picked));

    await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height / 2);
    await expect(chart(page)).not.toHaveAttribute('aria-valuenow', picked);
    await expect(readout(page)).toBeVisible();

    await page.getByRole('heading', { level: 2, name: 'Your VO2max over time' }).tap();
    await expect(readout(page)).toHaveCount(0);
  });

  test('A9-K6 @mobile on a phone the readout of the first, the middle and the last point is inside the chart, and the page does not scroll sideways', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await page.setViewportSize({ width: 375, height: 812 });
    await openPage(page);
    await chart(page).scrollIntoViewIfNeeded();
    const { said } = await sayings(runner.api);
    await chart(page).focus();

    for (const [key, position] of [['Home', 0], ['End', said.length - 1]] as const) {
      await page.keyboard.press(key);
      await expect(chart(page)).toHaveAttribute('aria-valuenow', String(position));
      await expectReadoutBeside(page, position);
    }
    const middle = Math.floor(said.length / 2);
    await page.keyboard.press('Home');
    for (let step = 0; step < middle; step += 1) await page.keyboard.press('ArrowRight');
    await expect(chart(page)).toHaveAttribute('aria-valuenow', String(middle));
    await expectReadoutBeside(page, middle);
    await expectNoHorizontalOverflow(page);
  });
});
