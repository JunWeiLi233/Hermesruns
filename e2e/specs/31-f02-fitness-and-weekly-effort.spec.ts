// F02 Check whether training is building or overreaching, the part M4 built: fitness, fatigue and form, and the weekly effort against
// the usual range. Both are cards on Analysis > Load balance, under the older acute / chronic chart.
//
// They need a history to say anything, so these specs use a throwaway runner with fourteen weeks of running behind it
// (fixtures/history.ts), not the seeded one. The numbers on the page are checked against the API and against arithmetic done again
// here from the daily efforts, so a card that drew the wrong number, or a model that drifted from its own documentation, fails.
//
// Case numbers continue the plan: F02-H8 and H9 were placeholders for these screens.
import type { Locator, Page } from '@playwright/test';
import { newRunner } from '../fixtures/api.ts';
import { oneDecimal, shortDay, signedChange, utcDay, weekStartOf, addDays } from '../fixtures/format.ts';
import { importHistoryRun, runOn, sharedHistoryRunner, waitForEffort, type RunnerWithHistory } from '../fixtures/history.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { a11yViolations, contrastProblems, expect, expectNoHorizontalOverflow, expectNoRawKeys, test } from '../fixtures/test.ts';

const WEEKS = 14;
const RACE_DAYS_AGO = 17;
const FIRST_RUN_DAYS_AGO = (WEEKS - 1) * 7 + 7;
const ROUTE = '/analysis/load-balance';

let runner: RunnerWithHistory;
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

test.beforeAll(async () => {
  test.setTimeout(480_000);
  runner = await sharedHistoryRunner('fitness', WEEKS);
  const race = await runner.api.patch(`/api/activities/${runOn(runner, RACE_DAYS_AGO).id}`, { runType: 'RACE', tags: ['half marathon'] });
  expect(race.status, JSON.stringify(race.json)).toBe(200);
});

interface Day {
  date: string;
  load: number;
  fitness: number;
  fatigue: number;
  form: number;
}

interface Series {
  status: string;
  historyDays: number;
  minHistoryDays: number;
  fitnessDays: number;
  fatigueDays: number;
  points: Day[];
  projection: Array<{ date: string; fitness: number; fatigue: number; form: number }>;
  current: { date: string; fitness: number; fatigue: number; form: number; fitnessChange7d: number; fatigueChange7d: number; formChange7d: number };
  raceDays: string[];
  sources: Record<string, number>;
  runs: number;
  pendingRuns: number;
}

interface Week {
  start: string;
  end: string;
  total: number;
  runs: number;
  complete: boolean;
  range: { low: number; high: number; average: number } | null;
  status: 'within' | 'above' | 'below' | 'building' | 'none';
}

const seriesOf = async (who: RunnerWithHistory = runner): Promise<Series> => (await who.api.get(`/api/training/series?from=${utcDay(200)}`)).json;

const fitnessCard = (page: Page): Locator => page.getByRole('region', { name: 'Fitness, fatigue and form', exact: true });
const todayCards = (page: Page): Locator => fitnessCard(page).getByRole('region', { name: 'Fitness, fatigue and form today' });
const weeklyCard = (page: Page): Locator => page.getByRole('region', { name: 'Weekly effort', exact: true });
const fitnessChart = (page: Page): Locator => fitnessCard(page).getByRole('slider', { name: /^Fitness, fatigue and form for \d+ days, from .+ to .+\./ });
const lineSwitches = (page: Page): Locator => fitnessCard(page).getByRole('group', { name: 'Lines to show' });
const ranges = (page: Page): Locator => fitnessCard(page).getByRole('group', { name: 'Time range' });

/** How the key reads fitness against fatigue: clearly above zero is fresh, clearly below is tired, a tenth of fitness or 3 points. */
function formWord(form: number, fitness: number): 'Fresh' | 'Even' | 'Tired' {
  const band = Math.max(3, 0.1 * Math.max(0, fitness));
  return form > band ? 'Fresh' : form < -band ? 'Tired' : 'Even';
}

const grouped = (value: number): string => Math.round(value).toLocaleString('en-US');
const literal = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const STATUS_WORDS: Record<Week['status'], string> = {
  within: 'Within your usual range',
  above: 'Above your usual range',
  below: 'Below your usual range',
  building: 'Building towards your usual range',
  none: 'No usual range yet',
};

