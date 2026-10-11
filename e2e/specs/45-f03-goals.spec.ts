// F03 Set a goal and track it (M6). Recon path: Progress -> Add Goal (timeframe, metric, value) -> progress on Progress and on the run.
// In HermesRuns: a card called Goals on the Training log and on the Profile page, and a read-only one on each run's page. A goal is a
// week, a month or a year, of distance, time, number of runs or climb; its progress is added up from the runner's runs each time.
//
// A throwaway runner with six weeks of running and a run today (fixtures/history.ts), so that the week, the month and the year going on
// each have a run in them whatever day the suite is run. Every number on a goal is checked against the API's answer, and the API's
// answer against the runs the history was built with, put into weeks, months and years here by their day.
import type { Locator, Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { addDays, utcDay, weekStartOf } from '../fixtures/format.ts';
import { importHistoryRun, runOn, sharedHistoryRunner, waitForEffort, type HistoryRun, type RunnerWithHistory } from '../fixtures/history.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { a11yViolations, contrastProblems, expect, expectNoHorizontalOverflow, expectNoRawKeys, test } from '../fixtures/test.ts';

const WEEKS = 6;
const ROUTE = '/training-log';

type Period = 'WEEK' | 'MONTH' | 'YEAR';
type Metric = 'DISTANCE' | 'TIME' | 'COUNT' | 'ELEVATION';

interface Goal {
  id: number;
  period: Period;
  metric: Metric;
  unit: string;
  target: number;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  daysTotal: number;
  daysLeft: number;
  progress: number;
  remaining: number;
  percent: number;
  reached: boolean;
  neededPerDay: number | null;
  expectedByNow: number;
  doneByNow: number;
  status: 'reached' | 'early' | 'ahead' | 'on_track' | 'behind';
  previous: { start: string; end: string; progress: number; reached: boolean };
  thisRun: number | null;
}

interface GoalsAnswer {
  today: string;
  timeZone: string;
  goals: Goal[];
  periods: Period[];
  metrics: Metric[];
  maxTarget: Record<Metric, number>;
}

let runner: RunnerWithHistory;
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

async function clearGoals(api: Api): Promise<void> {
  const answer = (await api.get('/api/goals')).json as GoalsAnswer;
  for (const goal of answer.goals) expect((await api.delete(`/api/goals/${goal.id}`)).status).toBe(200);
}

test.beforeAll(async () => {
  test.setTimeout(300_000);
  runner = await sharedHistoryRunner('goals', WEEKS, { todayRun: true });
  await clearGoals(runner.api);
});
// Every test starts without goals, and leaves none.
test.beforeEach(async () => clearGoals(runner.api));
test.afterAll(async () => clearGoals(runner.api));

const goalsOf = async (who: { api: Api } = runner): Promise<GoalsAnswer> => (await who.api.get('/api/goals')).json;

async function setGoal(api: Api, period: Period, metric: Metric, target: number): Promise<Goal> {
  const res = await api.post('/api/goals', { period, metric, target });
  expect(res.status, JSON.stringify(res.json)).toBe(201);
  return (res.json as GoalsAnswer).goals.find((goal) => goal.period === period && goal.metric === metric) as Goal;
}

// ---- What the page should say, worked out here from numbers, in the app's own words ----------------------------------------------------

const PERIOD_WORD: Record<Period, string> = { WEEK: 'Weekly', MONTH: 'Monthly', YEAR: 'Yearly' };
const METRIC_WORD: Record<Metric, string> = { DISTANCE: 'distance', TIME: 'time', COUNT: 'runs', ELEVATION: 'climb' };
const METRIC_RADIO: Record<Metric, string> = { DISTANCE: 'Distance', TIME: 'Time', COUNT: 'Runs', ELEVATION: 'Climb' };
const IN: Record<Period, string> = { WEEK: 'this week', MONTH: 'this month', YEAR: 'this year' };
const LAST: Record<Period, string> = { WEEK: 'Last week', MONTH: 'Last month', YEAR: 'Last year' };
const PERIOD_NOUN: Record<Period, string> = { WEEK: 'week', MONTH: 'month', YEAR: 'year' };
const STATUS_WORDS: Record<Goal['status'], string> = { reached: 'Goal reached', early: 'Just started', ahead: 'Ahead of pace', on_track: 'On track', behind: 'Behind pace' };

const titleOf = (goal: { period: Period; metric: Metric }): string => `${PERIOD_WORD[goal.period]} ${METRIC_WORD[goal.metric]}`;
const round1 = (value: number): number => Math.round(value * 10) / 10;
const plain = (value: number, digits = 1): string => value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
const days = (count: number): string => (count === 1 ? '1 day' : `${count} days`);

/** A goal's number with its unit: "42.5 km", "6 h 20 min", "12 runs", "1,250 m". */
function amount(metric: Metric, value: number): string {
  switch (metric) {
    case 'DISTANCE': return `${plain(round1(value))} km`;
    case 'TIME': {
      const total = Math.max(0, Math.round(value / 60));
      return total >= 60 ? `${Math.floor(total / 60)} h ${total % 60} min` : `${total} min`;
    }
    case 'COUNT': return `${plain(round1(value))} ${Math.round(value) === 1 ? 'run' : 'runs'}`;
    default: return `${Math.round(value).toLocaleString('en-US')} m`;
  }
}

/** What the row says under the bar: where an even pace would be, what is left, and how the period before went. */
function workingLines(goal: Goal): string[] {
  const lines: string[] = [];
  if (goal.status === 'early') lines.push(`A new ${PERIOD_NOUN[goal.period]} has begun, so there is no full day to judge by yet.`);
  else if (goal.status !== 'reached') {
    lines.push(`On an even pace you would have ${amount(goal.metric, goal.expectedByNow)} by the start of today. You had ${amount(goal.metric, goal.doneByNow)}.`);
  }
  if (!goal.reached) {
    const remaining = amount(goal.metric, goal.remaining);
    if (goal.daysLeft === 1) lines.push(`${remaining} to go, and today is the last day.`);
    else if (goal.metric === 'COUNT') lines.push(`${remaining} to go in ${days(goal.daysLeft)}.`);
    else lines.push(`${remaining} to go in ${days(goal.daysLeft)}, about ${amount(goal.metric, goal.neededPerDay as number)} a day.`);
  }
  if (goal.previous.progress > 0) {
    lines.push(`${LAST[goal.period]}: ${amount(goal.metric, goal.previous.progress)} of ${amount(goal.metric, goal.target)}, ${goal.previous.reached ? 'goal reached' : 'goal not reached'}.`);
  }
  return lines;
}

// ---- The runs the history was built with, put into periods by their day -----------------------------------------------------------------

function periodStart(period: Period, today = utcDay(0)): string {
  if (period === 'WEEK') return weekStartOf(today);
  return period === 'MONTH' ? `${today.slice(0, 8)}01` : `${today.slice(0, 5)}01-01`;
}

const dayOf = (run: HistoryRun): string => utcDay(run.daysAgo);
const runsSince = (start: string, end = utcDay(0)): HistoryRun[] => runner.runs.filter((run) => dayOf(run) >= start && dayOf(run) <= end);
const kmOf = (runs: HistoryRun[]): number => runs.reduce((sum, run) => sum + run.km, 0);

// ---- Locators ---------------------------------------------------------------------------------------------------------------------------

const goalsCard = (page: Page): Locator => page.getByRole('region', { name: 'Goals', exact: true });
const dialog = (page: Page, name = 'Set a goal'): Locator => page.getByRole('dialog', { name });
const rowOf = (page: Page, title: string): Locator =>
  goalsCard(page).getByRole('list', { name: 'Your goals' }).getByRole('listitem').filter({ has: page.getByRole('heading', { name: title, exact: true }) });

async function openCard(page: Page): Promise<void> {
  await expect(goalsCard(page)).toBeVisible();
  await expect(goalsCard(page).getByRole('button', { name: 'Set a goal' })).toBeVisible();
}

async function addThroughDialog(page: Page, period: Period, metric: Metric, target: string): Promise<void> {
  await goalsCard(page).getByRole('button', { name: 'Set a goal' }).click();
  const box = dialog(page);
  await expect(box).toBeVisible();
  await box.getByRole('radio', { name: PERIOD_WORD[period], exact: true }).check();
  await box.getByRole('radio', { name: METRIC_RADIO[metric], exact: true }).check();
  await box.getByLabel('Target').fill(target);
  await box.getByRole('button', { name: 'Save goal' }).click();
  await expect(box).toHaveCount(0);
}

/** The row shows every figure of the goal as the API holds it. */
async function expectRowShows(page: Page, goal: Goal): Promise<void> {
  const row = rowOf(page, titleOf(goal));
  await expect(row).toBeVisible();
  await expect(row.getByText(STATUS_WORDS[goal.status], { exact: true })).toBeVisible();
  const bar = row.getByRole('progressbar');
  const shown = amount(goal.metric, goal.progress);
  const target = amount(goal.metric, goal.target);
  await expect(bar).toHaveAttribute('aria-label', `${titleOf(goal)}: ${shown} of ${target}`);
  await expect(bar).toHaveAttribute('aria-valuenow', String(Math.min(100, goal.percent)));
  await expect(bar).toHaveAttribute('aria-valuetext', `${shown} / ${target}, ${goal.percent}%`);
  await expect(row).toContainText(`${shown} of ${target} ${IN[goal.period]}`);
  await expect(row.locator('strong')).toHaveText(`${goal.percent}%`);
  for (const line of workingLines(goal)) await expect(row, line).toContainText(line);
}

test.describe('F03 goals (M6)', () => {
  test('F03-H1 a weekly distance goal set from the training log: the row, its bar, its status and its working are the arithmetic of the runs', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    await expect(goalsCard(page)).toContainText('No goals yet');
    await expect(goalsCard(page)).toContainText('Pick a week, a month or a year and something to aim for: distance, time, number of runs or climb.');

    // The dialog starts on the first thing not yet set: a week of distance.
    await goalsCard(page).getByRole('button', { name: 'Set a goal' }).click();
    const box = dialog(page);
    await expect(box.getByRole('radio', { name: 'Weekly', exact: true })).toBeChecked();
    await expect(box.getByRole('radio', { name: 'Distance', exact: true })).toBeChecked();
    await expect(box.getByLabel('Target')).toBeFocused();
    await box.getByLabel('Target').fill('40');
    await box.getByRole('button', { name: 'Save goal' }).click();
    await expect(box).toHaveCount(0);
    await expect(goalsCard(page).getByRole('status').filter({ hasText: 'Goal saved.' })).toBeAttached();

    // What the server holds...
    const answer = await goalsOf();
    expect(answer.goals).toHaveLength(1);
    const goal = answer.goals[0];
    expect([goal.period, goal.metric, goal.target, goal.unit]).toEqual(['WEEK', 'DISTANCE', 40, 'km']);
    // ...is the arithmetic of the runs: a week is Monday to Sunday, progress is the distance run in it, today's run included.
    const start = weekStartOf(answer.today);
    expect([goal.periodStart, goal.periodEnd, goal.daysTotal]).toEqual([start, addDays(start, 6), 7]);
    const daysGone = (Date.parse(`${answer.today}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000;
    expect(goal.daysLeft).toBe(7 - daysGone);
    const before = runsSince(start, addDays(answer.today, -1));
    const inWeek = runsSince(start);
    expect(Math.abs(goal.progress - kmOf(inWeek)), 'distance run this week').toBeLessThan(0.15 * inWeek.length);
    expect(Math.abs(goal.doneByNow - kmOf(before)), 'distance run before today').toBeLessThan(0.15 * Math.max(1, before.length));
    expect(goal.expectedByNow).toBeCloseTo((40 * daysGone) / 7, 1);
    expect(goal.percent).toBe(Math.floor((goal.progress / 40) * 100));
    expect(goal.remaining).toBeCloseTo(Math.max(0, 40 - goal.progress), 1);
    // The call: reached, else early on the first day, else a tenth either side of an even share.
    const call = goal.progress >= 40 ? 'reached' : daysGone === 0 ? 'early' : goal.doneByNow >= goal.expectedByNow * 1.1 ? 'ahead' : goal.doneByNow >= goal.expectedByNow * 0.9 ? 'on_track' : 'behind';
    expect(goal.status).toBe(call);
    if (!goal.reached) expect(goal.neededPerDay).toBeCloseTo(goal.remaining / goal.daysLeft, 1);
    // Last week: the distance run in the week before, against today's target.
    const previousRuns = runsSince(addDays(start, -7), addDays(start, -1));
    expect(goal.previous).toMatchObject({ start: addDays(start, -7), end: addDays(start, -1), reached: kmOf(previousRuns) >= 40 });
    expect(Math.abs(goal.previous.progress - kmOf(previousRuns))).toBeLessThan(0.15 * Math.max(1, previousRuns.length));

    // ...and the page says it, in numbers and words, with a bar a screen reader can read.
    await expectRowShows(page, goal);
    await expect(goalsCard(page)).not.toContainText('No goals yet');
    await expect(goalsCard(page)).toContainText('A week runs Monday to Sunday in your time zone.');
  });

  test('F03-H1b the same goals are on the Profile page', async ({ browser, baseURL, guard }) => {
    const goal = await setGoal(runner.api, 'WEEK', 'DISTANCE', 35);
    const page = await pages.open(browser, baseURL, guard, runner, '/profile');
    await expect(goalsCard(page)).toBeVisible({ timeout: 20_000 });
    await expectRowShows(page, goal);
    // A change made there is what the training log shows.
    await goalsCard(page).getByRole('button', { name: 'Change the target of Weekly distance' }).click();
    await dialog(page, 'Change the target of Weekly distance').getByLabel('Target').fill('45');
    await dialog(page, 'Change the target of Weekly distance').getByRole('button', { name: 'Save goal' }).click();
    await expect(rowOf(page, 'Weekly distance')).toContainText('of 45 km this week');
    await page.goto(ROUTE);
    await expect(rowOf(page, 'Weekly distance')).toContainText('of 45 km this week');
  });

  test('F03-H2 each kind of goal can be set: a month of time, a year of runs, a year of climb; a goal that is met says so', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    await addThroughDialog(page, 'MONTH', 'TIME', '12');
    await addThroughDialog(page, 'YEAR', 'COUNT', '300');
    await addThroughDialog(page, 'YEAR', 'ELEVATION', '20000');
    // A weekly goal of one run is met by the run of today.
    await addThroughDialog(page, 'WEEK', 'COUNT', '1');

    const answer = await goalsOf();
    expect(answer.goals.map((goal) => `${goal.period}/${goal.metric}/${goal.target}`).sort()).toEqual(['MONTH/TIME/43200', 'WEEK/COUNT/1', 'YEAR/COUNT/300', 'YEAR/ELEVATION/20000']);
    // The list reads the same each time: by period, then by what it is about.
    await expect(goalsCard(page).getByRole('list', { name: 'Your goals' }).getByRole('heading', { level: 3 })).toHaveText(['Weekly runs', 'Monthly time', 'Yearly runs', 'Yearly climb']);
    for (const goal of answer.goals) await expectRowShows(page, goal);

    // Counting runs: the runs of the week, the year.
    const week = answer.goals.find((goal) => goal.period === 'WEEK') as Goal;
    expect(week.progress).toBe(runsSince(periodStart('WEEK')).length);
    const year = answer.goals.find((goal) => goal.period === 'YEAR' && goal.metric === 'COUNT') as Goal;
    expect(year.progress).toBe(runsSince(periodStart('YEAR')).length);
    // Time: the moving time of the runs of the month, in seconds, which the page writes as hours and minutes.
    const month = answer.goals.find((goal) => goal.metric === 'TIME') as Goal;
    expect(month.progress).toBeGreaterThan(0);
    // A goal that is met: the status says so, the bar is full, there is nothing left to go, and the percent is over 100.
    expect(week.reached).toBe(true);
    expect(week.percent).toBeGreaterThanOrEqual(100);
    expect(week.remaining).toBe(0);
    expect(week.neededPerDay).toBeNull();
    const row = rowOf(page, 'Weekly runs');
    await expect(row.getByText('Goal reached', { exact: true })).toBeVisible();
    await expect(row.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    await expect(row).not.toContainText('to go');
    // Climb: a run from a file carries no climb figure (BUG-036), so the year of climb stands at nothing.
    const climb = answer.goals.find((goal) => goal.metric === 'ELEVATION') as Goal;
    expect(climb.progress).toBe(0);
    await expect(rowOf(page, 'Yearly climb')).toContainText('0 m of 20,000 m this year');
  });

  test('F03-H3 a goal counts the runs from before it was set, follows a run that is added or deleted, and keeps nothing but its target', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('goals-follow');
    const { api } = made;
    // A run yesterday and one today, both before the goal exists.
    const yesterday = await importHistoryRun(api, 1, 'easy', 6, 340, 138, 'E2E follow yesterday');
    const today = await importHistoryRun(api, 0, 'easy', 5, 360, 140, 'E2E follow today', 0);
    await waitForEffort(api, 2);
    const yesterdayCounts = utcDay(1) >= periodStart('YEAR');
    const goal = await setGoal(api, 'YEAR', 'DISTANCE', 2000);
    expect(goal.progress, 'every run of the year so far, though the goal came after them').toBeCloseTo((yesterdayCounts ? yesterday.km : 0) + today.km, 0);
    expect(goal.progress).toBeGreaterThan(today.km - 0.2);

    const page = await pages.open(browser, baseURL, guard, { token: api.token as string, email: made.email }, ROUTE);
    await expectRowShows(page, goal);

    // Delete today's run and the goal loses it: progress is added up from the runs each time, never kept.
    expect((await api.delete(`/api/activities/${today.id}`)).status).toBeLessThan(300);
    const lessGoal = (await goalsOf({ api })).goals[0];
    expect(lessGoal.progress).toBeCloseTo(yesterdayCounts ? yesterday.km : 0, 0);
    await page.reload();
    await expectRowShows(page, lessGoal);

    // A run added later is in it as soon as it is in the list.
    const later = await importHistoryRun(api, 0, 'easy', 3, 360, 140, 'E2E follow later', 0);
    const moreGoal = (await goalsOf({ api })).goals[0];
    expect(moreGoal.progress).toBeCloseTo(lessGoal.progress + later.km, 0);
    expect(moreGoal.id, 'the same goal throughout').toBe(goal.id);
    expect(moreGoal.target).toBe(2000);
  });

  test('F03-H4 the page of a run says what that run adds to each goal whose period it is in, and nothing for the others', async ({ browser, baseURL, guard }) => {
    const weekly = await setGoal(runner.api, 'WEEK', 'DISTANCE', 40);
    const yearly = await setGoal(runner.api, 'YEAR', 'COUNT', 200);
    const today = runner.runs.find((run) => run.daysAgo === 0) as HistoryRun;
    const old = runOn(runner, 21);
    const answerToday = (await runner.api.get(`/api/goals?runId=${today.id}`)).json as GoalsAnswer;
    expect(answerToday.goals.find((goal) => goal.id === weekly.id)?.thisRun).toBeCloseTo(today.km, 0);
    expect(answerToday.goals.find((goal) => goal.id === yearly.id)?.thisRun).toBe(1);

    const page = await pages.open(browser, baseURL, guard, runner, `/runs/${today.id}`);
    const card = page.getByRole('region', { name: 'Goals', exact: true });
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Weekly distance' }) })).toContainText(`This run adds ${amount('DISTANCE', answerToday.goals.find((goal) => goal.id === weekly.id)?.thisRun as number)}.`);
    await expect(card.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Yearly runs' }) })).toContainText('This run adds 1 run.');
    // The run page shows the bars, not the working: that is on the training log.
    await expect(card).not.toContainText('On an even pace');
    await expect(card.getByRole('link', { name: 'Manage your goals' })).toHaveAttribute('href', '/training-log');

    // A run from three weeks ago is not in the week being judged, so the weekly goal adds nothing from it; the year may.
    await page.goto(`/runs/${old.id}`);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Weekly distance' }) })).not.toContainText('This run adds');
    if (dayOf(old) >= periodStart('YEAR')) {
      await expect(card.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Yearly runs' }) })).toContainText('This run adds 1 run.');
    }

    // Without goals the card asks for one, with a link to where one is set.
    await clearGoals(runner.api);
    await page.reload();
    await expect(card.getByRole('link', { name: 'Set a goal' })).toHaveAttribute('href', '/training-log');
    await expect(card).toContainText('Pick a week, a month or a year');
  });

  test('F03-H5 a time goal is typed in hours; a comma is a decimal point; thousands are read as thousands; miles are converted both ways', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    await addThroughDialog(page, 'WEEK', 'TIME', '5,5');
    expect((await goalsOf()).goals[0]).toMatchObject({ metric: 'TIME', target: 19_800 });
    await expect(rowOf(page, 'Weekly time')).toContainText('of 5 h 30 min this week');
    await addThroughDialog(page, 'MONTH', 'DISTANCE', '1.250,5');
    expect((await goalsOf()).goals.find((goal) => goal.period === 'MONTH')).toMatchObject({ target: 1250.5 });
    await addThroughDialog(page, 'YEAR', 'ELEVATION', '12,500');
    expect((await goalsOf()).goals.find((goal) => goal.period === 'YEAR')).toMatchObject({ target: 12_500 });

    // In miles the box and the row speak miles, the server keeps kilometres.
    await clearGoals(runner.api);
    const context = page.context();
    await context.addInitScript(() => localStorage.setItem('hermes_unit', 'mile'));
    await page.goto(ROUTE);
    await openCard(page);
    await addThroughDialog(page, 'WEEK', 'DISTANCE', '25');
    const goal = (await goalsOf()).goals[0];
    expect(goal.target).toBeCloseTo(25 * 1.609344, 2);
    await expect(rowOf(page, 'Weekly distance')).toContainText('of 25 mi this week');
    await rowOf(page, 'Weekly distance').getByRole('button', { name: 'Change the target of Weekly distance' }).click();
    await expect(dialog(page, 'Change the target of Weekly distance').getByLabel('Target')).toHaveValue('25');
  });

  test.fixme('F03-E1 no goal yet: suggested goals from your own history are offered (a could-have of M6, not built)', async () => {});

  test('F03-E2 the dialog refuses what is not a target, says why, and sends nothing', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    const posts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/goals')) posts.push(request.postData() ?? '');
    });
    await page.goto(ROUTE);
    await openCard(page);
    await goalsCard(page).getByRole('button', { name: 'Set a goal' }).click();
    const box = dialog(page);
    const target = box.getByLabel('Target');
    const refused = async (text: string, message: string) => {
      await target.fill(text);
      await box.getByRole('button', { name: 'Save goal' }).click();
      await expect(box.getByRole('alert'), `typed ${JSON.stringify(text.slice(0, 20))}`).toHaveText(message);
      await expect(target).toHaveAttribute('aria-invalid', 'true');
      await expect(box).toBeVisible();
    };
    await refused('', 'Enter a target.');
    await refused('   ', 'Enter a target.');
    for (const text of ['0', '0.0', '-5', 'abc', '5 km', '🏃', '１２', '1e3', '0x10', '..5', '5..5', '4-0', '9'.repeat(10_000)]) {
      await refused(text, 'Use a number above zero, like 40 or 5.5.');
    }
    await refused('100001', 'That is more than a goal can be. The most is 100,000 km.');
    // Typing again lets go of the message.
    await target.fill('40');
    await expect(box.getByRole('alert')).toHaveCount(0);
    expect(posts, 'nothing was sent for any of them').toEqual([]);
    expect((await goalsOf()).goals).toEqual([]);

    // Each metric has its own largest target, said in its own unit.
    await box.getByRole('radio', { name: 'Time', exact: true }).check();
    await refused('9000', 'That is more than a goal can be. The most is 8760 h 0 min.');
    await box.getByRole('radio', { name: 'Runs', exact: true }).check();
    await refused('10001', 'That is more than a goal can be. The most is 10,000 runs.');
    await box.getByRole('radio', { name: 'Climb', exact: true }).check();
    await refused('1000001', 'That is more than a goal can be. The most is 1,000,000 m.');
    // A fraction of a run is rounded to a whole one; it is never stored as a fraction.
    await box.getByRole('radio', { name: 'Runs', exact: true }).check();
    await target.fill('2.5');
    await box.getByRole('button', { name: 'Save goal' }).click();
    await expect(box).toHaveCount(0);
    expect((await goalsOf()).goals[0]).toMatchObject({ metric: 'COUNT', target: 3 });
    expect(posts).toHaveLength(1);
  });

  test('F03-E2b the API refuses what is not a goal: nothing is stored, and the answer says why', async () => {
    const refuse = async (body: unknown, code = 'INVALID_GOAL') => {
      const res = await runner.api.post('/api/goals', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.json.code).toBe(code);
    };
    for (const target of [0, -1, -0.5, '40', null, true, [], {}, 1e12]) await refuse({ period: 'WEEK', metric: 'DISTANCE', target });
    await refuse({ period: 'WEEK', metric: 'DISTANCE' });
    await refuse({ period: 'DECADE', metric: 'DISTANCE', target: 10 });
    await refuse({ period: 'week', metric: 'DISTANCE', target: 10 });
    await refuse({ period: 'WEEK', metric: 'PACE', target: 10 });
    await refuse({ metric: 'DISTANCE', target: 10 });
    await refuse({ period: 'WEEK', target: 10 });
    await refuse({});
    expect((await runner.api.post('/api/goals')).status).toBe(400);
    expect((await goalsOf()).goals).toEqual([]);
    // A distance below a hundredth of a kilometre is no target; the largest of each metric is allowed.
    await refuse({ period: 'WEEK', metric: 'DISTANCE', target: 0.004 });
    expect((await runner.api.post('/api/goals', { period: 'WEEK', metric: 'DISTANCE', target: 100_000 })).status).toBe(201);
    expect((await runner.api.post('/api/goals', { period: 'WEEK', metric: 'TIME', target: 31_536_000 })).status).toBe(201);
    expect((await runner.api.post('/api/goals', { period: 'WEEK', metric: 'COUNT', target: 10_000 })).status).toBe(201);
    expect((await runner.api.post('/api/goals', { period: 'WEEK', metric: 'ELEVATION', target: 1_000_000 })).status).toBe(201);
    await refuse({ period: 'WEEK', metric: 'COUNT', target: 10_001 });
    // The same goal twice is a conflict, not a second goal; changing a target is not.
    const again = await runner.api.post('/api/goals', { period: 'WEEK', metric: 'COUNT', target: 5 });
    expect([again.status, again.json.code]).toEqual([409, 'DUPLICATE_GOAL']);
    const one = (await goalsOf()).goals.find((goal) => goal.metric === 'COUNT') as Goal;
    expect((await runner.api.put(`/api/goals/${one.id}`, { target: 0 })).status).toBe(400);
    expect((await runner.api.put(`/api/goals/${one.id}`, { target: 'x' })).status).toBe(400);
    expect((await runner.api.put(`/api/goals/${one.id}`, { period: 'YEAR', target: 12 })).status, 'the period of a goal does not change').toBe(200);
    const after = (await goalsOf()).goals.find((goal) => goal.id === one.id) as Goal;
    expect([after.period, after.target]).toEqual(['WEEK', 12]);
  });

  test('F03-E3 double click on Save makes one goal; a second tab that saves the same goal is told so; a refresh drops what was typed', async ({ browser, baseURL, guard }) => {
    guard.allow(/status of 409/);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    const posts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/goals')) posts.push(request.postData() ?? '');
    });
    await page.goto(ROUTE);
    await openCard(page);

    await goalsCard(page).getByRole('button', { name: 'Set a goal' }).click();
    await dialog(page).getByLabel('Target').fill('40');
    await dialog(page).getByRole('button', { name: 'Save goal' }).dblclick();
    await expect(dialog(page)).toHaveCount(0);
    await expect(rowOf(page, 'Weekly distance')).toBeVisible();
    expect(posts, 'one request for two clicks').toHaveLength(1);
    expect((await goalsOf()).goals).toHaveLength(1);

    // Two tabs, the same new goal: the first to save wins, the other is told, and nothing is doubled.
    const second = await pages.tab(page, ROUTE);
    await openCard(second);
    await goalsCard(page).getByRole('button', { name: 'Set a goal' }).click();
    await goalsCard(second).getByRole('button', { name: 'Set a goal' }).click();
    // Both dialogs opened on the first free thing, a week of time.
    await expect(dialog(page).getByRole('radio', { name: 'Time', exact: true })).toBeChecked();
    await expect(dialog(second).getByRole('radio', { name: 'Time', exact: true })).toBeChecked();
    await dialog(second).getByLabel('Target').fill('6');
    await dialog(second).getByRole('button', { name: 'Save goal' }).click();
    await expect(dialog(second)).toHaveCount(0);
    await dialog(page).getByLabel('Target').fill('8');
    await dialog(page).getByRole('button', { name: 'Save goal' }).click();
    await expect(dialog(page).getByRole('alert')).toHaveText('You already have a goal for Weekly time. Change its target in the list instead.');
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    const time = (await goalsOf()).goals.filter((goal) => goal.metric === 'TIME');
    expect(time).toHaveLength(1);
    expect(time[0].target, 'the first to save is the goal').toBe(6 * 3600);
    await page.reload();
    await expect(rowOf(page, 'Weekly time')).toContainText('of 6 h 0 min this week');

    // A refresh in the middle of typing: the dialog is gone, nothing was sent.
    const sent = posts.length;
    await goalsCard(page).getByRole('button', { name: 'Set a goal' }).click();
    await dialog(page).getByLabel('Target').fill('12');
    await page.reload();
    await openCard(page);
    await expect(dialog(page)).toHaveCount(0);
    expect(posts.length).toBe(sent);
    expect((await goalsOf()).goals).toHaveLength(2);
  });

  test('F03-E3b a target is changed in a dialog that has only the target, and deleting asks first, can be refused, and puts the keyboard back', async ({ browser, baseURL, guard }) => {
    await setGoal(runner.api, 'WEEK', 'DISTANCE', 40);
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);

    // Change: the period and what is aimed for are not asked again, the target starts as it was.
    await goalsCard(page).getByRole('button', { name: 'Change the target of Weekly distance' }).click();
    const box = dialog(page, 'Change the target of Weekly distance');
    await expect(box).toBeVisible();
    await expect(box.getByRole('radio')).toHaveCount(0);
    await expect(box.getByLabel('Target')).toHaveValue('40');
    await expect(box.getByLabel('Target')).toBeFocused();
    await box.getByLabel('Target').fill('55.5');
    await box.getByRole('button', { name: 'Save goal' }).click();
    await expect(box).toHaveCount(0);
    const changed = (await goalsOf()).goals[0];
    expect(changed.target).toBe(55.5);
    await expectRowShows(page, changed);
    expect(changed.id, 'the same goal, not a new one').toBeGreaterThan(0);

    // Delete asks once, in the row.
    const row = rowOf(page, 'Weekly distance');
    await row.getByRole('button', { name: 'Delete Weekly distance' }).click();
    const confirm = row.getByRole('group', { name: 'Delete this goal?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Keep it' }).click();
    await expect(confirm).toHaveCount(0);
    expect((await goalsOf()).goals).toHaveLength(1);
    await row.getByRole('button', { name: 'Delete Weekly distance' }).click();
    await row.getByRole('group', { name: 'Delete this goal?' }).getByRole('button', { name: 'Yes, delete' }).click();
    await expect(row).toHaveCount(0);
    await expect(goalsCard(page)).toContainText('No goals yet');
    await expect(goalsCard(page).getByRole('status').filter({ hasText: 'Goal deleted.' })).toBeAttached();
    // The button that was pressed is gone, so the keyboard is where a new goal is set.
    await expect(goalsCard(page).getByRole('button', { name: 'Set a goal' })).toBeFocused();
    expect((await goalsOf()).goals).toEqual([]);
  });

  test('F03-E3c keyboard only: set a goal, close the dialog with Escape, and keep the keyboard inside the dialog while it is open', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCard(page);
    const add = goalsCard(page).getByRole('button', { name: 'Set a goal' });
    await add.focus();
    await page.keyboard.press('Enter');
    const box = dialog(page);
    await expect(box.getByLabel('Target')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(box).toHaveCount(0);
    await expect(add).toBeFocused();
    expect((await goalsOf()).goals).toEqual([]);

    await page.keyboard.press('Enter');
    await expect(box.getByLabel('Target')).toBeFocused();
    // Tab goes round the dialog, and shift-Tab goes round the other way: focus never leaves it.
    const save = box.getByRole('button', { name: 'Save goal' });
    await save.focus();
    await page.keyboard.press('Tab');
    await expect(box.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(save).toBeFocused();
    // Radio buttons are chosen with the arrow keys, as radio buttons are.
    await box.getByRole('radio', { name: 'Weekly', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(box.getByRole('radio', { name: 'Monthly', exact: true })).toBeChecked();
    await box.getByLabel('Target').fill('150');
    await page.keyboard.press('Enter');
    await expect(box).toHaveCount(0);
    await expect(add).toBeFocused();
    expect((await goalsOf()).goals).toMatchObject([{ period: 'MONTH', metric: 'DISTANCE', target: 150 }]);
  });

  test.fixme('F03-E4 a goal that crosses a time-zone or daylight-saving boundary counts the right days (needs the runner\'s time zone and the BUG-003 decision on file-run times)', async () => {});

  test('F03-E5 a climb goal adds up the climb figures runs carry (here the seeded runner\'s Strava-style runs), and only those', async ({ browser, baseURL, guard, seed }) => {
    const mine = new Api(seed.baseUrl, seed.a.token);
    await clearGoals(mine);
    try {
      const log = (await mine.get('/api/training/log?weeks=26')).json as { today: string; weeks: Array<{ days: Array<{ date: string; runs: Array<{ elevationGainM: number | null }> }> }> };
      const climbSince = (start: string) => log.weeks.flatMap((week) => week.days).filter((day) => day.date >= start && day.date <= log.today)
        .flatMap((day) => day.runs).reduce((sum, run) => sum + (run.elevationGainM ?? 0), 0);
      const expectedYear = climbSince(periodStart('YEAR', log.today));
      expect(expectedYear, 'the seeded runner has climb this year').toBeGreaterThan(100);
      const goal = await setGoal(mine, 'YEAR', 'ELEVATION', 50_000);
      expect(Math.abs(goal.progress - expectedYear)).toBeLessThan(1);
      const page = await pages.open(browser, baseURL, guard, { token: seed.a.token, email: seed.a.email }, ROUTE);
      await expectRowShows(page, goal);
      await expect(rowOf(page, 'Yearly climb')).toContainText(`${amount('ELEVATION', goal.progress)} of 50,000 m this year`);
    } finally {
      await clearGoals(mine);
    }
  });

  test('F03-E6 when the goals cannot be loaded the card says so and Try again works; a save that fails keeps what was typed; a delete that fails says so', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    let loadFailures = 1;
    await page.route('**/api/goals', (route) => (route.request().method() === 'GET' && loadFailures-- > 0
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' })
      : route.fallback()));
    await page.goto(ROUTE);
    await expect(goalsCard(page).getByRole('alert')).toHaveText('Your goals could not be loaded.');
    await expect(goalsCard(page).getByRole('button', { name: 'Set a goal' })).toHaveCount(0);
    await goalsCard(page).getByRole('button', { name: 'Try again' }).click();
    await openCard(page);

    // A save that fails: the dialog stays, the number stays, and the same Save works once the server is back.
    let saveFailures = 1;
    await page.route('**/api/goals', (route) => (route.request().method() === 'POST' && saveFailures-- > 0
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' })
      : route.fallback()));
    await goalsCard(page).getByRole('button', { name: 'Set a goal' }).click();
    await dialog(page).getByLabel('Target').fill('42');
    await dialog(page).getByRole('button', { name: 'Save goal' }).click();
    await expect(dialog(page).getByRole('alert')).toHaveText('The goal could not be saved. Nothing was changed.');
    await expect(dialog(page).getByLabel('Target')).toHaveValue('42');
    expect((await goalsOf()).goals).toEqual([]);
    await dialog(page).getByRole('button', { name: 'Save goal' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(rowOf(page, 'Weekly distance')).toContainText('of 42 km this week');

    // A delete that fails says so and keeps the goal.
    let deleteFailures = 1;
    await page.route('**/api/goals/*', (route) => (route.request().method() === 'DELETE' && deleteFailures-- > 0
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' })
      : route.fallback()));
    await rowOf(page, 'Weekly distance').getByRole('button', { name: 'Delete Weekly distance' }).click();
    await rowOf(page, 'Weekly distance').getByRole('button', { name: 'Yes, delete' }).click();
    await expect(goalsCard(page).getByRole('alert')).toHaveText('The goal could not be deleted.');
    await expect(rowOf(page, 'Weekly distance')).toBeVisible();
    expect((await goalsOf()).goals).toHaveLength(1);
  });

  test('F03-E6b slow network: the card says it is loading and the page is usable meanwhile', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.route('**/api/goals', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.fallback();
    });
    await page.goto(ROUTE);
    await expect(goalsCard(page)).toHaveAttribute('aria-busy', 'true');
    await expect(goalsCard(page).getByRole('status').filter({ hasText: 'Loading your goals...' })).toBeAttached();
    await expect(page.getByRole('heading', { level: 1, name: 'Training log' }).first()).toBeVisible();
    await openCard(page);
    await expect(goalsCard(page)).not.toHaveAttribute('aria-busy', 'true');
  });

  test('F03-E7 the goals card and its dialog have no serious accessibility violation, and their text is readable in both themes', async ({ browser, baseURL, guard }) => {
    await setGoal(runner.api, 'WEEK', 'COUNT', 1);
    await setGoal(runner.api, 'WEEK', 'DISTANCE', 60);
    await setGoal(runner.api, 'MONTH', 'TIME', 80);
    await setGoal(runner.api, 'YEAR', 'ELEVATION', 20_000);
    for (const theme of ['light', 'midnight']) {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await expect(rowOf(page, 'Yearly climb')).toBeVisible();
      expect(await a11yViolations(page, { ignoreRules: ['color-contrast'] }), `${theme}, card`).toEqual([]);
      expect(await contrastProblems(page, { include: ['.goals-v2'] }), `${theme}, card, contrast`).toEqual([]);
      // Which of the five statuses a goal has depends on the day of the week and the month, so each is put on the first row in turn
      // (the stylesheet is what is being tested: no role says which colour a status has).
      for (const status of ['reached', 'early', 'ahead', 'on_track', 'behind'] as const) {
        await page.evaluate((value) => {
          const row = document.querySelector('.goals-v2__goal');
          const chip = row?.querySelector('.goals-v2__status');
          if (!row || !chip) throw new Error('no goal row on the page');
          row.className = `goals-v2__goal is-${value}`;
          chip.className = `goals-v2__status is-${value}`;
        }, status);
        expect(await contrastProblems(page, { include: ['.goals-v2'] }), `${theme}, status ${status}`).toEqual([]);
      }
      await goalsCard(page).getByRole('button', { name: 'Set a goal' }).click();
      await dialog(page).getByLabel('Target').fill('x');
      await dialog(page).getByRole('button', { name: 'Save goal' }).click();
      await expect(dialog(page).getByRole('alert')).toBeVisible();
      expect(await a11yViolations(page, { ignoreRules: ['color-contrast'] }), `${theme}, dialog`).toEqual([]);
      expect(await contrastProblems(page, { include: ['[role="dialog"]'] }), `${theme}, dialog, contrast`).toEqual([]);
    }
  });

  test('F03-E8 in Chinese the card, the rows and the dialog are translated and no raw key shows', async ({ browser, baseURL, guard }) => {
    await setGoal(runner.api, 'WEEK', 'DISTANCE', 40);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(ROUTE);
    const card = page.getByRole('region', { name: '目标', exact: true });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByRole('heading', { level: 3, name: '每周距离' })).toBeVisible();
    await card.getByRole('button', { name: '设定目标' }).click();
    await expect(page.getByRole('dialog', { name: '设定目标' })).toBeVisible();
    await page.getByRole('dialog', { name: '设定目标' }).getByRole('textbox').fill('');
    await page.getByRole('dialog', { name: '设定目标' }).getByRole('button', { name: '保存目标' }).click();
    await expect(page.getByRole('dialog', { name: '设定目标' }).getByRole('alert')).toBeVisible();
    await expectNoRawKeys(page);
    expect(await page.locator('body').innerText()).not.toMatch(/Weekly distance|Set a goal|No goals yet/);
  });

  test('F03-E9 @mobile the goals card and its dialog fit a phone', async ({ browser, baseURL, guard }) => {
    await setGoal(runner.api, 'WEEK', 'DISTANCE', 40);
    await setGoal(runner.api, 'MONTH', 'TIME', 20);
    await setGoal(runner.api, 'YEAR', 'COUNT', 250);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(ROUTE);
    await expect(rowOf(page, 'Yearly runs')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await goalsCard(page).getByRole('button', { name: 'Set a goal' }).click();
    const box = dialog(page);
    await expect(box).toBeVisible();
    const frame = await box.boundingBox();
    expect(frame && frame.x >= 0 && frame.x + frame.width <= 375, `dialog at ${JSON.stringify(frame)}`).toBe(true);
    await expect(box.getByRole('button', { name: 'Save goal' })).toBeInViewport();
    await expectNoHorizontalOverflow(page);
  });

  test('F03-N1 goals are the runner\'s own: signed out is refused, another runner cannot read, change or delete them, and gets nothing from a run that is not theirs', async ({ api }) => {
    const goal = await setGoal(runner.api, 'WEEK', 'DISTANCE', 40);
    const other = await newRunner('goals-other');
    // Signed out, every verb.
    for (const [method, route, body] of [
      ['get', '/api/goals', undefined],
      ['post', '/api/goals', { period: 'WEEK', metric: 'DISTANCE', target: 10 }],
      ['put', `/api/goals/${goal.id}`, { target: 10 }],
      ['delete', `/api/goals/${goal.id}`, undefined],
    ] as const) {
      const res = await api.request(method.toUpperCase(), route, { body, token: null });
      expect(res.status, `${method} ${route}`).toBe(401);
    }
    // Another runner: their own list is empty, and yours cannot be reached: not found, as if it were not there.
    expect((await goalsOf(other)).goals).toEqual([]);
    expect((await other.api.put(`/api/goals/${goal.id}`, { target: 1 })).status).toBe(404);
    expect((await other.api.delete(`/api/goals/${goal.id}`)).status).toBe(404);
    expect((await other.api.delete('/api/goals/987654321')).status).toBe(404);
    expect((await goalsOf()).goals[0]).toMatchObject({ id: goal.id, target: 40 });
    // The same goal can be set by another runner; it is theirs and does not touch yours.
    const theirs = await setGoal(other.api, 'WEEK', 'DISTANCE', 12);
    expect(theirs.id).not.toBe(goal.id);
    expect(theirs.progress).toBe(0);
    expect((await goalsOf()).goals[0].target).toBe(40);
    // A run of yours named in their request adds nothing to their goals, and shows nothing of yours.
    const today = runner.runs.find((run) => run.daysAgo === 0) as HistoryRun;
    const nosy = (await other.api.get(`/api/goals?runId=${today.id}`)).json as GoalsAnswer;
    expect(nosy.goals.map((item) => item.thisRun)).toEqual([null]);
    // Odd ids are not found rather than errors.
    expect((await runner.api.delete('/api/goals/abc')).status).toBeGreaterThanOrEqual(400);
    expect((await runner.api.delete('/api/goals/abc')).status).toBeLessThan(500);
  });
});
