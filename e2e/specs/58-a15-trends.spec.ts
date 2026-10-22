// A15 Trends, a page of the analysis section that came out of the Runalyze review (F33, trend analysis): one thing about the runner's runs (pace, distance, time, heart rate,
// efficiency or cadence), run by run over a period, with the middle of it, the range the runs usually keep to, a trend line and the stretch before for comparison.
//
// Every figure is worked out again here, in this file, from the runs the API lists and the rules of the methods document (docs/README-ANALYSIS.md, "Trends"): the value of a
// run, the period in calendar months ending on the runner's today, the median and the percentiles between the two nearest values, the least-squares line and the share of
// the differences it accounts for, the mean of the latest ten runs, and the comparison with the stretch before. So a page that put a run in the wrong period, took the wrong
// middle or fitted the wrong line fails.
import type { Locator, Page } from '@playwright/test';
import { Api, freshClientAddress, newRunner } from '../fixtures/api.ts';
import { KM_PER_MILE, importRunSpecs, sharedRunner, type RunSpec } from '../fixtures/analysis.ts';
import { addDays, addMonths, hms, mmss, shortDate } from '../fixtures/format.ts';
import { markRatios } from '../fixtures/marks.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { elementsBeyondTheEdge, enlargeText, readingsThatCollide, readoutSticksOut } from '../fixtures/reflow.ts';
import { browserToday } from '../fixtures/strain.ts';
import { a11yViolations, contrastProblems, expect, expectNoRawKeys, test } from '../fixtures/test.ts';

const ROUTE = '/analysis/trends';
const pages = pageOpener();
async function setProfileUnits(api: Api, units: 'metric' | 'imperial' = 'metric'): Promise<void> {
  const profile = (await api.get('/api/training/me')).json;
  if (profile.units === units) return;
  expect((await api.request('PATCH', '/api/training/me', {
    body: { units }, headers: { 'If-Match': String(profile.revision), 'Idempotency-Key': crypto.randomUUID() },
  })).status).toBe(200);
}
test.afterEach(() => pages.closeAll());

const METRICS = ['pace', 'distance', 'duration', 'heartRate', 'efficiency', 'cadence'] as const;
type Metric = (typeof METRICS)[number];
type RunSet = 'all' | 'ordinary' | 'long' | 'workout' | 'race';
type Range = '3m' | '6m' | '1y' | 'all';
type Box = { x: number; y: number; width: number; height: number };

interface Row {
  id: number;
  name: string;
  distanceKm: number;
  movingTimeSeconds: number;
  averageHeartRate: number | null;
  averageCadence: number | null;
  startTime: string;
  runType: string | null;
}
interface Point {
  row: Row;
  day: string;
  x: number;
  value: number;
}

const rowsOf = async (api: Api): Promise<Row[]> => {
  const result = await api.get('/api/activities/analysis');
  expect(result.status, 'analysis rows API succeeds').toBe(200);
  expect(Array.isArray(result.json), 'analysis rows are a list').toBe(true);
  return result.json;
};
const whoOf = (made: { api: Api; email: string }): { token: string; email: string } => ({ token: made.api.token as string, email: made.email });

/** The runner's today as the page counts it: the date on the device, or the date of the latest run when that is ahead of it by two days at most. */
function runnersToday(rows: Row[]): string {
  const device = browserToday();
  const limit = addDays(device, 2);
  return rows.map((row) => row.startTime.slice(0, 10)).filter((day) => day > device && day <= limit).sort().pop() ?? device;
}

const dayOf = (row: Row): string => row.startTime.slice(0, 10);
/** The day as a number, with the hour of the start as a fraction of a day (the methods document's x). */
function xOf(row: Row): number {
  const [year, month, day] = dayOf(row).split('-').map(Number);
  const clock = /T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(row.startTime);
  const seconds = clock ? Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3] ?? 0) : 0;
  return Date.UTC(year, month - 1, day) / 86_400_000 + seconds / 86_400;
}

const heartRateOf = (row: Row): number | null => (row.averageHeartRate != null && row.averageHeartRate > 40 && row.averageHeartRate < 250 ? row.averageHeartRate : null);

function valueOf(row: Row, metric: Metric): number | null {
  if (!(row.distanceKm > 0) || !(row.movingTimeSeconds > 0)) return null;
  switch (metric) {
    case 'pace': return row.movingTimeSeconds / row.distanceKm;
    case 'distance': return row.distanceKm;
    case 'duration': return row.movingTimeSeconds;
    case 'heartRate': return heartRateOf(row);
    case 'efficiency': {
      const bpm = heartRateOf(row);
      return bpm == null ? null : (row.distanceKm * 1000) / (row.movingTimeSeconds / 60) / bpm;
    }
    case 'cadence': return row.averageCadence != null && row.averageCadence > 0 && row.averageCadence < 300 ? row.averageCadence : null;
    default: return null;
  }
}

function inSet(row: Row, set: RunSet): boolean {
  if (set === 'all') return true;
  const type = (row.runType ?? '').toUpperCase();
  if (set === 'ordinary') return !['RACE', 'LONG_RUN', 'WORKOUT'].includes(type);
  return type === { long: 'LONG_RUN', workout: 'WORKOUT', race: 'RACE' }[set];
}

/** The period and the stretch before it, in days: the last N calendar months ending on today, or everything from the first run with a value. */
function periodOf(range: Range, today: string, firstDay: string): { from: string; before: { from: string; to: string } | null } {
  const months = { '3m': 3, '6m': 6, '1y': 12, all: 0 }[range];
  if (!months) return { from: firstDay, before: null };
  const from = addMonths(today, -months);
  return { from, before: { from: addMonths(from, -months), to: addDays(from, -1) } };
}

/** The value below which a share p of the ascending list falls, between its two nearest values in proportion. */
function quantile(sorted: number[], p: number): number {
  const position = (sorted.length - 1) * p;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (position - low) * (sorted[high] - sorted[low]);
}

