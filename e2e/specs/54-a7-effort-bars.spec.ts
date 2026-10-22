// A7 Daily effort bars under the fitness chart, and the change over 14 days under its numbers, which came out of the Runalyze review. The strip
// of bars is the effort of each day the server's series carries; it has a scale of its own, a switch in the key beside the three lines, and a
// bar for the day being looked at. (The arrows and the 7 and 14 day lines under the three numbers are checked with the numbers themselves, in
// 31-f02, F02-H8.)
//
// What the bars show is worked out again here from the API's series: how many bars there are, how tall each is against the scale, what the
// scale is, and what a day reads when it is looked at, so a strip that drew the wrong days, the wrong heights or a scale of the wrong size fails.
import type { Locator, Page } from '@playwright/test';
import { oneDecimal, shortDay, signedChange, utcDay } from '../fixtures/format.ts';
import { sharedHistoryRunner, type RunnerWithHistory } from '../fixtures/history.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { expect, expectNoRawKeys, test } from '../fixtures/test.ts';

const WEEKS = 14;
const ROUTE = '/analysis/load-balance';

let runner: RunnerWithHistory;
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

test.beforeAll(async () => {
  test.setTimeout(480_000);
  runner = await sharedHistoryRunner('fitness', WEEKS);
});

interface Day {
  date: string;
  load: number;
  fitness: number;
  fatigue: number;
  form: number;
}

interface Series {
  points: Day[];
  projection: Array<{ date: string; fitness: number; fatigue: number; form: number }>;
  current: { fitness: number; fatigue: number; form: number };
}

const seriesOf = async (): Promise<Series> => (await runner.api.get(`/api/training/series?from=${utcDay(200)}`)).json;

const card = (page: Page): Locator => page.getByRole('region', { name: 'Fitness, fatigue and form', exact: true });
const chart = (page: Page): Locator => card(page).getByRole('slider', { name: /^Fitness, fatigue and form for \d+ days/ });
const effortSwitch = (page: Page): Locator => card(page).getByRole('group', { name: 'Lines to show' }).getByRole('button', { name: /^Daily effort/ });
const strip = (page: Page): Locator => card(page).locator('.analysis-fit-v2-effort');

/** The smallest round number (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 times a power of ten) that is at least `value`, as the methods document says. */
function roundCeiling(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const factor = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((candidate) => candidate * magnitude >= value - 1e-9) as number;
  return Number((factor * magnitude).toPrecision(12));
}

/** The bars as drawn: the height of each, from the path the strip is one of, and the strip's own box and scale (read off its two grid lines). */
async function barsOf(page: Page): Promise<{ heights: number[]; xs: number[]; stripHeight: number; scale: number }> {
  const drawn = await card(page).locator('.analysis-fit-v2-effort-bars').getAttribute('d');
  const bars = [...(drawn ?? '').matchAll(/M([\d.-]+),([\d.-]+)h([\d.-]+)v([\d.-]+)/g)].map((match) => ({ x: Number(match[1]), width: Number(match[3]), height: Number(match[4]) }));
  const lines = await strip(page).locator('line.analysis-fit-v2-grid').evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('y1'))));
  const labels = await strip(page).locator('text').allTextContents();
  return {
    heights: bars.map((bar) => bar.height),
    xs: bars.map((bar) => bar.x + bar.width / 2),
    stripHeight: Math.abs(lines[0] - lines[1]),
    scale: Number(labels[labels.length - 1].replace(/,/g, '')),
  };
}

async function openCard(page: Page): Promise<void> {
  await expect(card(page)).toBeVisible();
  await expect(chart(page)).toBeVisible();
  await expect(strip(page)).toBeVisible();
}

