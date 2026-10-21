// A16 Quality sessions, a page of the analysis section that came out of the Runalyze review (F34, quality sessions): the runs the runner has given a type that means a hard
// session (a workout or a race, and a long run if they count it), over a period, with how many there were, how far, how fast, and how the count stands against the stretch before.
//
// Every figure is worked out again here, in this file, from the runs the API lists and the rules of the methods document (docs/README-ANALYSIS.md, "Quality Sessions"): which
// runs count, the period in calendar months ending on the runner's today and the stretch of the same length before it, the share of the distance, the sessions a week, the
// middle pace of the sessions and of the other runs, and the order of the table. So a page that counted a run of the wrong type, took the wrong period, divided by the wrong
// number of weeks or sorted the table by the wrong thing fails.
import type { Locator, Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { KM_PER_MILE, importRunSpecs, sharedRunner, type RunSpec } from '../fixtures/analysis.ts';
import { addDays, addMonths, hms, mmss, shortDate } from '../fixtures/format.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { elementsBeyondTheEdge, enlargeText, readingsThatCollide } from '../fixtures/reflow.ts';
import { browserToday } from '../fixtures/strain.ts';
import { a11yViolations, contrastProblems, expect, expectNoRawKeys, test } from '../fixtures/test.ts';

const ROUTE = '/analysis/quality-sessions';
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

const KINDS = ['workout', 'race', 'long'] as const;
type Kind = (typeof KINDS)[number];
type Range = '3m' | '6m' | '1y' | 'all';
type Unit = 'km' | 'mile';
const RANGES: Range[] = ['3m', '6m', '1y', 'all'];
const DEFAULT_KINDS: Kind[] = ['workout', 'race'];
const RUN_TYPE: Record<Kind, string> = { workout: 'WORKOUT', race: 'RACE', long: 'LONG_RUN' };
const TYPE_LABEL: Record<string, string> = { RACE: 'Race', LONG_RUN: 'Long run', WORKOUT: 'Workout' };
const TYPE_LABEL_ZH: Record<string, string> = { RACE: '比赛', LONG_RUN: '长距离跑', WORKOUT: '训练课' };
type Box = { x: number; y: number; width: number; height: number };

interface Row {
  id: number;
  name: string;
  distanceKm: number;
  movingTimeSeconds: number;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  startTime: string;
  runType: string | null;
}

const rowsOf = async (api: Api): Promise<Row[]> => (await api.get('/api/activities/analysis')).json;
const whoOf = (made: { api: Api; email: string }): { token: string; email: string } => ({ token: made.api.token as string, email: made.email });

/** The runner's today as the page counts it: the date on the device, or the date of the latest run when that is ahead of it by two days at most. */
function runnersToday(rows: Row[]): string {
  const device = browserToday();
  const limit = addDays(device, 2);
  return rows.map((row) => row.startTime.slice(0, 10)).filter((day) => day > device && day <= limit).sort().pop() ?? device;
}

const dayOf = (row: Row): string => row.startTime.slice(0, 10);
/** The day as a number, with the hour of the start as a fraction of a day: what puts two sessions of one day in order. */
function xOf(row: Row): number {
  const [year, month, day] = dayOf(row).split('-').map(Number);
  const clock = /T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(row.startTime);
  const seconds = clock ? Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3] ?? 0) : 0;
  return Date.UTC(year, month - 1, day) / 86_400_000 + seconds / 86_400;
}
const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
const paceOf = (row: Row): number => row.movingTimeSeconds / row.distanceKm;
const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

/** The period and the stretch before it: the last N calendar months ending on today, or everything from the first run. */
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
const median = (values: number[]): number | null => (values.length === 0 ? null : quantile([...values].sort((a, b) => a - b), 0.5));

interface Found {
  today: string;
  from: string;
  /** The sessions of the period, newest first. */
  sessions: Row[];
  count: number;
  km: number;
  share: number | null;
  perWeek: number;
  median: number | null;
  otherMedian: number | null;
  before: { runs: number; sessions: number } | null;
}

function qualityOf(rows: Row[], { kinds = DEFAULT_KINDS, range = '3m' }: { kinds?: readonly Kind[]; range?: Range } = {}): Found {
  const today = runnersToday(rows);
  const usable = rows.filter((row) => dayOf(row) <= today && row.distanceKm > 0 && row.movingTimeSeconds > 0);
  const period = periodOf(range, today, usable.map(dayOf).sort()[0] ?? today);
  const within = (row: Row, from: string, to: string): boolean => dayOf(row) >= from && dayOf(row) <= to;
  const counts = (row: Row): boolean => kinds.some((kind) => (row.runType ?? '').toUpperCase() === RUN_TYPE[kind]);
  const inPeriod = usable.filter((row) => within(row, period.from, today));
  const sessions = inPeriod.filter(counts).sort((a, b) => xOf(b) - xOf(a) || b.id - a.id);
  const others = inPeriod.filter((row) => !counts(row));
  const km = sum(sessions.map((row) => row.distanceKm));
  const earlier = period.before ? usable.filter((row) => within(row, period.before!.from, period.before!.to)) : null;
  return {
    today,
    from: period.from,
    sessions,
    count: sessions.length,
    km,
    share: inPeriod.length > 0 ? km / sum(inPeriod.map((row) => row.distanceKm)) : null,
    // The days of the period, both ends counted, over seven.
    perWeek: sessions.length / ((daysBetween(period.from, today) + 1) / 7),
    median: median(sessions.map(paceOf)),
    otherMedian: median(others.map(paceOf)),
    before: earlier ? { runs: earlier.length, sessions: earlier.filter(counts).length } : null,
  };
}