function summarize(values: number[]): { count: number; median: number; min: number; max: number; low: number; high: number; usual: boolean } | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const usual = sorted.length >= 10;
  return {
    count: sorted.length,
    median: quantile(sorted, 0.5),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    low: usual ? quantile(sorted, 0.1) : sorted[0],
    high: usual ? quantile(sorted, 0.9) : sorted[sorted.length - 1],
    usual,
  };
}

/** The least-squares line: null (with the reason) for under 5 runs or under 14 days; otherwise the change in a month, along the period and the fit. */
function straight(points: Point[]): { reason: 'few' | 'short' } | { slopeMonth: number; change: number; r2: number } {
  if (points.length < 5) return { reason: 'few' };
  const span = points[points.length - 1].x - points[0].x;
  if (span < 14) return { reason: 'short' };
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.value, 0) / points.length;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const point of points) {
    sxx += (point.x - meanX) ** 2;
    sxy += (point.x - meanX) * (point.value - meanY);
    syy += (point.value - meanY) ** 2;
  }
  const slope = sxy / sxx;
  return { slopeMonth: slope * 30, change: slope * span, r2: syy === 0 ? 0 : (sxy * sxy) / (sxx * syy) };
}

/** The mean of the latest ten runs at each run from the fifth on. */
function average(points: Point[]): number[] {
  const out: number[] = [];
  for (let index = 4; index < points.length; index += 1) {
    const window = points.slice(Math.max(0, index - 9), index + 1);
    out.push(window.reduce((sum, point) => sum + point.value, 0) / window.length);
  }
  return out;
}

interface Found {
  today: string;
  from: string;
  points: Point[];
  leftOut: number;
  stats: ReturnType<typeof summarize>;
  before: { from: string; to: string; stats: ReturnType<typeof summarize> } | null;
}

function trendOf(rows: Row[], { metric = 'pace', set = 'all', range = '6m' }: { metric?: Metric; set?: RunSet; range?: Range } = {}): Found {
  const today = runnersToday(rows);
  const eligible = rows.filter((row) => dayOf(row) <= today && row.distanceKm > 0 && row.movingTimeSeconds > 0 && inSet(row, set));
  const withValue = eligible.filter((row) => valueOf(row, metric) != null);
  const firstDay = withValue.map(dayOf).sort()[0] ?? today;
  const period = periodOf(range, today, firstDay);
  const within = (row: Row, from: string, to: string): boolean => dayOf(row) >= from && dayOf(row) <= to;
  const points = withValue
    .filter((row) => within(row, period.from, today))
    .map((row): Point => ({ row, day: dayOf(row), x: xOf(row), value: valueOf(row, metric) as number }))
    .sort((a, b) => a.x - b.x || a.row.id - b.row.id);
  const leftOut = eligible.filter((row) => valueOf(row, metric) == null && within(row, period.from, today)).length;
  const before = period.before
    ? { ...period.before, stats: summarize(withValue.filter((row) => within(row, period.before!.from, period.before!.to)).map((row) => valueOf(row, metric) as number)) }
    : null;
  return { today, from: period.from, points, leftOut, stats: summarize(points.map((point) => point.value)), before };
}

// How the page writes a value, an amount and a direction, in kilometres.
const PACE_WORDS = { up: 'slower', down: 'quicker' };
function valueText(metric: Metric, value: number, unit: 'km' | 'mile' = 'km'): string {
  switch (metric) {
    case 'pace': return unit === 'mile' ? `${mmss(value * KM_PER_MILE)} /mi` : `${mmss(value)} /km`;
    case 'distance': return unit === 'mile' ? `${(value / KM_PER_MILE).toFixed(1)} mi` : `${value.toFixed(1)} km`;
    case 'duration': return Math.round(value) >= 3600 ? hms(value) : mmss(value);
    case 'heartRate': return `${Math.round(value)} bpm`;
    case 'efficiency': return `${value.toFixed(2)} m/beat`;
    default: return `${Math.round(value)} spm`;
  }
}
function amountText(metric: Metric, delta: number): string {
  const amount = Math.abs(delta);
  switch (metric) {
    case 'pace': return `${mmss(amount)} /km`;
    case 'distance': return `${amount.toFixed(1)} km`;
    case 'duration': return Math.round(amount) >= 3600 ? hms(amount) : mmss(amount);
    case 'heartRate': return `${amount.toFixed(1)} bpm`;
    case 'efficiency': return `${amount.toFixed(2)} m/beat`;
    default: return `${amount.toFixed(1)} spm`;
  }
}
/** Whether a change is nothing at the precision it is written to (the methods document's limits). */
function isLevel(metric: Metric, delta: number): boolean {
  const amount = Math.abs(delta);
  if (metric === 'pace' || metric === 'duration') return amount < 0.5;
  if (metric === 'efficiency') return amount < 0.005;
  return amount < 0.05;
}
function wayOf(metric: Metric, delta: number): string {
  if (metric === 'pace') return delta < 0 ? PACE_WORDS.down : PACE_WORDS.up;
  if (metric === 'distance' || metric === 'duration') return delta > 0 ? 'longer' : 'shorter';
  return delta > 0 ? 'higher' : 'lower';
}
const TYPE_LABEL: Record<string, string> = { RACE: 'Race', LONG_RUN: 'Long run', WORKOUT: 'Workout' };
/** What the slider says for a run. */
function said(metric: Metric, point: Point): string {
  const type = (point.row.runType ?? '').toUpperCase();
  return `${shortDate(new Date(`${point.day}T12:00:00Z`))}: ${valueText(metric, point.value)}, ${point.row.name}${type ? `, ${TYPE_LABEL[type]}` : ''}`;
}

const SPAN: Record<string, string> = { '3m': '3 months', '6m': '6 months', '1y': 'year' };
const COMPARE_LABEL: Record<string, string> = { '3m': 'Against the 3 months before', '6m': 'Against the 6 months before', '1y': 'Against the year before' };

