// F02 Look back over the weeks: the training log (M5 and M5b). Weeks, newest first, each with what it added up to and the runs of each
// day; narrowed by run type and by tags, looked at by distance, time, climb or effort, started from any day, and extended an
// earlier or a later page at a time. Everything about the view is in the address.
//
// A throwaway runner with fourteen weeks of running (fixtures/history.ts) so there are more weeks than a page holds. The page is
// checked against the API's own answer, and the API's totals against the runs the history was built with.
//
// Case numbers continue the plan: F02-H10 was the placeholder for this screen.
import type { Locator, Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { addDays, hms, mmss, shortDay, utcDay, weekStartOf } from '../fixtures/format.ts';
import { runOn, sharedHistoryRunner, type RunnerWithHistory } from '../fixtures/history.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { a11yViolations, contrastProblems, expect, expectNoHorizontalOverflow, expectNoRawKeys, test } from '../fixtures/test.ts';

const WEEKS = 14;
const ROUTE = '/training-log';
const PAGE_WEEKS = 12;

let runner: RunnerWithHistory;
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

// What the runner has said about some of the runs, by how many days ago they were. The easy run of yesterday has only a tag.
const LABELS: Array<[number, { runType: string | null; tags: string[] }]> = [
  [17, { runType: 'RACE', tags: ['half marathon', 'goal race'] }],
  [10, { runType: 'WORKOUT', tags: ['tempo'] }],
  [3, { runType: 'WORKOUT', tags: ['tempo'] }],
  [7, { runType: 'LONG_RUN', tags: ['hills'] }],
  [1, { runType: null, tags: ['with the dog'] }],
];
const nameOf = (daysBack: number): string => runOn(runner, daysBack).name;

test.beforeAll(async () => {
  test.setTimeout(480_000);
  runner = await sharedHistoryRunner('fitness', WEEKS);
  for (const [daysBack, labels] of LABELS) {
    const res = await runner.api.patch(`/api/activities/${runOn(runner, daysBack).id}`, labels);
    expect(res.status, JSON.stringify(res.json)).toBe(200);
  }
});

interface LogRun {
  id: number;
  name: string;
  distanceKm: number;
  movingSeconds: number;
  effort: number | null;
  elevationGainM: number | null;
  runType: string | null;
  tags: string[];
}

interface LogWeek {
  start: string;
  end: string;
  runs: number;
  distanceKm: number;
  movingSeconds: number;
  effort: number;
  elevationGainM: number;
  days: Array<{ date: string; runs: LogRun[] }>;
}

interface Log {
  today: string;
  timeZone: string;
  weeks: LogWeek[];
  olderRuns: boolean;
  runTypes: string[];
  tags: Array<{ tag: string; runs: number }>;
}

const logOf = async (query = `weeks=${PAGE_WEEKS}`, who: RunnerWithHistory = runner): Promise<Log> => (await who.api.get(`/api/training/log?${query}`)).json;

const heading = (page: Page): Locator => page.getByRole('heading', { level: 1, name: 'Training log' }).first();
const logWeeks = (page: Page): Locator => page.locator('[data-week]');
const runLinks = (page: Page): Locator => logWeeks(page).getByRole('link');
const viewBar = (page: Page): Locator => page.getByRole('region', { name: 'View the log' });
const filterBar = (page: Page): Locator => page.getByRole('region', { name: 'Filter the log' });
const typeChips = (page: Page): Locator => filterBar(page).getByRole('group', { name: 'Run type' });
const tagChips = (page: Page): Locator => filterBar(page).getByRole('group', { name: 'Tags' });
const metricChips = (page: Page): Locator => viewBar(page).getByRole('group', { name: 'Show', exact: true });
const jumpField = (page: Page): Locator => viewBar(page).getByLabel('Jump to a date');
/** The listed row of one run (its name is its link). */
const rowOf = (page: Page, name: string): Locator => logWeeks(page).getByRole('listitem').filter({ has: page.getByRole('link', { name, exact: true }) });

async function openLog(page: Page): Promise<void> {
  await expect(heading(page)).toBeVisible();
  await expect(logWeeks(page).first()).toBeVisible();
}

const spaced = async (locator: Locator): Promise<string> => (await locator.innerText()).replace(/\s+/g, ' ').trim();
/** A list of captions and figures as written in the markup (the page shows the captions in capitals): ["Runs 3", "Distance 21.0 km", ...]. */
const figures = (locator: Locator): Promise<string[]> =>
  locator.evaluate((list) => Array.from(list.querySelectorAll(':scope > div')).map((item) => `${item.querySelector('dt')?.textContent ?? ''} ${item.querySelector('dd')?.textContent ?? ''}`.replace(/\s+/g, ' ').trim()));
const grouped = (value: number): string => Math.round(value).toLocaleString('en-US');

/** How a week's time is written: "3 h 12 min" / "45 min". */
function weekTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

function metricOf(run: LogRun, metric: 'distance' | 'time' | 'climb' | 'effort'): string {
  switch (metric) {
    case 'distance': return `${run.distanceKm.toFixed(1)} km`;
    case 'time': return run.movingSeconds >= 3600 ? hms(run.movingSeconds) : mmss(run.movingSeconds);
    case 'climb': return run.elevationGainM && run.elevationGainM > 0 ? `${grouped(run.elevationGainM)} m` : '–';
    default: return run.effort && run.effort > 0 ? grouped(run.effort) : '–';
  }
}

const DAY_OF_WEEK = (day: string): string => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

test.describe('F02 the training log: the weeks (M5)', () => {
  test('F02-H10 the weeks, newest first, each adding up its runs, and a run opens its page', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    const log = await logOf();
    await openLog(page);

    // Twelve weeks, newest first, Monday to Sunday, as the server counted them.
    expect(log.weeks).toHaveLength(PAGE_WEEKS);
    expect(log.olderRuns, 'there are earlier weeks than the page holds').toBe(true);
    await expect(logWeeks(page)).toHaveCount(PAGE_WEEKS);
    expect(await logWeeks(page).evaluateAll((cards) => cards.map((card) => card.getAttribute('data-week')))).toEqual(log.weeks.map((week) => week.start));
    expect(log.weeks[0].start).toBe(weekStartOf(utcDay(0)));
    log.weeks.forEach((week, index) => {
      expect(week.start, `week ${index} starts on a Monday`).toBe(weekStartOf(week.start));
      if (index > 0) expect(addDays(week.start, 7)).toBe(log.weeks[index - 1].start);
    });
    await expect(logWeeks(page).first()).toContainText('This week');
    await expect(logWeeks(page).nth(1)).not.toContainText('This week');

    // The server's totals are the runs the history was built with, put into weeks by the day they were run.
    for (const week of log.weeks) {
      const built = runner.runs.filter((run) => weekStartOf(utcDay(run.daysAgo)) === week.start);
      expect(week.runs, `runs in the week of ${week.start}`).toBe(built.length);
      expect(Math.abs(week.distanceKm - built.reduce((sum, run) => sum + run.km, 0)), `distance of the week of ${week.start}`).toBeLessThan(0.5);
    }

    // Each card says what the server said: runs, distance, time, effort and climb (climb only when there is some).
    for (const week of log.weeks) {
      const card = page.locator(`[data-week="${week.start}"]`);
      const totals = [`Runs ${week.runs}`, `Distance ${week.distanceKm.toFixed(1)} km`, `Time ${weekTime(week.movingSeconds)}`, `Effort ${grouped(week.effort)}`];
      if (week.elevationGainM > 0) totals.push(`Climb ${grouped(week.elevationGainM)} m`);
      expect(await figures(card.locator('dl').first()), `totals of the week of ${week.start}`).toEqual(totals);
    }

    // Each day with a run is a heading with the day's total; each run is a row with its own figures and a link to its page.
    const week = log.weeks[1];
    const card = page.locator(`[data-week="${week.start}"]`);
    for (const day of week.days) {
      const section = card.locator('section').filter({ has: page.locator(`time[datetime="${day.date}"]`) });
      await expect(section.getByRole('heading', { level: 3 })).toContainText(DAY_OF_WEEK(day.date));
      for (const run of day.runs) {
        const row = section.getByRole('listitem').filter({ has: page.getByRole('link', { name: run.name, exact: true }) });
        await expect(row.getByRole('link', { name: run.name, exact: true })).toHaveAttribute('href', `/runs/${run.id}`);
        const stats = await figures(row.locator('dl'));
        expect(stats).toContain(`Distance ${run.distanceKm.toFixed(1)} km`);
        expect(stats).toContain(`Time ${metricOf(run, 'time')}`);
        expect(stats).toContain(`Effort ${metricOf(run, 'effort')}`);
        expect(stats.some((item) => /^Pace \d+:\d\d \/km$/.test(item)), stats.join(' | ')).toBe(true);
        expect(stats, 'a run shows its climb when the file had elevation, and a dash when it had none').toContain(`Climb ${metricOf(run, 'climb')}`);
      }
    }
    const first = week.days[0].runs[0];
    await card.getByRole('link', { name: first.name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/runs/${first.id}$`));
    await expect(page.getByRole('region', { name: 'Pace analysis' })).toBeVisible();
  });

  test('F02-H10b a run shows the type and the tags the runner gave it', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openLog(page);
    const race = rowOf(page, nameOf(17));
    await expect(race.getByText('Race', { exact: true })).toBeVisible();
    await expect(race.getByRole('list', { name: 'Tags on this run' }).getByRole('button')).toHaveText(['half marathon', 'goal race']);
    await expect(rowOf(page, nameOf(3)).getByText('Workout', { exact: true })).toBeVisible();
    await expect(rowOf(page, nameOf(7)).getByText('Long run', { exact: true })).toBeVisible();
    // A run the runner said nothing about has no label, and one with only a tag has only the tag.
    const dog = rowOf(page, nameOf(1));
    await expect(dog.getByRole('list', { name: 'Tags on this run' }).getByRole('button')).toHaveText(['with the dog']);
    for (const word of ['Race', 'Workout', 'Long run']) await expect(dog.getByText(word, { exact: true })).toHaveCount(0);
    const plain = rowOf(page, nameOf(5));
    await expect(plain.getByRole('list', { name: 'Tags on this run' })).toHaveCount(0);
  });

  test('F02-H10c Show: distance, time, climb or effort rewrite the day totals and the address, and ask the server for nothing', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    const asked: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/training/log')) asked.push(request.url());
    });
    await page.goto(ROUTE);
    await openLog(page);
    const log = await logOf();
    const runs = log.weeks.flatMap((week) => week.days).flatMap((day) => day.runs.map((run) => ({ ...run, date: day.date })));
    const byDay = new Map(runs.map((run) => [run.date, run]));
    // Days with exactly one run, an easy one, a hard one and a long one (the long run has the only climb).
    const days = [utcDay(1), utcDay(3), utcDay(7)];
    const dayHeading = (day: string) => logWeeks(page).locator('section').filter({ has: page.locator(`time[datetime="${day}"]`) }).getByRole('heading', { level: 3 });

    await expect(metricChips(page).getByRole('button', { name: 'Distance' })).toHaveAttribute('aria-pressed', 'true');
    for (const metric of ['distance', 'time', 'climb', 'effort'] as const) {
      const name = metric[0].toUpperCase() + metric.slice(1);
      await metricChips(page).getByRole('button', { name }).click();
      await expect(metricChips(page).getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
      if (metric === 'distance') await expect(page).not.toHaveURL(/metric=/);
      else await expect(page).toHaveURL(new RegExp(`metric=${metric}`));
      if (metric === 'climb') {
        // The long run is a file with elevation, and the importer adds up its climb (BUG-036): its day says so, the other days say it
        // with a dash, and the week totals show the climb of the week now that climb is what is being looked at (even when it is
        // 0 m), though they leave it out otherwise.
        const first = logWeeks(page).first();
        const start = await first.getAttribute('data-week');
        const week = log.weeks.find((candidate) => candidate.start === start) as LogWeek;
        expect(await figures(first.locator('dl').first())).toContain(`Climb ${grouped(week.elevationGainM)} m`);
      }
      for (const day of days) {
        const run = byDay.get(day) as (typeof runs)[number];
        await expect(dayHeading(day), `${metric} on ${day}`).toContainText(metricOf(run, metric));
      }
    }
    // Looked at by effort, the week totals leave climb out when the week had none.
    expect(await figures(logWeeks(page).first().locator('dl').first())).not.toContain('Climb 0 m');
    // And the long run, the only one with a climb, shows it where climb is shown (BUG-036).
    expect(runs.some((run) => (run.elevationGainM ?? 0) > 0), 'the long runs carry a climb figure').toBe(true);
    // The figure being looked at is marked in every row, for the eye (no role says which figure is marked).
    await expect(rowOf(page, nameOf(3)).locator('.is-chosen dt')).toHaveText('Effort');
    expect(asked, 'changing what is shown makes no request').toHaveLength(1);
  });

  test('F02-H10d the type and the tags narrow the log; the address keeps them; Clear filters brings everything back', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openLog(page);
    const log = await logOf();
    expect(log.runTypes.sort()).toEqual(['LONG_RUN', 'RACE', 'WORKOUT']);

    // Only the types the runner has used are offered, with "all runs" to take the choice back.
    await expect(typeChips(page).getByRole('button')).toHaveText(['All runs', 'Race', 'Long run', 'Workout']);
    await expect(typeChips(page).getByRole('button', { name: 'All runs' })).toHaveAttribute('aria-pressed', 'true');
    await typeChips(page).getByRole('button', { name: 'Race', exact: true }).click();
    await expect(page).toHaveURL(/runType=RACE/);
    await expect(runLinks(page)).toHaveCount(1);
    await expect(runLinks(page).first()).toHaveText(nameOf(17));
    await expect(typeChips(page).getByRole('button', { name: 'Race', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await typeChips(page).getByRole('button', { name: 'All runs' }).click();
    await expect(page).not.toHaveURL(/runType/);
    await expect(runLinks(page).first()).toBeVisible();

    // The runner's tags, most used first, each with how many runs have it.
    expect(log.tags[0]).toEqual({ tag: 'tempo', runs: 2 });
    await expect(tagChips(page).getByRole('button', { name: /^tempo\s*2$/ })).toBeVisible();
    await tagChips(page).getByRole('button', { name: /^tempo/ }).click();
    await expect(page).toHaveURL(/tag=tempo/);
    await expect(runLinks(page)).toHaveText([nameOf(3), nameOf(10)]);

    // A second tag narrows further: the runs that have both. Nothing has both, and the page says so instead of showing everything.
    await tagChips(page).getByRole('button', { name: /^hills/ }).click();
    expect(new URL(page.url()).searchParams.getAll('tag').sort()).toEqual(['hills', 'tempo']);
    await expect(page.getByText('Showing runs that have all of the chosen tags.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'No runs match these filters' })).toBeVisible();
    await expect(runLinks(page)).toHaveCount(0);
    // The filters stay, so the choice can be undone.
    await expect(tagChips(page).getByRole('button', { name: /^hills/ })).toHaveAttribute('aria-pressed', 'true');
    await tagChips(page).getByRole('button', { name: /^hills/ }).click();
    await expect(runLinks(page)).toHaveCount(2);

    // A type and a tag together; then everything is cleared at once.
    await typeChips(page).getByRole('button', { name: 'Workout' }).click();
    await expect(runLinks(page)).toHaveText([nameOf(3), nameOf(10)]);
    await typeChips(page).getByRole('button', { name: 'Race', exact: true }).click();
    await expect(runLinks(page)).toHaveCount(0);
    await filterBar(page).getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).not.toHaveURL(/runType|tag=/);
    await expect(logWeeks(page)).toHaveCount(PAGE_WEEKS);
    await expect(filterBar(page).getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
  });

  test('F02-H10e a tag on a run is a filter: pressing it narrows the log to that tag, and pressing it again lets go', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openLog(page);
    await rowOf(page, nameOf(1)).getByRole('button', { name: 'Filter by the tag with the dog' }).click();
    expect(new URL(page.url()).searchParams.getAll('tag')).toEqual(['with the dog']);
    await expect(runLinks(page)).toHaveText([nameOf(1)]);
    await expect(rowOf(page, nameOf(1)).getByRole('button', { name: 'Filter by the tag with the dog' })).toHaveAttribute('aria-pressed', 'true');
    await rowOf(page, nameOf(1)).getByRole('button', { name: 'Filter by the tag with the dog' }).click();
    await expect(page).not.toHaveURL(/tag=/);
    await expect(logWeeks(page)).toHaveCount(PAGE_WEEKS);
  });

  test('F02-H10f the address is the view: opening it shows the same filters, metric and start; the back button leaves the log', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.goto('/runs');
    await page.goto(`${ROUTE}?runType=RACE&tag=half%20marathon&metric=effort`);
    await openLog(page);
    await expect(typeChips(page).getByRole('button', { name: 'Race', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(tagChips(page).getByRole('button', { name: /^half marathon/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(metricChips(page).getByRole('button', { name: 'Effort' })).toHaveAttribute('aria-pressed', 'true');
    await expect(runLinks(page)).toHaveText([nameOf(17)]);
    // Choosing something else changes the address in place: back goes to where the runner came from, not through every chip.
    await typeChips(page).getByRole('button', { name: 'All runs' }).click();
    await metricChips(page).getByRole('button', { name: 'Time' }).click();
    await page.goBack();
    await expect(page).toHaveURL(/\/runs$/);
  });

  test('F02-H10g Jump to a date starts the log at the week of that day; later weeks come up to today; Latest weeks undoes it', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    const asked: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/training/log')) asked.push(new URL(request.url()).search);
    });
    await page.goto(ROUTE);
    await openLog(page);
    await expect(page.getByRole('button', { name: 'Latest weeks' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show later weeks' })).toHaveCount(0);

    const target = utcDay(56);
    const field = jumpField(page);
    await field.fill(target);
    await expect(page).toHaveURL(new RegExp(`to=${target}`));
    await expect(logWeeks(page)).toHaveCount(PAGE_WEEKS);
    await expect(logWeeks(page).first()).toHaveAttribute('data-week', weekStartOf(target));
    await expect(logWeeks(page).first()).not.toContainText('This week');
    await expect(page.getByRole('button', { name: 'Latest weeks' })).toBeVisible();
    expect(asked.at(-1)).toContain(`to=${target}`);
    expect(asked.at(-1)).toContain(`weeks=${PAGE_WEEKS}`);

    // Later weeks arrive above the first, up to the week of today, and the keyboard goes to the first of them.
    const gap = (Date.parse(`${weekStartOf(utcDay(0))}T12:00:00Z`) - Date.parse(`${weekStartOf(target)}T12:00:00Z`)) / (7 * 86_400_000);
    await page.getByRole('button', { name: 'Show later weeks' }).click();
    await expect(logWeeks(page)).toHaveCount(PAGE_WEEKS + gap);
    await expect(logWeeks(page).first()).toHaveAttribute('data-week', weekStartOf(utcDay(0)));
    await expect(logWeeks(page).first().getByRole('heading', { level: 2 })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Show later weeks' })).toHaveCount(0);
    // The weeks reach today, but the log was started from a past day, and can still be put back.
    await expect(page.getByRole('button', { name: 'Latest weeks' })).toBeVisible();
    // Weeks are never listed twice, and run on without a gap.
    const starts = await logWeeks(page).evaluateAll((cards) => cards.map((card) => card.getAttribute('data-week') as string));
    expect(new Set(starts).size).toBe(starts.length);
    starts.forEach((start, index) => {
      if (index > 0) expect(addDays(start, 7)).toBe(starts[index - 1]);
    });

    await page.getByRole('button', { name: 'Latest weeks' }).click();
    await expect(page).not.toHaveURL(/to=/);
    await expect(field).toHaveValue('');
    await expect(field).toBeFocused();
    await expect(logWeeks(page)).toHaveCount(PAGE_WEEKS);
    await expect(logWeeks(page).first()).toContainText('This week');
    await expect(page.getByRole('button', { name: 'Latest weeks' })).toHaveCount(0);
  });

  test('F02-H10h a day is requested only when it is a real day between 1970 and today; typing a year never asks for the years on the way', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    const asked: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/training/log')) asked.push(new URL(request.url()).searchParams.get('to') ?? '');
    });
    await page.goto(ROUTE);
    await openLog(page);
    const before = asked.length;
    const field = jumpField(page);
    await field.fill(addDays(utcDay(0), 400));
    await field.fill('1969-12-31');
    await field.fill('0002-03-04');
    await field.fill('');
    expect(asked, 'a day after today, before 1970 or empty asks for nothing').toHaveLength(before);
    await expect(page).not.toHaveURL(/to=/);
    // Typing the digits, in the order this browser's date field takes them. With the year last (as in the United States) the field
    // passes through 0002-.., 0020-.., 0202-.. on the way to 2026-..: none of those is ever asked for.
    const day = utcDay(30);
    const order = await page.evaluate(() => new Intl.DateTimeFormat(navigator.language, { year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(2026, 8, 11)).map((part) => part.type).filter((type) => ['year', 'month', 'day'].includes(type)));
    expect(order.at(-1), 'the context is the project\'s en-US one: month, day, year').toBe('year');
    const part = { year: day.slice(0, 4), month: day.slice(5, 7), day: day.slice(8, 10) } as Record<string, string>;
    await field.focus();
    await page.keyboard.type(order.map((type) => part[type]).join(''));
    await expect(page).toHaveURL(new RegExp(`to=${day}`));
    expect(asked.slice(before).filter((day) => day < '1970-01-01'), 'no request for the years on the way').toEqual([]);
    expect(asked.at(-1)).toBe(utcDay(30));
  });

  test('F02-H10i a day before the first run starts a log with no runs, and says so, with a way back to the runs', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, `${ROUTE}?to=${utcDay(300)}`);
    await expect(heading(page)).toBeVisible();
    await expect(page.getByText('There are no runs in these weeks, and none before them.')).toBeVisible();
    await expect(runLinks(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Show later weeks' }).click();
    await expect(page.getByRole('button', { name: 'Show later weeks' })).toBeVisible();
    await page.getByRole('button', { name: 'Latest weeks' }).click();
    await expect(logWeeks(page).first()).toContainText('This week');
    await expect(runLinks(page).first()).toBeVisible();
  });

  test('F02-H10j earlier weeks come a page at a time until the first run, the keyboard goes to the first new week', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    const asked: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/training/log')) asked.push(new URL(request.url()).search);
    });
    await page.goto(ROUTE);
    await openLog(page);
    const log = await logOf();
    const oldest = log.weeks.at(-1) as LogWeek;
    const more = page.getByRole('button', { name: 'Load earlier weeks' });
    await expect(more).toBeVisible();
    await more.click();
    await expect.poll(() => logWeeks(page).count()).toBeGreaterThan(PAGE_WEEKS);
    // The next page starts the day before the oldest week it had, so no week is asked for twice.
    expect(asked.at(-1)).toContain(`to=${addDays(oldest.start, -1)}`);
    await expect(logWeeks(page).nth(PAGE_WEEKS).getByRole('heading', { level: 2 })).toBeFocused();
    await expect(page.getByText('That is your first run.')).toBeVisible();
    await expect(more).toHaveCount(0);
    const starts = await logWeeks(page).evaluateAll((cards) => cards.map((card) => card.getAttribute('data-week') as string));
    expect(new Set(starts).size).toBe(starts.length);
    // The oldest run of the history is in the oldest week with runs.
    const firstDay = utcDay((WEEKS - 1) * 7 + 7);
    await expect(page.locator(`[data-week="${weekStartOf(firstDay)}"]`).locator(`time[datetime="${firstDay}"]`)).toBeAttached();
  });

  test('F02-H10k climb: runs that carry a climb figure show it in their rows, in the day totals and in the weeks', async ({ browser, baseURL, guard, seed }) => {
    // The seeded runner has 21 runs that carry a climb figure, as runs synced from Strava do (a run from a file does not, BUG-036).
    // The log is only read here.
    const mine = new Api(seed.baseUrl, seed.a.token);
    const log = (await mine.get('/api/training/log?weeks=12')).json as Log;
    const withClimb = log.weeks.filter((week) => week.elevationGainM > 0);
    expect(withClimb.length, 'weeks with climb in the seeded history').toBeGreaterThan(3);
    for (const week of withClimb) {
      const sum = week.days.flatMap((day) => day.runs).reduce((total, run) => total + (run.elevationGainM ?? 0), 0);
      expect(Math.abs(sum - week.elevationGainM), `climb of the week of ${week.start}`).toBeLessThan(0.5);
    }
    const page = await pages.open(browser, baseURL, guard, { token: seed.a.token, email: seed.a.email }, `${ROUTE}?metric=climb`);
    await expect(logWeeks(page).first()).toBeVisible();
    for (const week of withClimb.slice(0, 3)) {
      const card = page.locator(`[data-week="${week.start}"]`);
      expect(await figures(card.locator('dl').first())).toContain(`Climb ${grouped(week.elevationGainM)} m`);
      for (const day of week.days) {
        const total = day.runs.reduce((sum, run) => sum + (run.elevationGainM ?? 0), 0);
        const dayHeading = card.locator('section').filter({ has: page.locator(`time[datetime="${day.date}"]`) }).getByRole('heading', { level: 3 });
        await expect(dayHeading).toContainText(total > 0 ? `${grouped(total)} m` : '–');
      }
    }
    // Looked at by distance, the week totals still carry the climb the week had.
    await metricChips(page).getByRole('button', { name: 'Distance' }).click();
    expect(await figures(page.locator(`[data-week="${withClimb[0].start}"]`).locator('dl').first())).toContain(`Climb ${grouped(withClimb[0].elevationGainM)} m`);
  });

  test('F02-E26 a runner with no run sees an invitation to import, not an empty log', async ({ browser, baseURL, guard }) => {
    const { api, email } = await newRunner('log-none');
    const page = await pages.open(browser, baseURL, guard, { token: api.token as string, email }, ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: 'No runs yet' })).toBeVisible();
    await expect(page.getByText('Import your runs or connect a watch, and they appear here week by week.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Import runs' })).toHaveAttribute('href', '/settings/import-data');
    await expect(viewBar(page)).toHaveCount(0);
    await expect(filterBar(page)).toHaveCount(0);
    await expect(logWeeks(page)).toHaveCount(0);
    await expectNoRawKeys(page);
  });

  test('F02-E27 filters for something nobody has: the page says nothing matches and still lets the runner take the filter off', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, `${ROUTE}?tag=no%20such%20tag`);
    await expect(page.getByRole('heading', { level: 2, name: 'No runs match these filters' })).toBeVisible();
    await expect(page.getByText('Try fewer tags, or a different run type.')).toBeVisible();
    await expect(tagChips(page).getByRole('button', { name: /^no such tag/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await expect(page).not.toHaveURL(/tag=/);
    await expect(logWeeks(page)).toHaveCount(PAGE_WEEKS);
    // A run type the API does not know is refused by the API; the page must not break on it either.
    await page.goto(`${ROUTE}?runType=SPRINT`);
    await expect(heading(page)).toBeVisible();
    await expectNoRawKeys(page);
  });

  test('F02-E28 when the log cannot be loaded the page says so and Try again brings it back', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    let failures = 1;
    await page.route('**/api/training/log**', (route) => (failures-- > 0 ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }) : route.continue()));
    await page.goto(ROUTE);
    await expect(page.getByRole('alert').filter({ hasText: 'Your training log could not be loaded.' })).toBeVisible();
    await page.getByRole('button', { name: 'Try again' }).first().click();
    await expect(logWeeks(page)).toHaveCount(PAGE_WEEKS);
  });

  test('F02-E29 when earlier weeks cannot be loaded the page says so, keeps what it has, and the next try works', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    let failures = 1;
    await page.route('**/api/training/log**', (route) => (route.request().url().includes('&to=') || route.request().url().includes('?to=')) && failures-- > 0
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' })
      : route.continue());
    await page.goto(ROUTE);
    await openLog(page);
    const more = page.getByRole('button', { name: 'Load earlier weeks' });
    await more.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Earlier weeks could not be loaded.' })).toBeVisible();
    await expect(logWeeks(page)).toHaveCount(PAGE_WEEKS);
    await expect(more).toBeEnabled();
    await more.click();
    await expect.poll(() => logWeeks(page).count()).toBeGreaterThan(PAGE_WEEKS);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('F02-E30 slow network: the page says it is loading, then shows the weeks', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.route('**/api/training/log**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await page.goto(ROUTE);
    await expect(page.getByRole('status').filter({ hasText: 'Loading your training log...' })).toBeAttached();
    await expect(heading(page)).toBeVisible();
    await expect(logWeeks(page).first()).toBeVisible({ timeout: 15_000 });
  });

  test('F02-E31 two tabs: a tag added in one is in the other after a reload, and the log never shows a run twice', async ({ browser, baseURL, guard }) => {
    const one = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openLog(one);
    const two = await pages.tab(one, ROUTE);
    await openLog(two);
    const run = runOn(runner, 5);
    try {
      expect((await runner.api.patch(`/api/activities/${run.id}`, { tags: ['two tabs'] })).status).toBe(200);
      await two.reload();
      await openLog(two);
      await expect(rowOf(two, run.name).getByRole('button', { name: 'Filter by the tag two tabs' })).toBeVisible();
      await one.bringToFront();
      await one.reload();
      await openLog(one);
      await expect(tagChips(one).getByRole('button', { name: /^two tabs/ })).toBeVisible();
      await expect(one.getByRole('link', { name: run.name, exact: true })).toHaveCount(1);
    } finally {
      expect((await runner.api.patch(`/api/activities/${run.id}`, { tags: [] })).status).toBe(200);
    }
  });

  test('F02-E32 the training log has no serious accessibility violation, with each metric shown', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openLog(page);
    expect(await a11yViolations(page, { ignoreRules: ['color-contrast'] })).toEqual([]);
    await metricChips(page).getByRole('button', { name: 'Effort' }).click();
    await typeChips(page).getByRole('button', { name: 'Workout' }).click();
    expect(await a11yViolations(page, { ignoreRules: ['color-contrast'] })).toEqual([]);
  });

  test('F02-E33 text on the training log is readable (contrast of 4.5 to 1), in both themes, with each metric shown', async ({ browser, baseURL, guard }) => {
    // axe cannot judge this page (it puts every piece of text in "incomplete"), so the colours are worked out by contrastProblems().
    // The log and the goals card on it; the shell around them (the breadcrumb) is known to fall short (BUG-005).
    for (const theme of ['light', 'midnight']) {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await openLog(page);
      expect(await contrastProblems(page, { include: ['.training-log-v2'] }), `${theme}, distance`).toEqual([]);
      await metricChips(page).getByRole('button', { name: 'Effort' }).click();
      await typeChips(page).getByRole('button', { name: 'Workout' }).click();
      expect(await contrastProblems(page, { include: ['.training-log-v2'] }), `${theme}, effort, workouts`).toEqual([]);
    }
  });

  test('F02-E34 keyboard only: filter by a tag, change what is shown, jump to a date and load more, without a mouse', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openLog(page);
    const tempo = tagChips(page).getByRole('button', { name: /^tempo/ });
    await tempo.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/tag=tempo/);
    await expect(tempo).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page).not.toHaveURL(/tag=/);
    const effort = metricChips(page).getByRole('button', { name: 'Effort' });
    await effort.focus();
    await page.keyboard.press('Enter');
    await expect(effort).toHaveAttribute('aria-pressed', 'true');
    const more = page.getByRole('button', { name: 'Load earlier weeks' });
    await more.focus();
    await page.keyboard.press('Enter');
    await expect(logWeeks(page).nth(PAGE_WEEKS).getByRole('heading', { level: 2 })).toBeFocused();
  });

  test('F02-E35 in Chinese the training log is translated and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(`${ROUTE}?runType=RACE`);
    await expect(page.getByRole('heading', { level: 1, name: '训练日志' }).first()).toBeVisible({ timeout: 15_000 });
    await expect(logWeeks(page)).toHaveCount(1);
    await expectNoRawKeys(page);
    expect(await page.locator('main').innerText()).not.toMatch(/Training log|Load earlier weeks|Clear filters/);
  });

  test('F02-E36 @mobile the training log fits a phone, before and after a jump and a filter', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(ROUTE);
    await openLog(page);
    await expectNoHorizontalOverflow(page);
    // Ten days back: the week of that day is not this week, and the workout of that day is in it.
    await jumpField(page).fill(utcDay(10));
    await expect(page).toHaveURL(/to=/);
    await expect(logWeeks(page).first()).not.toContainText('This week');
    await expectNoHorizontalOverflow(page);
    await typeChips(page).getByRole('button', { name: 'Workout' }).click();
    await expect(runLinks(page).first()).toHaveText(nameOf(10));
    await expectNoHorizontalOverflow(page);
  });

  test('F02-N2 the log is the runner\'s own and refuses what it cannot answer: signed out is 401, bad values are 400, another runner has no runs here', async ({ api }) => {
    const signedOut = await api.get('/api/training/log', { token: null });
    expect(signedOut.status).toBe(401);
    for (const query of ['weeks=0', 'weeks=27', 'weeks=abc', 'to=2026-02-30', 'to=yesterday', 'runType=SPRINT']) {
      const refused = await runner.api.get(`/api/training/log?${query}`);
      expect(refused.status, query).toBe(400);
      expect(refused.json.code, query).toBe('INVALID_LOG_REQUEST');
    }
    // A day in the future is not an error: the log ends at today.
    const future = await logOf(`to=${addDays(utcDay(0), 30)}&weeks=1`);
    expect(future.weeks).toHaveLength(1);
    expect(future.weeks[0].start).toBe(weekStartOf(utcDay(0)));
    // The tags asked for are the tags a run carries; the case does not matter, and a tag nobody has finds nothing.
    const shouting = await logOf('tag=TEMPO&weeks=12');
    expect(shouting.weeks.reduce((sum, week) => sum + week.runs, 0)).toBe(2);
    const none = await logOf('tag=nobody-has-this&weeks=12');
    expect(none.weeks.reduce((sum, week) => sum + week.runs, 0)).toBe(0);

    const other = await newRunner('log-other');
    const theirs = (await other.api.get('/api/training/log?weeks=26')).json as Log;
    expect(theirs.weeks.reduce((sum, week) => sum + week.runs, 0)).toBe(0);
    expect(theirs.olderRuns).toBe(false);
    expect(theirs.tags).toEqual([]);
    expect(theirs.runTypes).toEqual([]);
  });
});