// ---- how the page writes what it found
const distanceText = (km: number, unit: Unit = 'km'): string => (unit === 'mile' ? `${(km / KM_PER_MILE).toFixed(1)} mi` : `${km.toFixed(1)} km`);
const paceText = (secondsPerKm: number, unit: Unit = 'km'): string => (unit === 'mile' ? `${mmss(secondsPerKm * KM_PER_MILE)} /mi` : `${mmss(secondsPerKm)} /km`);
const timeText = (seconds: number): string => (Math.round(seconds) >= 3600 ? hms(seconds) : mmss(seconds));
const weekly = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** The sessions a week to one decimal; a rate that would be written 0.0 (under 0.05) is "under 0.1", which reads as a few and not as none. */
const perWeekText = (perWeek: number): string => (perWeek < 0.05 ? 'Under 0.1 a week' : `About ${weekly.format(perWeek)} a week`);
const sensible = (bpm: number | null): number | null => (bpm != null && bpm > 40 && bpm < 250 ? Math.round(bpm) : null);

function heartText(row: Row): string {
  const average = sensible(row.averageHeartRate);
  const highest = sensible(row.maxHeartRate);
  if (average != null && highest != null) return `${average} / ${highest} bpm`;
  if (average != null) return `${average} bpm average`;
  if (highest != null) return `${highest} bpm highest`;
  return '--';
}

/** What the table says of a session: the day, the run, its type, the distance, the time, the pace and the heart rate. */
function rowCells(row: Row, unit: Unit = 'km'): string[] {
  return [
    shortDate(new Date(`${dayOf(row)}T12:00:00Z`)),
    row.name,
    TYPE_LABEL[(row.runType ?? '').toUpperCase()] ?? '--',
    distanceText(row.distanceKm, unit),
    timeText(row.movingTimeSeconds),
    paceText(paceOf(row), unit),
    heartText(row),
  ];
}

const COMPARE_LABEL: Record<string, string> = { '3m': 'Against the 3 months before', '6m': 'Against the 6 months before', '1y': 'Against the year before' };
const NOTHING_TO_COMPARE = 'You did not run in that stretch, so there is nothing to compare with.';

/** The four readings as the page writes them: [what it is, the number, the line under it]. */
function tilesOf(found: Found, range: Range, unit: Unit = 'km'): string[][] {
  let fourth: string[];
  if (found.before === null) {
    fourth = ['Latest session', shortDate(new Date(`${dayOf(found.sessions[0])}T12:00:00Z`)), found.sessions[0].name];
  } else if (found.before.runs === 0) {
    fourth = [COMPARE_LABEL[range], '--', NOTHING_TO_COMPARE];
  } else {
    const change = found.count - found.before.sessions;
    const value = change === 0 ? 'The same number' : change > 0 ? `${change} more` : `${-change} fewer`;
    fourth = [COMPARE_LABEL[range], value, `That stretch had ${found.before.sessions} in ${found.before.runs} run${found.before.runs === 1 ? '' : 's'}.`];
  }
  return [
    ['Sessions', String(found.count), perWeekText(found.perWeek)],
    ['Distance in them', distanceText(found.km, unit), `${Math.round((found.share as number) * 100)}% of everything you ran in the period`],
    ['Middle pace', paceText(found.median as number, unit), found.otherMedian == null ? 'No other run in the period' : `Your other runs: ${paceText(found.otherMedian, unit)}`],
    fourth,
  ];
}

// ---- the page
const heading = (page: Page): Locator => page.getByRole('heading', { level: 1, name: 'Quality sessions' });
const body = (page: Page): Locator => page.locator('.quality-sessions-v2');
const reads = (page: Page): Locator => page.getByRole('group', { name: 'Readings for the period' });
const table = (page: Page): Locator => page.getByRole('table', { name: 'The quality sessions of the period, newest first' });
const bodyRows = (page: Page): Locator => table(page).locator('tbody tr');
const chip = (page: Page, group: string, label: string): Locator => page.getByRole('group', { name: group, exact: true }).getByRole('button', { name: label, exact: true });
const TYPES = 'Counts as a quality session';
const emptyHeading = (page: Page): Locator => page.getByRole('heading', { level: 2, name: 'No quality session in this period' });
const methodsLink = (page: Page): Locator => page.getByRole('link', { name: 'How it is worked out' });

/** The page has drawn what it has to say: its heading, and the link that says how it is worked out (which comes with the choices, whether or not there is a session to list). */
async function openPage(page: Page): Promise<void> {
  await expect(heading(page)).toBeVisible();
  await expect(methodsLink(page)).toBeVisible();
}

async function readTiles(page: Page): Promise<string[][]> {
  return reads(page).locator('> div').evaluateAll((nodes) => nodes.map((node) => ['span', 'strong', 'small'].map((tag) => (node.querySelector(tag)?.textContent ?? '').trim())));
}
async function readRows(page: Page): Promise<string[][]> {
  return bodyRows(page).evaluateAll((rows) => rows.map((row) => Array.from(row.children).map((cell) => (cell.textContent ?? '').trim())));
}

/** The address of a view: the choices that are not the defaults. */
function viewOf({ kinds = DEFAULT_KINDS, range = '3m' }: { kinds?: readonly Kind[]; range?: Range } = {}): string {
  const params = new URLSearchParams();
  const ticked = KINDS.filter((kind) => kinds.includes(kind));
  if (ticked.length === 0) params.set('types', 'none');
  else if (ticked.join(',') !== DEFAULT_KINDS.join(',')) params.set('types', ticked.join(','));
  if (range !== '3m') params.set('range', range);
  const text = params.toString();
  return text ? `${ROUTE}?${text}` : ROUTE;
}

/** A runner made for one case, with the runs `specs` of which some have a type. */
async function runnerOf(label: string, specs: Array<RunSpec & { type?: Kind }>): Promise<{ made: Awaited<ReturnType<typeof newRunner>>; ids: number[] }> {
  const made = await newRunner(label);
  const ids = await importRunSpecs(made.api, specs, { wait: false });
  for (let k = 0; k < specs.length; k += 1) {
    const type = specs[k].type;
    if (type) expect((await made.api.patch(`/api/activities/${ids[k]}`, { runType: RUN_TYPE[type] })).status).toBe(200);
  }
  return { made, ids };
}