/** The sentences under the chart about the line, as the page says them. */
function lineSentences(metric: Metric, found: Found): string[] {
  const points = found.points;
  const result = straight(points);
  if ('reason' in result) {
    return [result.reason === 'short'
      ? 'A straight line needs the runs to be spread over at least 14 days.'
      : `A straight line needs at least 5 runs in the period, and the period has ${points.length}.`];
  }
  if (isLevel(metric, result.slopeMonth)) return ['A straight line through the runs is level.'];
  const fit = result.r2 < 0.1 ? 'hardly a trend' : result.r2 < 0.3 ? 'a loose trend' : 'a clear trend';
  return [
    `A straight line through the runs goes ${amountText(metric, result.slopeMonth)} ${wayOf(metric, result.slopeMonth)} each month, ${amountText(metric, result.change)} ${wayOf(metric, result.change)} over the period.`,
    `It accounts for ${Math.round(result.r2 * 100)}% of the differences between the runs: ${fit}.`,
  ];
}
function compareSentence(metric: Metric, range: Range, found: Found): string | null {
  if (!found.before || !found.stats) return null;
  const span = SPAN[range];
  const before = found.before.stats;
  if (found.stats.count < 3 || !before || before.count < 3) {
    return `Too few runs to compare with the ${span} before: it needs 3 in each, and that stretch has ${before?.count ?? 0}.`;
  }
  const change = found.stats.median - before.median;
  if (isLevel(metric, change)) return `The middle of this period is the same as the middle of the ${span} before it (${valueText(metric, before.median)}).`;
  return `The middle of this period is ${valueText(metric, found.stats.median)}, ${amountText(metric, change)} ${wayOf(metric, change)} than the middle of the ${span} before it (${valueText(metric, before.median)}).`;
}

// ---- the page
const heading = (page: Page): Locator => page.getByRole('heading', { level: 2, name: 'Trends', exact: true });
const chart = (page: Page): Locator => page.getByRole('slider');
const readout = (page: Page): Locator => page.locator('.metric-trend-v2__tooltip');
const dots = (page: Page): Locator => page.locator('svg circle.metric-trend-v2__dot');
const reads = (page: Page): Locator => page.getByRole('group', { name: 'Readings for the period' });
const tile = (page: Page, label: string): Locator => reads(page).locator('> div').filter({ has: page.getByText(label, { exact: true }) });
const chip = (page: Page, group: string, label: string): Locator => page.getByRole('group', { name: group, exact: true }).getByRole('button', { name: label, exact: true });
const notes = (page: Page): Locator => page.locator('.metric-trend-v2__sentences .metric-trend-v2__note');

async function openPage(page: Page): Promise<void> {
  await expect(heading(page)).toBeVisible();
  await expect(reads(page)).toBeVisible();
}

/** The address of a view: the choices that are not the defaults. */
function viewOf({ metric = 'pace', set = 'all', range = '6m', line = 'straight' }: { metric?: Metric; set?: RunSet; range?: Range; line?: string } = {}): string {
  const params = new URLSearchParams();
  if (metric !== 'pace') params.set('metric', metric);
  if (set !== 'all') params.set('runs', set);
  if (range !== '6m') params.set('range', range);
  if (line !== 'straight') params.set('line', line);
  const text = params.toString();
  return text ? `${ROUTE}?${text}` : ROUTE;
}

// Sixty runs six days apart, the newest two days back and the oldest 356, slower the further back (with a wobble), a heart rate that wobbles round 144, every ninth
// without one, distances of 5 to 10 km, and types for some of them (every tenth from the fifth a Workout, the 6th, 23rd, 40th and 57th a Race, the 31st a Long run).
const FIXTURE: RunSpec[] = Array.from({ length: 60 }, (_, k) => ({
  name: `E2E a15 run ${k}`,
  daysBack: 2 + 6 * k,
  km: 5 + (k % 6),
  pace: Math.round(290 + k * 1.1 + ((k * 7) % 5) * 4),
  hr: k % 9 === 8 ? null : 140 + ((k * 5) % 9),
}));
const typeOfRun = (k: number): string | null => (k % 10 === 4 ? 'WORKOUT' : k % 17 === 5 ? 'RACE' : k === 30 ? 'LONG_RUN' : null);

let runner: Awaited<ReturnType<typeof sharedRunner<null>>>;
test.beforeEach(async () => { runner.api.clientIp = freshClientAddress(); await setProfileUnits(runner.api); });

test.beforeAll(async () => {
  test.setTimeout(900_000);
  runner = await sharedRunner('a15', async ({ api }) => {
    const ids = await importRunSpecs(api, FIXTURE, { wait: false });
    for (let k = 0; k < ids.length; k += 1) {
      const type = typeOfRun(k);
      if (type) expect((await api.patch(`/api/activities/${ids[k]}`, { runType: type })).status).toBe(200);
    }
    return null;
  });
});