test.describe('A7 daily effort bars: what the strip says', () => {
  test('A7-H1 there is a bar for each day with effort, as tall as its share of the scale, and none for a day without a run', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    const series = await seriesOf();
    const loads = series.points.map((point) => point.load);
    const withEffort = loads.filter((load) => load > 0);
    expect(withEffort.length, 'the runner has days with running and days without').toBeGreaterThan(20);
    expect(withEffort.length).toBeLessThan(loads.length);

    const drawn = await barsOf(page);
    expect(drawn.heights, 'one bar for each day with effort').toHaveLength(withEffort.length);
    // Each bar is its day's effort against the scale, in the strip's own height: compared as sets, the days in the order of their size.
    const expected = withEffort.map((load) => (load / drawn.scale) * drawn.stripHeight).sort((a, b) => a - b);
    const actual = [...drawn.heights].sort((a, b) => a - b);
    for (const [index, height] of expected.entries()) expect(actual[index]).toBeCloseTo(Math.max(1, height), 1);
    // None of the bars is on the dotted days after today: the last bar is not to the right of today's position.
    const today = await chart(page).evaluate((node) => node.querySelector('line.analysis-fit-v2-today')?.getAttribute('x1') ?? null);
    expect(today).not.toBeNull();
    expect(Math.max(...drawn.xs)).toBeLessThanOrEqual(Number(today) + 0.01);
  });

  test('A7-H2 the strip has a scale of its own: 0 and the smallest round number that holds the biggest day', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    const series = await seriesOf();
    const biggest = Math.max(...series.points.map((point) => point.load));
    const scale = Math.max(10, roundCeiling(biggest));

    const labels = await strip(page).locator('text').allTextContents();
    expect(labels).toEqual(['Daily effort', '0', scale.toLocaleString('en-US')]);
    // The lines above have their own, bigger or smaller: a day's effort is not an average.
    const drawn = await barsOf(page);
    expect(drawn.scale).toBe(scale);
    expect(Math.max(...drawn.heights)).toBeCloseTo((biggest / scale) * drawn.stripHeight, 1);
  });

  test('A7-H3 the day looked at has its effort in the key, in the tooltip, in the slider\'s words and in the list, and its bar is marked', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    const series = await seriesOf();
    const last = series.points.length - 1;
    const slider = chart(page);
    await slider.focus();
    await expect(slider).toHaveAttribute('aria-valuenow', String(last));

    // Walk back through a run of days, a day with running and a rest day among them.
    let ranRest = false;
    let ranRun = false;
    for (let back = 0; back <= 9; back += 1) {
      const day = series.points[last - back];
      const load = Math.round(day.load);
      await expect(slider).toHaveAttribute('aria-valuenow', String(last - back));
      await expect(slider).toHaveAttribute('aria-valuetext', new RegExp(`Effort that day ${load.toLocaleString('en-US')}(,|$)`));
      await expect(effortSwitch(page).locator('strong')).toHaveText(load.toLocaleString('en-US'));
      await expect(card(page).locator('.analysis-fit-v2-tooltip .is-effort strong')).toHaveText(load.toLocaleString('en-US'));
      await expect(card(page).locator('.analysis-fit-v2-effort-selected')).toHaveCount(day.load > 0 ? 1 : 0);
      if (day.load > 0) ranRun = true;
      else ranRest = true;
      await page.keyboard.press('ArrowLeft');
    }
    expect(ranRun && ranRest, 'the days walked include a run and a rest').toBe(true);

    // The list a screen reader reads has the same figure for each real day, and none for the days after today.
    const items = card(page).locator('[data-analysis-history="fitness"] li');
    await expect(items).toHaveCount(series.points.length + series.projection.length);
    for (const index of [0, 10, last]) {
      await expect(items.nth(index)).toContainText(`Effort that day: ${Math.round(series.points[index].load).toLocaleString('en-US')}`);
    }
    await expect(items.nth(last + 1)).not.toContainText('Effort that day');
    await expect(items.nth(0)).toContainText(shortDay(series.points[0].date));
  });

  test('A7-H4 on the days after today there is no effort to show, and no bar', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    const slider = chart(page);
    await slider.focus();
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowRight');                       // End is the last day with running; the next is the first of the days after today

    await expect(card(page).locator('.analysis-fit-v2-tooltip time')).toContainText('If you rest');
    await expect(effortSwitch(page).locator('strong')).toHaveText('–');
    await expect(slider).not.toHaveAttribute('aria-valuetext', /Effort that day/);
    await expect(card(page).locator('.analysis-fit-v2-tooltip .is-effort')).toHaveCount(0);
    await expect(card(page).locator('.analysis-fit-v2-effort-selected')).toHaveCount(0);
  });

  test('A7-H5 the switch takes the strip away and brings it back, without touching a line, and it does not count as one of them', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    const height = (): Promise<number> => card(page).locator('svg.analysis-fit-v2-svg').evaluate((node) => Number(node.getAttribute('height')));
    const tall = await height();
    await expect(effortSwitch(page)).toHaveAttribute('aria-pressed', 'true');

    // The bars are not a line: with them showing, the lines still go down to one and not to none.
    const switches = card(page).getByRole('group', { name: 'Lines to show' });
    const lineSwitch = (name: string): Locator => switches.getByRole('button', { name: new RegExp(`^${name}`) });
    for (const name of ['Fatigue', 'Form', 'Fitness']) await lineSwitch(name).click();
    await expect(lineSwitch('Fitness')).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page).locator('.analysis-fit-v2-line:not(.is-projected)')).toHaveCount(1);
    await expect(strip(page)).toBeVisible();
    for (const name of ['Fatigue', 'Form']) await lineSwitch(name).click();

    // The switch takes the strip and the room above it, and leaves every line where it was.
    await effortSwitch(page).click();
    await expect(effortSwitch(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(strip(page)).toHaveCount(0);
    expect(tall - (await height()), 'the strip and the room above it go').toBe(24 + 58);
    await expect(card(page).locator('.analysis-fit-v2-line.is-fitness:not(.is-projected)')).toBeVisible();
    await expect(card(page).locator('.analysis-fit-v2-line.is-fatigue:not(.is-projected)')).toBeVisible();
    await expect(card(page).locator('.analysis-fit-v2-form-area.is-fresh, .analysis-fit-v2-form-area.is-tired').first()).toBeAttached();

    await effortSwitch(page).click();
    await expect(strip(page)).toBeVisible();
    await expect(effortSwitch(page)).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('A7 daily effort bars: when the chart is short, and in other conditions', () => {
  test('A7-E1 when the chart does not reach back 15 days the 14 day lines are left out and the 7 day lines stay', async ({ browser, baseURL, guard }) => {
    const series = await seriesOf();
    const short = { ...series, points: series.points.slice(-14) };
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.route('**/api/training/series**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(short) }));
    await page.goto(ROUTE);
    await openCard(page);

    await expect(card(page)).not.toContainText('in the last 14 days');
    for (const index of [0, 1, 2]) await expect(card(page).locator('.analysis-fit-v2-metrics article').nth(index)).toContainText('in the last 7 days');
    await expect(card(page).locator('.analysis-fit-v2-metrics .analysis-fit-v2-arrow')).toHaveCount(3);
  });

  test('A7-L1 in Chinese the switch and the lines under the numbers are translated and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(ROUTE);
    const chinese = page.getByRole('region', { name: '体能、疲劳与状态', exact: true });
    await expect(chinese.getByRole('slider')).toBeVisible();
    const series = await seriesOf();
    const now = series.points.at(-1) as Day;
    const back = series.points.at(-15) as Day;
    const formChange = now.form - back.form;

    await expect(chinese.getByRole('group', { name: '要显示的曲线' }).getByRole('button', { name: /^每日强度/ })).toBeVisible();
    await expect(chinese.locator('.analysis-fit-v2-effort-caption')).toHaveText('每日强度');
    await expect(chinese.locator('.analysis-fit-v2-metrics article').nth(2)).toContainText(`近 14 天 ${signedChange(formChange)}`);
    await expect(chinese.locator('.analysis-fit-v2-metrics article').nth(0)).toContainText(`近 14 天 ${signedChange(now.fitness - back.fitness)}（`);
    await expectNoRawKeys(page);
    expect(oneDecimal(now.fitness)).toMatch(/^\d+\.\d$/);
  });

  test('A7-M1 @mobile the strip is shorter on a phone, and the chart and the tiles fit it', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await page.setViewportSize({ width: 375, height: 812 });
    await openCard(page);
    const svg = await card(page).locator('svg.analysis-fit-v2-svg').evaluate((node) => ({ width: node.getBoundingClientRect().width, height: Number(node.getAttribute('height')) }));

    expect(svg.width).toBeLessThanOrEqual(375);
    expect(svg.height, 'a phone chart is 250 high, with a strip of 46 and 24 above it').toBe(250 + 24 + 46);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