// Forty-five runs nine days apart, the newest two days back and the oldest 398: ordinary runs of 5 to 10 km at about 5:30 a kilometre with a heart rate near 140, and among them
// the workouts (every fifth from the second: 6 to 9 km at about 4:40), the races (every seventh from the fourth that is not a workout's turn: 10 km at 4:45 to 4:50) and the
// long runs (every eighth from the sixth that is neither: 16 to 20 km, which take over an hour); every third of the typed runs has no heart rate.
const typeOfRun = (k: number): Kind | null => (k % 5 === 1 ? 'workout' : k % 7 === 3 ? 'race' : k % 8 === 5 ? 'long' : null);
const FIXTURE: RunSpec[] = Array.from({ length: 45 }, (_, k): RunSpec => {
  const kind = typeOfRun(k);
  return {
    name: `E2E a16 run ${k}`,
    daysBack: 2 + 9 * k,
    km: kind === 'long' ? 16 + (k % 5) : kind === 'race' ? 10 : kind === 'workout' ? 6 + (k % 4) : 5 + (k % 6),
    pace: kind === 'workout' ? 270 + (k % 5) * 4 : kind === 'race' ? 285 + (k % 3) * 3 : kind === 'long' ? 335 + (k % 4) * 3 : 320 + ((k * 7) % 6) * 6,
    hr: kind && k % 3 === 0 ? null : kind ? 165 + (k % 6) : 138 + (k % 9),
  };
});

let runner: Awaited<ReturnType<typeof sharedRunner<null>>>;

test.beforeAll(async () => {
  test.setTimeout(900_000);
  runner = await sharedRunner('a16', async ({ api }) => {
    const ids = await importRunSpecs(api, FIXTURE, { wait: false });
    for (let k = 0; k < ids.length; k += 1) {
      const kind = typeOfRun(k);
      if (kind) expect((await api.patch(`/api/activities/${ids[k]}`, { runType: RUN_TYPE[kind] })).status).toBe(200);
    }
    return null;
  });
});