test.describe('A15 trends: what the page says', () => {
  test('A15-H1 the first view is the pace of all runs over 6 months: the runs, their middle, their usual range, the line and the stretch before, worked out again from the runs', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const rows = await rowsOf(runner.api);
    const found = trendOf(rows);
    const stats = found.stats!;
    expect(found.points.length, 'the fixture has many runs in the 6 months').toBeGreaterThan(25);
    expect(found.before?.stats?.count, 'and some in the 6 months before').toBeGreaterThanOrEqual(3);

    for (const [group, label] of [['Show', 'Pace'], ['Which runs', 'All runs'], ['Period', '6 months'], ['Trend line', 'Straight line']] as const) {
      await expect(chip(page, group, label)).toHaveAttribute('aria-pressed', 'true');
    }
    expect(new URL(page.url()).search).toBe('');
    await expect(tile(page, 'Runs').locator('strong')).toHaveText(String(stats.count));
    await expect(tile(page, 'Runs').locator('small')).toHaveText(`From ${shortDate(new Date(`${found.points[0].day}T12:00:00Z`))} to ${shortDate(new Date(`${found.points[found.points.length - 1].day}T12:00:00Z`))}`);
    await expect(tile(page, 'Middle').locator('strong')).toHaveText(valueText('pace', stats.median));
    await expect(tile(page, 'Usual range').locator('strong')).toHaveText(`${valueText('pace', stats.low)} to ${valueText('pace', stats.high)}`);
    const change = stats.median - found.before!.stats!.median;
    await expect(tile(page, 'Against the 6 months before').locator('strong')).toHaveText(`${amountText('pace', change)} ${wayOf('pace', change)}`);

    await expect(dots(page)).toHaveCount(stats.count);
    const heights = await dots(page).evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('cy'))));
    const paces = found.points.map((point) => point.value);
    expect(heights[paces.indexOf(Math.min(...paces))], 'the quickest run is the highest dot: the pace axis is turned over').toBeLessThan(heights[paces.indexOf(Math.max(...paces))]);
    await expect(page.locator('svg line.metric-trend-v2__middle')).toHaveCount(1);
    await expect(page.locator('svg line.metric-trend-v2__trend')).toHaveCount(1);
    await expect(page.locator('svg rect.metric-trend-v2__band')).toHaveCount(1);
    const sentences = [...lineSentences('pace', found), compareSentence('pace', '6m', found)].filter(Boolean) as string[];
    await expect(notes(page).first()).toHaveText(lineSentences('pace', found).join(' '));
    await expect(notes(page).nth(1)).toHaveText(sentences[sentences.length - 1]);
  });

  for (const metric of ['distance', 'duration', 'heartRate', 'efficiency'] as const) {
    test(`A15-H2 ${metric}: the runs, the middle, the usual range, the line and the runs left out, worked out again`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, runner, viewOf({ metric }));
      await openPage(page);
      const found = trendOf(await rowsOf(runner.api), { metric });
      const stats = found.stats!;

      await expect(chip(page, 'Show', { distance: 'Distance', duration: 'Time', heartRate: 'Heart rate', efficiency: 'Efficiency' }[metric])).toHaveAttribute('aria-pressed', 'true');
      await expect(tile(page, 'Runs').locator('strong')).toHaveText(String(stats.count));
      await expect(tile(page, 'Middle').locator('strong')).toHaveText(valueText(metric, stats.median));
      await expect(tile(page, 'Usual range').locator('strong')).toHaveText(`${valueText(metric, stats.low)} to ${valueText(metric, stats.high)}`);
      await expect(dots(page)).toHaveCount(stats.count);
      const heights = await dots(page).evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('cy'))));
      const values = found.points.map((point) => point.value);
      expect(heights[values.indexOf(Math.max(...values))], 'the largest value is the highest dot').toBeLessThan(heights[values.indexOf(Math.min(...values))]);
      await expect(notes(page).first()).toHaveText(lineSentences(metric, found).join(' '));
      if (metric === 'heartRate' || metric === 'efficiency') {
        expect(found.leftOut, 'some runs of the fixture have no heart rate').toBeGreaterThan(0);
        await expect(page.getByText(`Runs with no heart rate are left out: ${found.leftOut}.`)).toBeVisible();
      } else {
        await expect(page.getByText(/are left out/)).toHaveCount(0);
      }
    });
  }

  test('A15-H3 every set of runs over every period has the runs that belong to it, and a stretch before for all but all time', async ({ browser, baseURL, guard }) => {
    test.setTimeout(300_000);
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const rows = await rowsOf(runner.api);
    for (const set of ['all', 'ordinary', 'long', 'workout', 'race'] as const) {
      for (const range of ['3m', '6m', '1y', 'all'] as const) {
        const found = trendOf(rows, { set, range });
        await page.goto(viewOf({ set, range }));
        const label = `${set} over ${range}`;
        if (found.points.length === 0) {
          await expect(page.getByRole('heading', { level: 2, name: 'No run to show' }), label).toBeVisible();
          continue;
        }
        await expect(tile(page, 'Runs').locator('strong'), label).toHaveText(String(found.points.length));
        await expect(tile(page, 'Middle').locator('strong'), label).toHaveText(valueText('pace', found.stats!.median));
        await expect(tile(page, 'Usual range').locator('strong'), label).toHaveText(`${valueText('pace', found.stats!.low)} to ${valueText('pace', found.stats!.high)}`);
        await expect(tile(page, 'Usual range').locator('small'), label).toContainText(found.stats!.usual ? '10th to the 90th percentile' : 'Lowest to highest');
        if (range === 'all') {
          const latest = found.points[found.points.length - 1];
          await expect(tile(page, 'Latest run').locator('strong'), label).toHaveText(valueText('pace', latest.value));
        } else {
          await expect(tile(page, COMPARE_LABEL[range]), label).toBeVisible();
          await expect(notes(page).last(), label).toHaveText(compareSentence('pace', range, found) as string);
        }
      }
    }
  });

  test('A15-H4 the average line is the mean of the latest ten runs at each run from the fifth, and the page says where it went', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, viewOf({ line: 'average' }));
    await openPage(page);
    const found = trendOf(await rowsOf(runner.api));
    const means = average(found.points);
    expect(means.length).toBe(found.points.length - 4);

    await expect(page.locator('svg path.metric-trend-v2__trend.is-average')).toHaveCount(1);
    await expect(page.locator('svg line.metric-trend-v2__trend')).toHaveCount(0);
    const path = (await page.locator('svg path.metric-trend-v2__trend.is-average').getAttribute('d')) as string;
    expect((path.match(/[ML]/g) ?? []).length, 'a point of the line for each run from the fifth').toBe(means.length);
    const change = means[means.length - 1] - means[0];
    await expect(notes(page).first()).toHaveText(`The average of the latest 10 runs went from ${valueText('pace', means[0])} to ${valueText('pace', means[means.length - 1])}: ${amountText('pace', change)} ${wayOf('pace', change)}.`);
    await expect(chip(page, 'Trend line', 'Average of 10 runs')).toHaveAttribute('aria-pressed', 'true');
  });

  test('A15-H5 the choices are in the address: they are written, kept over a reload, dropped when they are the default again, and Back leaves the page', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, '/analysis');
    await page.goto(ROUTE);
    await openPage(page);
    expect(new URL(page.url()).pathname).toBe('/analysis');
    expect(new URL(page.url()).hash).toBe('#analysis-trends');

    await chip(page, 'Show', 'Heart rate').click();
    await chip(page, 'Which runs', 'Workouts').click();
    await chip(page, 'Period', '3 months').click();
    await chip(page, 'Trend line', 'Average of 10 runs').click();
    expect(new URLSearchParams(new URL(page.url()).search).toString()).toBe('metric=heartRate&runs=workout&range=3m&line=average');

    await page.reload();
    await expect(heading(page)).toBeVisible();
    for (const [group, label] of [['Show', 'Heart rate'], ['Which runs', 'Workouts'], ['Period', '3 months'], ['Trend line', 'Average of 10 runs']] as const) {
      await expect(chip(page, group, label)).toHaveAttribute('aria-pressed', 'true');
    }
    await chip(page, 'Show', 'Pace').click();
    await chip(page, 'Period', '6 months').click();
    expect(new URLSearchParams(new URL(page.url()).search).toString()).toBe('runs=workout&line=average');

    await page.goBack();
    await expect(page.getByRole('heading', { level: 2, name: 'Go deeper' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/analysis');
  });
});