function thisWeekSentence(week: Week): string {
  const total = grouped(week.total);
  if (!week.range) return `This week so far: ${total}. There is no usual range yet: it needs three weeks of running before this one.`;
  const range = `${grouped(week.range.low)} to ${grouped(week.range.high)}`;
  if (week.status === 'within') return `This week so far: ${total}. Your usual range is ${range}, so you are inside it.`;
  if (week.status === 'above') return `This week so far: ${total}. Your usual range is ${range}, so you are already above it.`;
  return `This week so far: ${total}. Your usual range is ${range}; the days left can still take you into it.`;
}

async function openLoadBalance(page: Page): Promise<void> {
  await expect(fitnessCard(page)).toBeVisible();
  await expect(todayCards(page)).toBeVisible();
  await expect(weeklyCard(page).getByRole('table')).toBeAttached();
}

test.describe('F02 fitness, fatigue and form (M4)', () => {
  test('F02-H8 three numbers that are the model\'s own arithmetic, the change over seven days and a word for form', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    const series = await seriesOf();
    expect(series.status).toBe('ready');
    expect(series.points[0].date, 'the series starts the day of the first run').toBe(utcDay(FIRST_RUN_DAYS_AGO));
    expect(series.points.at(-1)?.date).toBe(utcDay(0));
    await openLoadBalance(page);

    // What the page shows is what the server computed...
    const now = series.current;
    await expect(todayCards(page).locator('article strong')).toHaveText([oneDecimal(now.fitness), oneDecimal(now.fatigue), signedChange(now.form)]);

    // ...and what the server computed is the documented model, worked out again here from the daily efforts alone:
    // each average closes 1 - e^(-1/days) of the gap to the day's effort, a day without a run is a day of zero.
    const slow = 1 - Math.exp(-1 / series.fitnessDays);
    const fast = 1 - Math.exp(-1 / series.fatigueDays);
    let fitness = 0;
    let fatigue = 0;
    for (const day of series.points) {
      fitness += (day.load - fitness) * slow;
      fatigue += (day.load - fatigue) * fast;
    }
    expect(series.fitnessDays).toBe(42);
    expect(series.fatigueDays).toBe(7);
    expect(Math.abs(fitness - now.fitness), `fitness worked out here ${fitness.toFixed(2)}, shown ${now.fitness}`).toBeLessThan(0.2);
    expect(Math.abs(fatigue - now.fatigue), `fatigue worked out here ${fatigue.toFixed(2)}, shown ${now.fatigue}`).toBeLessThan(0.2);
    expect(Math.abs(fitness - fatigue - now.form), 'form is fitness minus fatigue').toBeLessThan(0.3);
    expect(now.fitness).toBeGreaterThan(5);
    expect(now.fatigue).toBeGreaterThan(5);

    // The change over seven days is today against a week ago; fitness also says it as a share of what it was.
    const weekAgo = series.points.at(-8) as Day;
    expect(Math.abs(now.fitness - weekAgo.fitness - now.fitnessChange7d)).toBeLessThan(0.15);
    expect(Math.abs(now.fatigue - weekAgo.fatigue - now.fatigueChange7d)).toBeLessThan(0.15);
    const before = now.fitness - now.fitnessChange7d;
    const fitnessSentence = before > 0
      ? `${signedChange(now.fitnessChange7d)} (${signedChange((now.fitnessChange7d / before) * 100, 0)}%) in the last 7 days`
      : `${signedChange(now.fitnessChange7d)} in the last 7 days`;
    // Each line starts with an arrow, for the eye only: ↑ or ↓ when the number moved by 3% of where it started, → under that.
    const arrowFor = (change: number, scale: number): string => {
      if (Number(Math.abs(change).toFixed(1)) === 0) return '→';
      if (scale > 0 && Math.abs(change) < 0.03 * scale) return '→';
      return change > 0 ? '↑' : '↓';
    };
    const line = (arrow: string, sentence: string): RegExp => new RegExp(`^${arrow} ${literal(sentence)}$`);
    const articles = todayCards(page).locator('article');
    await expect(articles.nth(0).locator('em').nth(0)).toHaveText(line(arrowFor(now.fitnessChange7d, before), fitnessSentence));
    await expect(articles.nth(1).locator('em').nth(0)).toHaveText(line(arrowFor(now.fatigueChange7d, now.fatigue - now.fatigueChange7d), `${signedChange(now.fatigueChange7d)} in the last 7 days`));

    // The change over 14 days is the difference of the two numbers on the chart, worked out here from the points.
    const last = series.points.at(-1) as Day;
    const fortnight = series.points.at(-15) as Day;
    const fitnessChange14 = last.fitness - fortnight.fitness;
    await expect(articles.nth(0).locator('em').nth(1)).toHaveText(line(
      arrowFor(fitnessChange14, fortnight.fitness),
      `${signedChange(fitnessChange14)} (${signedChange((fitnessChange14 / fortnight.fitness) * 100, 0)}%) in the last 14 days`,
    ));
    const fatigueChange14 = last.fatigue - fortnight.fatigue;
    await expect(articles.nth(1).locator('em').nth(1)).toHaveText(line(arrowFor(fatigueChange14, fortnight.fatigue), `${signedChange(fatigueChange14)} in the last 14 days`));

    // Form says a word, and the word agrees with the number; under it, where it moved, with no share (it crosses zero).
    await expect(articles.nth(2).locator('em').nth(0)).toHaveText(formWord(now.form, now.fitness));
    const formBefore7 = now.form - now.formChange7d;
    await expect(articles.nth(2).locator('em').nth(1)).toHaveText(line(arrowFor(now.formChange7d, Math.max(Math.abs(now.form), Math.abs(formBefore7))), `${signedChange(now.formChange7d)} in the last 7 days`));
    const formChange14 = last.form - fortnight.form;
    await expect(articles.nth(2).locator('em').nth(2)).toHaveText(line(arrowFor(formChange14, Math.max(Math.abs(last.form), Math.abs(fortnight.form))), `${signedChange(formChange14)} in the last 14 days`));
  });

  test('F02-H8b the lines can be switched off, but never all three, and each switch says whether its line is drawn', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openLoadBalance(page);
    const switches = lineSwitches(page);
    const [fitness, fatigue, form] = ['Fitness', 'Fatigue', 'Form'].map((name) => switches.getByRole('button', { name: new RegExp(`^${name}`) }));
    for (const line of [fitness, fatigue, form]) await expect(line).toHaveAttribute('aria-pressed', 'true');

    await fatigue.click();
    await expect(fatigue).toHaveAttribute('aria-pressed', 'false');
    await expect(fitness).toHaveAttribute('aria-pressed', 'true');
    await fatigue.click();
    await expect(fatigue).toHaveAttribute('aria-pressed', 'true');

    // The last line that is on stays on: a chart with nothing on it would look like a failure.
    await fitness.click();
    await fatigue.click();
    await expect(fitness).toHaveAttribute('aria-pressed', 'false');
    await expect(fatigue).toHaveAttribute('aria-pressed', 'false');
    await form.click();
    await expect(form).toHaveAttribute('aria-pressed', 'true');
    // The chart is still there, and still readable.
    await expect(fitnessChart(page)).toBeVisible();
  });

  test('F02-H8c the time range asks for the days it names, and the chart follows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openLoadBalance(page);
    // Six months is chosen to begin with.
    await expect(ranges(page).getByRole('button', { name: '6 mo' })).toHaveAttribute('aria-pressed', 'true');
    const chartDays = async (): Promise<number> => Number(/for (\d+) days/.exec((await fitnessChart(page).getAttribute('aria-label')) ?? '')?.[1]);
    const daysIn = async (label: string, days: number, drawn: number = days) => {
      const asked = page.waitForRequest((request) => request.url().includes('/api/training/series') && request.url().includes('from='));
      await ranges(page).getByRole('button', { name: label }).click();
      const from = new URL((await asked).url()).searchParams.get('from') as string;
      const span = (Date.parse(`${utcDay(0)}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000 + 1;
      // Counted in the browser's own calendar, which can be a day either side of the runner's.
      expect(Math.abs(span - days), `${label} asks for ${span} days, from ${from}`).toBeLessThanOrEqual(1);
      await expect(ranges(page).getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(async () => Math.abs((await chartDays()) - drawn), { message: `days drawn for ${label}` }).toBeLessThanOrEqual(1);
    };
    await daysIn('6 wk', 42);
    await daysIn('3 mo', 91);
    // The runner has run for fourteen weeks, so a year shows no more days than that.
    await daysIn('1 yr', 365, FIRST_RUN_DAYS_AGO + 1);
    await daysIn('6 mo', 182, FIRST_RUN_DAYS_AGO + 1);
  });

  test('F02-H8d the chart is a slider the keyboard can move day by day, into the days after today, and it says what it shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    const series = await seriesOf();
    await openLoadBalance(page);
    const chart = fitnessChart(page);
    const lastReal = series.points.length - 1;
    const at = (day: string, fitness: number, fatigue: number, form: number) =>
      new RegExp(`^${literal(`${shortDay(day)}, Fitness ${oneDecimal(fitness)}, Fatigue ${oneDecimal(fatigue)}, Form ${signedChange(form)}`)}`);

    // Nothing is picked until the chart has the keyboard; then it starts on today.
    await expect(fitnessCard(page).getByText('Today', { exact: true }).first()).toBeVisible();
    await chart.focus();
    await expect(chart).toHaveAttribute('aria-valuenow', String(lastReal));
    const today = series.points[lastReal];
    await expect(chart).toHaveAttribute('aria-valuetext', at(today.date, today.fitness, today.fatigue, today.form));

    await page.keyboard.press('ArrowLeft');
    const yesterday = series.points[lastReal - 1];
    await expect(chart).toHaveAttribute('aria-valuenow', String(lastReal - 1));
    await expect(chart).toHaveAttribute('aria-valuetext', at(yesterday.date, yesterday.fitness, yesterday.fatigue, yesterday.form));

    // Past today the days are what would happen if the runner rested; the chart reaches 14 of them.
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowRight');
    const tomorrow = series.projection[0];
    await expect(chart).toHaveAttribute('aria-valuenow', String(lastReal + 1));
    await expect(chart).toHaveAttribute('aria-valuetext', at(tomorrow.date, tomorrow.fitness, tomorrow.fatigue, tomorrow.form));
    for (let step = 0; step < 20; step += 1) await page.keyboard.press('ArrowRight');
    await expect(chart).toHaveAttribute('aria-valuenow', String(lastReal + series.projection.length));
    await expect(fitnessCard(page)).toContainText(`Dotted: where they would go if you did not run for the next ${series.projection.length} days.`);

    // Home is the first day, Escape lets go.
    await page.keyboard.press('Home');
    await expect(chart).toHaveAttribute('aria-valuenow', '0');
    await expect(chart).toHaveAttribute('aria-valuetext', at(series.points[0].date, series.points[0].fitness, series.points[0].fatigue, series.points[0].form));
    await page.keyboard.press('Escape');
    await expect(fitnessCard(page).getByText('Today', { exact: true }).first()).toBeVisible();
  });

  test('F02-H8e resting makes fatigue fall faster than fitness, so form rises', async ({ browser, baseURL, guard }) => {
    await pages.open(browser, baseURL, guard, runner, ROUTE);
    const series = await seriesOf();
    expect(series.projection).toHaveLength(14);
    expect(series.projection[0].date).toBe(utcDay(-1));
    const { fitness, fatigue, form } = series.current;
    const end = series.projection.at(-1) as Series['projection'][number];
    expect(end.fitness).toBeLessThan(fitness);
    expect(end.fatigue).toBeLessThan(fatigue);
    expect(end.fatigue / fatigue, 'a fast average falls faster than a slow one').toBeLessThan(end.fitness / fitness);
    expect(end.form).toBeGreaterThan(form);
    // Fourteen days of no running: each average decays by e^(-days/time constant).
    expect(Math.abs(end.fitness - fitness * Math.exp(-14 / series.fitnessDays))).toBeLessThan(0.25);
    expect(Math.abs(end.fatigue - fatigue * Math.exp(-14 / series.fatigueDays))).toBeLessThan(0.25);
  });

  test('F02-H8f a race is flagged on its day, and the day stops being flagged when the run is no longer a race', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    const series = await seriesOf();
    expect(series.raceDays).toEqual([utcDay(RACE_DAYS_AGO)]);
    await openLoadBalance(page);
    await expect(fitnessCard(page)).toContainText('A flag marks a day you raced.');

    // The keyboard finds the day, and the chart says it is a race day.
    const chart = fitnessChart(page);
    await chart.focus();
    for (let step = 0; step < RACE_DAYS_AGO; step += 1) await page.keyboard.press('ArrowLeft');
    await expect(chart).toHaveAttribute('aria-valuetext', new RegExp(`^${shortDay(utcDay(RACE_DAYS_AGO))}, .*, Race day$`));
    await page.keyboard.press('ArrowLeft');
    await expect(chart).not.toHaveAttribute('aria-valuetext', /Race day/);

    // Clear the type of the race and the flag goes, and the card says how to put one back.
    const run = runOn(runner, RACE_DAYS_AGO);
    try {
      expect((await runner.api.patch(`/api/activities/${run.id}`, { runType: null })).status).toBe(200);
      await page.reload();
      await openLoadBalance(page);
      await expect(fitnessCard(page)).toContainText("Set a run's type to Race on its page and its day is flagged here.");
      await expect(fitnessCard(page)).not.toContainText('A flag marks a day you raced.');
      expect((await seriesOf()).raceDays).toEqual([]);
    } finally {
      expect((await runner.api.patch(`/api/activities/${run.id}`, { runType: 'RACE' })).status).toBe(200);
    }
  });

  test('F02-H8g the card says which runs the numbers come from', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    const series = await seriesOf();
    await openLoadBalance(page);
    expect(series.sources.HR_ZONES, 'every run of the history has a heart-rate stream').toBe(series.runs);
    await expect(fitnessCard(page)).toContainText(`Worked out from ${series.runs} runs: ${series.runs} from heart-rate zones.`);
    // The two scales are kept apart, and the card says so rather than letting them be compared.
    await expect(fitnessCard(page)).toContainText('This is not the load on the chart above');
  });

  test('F02-E16 a runner with no run has nothing to show, and the card says what would make something appear', async ({ browser, baseURL, guard }) => {
    const { api, email } = await newRunner('fitness-none');
    const page = await pages.open(browser, baseURL, guard, { token: api.token as string, email }, ROUTE);
    await expect(fitnessCard(page)).toContainText('No run has an Effort score yet. Import runs, or rate the ones recorded without heart rate, and your fitness and form will appear here.');
    await expect(fitnessCard(page).getByRole('slider')).toHaveCount(0);
    await expect(weeklyCard(page)).toContainText('No weeks to show yet. They start with your first run that has an Effort score.');
    await expectNoRawKeys(page);
    expect(await page.locator('main').innerText()).not.toMatch(/NaN|Infinity|undefined|\bnull\b/);
  });

  test('F02-E17 under two weeks of history the card says how long it is, not numbers that mean nothing', async ({ browser, baseURL, guard }) => {
    const { api, email } = await newRunner('fitness-new');
    await importHistoryRun(api, 3, 'easy', 6, 340, 138);
    await waitForEffort(api, 1);
    const series = (await api.get(`/api/training/series?from=${utcDay(200)}`)).json as Series;
    expect(series.status).toBe('building');
    const page = await pages.open(browser, baseURL, guard, { token: api.token as string, email }, ROUTE);
    await expect(fitnessCard(page)).toContainText(`Fitness and form need at least ${series.minHistoryDays} days of history to mean anything. Yours is ${series.historyDays} so far.`);
    await expect(fitnessCard(page).getByRole('slider')).toHaveCount(0);
    await expect(todayCards(page)).toHaveCount(0);
    // The weekly card needs only one run to start counting, and says there is no range to compare with yet.
    const weekly = (await api.get('/api/training/weekly-effort')).json as { weeks: Week[] };
    const thisWeek = weekly.weeks.at(-1) as Week;
    expect(thisWeek.range).toBeNull();
    await expect(weeklyCard(page)).toContainText(thisWeekSentence(thisWeek));
  });

  test('F02-E18 when the numbers cannot be loaded the card says so, Try again brings them back, and the rest of the page stays', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    let failures = 1;
    await page.route('**/api/training/series**', (route) => (failures-- > 0 ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }) : route.continue()));
    await page.goto(ROUTE);
    await expect(fitnessCard(page).getByRole('alert')).toHaveText('Your fitness and form could not be loaded.');
    await expect(page.getByRole('heading', { level: 2, name: 'Acute vs. chronic load' }).first()).toBeVisible();
    await expect(weeklyCard(page).getByRole('table')).toBeAttached();
    await fitnessCard(page).getByRole('button', { name: 'Try again' }).click();
    await expect(todayCards(page)).toBeVisible();
    await expect(fitnessCard(page).getByRole('alert')).toHaveCount(0);
  });

  test('F02-E19 when the weekly effort cannot be loaded that card says so and recovers, and fitness is unaffected', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    let failures = 1;
    await page.route('**/api/training/weekly-effort**', (route) => (failures-- > 0 ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }) : route.continue()));
    await page.goto(ROUTE);
    await expect(weeklyCard(page).getByRole('alert')).toHaveText('Your weekly effort could not be loaded.');
    await expect(todayCards(page)).toBeVisible();
    await weeklyCard(page).getByRole('button', { name: 'Try again' }).click();
    await expect(weeklyCard(page).getByRole('table')).toBeAttached();
  });

  test('F02-E20 slow network: both cards say they are loading, and the page is usable meanwhile', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    for (const route of ['**/api/training/series**', '**/api/training/weekly-effort**']) {
      await page.route(route, async (request) => {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        await request.continue();
      });
    }
    await page.goto(ROUTE);
    await expect(fitnessCard(page)).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('heading', { level: 2, name: 'Acute vs. chronic load' }).first()).toBeVisible();
    await expect(todayCards(page)).toBeVisible({ timeout: 15_000 });
    await expect(fitnessCard(page)).not.toHaveAttribute('aria-busy', 'true');
  });

  test('F02-E21 the fitness and weekly cards have no serious accessibility violation', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openLoadBalance(page);
    expect(await a11yViolations(page, { ignoreRules: ['color-contrast'] })).toEqual([]);
  });

  test('F02-E22 text on the fitness and weekly cards is readable (contrast of 4.5 to 1), in both themes', async ({ browser, baseURL, guard }) => {
    for (const theme of ['light', 'midnight']) {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await openLoadBalance(page);
      // Only the two new cards: the older parts of the page are known to fall short (BUG-005) and are not held to it here.
      expect(await contrastProblems(page, { include: ['#load-fitness', '#load-weekly-effort'] }), theme).toEqual([]);
      expect(await a11yViolations(page, { onlyRules: ['color-contrast'], include: ['#load-fitness', '#load-weekly-effort'] }), `${theme}, by axe`).toEqual([]);
    }
  });

  test('F02-E23 in Chinese both cards are translated and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(ROUTE);
    await expect(page.getByRole('region', { name: '体能、疲劳与状态', exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('region', { name: '今天的体能、疲劳与状态' })).toBeVisible();
    await expect(page.getByRole('region', { name: '每周强度', exact: true })).toBeVisible();
    await expectNoRawKeys(page);
    expect(await page.locator('#load-fitness, #load-weekly-effort').allInnerTexts()).not.toContain('Fitness, fatigue and form');
  });

  test('F02-E24 @mobile Load balance with the new cards fits a phone', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(ROUTE);
    await openLoadBalance(page);
    await expectNoHorizontalOverflow(page);
    // The three numbers are still read, each inside the width of the phone.
    for (const index of [0, 1, 2]) {
      const article = todayCards(page).locator('article').nth(index);
      await article.scrollIntoViewIfNeeded();
      const frame = await article.boundingBox();
      expect(frame && frame.x >= 0 && frame.x + frame.width <= 375, `number ${index} at ${JSON.stringify(frame)}`).toBe(true);
    }
  });

  test('F02-N1 the numbers are the runner\'s own: signed out is refused, a bad range is refused, another runner has none of this history', async ({ api, seed }) => {
    for (const route of ['/api/training/series', '/api/training/weekly-effort']) {
      const signedOut = await api.get(route, { token: null });
      expect(signedOut.status, route).toBe(401);
    }
    const bad = await runner.api.get('/api/training/series?from=2026-13-45');
    expect(bad.status).toBe(400);
    expect(bad.json.code).toBe('INVALID_RANGE');
    const backwards = await runner.api.get(`/api/training/series?from=${utcDay(0)}&to=${utcDay(10)}`);
    expect(backwards.status).toBe(400);
    const tooLong = await runner.api.get(`/api/training/series?from=${utcDay(500)}`);
    expect(tooLong.status).toBe(400);
    expect((await runner.api.get('/api/training/weekly-effort?weeks=0')).status).toBe(400);
    expect((await runner.api.get('/api/training/weekly-effort?weeks=53')).status).toBe(400);
    expect((await runner.api.get('/api/training/weekly-effort?weeks=abc')).status).toBe(400);

    const mine = await seriesOf();
    expect(mine.runs).toBe(runner.runs.length);
    const other = await newRunner('fitness-other');
    const theirs = (await other.api.get('/api/training/series')).json as Series;
    expect(theirs.status).toBe('none');
    expect(theirs.runs).toBe(0);
    expect(theirs.points).toEqual([]);
    expect(theirs.raceDays).toEqual([]);
    const theirWeeks = (await other.api.get('/api/training/weekly-effort')).json as { weeks: Week[] };
    expect(theirWeeks.weeks).toEqual([]);
    expect(seed.baseUrl).toBeTruthy();
  });
});

test.describe('F02 weekly effort against the usual range (M4)', () => {
  test('F02-H9 each week is set against the mean of the three weeks before it, plus or minus a fifth, and called by where it falls', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    const weekly = (await runner.api.get('/api/training/weekly-effort?weeks=12')).json as { today: string; bandPercent: number; weeks: Week[] };
    await openLoadBalance(page);
    expect(weekly.bandPercent).toBe(20);
    expect(weekly.weeks).toHaveLength(12);
    const { weeks } = weekly;

    // Weeks run Monday to Sunday, one after another, ending with the one going on.
    weeks.forEach((week, index) => {
      expect(week.start, `week ${index} starts on a Monday`).toBe(weekStartOf(week.start));
      expect(week.end).toBe(addDays(week.start, 6));
      if (index > 0) expect(week.start).toBe(addDays(weeks[index - 1].start, 7));
    });
    const last = weeks.at(-1) as Week;
    expect(last.start).toBe(weekStartOf(utcDay(0)));
    expect(last.complete, 'the week going on is not complete').toBe(false);
    expect(weeks.slice(0, -1).every((week) => week.complete)).toBe(true);

    // Runs per week are the runs the history was built with, put into weeks by their day.
    for (const week of weeks) {
      const expected = runner.runs.filter((run) => weekStartOf(utcDay(run.daysAgo)) === week.start).length;
      expect(week.runs, `runs in the week of ${week.start}`).toBe(expected);
    }

    // The usual range is worked out again from the weeks before: their mean, and a fifth either side of it.
    weeks.forEach((week, index) => {
      if (!week.range) return;
      expect(week.range.low).toBeCloseTo(week.range.average * 0.8, 0);
      expect(week.range.high).toBeCloseTo(week.range.average * 1.2, 0);
      if (index >= 3) {
        const mean = (weeks[index - 1].total + weeks[index - 2].total + weeks[index - 3].total) / 3;
        expect(Math.abs(week.range.average - mean), `usual effort of the week of ${week.start}`).toBeLessThan(0.2);
      }
      // The call itself.
      const expected = week.total > week.range.high ? 'above' : week.total >= week.range.low ? 'within' : week.complete ? 'below' : 'building';
      expect(week.status, `week of ${week.start}: ${week.total} against ${week.range.low} to ${week.range.high}`).toBe(expected);
    });
    expect(weeks.filter((week) => week.range).length, 'most weeks have a range to be compared with').toBeGreaterThan(8);

    // A week's effort is the sum of its days' efforts, which the fitness series carries.
    const series = await seriesOf();
    for (const week of weeks.slice(1)) {
      const days = series.points.filter((day) => day.date >= week.start && day.date <= week.end);
      const sum = days.reduce((total, day) => total + day.load, 0);
      expect(Math.abs(sum - week.total), `effort of the week of ${week.start}`).toBeLessThan(0.7);
    }

    // The page says what the API says: the list read by a screen reader has one row per week...
    const table = weeklyCard(page).getByRole('table');
    await expect(table.getByRole('row')).toHaveCount(13);
    for (const heading of ['Week', 'Effort', 'Runs', 'Usual range', 'Compared with it']) await expect(table.getByRole('columnheader', { name: heading })).toBeAttached();
    for (const [index, week] of weeks.entries()) {
      const row = table.getByRole('row').nth(index + 1);
      await expect(row.getByRole('rowheader')).toHaveText(shortDay(week.start));
      await expect(row.getByRole('cell')).toHaveText([
        grouped(week.total),
        String(week.runs),
        week.range ? `${grouped(week.range.low)} to ${grouped(week.range.high)}` : '–',
        STATUS_WORDS[week.status],
      ]);
    }
    // ...and the card names the week going on, and says why.
    await expect(weeklyCard(page)).toContainText(STATUS_WORDS[last.status]);
    await expect(weeklyCard(page)).toContainText(thisWeekSentence(last));
    await expect(weeklyCard(page)).toContainText('A week still going is never called below');
  });

  test('F02-H9b the weekly chart is a slider that reads one week at a time', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    const weekly = (await runner.api.get('/api/training/weekly-effort?weeks=12')).json as { weeks: Week[] };
    await openLoadBalance(page);
    const chart = weeklyCard(page).getByRole('slider', { name: /^Effort for each of the last 12 weeks, with each week's usual range behind its bar\./ });
    await expect(chart).toBeVisible();
    await chart.focus();
    const weeks = weekly.weeks;
    await expect(chart).toHaveAttribute('aria-valuenow', '11');
    const reads = (week: Week) => new RegExp(`^Week of ${shortDay(week.start)}, ${grouped(week.total)}, ${STATUS_WORDS[week.status]}$`);
    await expect(chart).toHaveAttribute('aria-valuetext', reads(weeks[11]));
    await page.keyboard.press('ArrowLeft');
    await expect(chart).toHaveAttribute('aria-valuetext', reads(weeks[10]));
    await page.keyboard.press('Home');
    await expect(chart).toHaveAttribute('aria-valuetext', reads(weeks[0]));
    await page.keyboard.press('ArrowLeft');
    await expect(chart).toHaveAttribute('aria-valuenow', '0');
    await page.keyboard.press('End');
    await expect(chart).toHaveAttribute('aria-valuenow', '11');
  });

  test('F02-H9c a week that was a lot heavier than the three before it is called above the range, and a missed week below', async ({ browser, baseURL, guard }) => {
    // Three steady weeks, one very heavy one, then three with no run at all: the calls are the model's, and the page shows them.
    const made = await newRunner('weekly-calls');
    const mondayThisWeek = weekStartOf(utcDay(0));
    const sinceMonday = Math.round((Date.parse(`${utcDay(0)}T12:00:00Z`) - Date.parse(`${mondayThisWeek}T12:00:00Z`)) / 86_400_000);
    // The day of weekday k (Monday is 0) in the week `weeksBack` weeks before this one was `7 * weeksBack + sinceMonday - k` days ago.
    const daysBackOf = (weeksBack: number, weekday: number): number => 7 * weeksBack + sinceMonday - weekday;
    let imported = 0;
    for (const weeksBack of [7, 6, 5]) {
      for (const weekday of [1, 3, 5]) {
        await importHistoryRun(made.api, daysBackOf(weeksBack, weekday), 'easy', 6, 340, 138);
        imported += 1;
      }
    }
    for (let weekday = 0; weekday < 7; weekday += 1) {
      await importHistoryRun(made.api, daysBackOf(4, weekday), 'hard', 14, 300, 168);
      imported += 1;
    }
    await waitForEffort(made.api, imported);
    const weekly = (await made.api.get('/api/training/weekly-effort?weeks=12')).json as { weeks: Week[] };
    const byStart = new Map(weekly.weeks.map((week) => [week.start, week]));
    const weekBack = (count: number) => byStart.get(addDays(mondayThisWeek, -7 * count)) as Week;
    expect(weekBack(5).status, 'the third week has no three weeks before it yet').toBe('none');
    expect(weekBack(4).status, `the heavy week: ${weekBack(4).total} against ${JSON.stringify(weekBack(4).range)}`).toBe('above');
    for (const missed of [3, 2, 1]) {
      expect(weekBack(missed).complete).toBe(true);
      expect(weekBack(missed).total, 'a week with no run is a real week of zero').toBe(0);
      expect(weekBack(missed).status, `week ${missed} back`).toBe('below');
    }

    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await openLoadBalance(page);
    const table = weeklyCard(page).getByRole('table');
    const rowOf = (week: Week) => table.getByRole('row').nth(weekly.weeks.findIndex((candidate) => candidate.start === week.start) + 1);
    await expect(rowOf(weekBack(4)).getByRole('cell').last()).toHaveText(STATUS_WORDS.above);
    await expect(rowOf(weekBack(3)).getByRole('cell').last()).toHaveText(STATUS_WORDS.below);
    await expect(rowOf(weekBack(5)).getByRole('cell').last()).toHaveText(STATUS_WORDS.none);
  });

  test('F02-E25 @mobile the weekly card fits a phone', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(ROUTE);
    await openLoadBalance(page);
    await weeklyCard(page).scrollIntoViewIfNeeded();
    await expectNoHorizontalOverflow(page);
  });
});