test.describe('A16 quality sessions: what the page says', () => {
  test('A16-H1 the first view is the workouts and the races of the last 3 months: the four readings and the table, worked out again from the runs', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const found = qualityOf(await rowsOf(runner.api));
    expect(found.count, 'the fixture has sessions in the 3 months').toBeGreaterThanOrEqual(3);
    expect(found.before?.runs, 'and runs in the 3 months before').toBeGreaterThanOrEqual(3);
    expect(found.sessions.some((row) => heartText(row) === '--'), 'one of the sessions has no heart rate').toBe(true);

    for (const [group, label, pressed] of [[TYPES, 'Workouts', 'true'], [TYPES, 'Races', 'true'], [TYPES, 'Long runs', 'false'], ['Period', '3 months', 'true'], ['Period', '6 months', 'false']] as const) {
      await expect(chip(page, group, label), `${label}`).toHaveAttribute('aria-pressed', pressed);
    }
    expect(new URL(page.url()).search).toBe('');
    await expect(reads(page)).toBeVisible();
    expect(await readTiles(page)).toEqual(tilesOf(found, '3m'));
    expect(await readRows(page)).toEqual(found.sessions.map((row) => rowCells(row)));
    await expect(page.getByText('Open a run for its pace chart and the splits of each kilometre.')).toBeVisible();
    await expect(methodsLink(page)).toHaveAttribute('href', /README-ANALYSIS\.md#quality-sessions$/);
  });

  test('A16-H2 every choice of types over every period has the sessions that belong to it, with their readings and their table, worked out again', async ({ browser, baseURL, guard }) => {
    test.setTimeout(480_000);
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const rows = await rowsOf(runner.api);
    const sets: Kind[][] = [['workout'], ['race'], ['long'], ['workout', 'race'], ['workout', 'long'], ['race', 'long'], ['workout', 'race', 'long']];
    let withSessions = 0;
    for (const kinds of sets) {
      for (const range of RANGES) {
        const label = `${kinds.join(' and ')} over ${range}`;
        const found = qualityOf(rows, { kinds, range });
        await page.goto(viewOf({ kinds, range }));
        await expect(heading(page), label).toBeVisible();
        if (found.count === 0) {
          await expect(emptyHeading(page), label).toBeVisible();
          continue;
        }
        await expect(reads(page), label).toBeVisible();
        expect(await readTiles(page), label).toEqual(tilesOf(found, range));
        expect(await readRows(page), label).toEqual(found.sessions.map((row) => rowCells(row)));
        withSessions += 1;
      }
    }
    expect(withSessions, 'most of the 28 views have sessions to show').toBeGreaterThan(20);
  });

  test('A16-H3 no run at all in the stretch before is "nothing to compare with", which is not the same as no session there: the page counts the runs, in the singular for one', async ({ browser, baseURL, guard }) => {
    test.setTimeout(420_000);
    const now: Array<RunSpec & { type?: Kind }> = [
      { name: 'E2E a16 now a', daysBack: 5, km: 8, pace: 290, hr: 160, type: 'workout' },
      { name: 'E2E a16 now b', daysBack: 20, km: 6, pace: 300, hr: 158, type: 'workout' },
      { name: 'E2E a16 now c', daysBack: 12, km: 5, pace: 340, hr: 140 },
    ];
    const earlier = (days: number[], type?: Kind): Array<RunSpec & { type?: Kind }> => days.map((daysBack) => ({ name: `E2E a16 earlier ${daysBack}`, daysBack, km: 7, pace: 320, hr: 145, type }));
    // The stretch before the last 3 months is about 3 to 6 months back, whatever day of the year it is: 100 to 140 days back is inside it.
    const cases: Array<{ label: string; specs: Array<RunSpec & { type?: Kind }>; value: string; hint: string }> = [
      { label: 'no run before', specs: now, value: '--', hint: NOTHING_TO_COMPARE },
      { label: 'three runs before, no session among them', specs: [...now, ...earlier([100, 120, 140])], value: '2 more', hint: 'That stretch had 0 in 3 runs.' },
      { label: 'one run before', specs: [...now, ...earlier([120])], value: '2 more', hint: 'That stretch had 0 in 1 run.' },
      { label: 'two sessions before and one now', specs: [now[0], now[2], ...earlier([100, 110], 'workout')], value: '1 fewer', hint: 'That stretch had 2 in 2 runs.' },
      { label: 'two sessions before and two now', specs: [...now, ...earlier([100, 110], 'workout')], value: 'The same number', hint: 'That stretch had 2 in 2 runs.' },
    ];
    for (const item of cases) {
      const { made } = await runnerOf('a16-compare', item.specs);
      const page = await pages.open(browser, baseURL, guard, whoOf(made), ROUTE);
      await openPage(page);
      await expect(reads(page), item.label).toBeVisible();
      const found = qualityOf(await rowsOf(made.api));
      const tiles = await readTiles(page);
      expect(tiles[3], item.label).toEqual(['Against the 3 months before', item.value, item.hint]);
      expect(tiles, item.label).toEqual(tilesOf(found, '3m'));
    }
  });

  test('A16-H4 the choices are in the address: they are written, kept over a reload, dropped when they are the default again, and Back leaves the page', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, '/analysis');
    await page.getByRole('link', { name: /^Quality sessions/ }).click();
    await openPage(page);
    expect(new URL(page.url()).pathname).toBe(ROUTE);

    await chip(page, TYPES, 'Long runs').click();
    await chip(page, 'Period', '1 year').click();
    expect(new URLSearchParams(new URL(page.url()).search).toString()).toBe('types=workout%2Crace%2Clong&range=1y');
    await chip(page, TYPES, 'Races').click();
    expect(new URLSearchParams(new URL(page.url()).search).toString()).toBe('types=workout%2Clong&range=1y');

    await page.reload();
    await openPage(page);
    for (const [group, label, pressed] of [[TYPES, 'Workouts', 'true'], [TYPES, 'Races', 'false'], [TYPES, 'Long runs', 'true'], ['Period', '1 year', 'true']] as const) {
      await expect(chip(page, group, label), label).toHaveAttribute('aria-pressed', pressed);
    }
    expect(await readRows(page)).toEqual(qualityOf(await rowsOf(runner.api), { kinds: ['workout', 'long'], range: '1y' }).sessions.map((row) => rowCells(row)));

    // Back to the defaults: nothing is left in the address.
    await chip(page, TYPES, 'Races').click();
    await chip(page, TYPES, 'Long runs').click();
    await chip(page, 'Period', '3 months').click();
    expect(new URL(page.url()).search).toBe('');

    // The choices replace the entry of the address, so Back goes where the runner came from.
    await page.goBack();
    await expect(page.getByRole('heading', { level: 2, name: 'More ways to look' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/analysis');
  });

  test('A16-H5 a value in the address that is none of the choices is the default, and the types may come in any order, with the comma written as it is', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, `${ROUTE}?types=sprint&range=forever`);
    await openPage(page);
    for (const [group, label, pressed] of [[TYPES, 'Workouts', 'true'], [TYPES, 'Races', 'true'], [TYPES, 'Long runs', 'false'], ['Period', '3 months', 'true']] as const) {
      await expect(chip(page, group, label), `a made-up value: ${label}`).toHaveAttribute('aria-pressed', pressed);
    }
    await page.goto(`${ROUTE}?types=long,race&range=6m`);
    await openPage(page);
    for (const [group, label, pressed] of [[TYPES, 'Workouts', 'false'], [TYPES, 'Races', 'true'], [TYPES, 'Long runs', 'true'], ['Period', '6 months', 'true']] as const) {
      await expect(chip(page, group, label), `types in another order: ${label}`).toHaveAttribute('aria-pressed', pressed);
    }
    const found = qualityOf(await rowsOf(runner.api), { kinds: ['race', 'long'], range: '6m' });
    expect(found.count).toBeGreaterThan(0);
    expect(await readRows(page)).toEqual(found.sessions.map((row) => rowCells(row)));
    expect(new URL(page.url()).search, 'the address is left as it was typed until a choice is made').toBe('?types=long,race&range=6m');
  });

  test('A16-H6 a run of the table is a link to its page, whose type is the one the table gives', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, viewOf({ kinds: ['workout', 'race', 'long'], range: '1y' }));
    await openPage(page);
    const found = qualityOf(await rowsOf(runner.api), { kinds: ['workout', 'race', 'long'], range: '1y' });
    const types = new Set(found.sessions.map((row) => row.runType));
    expect(types, 'the 1 year view holds one of each type').toEqual(new Set(['WORKOUT', 'RACE', 'LONG_RUN']));
    await expect(bodyRows(page)).toHaveCount(found.count);
    await expect(bodyRows(page).locator('a')).toHaveCount(found.count);
    const hrefs = await bodyRows(page).locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(hrefs).toEqual(found.sessions.map((row) => `/runs/${row.id}`));

    for (const wanted of ['WORKOUT', 'RACE', 'LONG_RUN']) {
      const row = found.sessions.find((session) => session.runType === wanted) as Row;
      await page.goto(viewOf({ kinds: ['workout', 'race', 'long'], range: '1y' }));
      await table(page).getByRole('link', { name: row.name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/runs/${row.id}$`));
      await expect(page.getByRole('region', { name: 'Type and tags', exact: true }).getByRole('group', { name: 'Run type' }).getByRole('radio', { name: TYPE_LABEL[wanted], exact: true })).toBeChecked();
    }
  });

  test('A16-F1 a run given a type on its page is a session here when the runner comes back, and one set back to a plain run is not', async ({ browser, baseURL, guard }) => {
    test.setTimeout(300_000);
    const { made, ids } = await runnerOf('a16-flow', [3, 10, 17].map((daysBack): RunSpec => ({ name: `E2E a16 flow ${daysBack}`, daysBack, km: 8, pace: 300 + daysBack, hr: 150 })));
    const labels = (page: Page): Locator => page.getByRole('region', { name: 'Type and tags', exact: true });
    const page = await pages.open(browser, baseURL, guard, whoOf(made), ROUTE);
    await openPage(page);
    await expect(emptyHeading(page)).toBeVisible();

    // By the links of the page to the training log and to a run, and its type is set to Workout.
    await page.getByRole('link', { name: 'Open the training log' }).click();
    await page.getByRole('link', { name: 'E2E a16 flow 10', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/runs/${ids[1]}$`));
    let saved = page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().endsWith(`/api/activities/${ids[1]}`));
    await labels(page).getByRole('group', { name: 'Run type' }).getByRole('radio', { name: 'Workout', exact: true }).check();
    expect((await saved).status()).toBe(200);
    await expect(labels(page).getByRole('status').filter({ hasText: 'Run type set to Workout.' })).toBeAttached();

    // Back to the page: it asks for the runs again, with no wait for what it had to run out, and has the session.
    await page.goBack();
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${ROUTE}$`));
    await openPage(page);
    const found = qualityOf(await rowsOf(made.api));
    expect(found.sessions.map((row) => row.id)).toEqual([ids[1]]);
    await expect(reads(page)).toBeVisible();
    expect(await readRows(page)).toEqual(found.sessions.map((row) => rowCells(row)));
    expect((await readTiles(page))[0].slice(0, 2)).toEqual(['Sessions', '1']);

    // And the other way: the run is set back to a plain one from the table's link.
    await table(page).getByRole('link', { name: 'E2E a16 flow 10', exact: true }).click();
    saved = page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().endsWith(`/api/activities/${ids[1]}`));
    await labels(page).getByRole('group', { name: 'Run type' }).getByRole('radio', { name: 'Just a run', exact: true }).check();
    expect((await saved).status()).toBe(200);
    await expect(labels(page).getByRole('status').filter({ hasText: 'Run type cleared.' })).toBeAttached();
    await page.goBack();
    await expect(emptyHeading(page)).toBeVisible();
    await expect(table(page)).toHaveCount(0);
  });
});

test.describe('A16 quality sessions: runners it has little to say to, and other conditions', () => {
  test('A16-E1 a runner whose runs have no type is told no session is marked, is offered the runs and the training log, and still has the choices', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const { made } = await runnerOf('a16-plain', [4, 11, 18, 25, 32].map((daysBack): RunSpec => ({ name: `E2E a16 plain ${daysBack}`, daysBack, km: 6, pace: 330, hr: 145 })));
    const page = await pages.open(browser, baseURL, guard, whoOf(made), ROUTE);
    await openPage(page);
    await expect(emptyHeading(page)).toBeVisible();
    await expect(page.getByText('None of your runs in this period has one of the types that count. Give a run the type Workout or Race on its page or in the training log, and it shows here.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open your runs' })).toHaveAttribute('href', '/runs');
    await expect(page.getByRole('link', { name: 'Open the training log' })).toHaveAttribute('href', '/training-log');
    await expect(table(page)).toHaveCount(0);
    await expect(reads(page)).toHaveCount(0);
    await expect(chip(page, TYPES, 'Workouts')).toHaveAttribute('aria-pressed', 'true');
    // Turning the long runs on does not make a run of no type a session.
    await chip(page, TYPES, 'Long runs').click();
    await expect(emptyHeading(page)).toBeVisible();
  });

  test('A16-E2 a runner with no run at all gets the same answer, not an error', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const made = await newRunner('a16-none');
    const page = await pages.open(browser, baseURL, guard, whoOf(made), ROUTE);
    await openPage(page);
    await expect(emptyHeading(page)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open your runs' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(table(page)).toHaveCount(0);
  });

  test('A16-E3 with no type turned on the page says to turn one on, with no link to the runs, and turning one on brings its sessions', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, `${ROUTE}?types=none`);
    await openPage(page);
    await expect(page.getByRole('heading', { level: 2, name: 'No type is on' })).toBeVisible();
    await expect(page.getByText('Turn on at least one type above: workouts, races or long runs.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open your runs' })).toHaveCount(0);
    await expect(table(page)).toHaveCount(0);
    for (const label of ['Workouts', 'Races', 'Long runs']) {
      await expect(chip(page, TYPES, label), label).toHaveAttribute('aria-pressed', 'false');
    }
    await chip(page, TYPES, 'Workouts').click();
    expect(new URL(page.url()).search).toBe('?types=workout');
    const found = qualityOf(await rowsOf(runner.api), { kinds: ['workout'] });
    expect(await readRows(page)).toEqual(found.sessions.map((row) => rowCells(row)));
    expect((await readRows(page)).every((cells) => cells[2] === 'Workout')).toBe(true);
  });

  test('A16-E4 on a slow network the page says it is loading and then shows the sessions; when the runs cannot be fetched it says so and trying again works', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    guard.allow(/Failed to load resource|net::ERR_/);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.route('**/api/activities/analysis', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await page.goto(ROUTE);
    await expect(page.getByRole('status').filter({ hasText: 'Loading your runs...' })).toHaveCount(1);
    await expect(body(page)).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(reads(page)).toBeVisible({ timeout: 20_000 });
    await expect(body(page)).not.toHaveAttribute('aria-busy', 'true');
    await page.unroute('**/api/activities/analysis');

    await page.route('**/api/activities/analysis', (route) => route.abort());
    await page.goto(viewOf({ range: '1y' }));
    await expect(page.getByRole('alert')).toHaveText('Your runs could not be loaded.');
    await expect(reads(page)).toHaveCount(0);
    await expect(table(page)).toHaveCount(0);
    await page.unroute('**/api/activities/analysis');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(reads(page)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('A16-E5 two sessions of one day are in the order they began, the later first, whichever was saved first', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    // The evening race is imported first, so it has the lower id: a table ordered by the id puts the morning workout above it.
    const { made, ids } = await runnerOf('a16-day', [
      { name: 'E2E a16 evening race', daysBack: 4, km: 5, pace: 280, hr: 175, hourUtc: 19, type: 'race' },
      { name: 'E2E a16 morning workout', daysBack: 4, km: 8, pace: 290, hr: 165, hourUtc: 14, type: 'workout' },
      { name: 'E2E a16 earlier workout', daysBack: 12, km: 7, pace: 295, hr: 160, type: 'workout' },
    ]);
    const page = await pages.open(browser, baseURL, guard, whoOf(made), ROUTE);
    await openPage(page);
    const found = qualityOf(await rowsOf(made.api));
    expect(found.sessions.map((row) => row.id), 'the later start of the day first, then the earlier day').toEqual([ids[0], ids[1], ids[2]]);
    expect(xOf(found.sessions[0]) > xOf(found.sessions[1]), 'the race began after the workout').toBe(true);
    expect(dayOf(found.sessions[0]), 'on the same day').toBe(dayOf(found.sessions[1]));
    await expect(reads(page)).toBeVisible();
    expect((await readRows(page)).map((cells) => cells[1])).toEqual(['E2E a16 evening race', 'E2E a16 morning workout', 'E2E a16 earlier workout']);
    expect(await readRows(page)).toEqual(found.sessions.map((row) => rowCells(row)));
  });

  test('A16-E6 a name of 112 characters with emoji and accents is cut short in its column and whole in its link, and the page does not scroll sideways', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    // By code points, so that an emoji is never cut in two; the title limit is 120, and a name is saved without the spaces at its ends.
    const longName = Array.from('Séance de fractionné très longue au bord du canal Saint-Martin avec Zoë, Renée et les amis du club 🏃 — 10 × 400 m, 3 × 1 000 m, côtes et lignes droites').slice(0, 112).join('').trim();
    const { made, ids } = await runnerOf('a16-name', [
      { name: longName, daysBack: 3, km: 8, pace: 290, hr: 165, type: 'workout' },
      { name: 'E2E a16 short', daysBack: 10, km: 6, pace: 300, hr: 160, type: 'workout' },
    ]);
    const page = await pages.open(browser, baseURL, guard, whoOf(made), ROUTE);
    await openPage(page);
    expect(Array.from(longName).length, 'the name is long').toBeGreaterThan(100);
    const link = table(page).getByRole('link', { name: longName, exact: true });
    await expect(link, 'the whole name is the name of the link').toHaveAttribute('href', `/runs/${ids[0]}`);
    await expect(link).toHaveAttribute('title', longName);
    const sizes = await link.evaluate((node) => ({
      link: Math.round(node.getBoundingClientRect().width),
      cell: Math.round((node.closest('td') as HTMLElement).getBoundingClientRect().width),
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(sizes.link, 'the name does not stretch the column').toBeGreaterThan(sizes.cell);
    expect(sizes.cell, 'the column stops at about 26 characters').toBeLessThan(420);
    expect(sizes.page, 'the page itself has nothing to scroll sideways').toBeLessThanOrEqual(0);
    expect(await readRows(page)).toEqual(qualityOf(await rowsOf(made.api)).sessions.map((row) => rowCells(row)));
  });

  test('A16-E7 a session that is rare in a long period is "Under 0.1 a week" and not 0.0, and the same session over 3 months is about 0.1', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    // One workout five days back among ordinary runs 150 and 300 days back: 1 in about 93 days (13 weeks) over 3 months, and 1 in 181 days or more (26 weeks or more) over the rest.
    const { made } = await runnerOf('a16-rare', [
      { name: 'E2E a16 rare workout', daysBack: 5, km: 8, pace: 290, hr: 165, type: 'workout' },
      { name: 'E2E a16 rare easy a', daysBack: 150, km: 6, pace: 330, hr: 145 },
      { name: 'E2E a16 rare easy b', daysBack: 300, km: 6, pace: 330, hr: 145 },
    ]);
    const rows = await rowsOf(made.api);
    const page = await pages.open(browser, baseURL, guard, whoOf(made), ROUTE);
    const cases: Array<[Range, string]> = [['3m', 'About 0.1 a week'], ['6m', 'Under 0.1 a week'], ['1y', 'Under 0.1 a week'], ['all', 'Under 0.1 a week']];
    for (const [range, text] of cases) {
      await page.goto(viewOf({ range }));
      await openPage(page);
      await expect(reads(page), range).toBeVisible();
      const tiles = await readTiles(page);
      expect(tiles[0], range).toEqual(['Sessions', '1', text]);
      expect(tiles, range).toEqual(tilesOf(qualityOf(rows, { range }), range));
    }
  });

  test('A16-N1 each runner sees their own sessions and nothing of anyone else\'s', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    const { made } = await runnerOf('a16-mine', [10, 25, 40].map((daysBack): RunSpec & { type: Kind } => ({ name: `E2E a16 mine ${daysBack}`, daysBack, km: 6, pace: 300 + daysBack / 5, hr: 150, type: 'workout' })));
    const page = await pages.open(browser, baseURL, guard, whoOf(made), ROUTE);
    await openPage(page);
    await expect(reads(page)).toBeVisible();
    await expect(bodyRows(page)).toHaveCount(3);
    await expect(table(page)).not.toContainText('E2E a16 run');
    await expect(table(page)).toContainText('E2E a16 mine 40');
  });

  test('A16-N2 signed out, the page sends the visitor to the front page or the sign-in page and shows no run', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page).toHaveURL(/\/($|login)/);
    await expect(table(page)).toHaveCount(0);
    await expect(reads(page)).toHaveCount(0);
  });
});

test.describe('A16 quality sessions: units, language, themes, keys and phones', () => {
  test('A16-U1 in miles the distances and the paces are in miles, the readings and the table', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_unit', 'mile'));
    await page.goto(ROUTE);
    await openPage(page);
    const found = qualityOf(await rowsOf(runner.api));
    await expect(reads(page)).toBeVisible();
    expect(await readTiles(page)).toEqual(tilesOf(found, '3m', 'mile'));
    expect(await readRows(page)).toEqual(found.sessions.map((row) => rowCells(row, 'mile')));
    expect((await readRows(page))[0][3]).toMatch(/ mi$/);
    expect((await readRows(page))[0][5]).toMatch(/ \/mi$/);
  });

  test('A16-L1 in Chinese the page is translated, the sentences have Chinese punctuation, and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(ROUTE);
    await expect(page.getByRole('heading', { level: 1, name: '质量训练课' })).toBeVisible();
    const found = qualityOf(await rowsOf(runner.api));
    await expect(page.getByRole('group', { name: '计为质量训练课的类型', exact: true }).getByRole('button', { name: '训练课', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: '计为质量训练课的类型', exact: true }).getByRole('button', { name: '长距离跑', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('group', { name: '时间段', exact: true }).getByRole('button', { name: '3 个月', exact: true })).toHaveAttribute('aria-pressed', 'true');

    const tiles = await page.getByRole('group', { name: '这段时间的读数' }).locator('> div').evaluateAll((nodes) => nodes.map((node) => ['span', 'strong', 'small'].map((tag) => (node.querySelector(tag)?.textContent ?? '').trim())));
    const change = found.count - (found.before as { sessions: number }).sessions;
    expect(tiles[0].slice(0, 2)).toEqual(['训练课次数', String(found.count)]);
    expect(found.perWeek, 'the fixture has a rate that is written with a number').toBeGreaterThanOrEqual(0.05);
    expect(tiles[0][2]).toBe(`平均每周约 ${weekly.format(found.perWeek)} 次`);
    expect(tiles[1].slice(0, 2)).toEqual(['它们的距离', `${found.km.toFixed(1)} 公里`]);
    expect(tiles[1][2]).toBe(`占这段时间全部跑量的 ${Math.round((found.share as number) * 100)}%`);
    expect(tiles[2].slice(0, 2)).toEqual(['中间配速', `${mmss(found.median as number)} /公里`]);
    expect(tiles[3][0]).toBe('与之前 3 个月相比');
    expect(tiles[3][1]).toBe(change === 0 ? '次数相同' : change > 0 ? `多 ${change} 次` : `少 ${-change} 次`);
    expect(tiles[3][2]).toBe(`那段时间有 ${(found.before as { sessions: number }).sessions} 次，共 ${(found.before as { runs: number }).runs} 次跑步。`);

    const headers = await page.getByRole('table', { name: '这段时间的质量训练课，从最近到最早' }).locator('thead th').allTextContents();
    expect(headers).toEqual(['日期', '跑步', '类型', '距离', '时间', '配速', '心率']);
    const cells = await page.getByRole('table', { name: '这段时间的质量训练课，从最近到最早' }).locator('tbody tr').evaluateAll((rows) => rows.map((row) => Array.from(row.children).map((cell) => (cell.textContent ?? '').trim())));
    expect(cells.length).toBe(found.count);
    found.sessions.forEach((row, index) => {
      expect(cells[index][0]).toMatch(/^\d{4}年\d{1,2}月\d{1,2}日$/);
      expect(cells[index][1]).toBe(row.name);
      expect(cells[index][2]).toBe(TYPE_LABEL_ZH[(row.runType ?? '').toUpperCase()]);
      expect(cells[index][3]).toBe(`${row.distanceKm.toFixed(1)} 公里`);
      expect(cells[index][5]).toBe(`${mmss(paceOf(row))} /公里`);
    });
    for (const text of await page.locator('.quality-sessions-v2__hint, .quality-sessions-v2__note, .quality-sessions-v2__reads small, .quality-sessions-v2__head p').allTextContents()) {
      expect(text.replace(/\d+:\d+/g, ''), 'no English comma, colon or full stop in a Chinese sentence').not.toMatch(/[,:;]|\.(?!\d)/);
    }
    await expectNoRawKeys(page);
  });

  for (const theme of ['light', 'midnight']) {
    test(`A16-A1 the page is readable in the ${theme} theme and has no accessibility violations, with the long runs turned on`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await openPage(page);
      await expect(table(page)).toBeVisible();
      expect(await contrastProblems(page, { include: ['.quality-sessions-v2'] }), `${theme}, contrast`).toEqual([]);
      expect(await a11yViolations(page, { include: ['.quality-sessions-v2'] }), `${theme}, axe`).toEqual([]);
      await chip(page, TYPES, 'Long runs').click();
      await chip(page, 'Period', '1 year').click();
      await expect(chip(page, 'Period', '1 year')).toHaveAttribute('aria-pressed', 'true');
      expect(await contrastProblems(page, { include: ['.quality-sessions-v2'] }), `${theme}, contrast with the long runs`).toEqual([]);
      expect(await a11yViolations(page, { include: ['.quality-sessions-v2'] }), `${theme}, axe with the long runs`).toEqual([]);
    });

    test(`A16-A3 the empty state is readable in the ${theme} theme and has no accessibility violations`, async ({ browser, baseURL, guard }) => {
      test.setTimeout(240_000);
      const made = await newRunner('a16-empty');
      await importRunSpecs(made.api, [5, 12, 19].map((daysBack): RunSpec => ({ name: `E2E a16 empty ${daysBack}`, daysBack, km: 6, pace: 330, hr: 145 })), { wait: false });
      const page = await pages.open(browser, baseURL, guard, whoOf(made), null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await openPage(page);
      await expect(emptyHeading(page)).toBeVisible();
      expect(await contrastProblems(page, { include: ['.quality-sessions-v2'] }), `${theme}, contrast`).toEqual([]);
      expect(await a11yViolations(page, { include: ['.quality-sessions-v2'] }), `${theme}, axe`).toEqual([]);
      await page.goto(`${ROUTE}?types=none`);
      await expect(page.getByRole('heading', { level: 2, name: 'No type is on' })).toBeVisible();
      expect(await contrastProblems(page, { include: ['.quality-sessions-v2'] }), `${theme}, contrast with no type on`).toEqual([]);
      expect(await a11yViolations(page, { include: ['.quality-sessions-v2'] }), `${theme}, axe with no type on`).toEqual([]);
    });
  }

  test('A16-K1 the keyboard reaches every link and button in turn, each shows where it is, a chip is turned on and off with Space and Enter and keeps the focus, and Enter follows a run', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    await expect(table(page)).toBeVisible();
    await page.locator('body').click({ position: { x: 5, y: 5 } });

    // Every link and button of the page's own content is a stop; the loop ends when they have all been reached (and not later, or the focus wraps round).
    const stops = await body(page).locator('a[href], button').count();
    const seen: string[] = [];
    for (let step = 0; step < 200 && seen.length < stops; step += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body || !el.closest('.quality-sessions-v2')) return null;
        const style = getComputedStyle(el);
        return { name: (el.textContent || '').trim().slice(0, 40), outline: `${style.outlineStyle} ${style.outlineWidth}` };
      });
      if (info) {
        expect(info.outline, `${info.name} shows the keyboard focus`).toMatch(/solid 2px/);
        seen.push(info.name);
      }
    }
    const found = qualityOf(await rowsOf(runner.api));
    // The page's order: the two links under the title, the three types, the four periods, the runs of the table, and the link that says how it is worked out.
    expect(seen).toEqual(['Analysis', 'Trends', 'Workouts', 'Races', 'Long runs', '3 months', '6 months', '1 year', 'All time', ...found.sessions.map((row) => row.name.slice(0, 40)), 'How it is worked out']);

    // Space turns a type on and off, Enter picks a period, and the focus stays on the chip that was used.
    await chip(page, TYPES, 'Long runs').focus();
    await page.keyboard.press('Space');
    await expect(chip(page, TYPES, 'Long runs')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip(page, TYPES, 'Long runs')).toBeFocused();
    expect(new URL(page.url()).search).toBe('?types=workout%2Crace%2Clong');
    await page.keyboard.press('Space');
    await expect(chip(page, TYPES, 'Long runs')).toHaveAttribute('aria-pressed', 'false');
    await expect(chip(page, TYPES, 'Long runs')).toBeFocused();
    await chip(page, 'Period', '6 months').focus();
    await page.keyboard.press('Enter');
    await expect(chip(page, 'Period', '6 months')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip(page, 'Period', '6 months')).toBeFocused();
    expect(new URL(page.url()).search).toBe('?range=6m');

    const wider = qualityOf(await rowsOf(runner.api), { range: '6m' });
    await table(page).getByRole('link', { name: wider.sessions[0].name, exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/runs/${wider.sessions[0].id}$`));
  });

  test('A16-M1 @mobile on a phone the page fits: the choices wrap, the readings are the rows of one card, the table scrolls in its frame, and a tap turns a type on', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    await expect(table(page)).toBeVisible();
    expect(await elementsBeyondTheEdge(page)).toEqual([]);
    const widths = await reads(page).locator('> div').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().width)));
    expect(new Set(widths).size, 'the four readings are one column, as wide as each other').toBe(1);
    const frame = await page.locator('.quality-sessions-v2__table-wrap').evaluate((node) => ({ shown: node.clientWidth, whole: node.scrollWidth, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    expect(frame.whole, 'the table is wider than the phone and scrolls inside its frame').toBeGreaterThan(frame.shown);
    expect(frame.sideways, 'and the page itself does not scroll sideways').toBeLessThanOrEqual(0);
    expect(await page.locator('.quality-sessions-v2__table-wrap').evaluate((node) => getComputedStyle(node).overflowX), 'the frame scrolls by itself').toMatch(/auto|scroll/);

    await chip(page, TYPES, 'Long runs').tap();
    await expect(chip(page, TYPES, 'Long runs')).toHaveAttribute('aria-pressed', 'true');
    const found = qualityOf(await rowsOf(runner.api), { kinds: ['workout', 'race', 'long'] });
    await expect(bodyRows(page)).toHaveCount(found.count);
    expect(await readRows(page)).toEqual(found.sessions.map((row) => rowCells(row)));
  });

  test('A16-M2 @mobile at 320 px with the text at 200% nothing runs off the screen and no name runs into its number', async ({ browser, baseURL, guard }) => {
    test.setTimeout(240_000);
    // A runner whose fourth reading is the longest a reading can be, "The same number" (two sessions now and two before), and whose distance has two digits before the point.
    const { made } = await runnerOf('a16-phone', [
      { name: 'E2E a16 phone race', daysBack: 5, km: 21.1, pace: 290, hr: 170, type: 'race' },
      { name: 'E2E a16 phone workout', daysBack: 20, km: 42.2, pace: 280, hr: 165, type: 'workout' },
      { name: 'E2E a16 phone before a', daysBack: 100, km: 7, pace: 300, hr: 160, type: 'workout' },
      { name: 'E2E a16 phone before b', daysBack: 110, km: 7, pace: 300, hr: 160, type: 'workout' },
    ]);
    const page = await pages.open(browser, baseURL, guard, whoOf(made), null);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(ROUTE);
    await openPage(page);
    await expect(table(page)).toBeVisible();
    expect((await readTiles(page))[3].slice(0, 2), 'the longest value of the fourth reading').toEqual(['Against the 3 months before', 'The same number']);
    for (const percent of [150, 200]) {
      await enlargeText(page, percent);
      expect(await elementsBeyondTheEdge(page), `elements cut off at the edge of a 320 px screen at ${percent}%`).toEqual([]);
      expect(await readingsThatCollide(page, '.quality-sessions-v2__reads > div'), `the four readings at ${percent}%`).toEqual([]);
    }
    for (const group of [[TYPES, 'Long runs'], ['Period', 'All time']] as const) {
      const target = chip(page, group[0], group[1]);
      await target.scrollIntoViewIfNeeded();
      const box = (await target.boundingBox()) as Box;
      expect(box.x, `${group[1]} starts on the screen`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${group[1]} ends on the screen`).toBeLessThanOrEqual(320);
    }
  });
});

test.describe('A16 quality sessions: the way in from Analysis', () => {
  test('A16-X1 Analysis has a link to the page in its card "More ways to look", which opens it with a title of its own', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, '/analysis');
    const card = page.getByRole('region', { name: 'More ways to look' });
    await expect(card).toBeVisible();
    const link = card.getByRole('link', { name: /^Quality sessions/ });
    await expect(link).toHaveAttribute('href', ROUTE);
    await link.click();
    await expect(heading(page)).toBeVisible();
    await expect(page).toHaveTitle(/^Quality sessions \| HermesRuns/);
  });

  test('A16-X2 the two links under the title lead to Analysis and to Trends', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const links = page.getByRole('navigation', { name: 'Related pages' });
    await expect(links.getByRole('link', { name: 'Analysis', exact: true })).toHaveAttribute('href', '/analysis');
    await links.getByRole('link', { name: 'Trends', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Trends' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/analysis/trends');
    await page.goBack();
    await openPage(page);
    await links.getByRole('link', { name: 'Analysis', exact: true }).click();
    await expect(page).toHaveURL(/\/analysis$/);
  });
});