test.describe('A15 trends: reading one run', () => {
  async function expectReadoutInChart(page: Page): Promise<void> {
    const frame = (await chart(page).boundingBox()) as Box;
    const tip = (await readout(page).boundingBox()) as Box;
    expect(tip.x, 'the readout starts inside the chart').toBeGreaterThanOrEqual(frame.x - 1);
    expect(tip.x + tip.width, 'and ends inside it').toBeLessThanOrEqual(frame.x + frame.width + 1);
    expect(tip.y).toBeGreaterThanOrEqual(frame.y - 1);
    expect(tip.y + tip.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
  }

  test('A15-K1 from the keyboard: Tab brings the chart the newest run, the arrows walk every run, and Home, End and Escape do what they say', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const found = trendOf(await rowsOf(runner.api));
    const last = found.points.length - 1;

    await expect(readout(page)).toHaveCount(0);
    await chip(page, 'Trend line', 'Average of 10 runs').focus();
    await page.keyboard.press('Tab');
    await expect(chart(page)).toBeFocused();
    await expect(chart(page)).toHaveAttribute('aria-valuenow', String(last));
    await expect(chart(page)).toHaveAttribute('aria-valuetext', said('pace', found.points[last]));
    await expect(readout(page).locator('time')).toHaveText(shortDate(new Date(`${found.points[last].day}T12:00:00Z`)));
    await expect(readout(page).locator('strong')).toHaveText(valueText('pace', found.points[last].value));

    for (let index = last - 1; index >= 0; index -= 1) {
      await page.keyboard.press('ArrowLeft');
      await expect(chart(page)).toHaveAttribute('aria-valuenow', String(index));
      expect(await chart(page).getAttribute('aria-valuetext'), `run ${index + 1} of ${found.points.length}`).toBe(said('pace', found.points[index]));
    }
    await page.keyboard.press('ArrowLeft');
    await expect(chart(page)).toHaveAttribute('aria-valuenow', '0');
    await page.keyboard.press('End');
    await expect(chart(page)).toHaveAttribute('aria-valuenow', String(last));
    await page.keyboard.press('Home');
    await expect(chart(page)).toHaveAttribute('aria-valuenow', '0');
    await page.keyboard.press('Escape');
    await expect(readout(page)).toHaveCount(0);
    await expect(chart(page).locator('circle.metric-trend-v2__selected')).toHaveCount(0);
  });

  test('A15-K2 for a screen reader every run is in a list, oldest first, with the words of the slider', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const found = trendOf(await rowsOf(runner.api));
    const items = page.getByRole('list', { name: 'Every run of the period, oldest first' }).getByRole('listitem');
    await expect(items).toHaveCount(found.points.length);
    const texts = await items.allTextContents();
    expect(texts).toEqual(found.points.map((point) => said('pace', point)));
    expect(texts.some((text) => /, Workout$/.test(text)) && texts.some((text) => /, Race$/.test(text)), 'the runs that have a type say it').toBe(true);
    await expect(chart(page)).toHaveAttribute('aria-label', new RegExp(`^${found.points.length} runs from .* to .*, pace from ${valueText('pace', found.stats!.min).replace('.', '\\.')} to ${valueText('pace', found.stats!.max)}\\.`));
  });

  test('A15-K3 with the mouse: the readout follows the pointer to the nearest run and stays inside the chart, and goes when the pointer leaves', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const found = trendOf(await rowsOf(runner.api));
    await chart(page).scrollIntoViewIfNeeded();
    const box = (await chart(page).boundingBox()) as Box;
    const viewWidth = await chart(page).locator('svg').evaluate((node) => Number((node.getAttribute('viewBox') ?? '').split(' ')[2]));
    const centres = await dots(page).evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('cx'))));
    const scale = box.width / viewWidth;

    for (const fraction of [0.1, 0.35, 0.5, 0.75, 0.97]) {
      const x = box.x + box.width * fraction;
      await page.mouse.move(x, box.y + box.height / 2);
      const nearest = centres.reduce((best, centre, index) => (Math.abs(centre * scale - (x - box.x)) < Math.abs(centres[best] * scale - (x - box.x)) ? index : best), 0);
      await expect(chart(page), `at ${Math.round(fraction * 100)}% of the width`).toHaveAttribute('aria-valuenow', String(nearest));
      await expect(chart(page)).toHaveAttribute('aria-valuetext', said('pace', found.points[nearest]));
      await expectReadoutInChart(page);
    }
    await heading(page).hover();
    await expect(readout(page)).toHaveCount(0);
  });

  test('A15-K4 with a finger: a tap picks a run and keeps it after the finger lifts, and a tap elsewhere lets go', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE, { hasTouch: true, viewport: { width: 390, height: 844 } });
    await openPage(page);
    await chart(page).scrollIntoViewIfNeeded();
    const box = (await chart(page).boundingBox()) as Box;

    await page.touchscreen.tap(box.x + box.width * 0.4, box.y + box.height / 2);
    await expect(readout(page)).toBeVisible();
    const picked = (await chart(page).getAttribute('aria-valuenow')) as string;
    await page.waitForTimeout(400);
    await expect(readout(page), 'the finger has lifted and the run is still read').toBeVisible();
    await expect(chart(page)).toHaveAttribute('aria-valuenow', picked);
    await expectReadoutInChart(page);
    await heading(page).tap();
    await expect(readout(page)).toHaveCount(0);
  });

  for (const [width, percent] of [[1280, 150], [1280, 200], [390, 150], [390, 200]] as const) {
    test(`A15-K5 at ${width} px with the text at ${percent}% the readout of every run stays inside the chart`, async ({ browser, baseURL, guard }) => {
      test.setTimeout(240_000);
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.setViewportSize({ width, height: 800 });
      await page.goto(viewOf({ range: '1y' }));
      await openPage(page);
      await enlargeText(page, percent);
      await chart(page).scrollIntoViewIfNeeded();
      await chart(page).focus();
      const count = Number(await chart(page).getAttribute('aria-valuemax')) + 1;
      await page.keyboard.press('Home');
      for (let index = 0; index < count; index += 1) {
        await expect(readout(page), `run ${index + 1}`).toBeVisible();
        expect(await readoutSticksOut(chart(page), '.metric-trend-v2__tooltip'), `run ${index + 1} of ${count}`).toBe('');
        if (index < count - 1) await page.keyboard.press('ArrowRight');
      }
    });
  }
});

test.describe('A15 trends: runners it has little to say to, and other conditions', () => {
  test('A15-E1 a runner with one run sees it, and the page says what a line and a comparison need', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const made = await newRunner('a15-one');
    await importRunSpecs(made.api, [{ name: 'E2E a15 only run', daysBack: 9, km: 6, pace: 330, hr: 150 }], { wait: false });
    const page = await pages.open(browser, baseURL, guard, whoOf(made), ROUTE);
    await openPage(page);
    const found = trendOf(await rowsOf(made.api));

    await expect(tile(page, 'Runs').locator('strong')).toHaveText('1');
    await expect(dots(page)).toHaveCount(1);
    await expect(chart(page)).toHaveAttribute('aria-label', `One run, on ${shortDate(new Date(`${found.points[0].day}T12:00:00Z`))}: ${valueText('pace', found.points[0].value)}.`);
    await expect(notes(page).first()).toHaveText('A straight line needs at least 5 runs in the period, and the period has 1.');
    await expect(notes(page).nth(1)).toHaveText('Too few runs to compare with the 6 months before: it needs 3 in each, and that stretch has 0.');
    await expect(page.locator('svg line.metric-trend-v2__trend')).toHaveCount(0);
    await expect(tile(page, 'Usual range').locator('small')).toContainText('Lowest to highest');
    await chart(page).focus();
    await expect(readout(page)).toBeVisible();
  });

  test('A15-E6 six runs inside ten days are enough runs and too few days: the page says a straight line needs 14, and still shows the middle and the dots', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const made = await newRunner('a15-short');
    await importRunSpecs(made.api, [3, 5, 7, 9, 11, 13].map((daysBack): RunSpec => ({ name: `E2E a15 short ${daysBack}`, daysBack, km: 6, pace: 330 - daysBack, hr: 150 })), { wait: false });
    const page = await pages.open(browser, baseURL, guard, whoOf(made), ROUTE);
    await openPage(page);
    const found = trendOf(await rowsOf(made.api));
    expect(found.points.length).toBe(6);

    await expect(notes(page).first()).toHaveText('A straight line needs the runs to be spread over at least 14 days.');
    await expect(page.locator('svg line.metric-trend-v2__trend')).toHaveCount(0);
    await expect(dots(page)).toHaveCount(6);
    await expect(tile(page, 'Middle').locator('strong')).toHaveText(valueText('pace', found.stats!.median));
  });

  test('A15-E2 a runner with no run is told there is nothing to show and is offered the runs, and the choices are still there', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const made = await newRunner('a15-none');
    const page = await pages.open(browser, baseURL, guard, whoOf(made), ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: 'No run to show' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open your runs' })).toHaveAttribute('href', '/runs');
    await expect(chart(page)).toHaveCount(0);
    await expect(chip(page, 'Show', 'Pace')).toBeVisible();
    await expect(page.getByRole('link', { name: 'How it is worked out' })).toBeVisible();
  });

  test('A15-E3 cadence: a run from a file carries none, so every run is left out and the page says so', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, viewOf({ metric: 'cadence' }));
    const found = trendOf(await rowsOf(runner.api), { metric: 'cadence' });
    expect(found.points.length, 'a run imported from a file has no cadence').toBe(0);
    expect(found.leftOut).toBeGreaterThan(25);
    await expect(page.getByRole('heading', { level: 2, name: 'No run to show' })).toBeVisible();
    await expect(page.getByText(/has a cadence\. Try a longer period or another set of runs\./)).toBeVisible();
    await expect(page.getByText(`Runs with no cadence are left out: ${found.leftOut}.`)).toBeVisible();
  });

  test('A15-E4 on a slow network the page says it is loading and then shows the runs; when the runs cannot be fetched it says so and trying again works', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    guard.allow(/Failed to load resource|net::ERR_/);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/activities/analysis', async (route) => {
      await pending;
      await route.continue();
    });
    await page.goto(ROUTE);
    await expect(page.locator('[data-loading-state="analysis"] > [aria-busy="true"]')).toBeVisible();
    await expect(page.locator('[data-loading-state="analysis"]').getByRole('status')).toContainText('Loading');
    await expect(page.locator('.metric-trend-v2')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    release();
    await expect(reads(page)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.metric-trend-v2')).not.toHaveAttribute('aria-busy', 'true');
    await page.unroute('**/api/activities/analysis');

    await page.route('**/api/activities/analysis', (route) => route.abort());
    await page.goto(viewOf({ range: '1y' }));
    await expect(page.getByRole('alert').getByRole('heading')).toHaveText('Unable to load analysis right now.');
    await expect(reads(page)).toHaveCount(0);
    await page.unroute('**/api/activities/analysis');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(reads(page)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('A15-E5 a name of 118 characters with emoji and accents is read in full, and its readout stays inside the chart', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const made = await newRunner('a15-name');
    // By code points, so that an emoji is never cut in two; the title limit is 120.
    const longName = Array.from(`Crème brûlée 🏃 très longue sortie du dimanche matin au bord de la rivière avec Zoë et Renée, 21,1 km sous la pluie ☔ et dans le vent`).slice(0, 112).join('');
    const specs: RunSpec[] = [
      { name: longName, daysBack: 4, km: 8, pace: 320, hr: 150 },
      ...[10, 20, 30, 40, 50].map((daysBack): RunSpec => ({ name: `E2E a15 name ${daysBack}`, daysBack, km: 6, pace: 330 + daysBack / 5, hr: 148 })),
    ];
    await importRunSpecs(made.api, specs, { wait: false });
    const page = await pages.open(browser, baseURL, guard, whoOf(made), ROUTE);
    await openPage(page);
    const found = trendOf(await rowsOf(made.api));
    const newest = found.points[found.points.length - 1];

    await chart(page).focus();
    await expect(readout(page)).toBeVisible();
    expect(Array.from(newest.row.name).length, 'the name is long').toBeGreaterThan(100);
    expect(await chart(page).getAttribute('aria-valuetext')).toBe(said('pace', newest));
    expect(await readoutSticksOut(chart(page), '.metric-trend-v2__tooltip')).toBe('');
    // The readout shows the start of the name and no more than two lines of it.
    const lines = await readout(page).locator('span').evaluate((node) => Math.round(node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight || '16')));
    expect(lines).toBeLessThanOrEqual(2);
  });

  test('A15-N1 each runner sees their own runs and nothing of anyone else\'s', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const mine = await newRunner('a15-mine');
    await importRunSpecs(mine.api, [10, 25, 40, 55].map((daysBack): RunSpec => ({ name: `E2E a15 mine ${daysBack}`, daysBack, km: 6, pace: 330 + daysBack / 5, hr: 145 })), { wait: false });
    const page = await pages.open(browser, baseURL, guard, whoOf(mine), ROUTE);
    await openPage(page);
    await expect(tile(page, 'Runs').locator('strong')).toHaveText('4');
    await expect(page.getByRole('list', { name: 'Every run of the period, oldest first' })).not.toContainText('E2E a15 run');
    await expect(page.getByRole('list', { name: 'Every run of the period, oldest first' })).toContainText('E2E a15 mine 55');
  });
});

test.describe('A15 trends: units, language, themes and phones', () => {
  test('A15-U1 in miles the pace, the distance and the axis are in miles', async ({ browser, baseURL, guard }) => {
    await setProfileUnits(runner.api, 'imperial');
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_unit', 'mile'));
    await page.goto(ROUTE);
    await openPage(page);
    const found = trendOf(await rowsOf(runner.api));
    await expect(tile(page, 'Middle').locator('strong')).toHaveText(valueText('pace', found.stats!.median, 'mile'));
    await expect(tile(page, 'Usual range').locator('strong')).toHaveText(`${valueText('pace', found.stats!.low, 'mile')} to ${valueText('pace', found.stats!.high, 'mile')}`);
    await expect(chart(page)).toHaveAttribute('aria-valuetext', new RegExp(`${valueText('pace', found.points[found.points.length - 1].value, 'mile').replace('.', '\\.')}`));
    // The axis counts seconds a mile: its numbers are minutes and seconds that are the multiples of 5 or 10 seconds a mile.
    const ticks = (await page.locator('svg text').allTextContents()).filter((text) => /^\d+:\d{2}$/.test(text));
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks.every((text) => Number(text.split(':')[1]) % 5 === 0)).toBe(true);
    // And it is the axis of the paces in miles: it reaches below the quickest run and above the slowest, counted in seconds a mile (an axis of seconds a kilometre does not).
    const tickSeconds = ticks.map((text) => Number(text.split(':')[0]) * 60 + Number(text.split(':')[1]));
    const paces = found.points.map((point) => point.value);
    expect(Math.min(...tickSeconds), 'the axis reaches below the quickest run').toBeLessThanOrEqual(Math.min(...paces) * KM_PER_MILE);
    expect(Math.max(...tickSeconds), 'and above the slowest').toBeGreaterThanOrEqual(Math.max(...paces) * KM_PER_MILE);
    await expect(page.locator('svg text.metric-trend-v2__axis-unit')).toHaveText('/mi');

    await page.goto(viewOf({ metric: 'distance' }));
    await expect(tile(page, 'Middle').locator('strong')).toHaveText(valueText('distance', trendOf(await rowsOf(runner.api), { metric: 'distance' }).stats!.median, 'mile'));
    await expect(page.locator('svg text.metric-trend-v2__axis-unit')).toHaveText('mi');
  });

  test('A15-L1 in Chinese the page is translated, the sentences have Chinese punctuation, and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: '趋势', exact: true })).toBeVisible();
    const found = trendOf(await rowsOf(runner.api));
    const change = found.stats!.median - found.before!.stats!.median;

    await expect(page.getByRole('group', { name: '显示', exact: true }).getByRole('button', { name: '配速' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: '时间段', exact: true }).getByRole('button', { name: '6 个月' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: '这段时间的读数' }).locator('> div').nth(1).locator('strong')).toHaveText(`${mmss(found.stats!.median)} /公里`);
    await expect(page.getByRole('group', { name: '这段时间的读数' }).locator('> div').nth(3).locator('strong')).toHaveText(`${wayOf('pace', change) === 'quicker' ? '更快' : '更慢'} ${mmss(Math.abs(change))} /公里`);
    const sentences = await page.locator('.metric-trend-v2__sentences .metric-trend-v2__note').allTextContents();
    expect(sentences.length).toBeGreaterThanOrEqual(2);
    for (const sentence of sentences) {
      expect(sentence.replace(/\d+:\d+/g, ''), 'no English comma, colon or full stop in a Chinese sentence').not.toMatch(/[,:;]|\.(?!\d)/);
    }
    await expect(chart(page)).toHaveAttribute('aria-valuetext', /^\d{4}年\d{1,2}月\d{1,2}日：\d+:\d{2} \/公里，E2E a15 run \d+/);
    await expectNoRawKeys(page);
  });

  for (const theme of ['light', 'midnight', 'high-contrast', 'high-contrast-light']) {
    test(`A15-A2 the dots, the middle, the trend line and the readout show 3 to 1 against the card in the ${theme} theme, and the readout is solid`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await openPage(page);
      await chart(page).focus();
      await page.keyboard.press('ArrowLeft');
      await expect(readout(page)).toBeVisible();
      const found = await markRatios(page, [
        { selector: '.metric-trend-v2 svg circle.metric-trend-v2__dot', paint: 'fill', what: 'a dot' },
        { selector: '.metric-trend-v2 svg line.metric-trend-v2__middle', paint: 'stroke', what: 'the line of the middle' },
        { selector: '.metric-trend-v2 svg line.metric-trend-v2__trend', paint: 'stroke', what: 'the trend line' },
        { selector: '.metric-trend-v2 svg circle.metric-trend-v2__selected', paint: 'stroke', what: 'the ring on the run read' },
      ]);
      for (const item of found) {
        test.info().annotations.push({ type: 'ratio', description: `${theme}: ${item.what} ${item.mark} on ${item.behind} = ${item.ratio.toFixed(2)}` });
        expect(item.ratio, `${item.what}: ${item.mark} on ${item.behind}`).toBeGreaterThanOrEqual(3);
      }
      const background = await readout(page).evaluate((node) => getComputedStyle(node).backgroundColor);
      const parts = background.match(/[\d.]+/g) ?? [];
      expect(parts.length >= 4 ? Number(parts[3]) : 1, `the readout's background is ${background}`).toBeGreaterThanOrEqual(0.95);
    });
  }

  for (const theme of ['light', 'midnight']) {
    test(`A15-A1 the page is readable in the ${theme} theme and has no accessibility violations, with a run read`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await openPage(page);
      expect(await contrastProblems(page, { include: ['.metric-trend-v2'] }), `${theme}, contrast`).toEqual([]);
      expect(await a11yViolations(page, { include: ['.metric-trend-v2'] }), `${theme}, axe`).toEqual([]);
      await chart(page).focus();
      await page.keyboard.press('ArrowLeft');
      await expect(readout(page)).toBeVisible();
      expect(await contrastProblems(page, { include: ['.metric-trend-v2'] }), `${theme}, contrast with a run read`).toEqual([]);
      expect(await a11yViolations(page, { include: ['.metric-trend-v2'] }), `${theme}, axe with a run read`).toEqual([]);
    });
  }

  test('A15-M1 @mobile on a phone the page fits: the choices wrap, the readings are the rows of one card, and nothing is cut off', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    expect(await elementsBeyondTheEdge(page)).toEqual([]);
    const rows = await reads(page).locator('> div').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().width)));
    expect(new Set(rows).size, 'the four readings are one column, as wide as each other').toBe(1);
    await chart(page).scrollIntoViewIfNeeded();
    await chart(page).focus();
    await expect(readout(page)).toBeVisible();
    expect(await readoutSticksOut(chart(page), '.metric-trend-v2__tooltip')).toBe('');
  });

  test('A15-M2 @mobile at 320 px with the text at 200% nothing runs off the screen and no name runs into its number', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(ROUTE);
    await openPage(page);
    for (const percent of [150, 200]) {
      await enlargeText(page, percent);
      expect(await elementsBeyondTheEdge(page), `elements cut off at the edge of a 320 px screen at ${percent}%`).toEqual([]);
      expect(await readingsThatCollide(page, '.metric-trend-v2__reads > div'), `the four readings at ${percent}%`).toEqual([]);
    }
    for (const group of [['Show', 'Cadence'], ['Which runs', 'Races'], ['Period', 'All time'], ['Trend line', 'Average of 10 runs']] as const) {
      const target = chip(page, group[0], group[1]);
      await target.scrollIntoViewIfNeeded();
      const box = (await target.boundingBox()) as Box;
      expect(box.x, `${group[1]} starts on the screen`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${group[1]} ends on the screen`).toBeLessThanOrEqual(320);
    }
  });
});

test.describe('A15 trends: the way in from Analysis', () => {
  test('A15-X1 Analysis opens Trends from its Go deeper disclosure', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, '/analysis');
    const card = page.getByRole('region', { name: 'Go deeper' });
    await expect(card).toBeVisible();
    const disclosure = card.locator('#analysis-trends');
    await expect(disclosure).not.toHaveAttribute('open');
    await disclosure.locator(':scope > summary').click();
    await expect(disclosure).toHaveAttribute('open', '');
    await expect(heading(page)).toBeVisible();
    await expect(reads(page)).toBeVisible();
    await expect(page).toHaveURL(/\/analysis$/);
    await expect(page).toHaveTitle('Analysis | HermesRuns');
  });
});
