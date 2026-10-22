// A8 Your races against the number, a section of the VO2max estimates page that came out of the Runalyze review: each run the runner
// flagged as a race, with the VO2max its time gives, the VO2max the page had shown the day before it, and the difference.
//
// The numbers on the page are worked out again here, in this file, from the runs the API lists and the rule the methods document gives
// (docs/README-ANALYSIS.md, "VDOT and VO2max", "Your races against the number"): so a page that rated a time wrongly, looked at the wrong
// runs for the number before it, counted the race itself in it, or averaged the wrong differences fails. The flow of flagging a race on a
// run's own page and finding it on the VO2max page without a reload is walked through in the browser, because the list of runs is kept
// in the page for a couple of minutes and saving a type has to drop it.
import type { Locator, Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { importRunSpecs, sharedRunner, type RunSpec } from '../fixtures/analysis.ts';
import { hms, mmss, raceEquationVo2max, shortDate, signedChange } from '../fixtures/format.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { expandRunLabels } from '../fixtures/run-labels.ts';
import { a11yViolations, contrastProblems, expect, expectNoHorizontalOverflow, expectNoRawKeys, test } from '../fixtures/test.ts';

const ROUTE = '/analysis#vo2max-estimates';
const DAY = 24 * 3600 * 1000;
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

test.beforeEach(async () => setProfileUnits(runner.api));


interface Row {
  id: number;
  name: string;
  distanceKm: number;
  movingTimeSeconds: number;
  startTime: string;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  runType: string | null;
}

interface Expected extends Row {
  start: number;
  tooShort: boolean;
  vdot: number | null;
  before: number | null;
  gap: number | null;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;
const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
const startOf = (row: Row): number => Date.parse(`${row.startTime}Z`);
const clock = (seconds: number): string => (Math.round(seconds) >= 3600 ? hms(seconds) : mmss(seconds));
const rowsOf = async (api: Api): Promise<Row[]> => (await api.get('/api/activities/analysis')).json;

/**
 * The number the runner would have seen the moment the race began: the rule of the methods document on the runs that began before it.
 * None of these runs has a heart rate (asserted), so every estimate is Daniels' race equation; the rule's pace filter and pool still apply.
 */
function standingBefore(raceStart: number, rows: Row[]): number | null {
  const earlier = rows.filter((row) => startOf(row) < raceStart);
  expect(earlier.every((row) => !row.averageHeartRate), 'the fixture runs have no heart rate').toBe(true);
  const rated = earlier.filter((row) => row.distanceKm >= 1.5 && row.movingTimeSeconds > 0);
  const paces = rated.map((row) => row.movingTimeSeconds / row.distanceKm).sort((a, b) => a - b);
  const median = paces.length ? paces[Math.floor(paces.length / 2)] : null;
  const found = rated
    .filter((row) => raceStart - startOf(row) <= 90 * DAY)
    .filter((row) => median === null || row.movingTimeSeconds / row.distanceKm <= median * 1.18)
    .map((row) => ({ km: row.distanceKm, estimate: raceEquationVo2max(row.distanceKm * 1000, row.movingTimeSeconds) }));
  if (found.length === 0) return null;
  const pool = found.some((item) => item.km >= 3) ? found.filter((item) => item.km >= 3) : found;
  const top = [...pool].sort((a, b) => b.estimate - a.estimate).slice(0, 3);
  return round1(mean(top.map((item) => item.estimate)));
}

/** The races of the list, newest first, each with the numbers the page should show. */
function racesFrom(rows: Row[]): Expected[] {
  return rows
    .filter((row) => row.runType === 'RACE')
    .map((row) => {
      const start = startOf(row);
      const tooShort = row.distanceKm < 1.5;
      const vdot = tooShort ? null : round1(raceEquationVo2max(row.distanceKm * 1000, row.movingTimeSeconds));
      const before = tooShort ? null : standingBefore(start, rows);
      return { ...row, start, tooShort, vdot, before, gap: vdot !== null && before !== null ? round1(vdot - before) : null };
    })
    .sort((a, b) => b.start - a.start);
}

const section = (page: Page): Locator => page.locator('.vo2max-estimates-v2__races');
const racesTable = (page: Page): Locator => page.getByRole('table', { name: /^Your races, newest first/ });
const runsTable = (page: Page): Locator => page.getByRole('table', { name: /^Runs of the last 90 days with an estimate, highest first$/ });
const typeGroup = (page: Page): Locator => page.getByRole('region', { name: 'Labels', exact: true }).getByRole('group', { name: 'Run type' });

/** Three easy 5 km runs, two races (a 10 km and a 5 km), a 1.2 km fun run that is also flagged, none with a heart rate. */
const FIXTURE: RunSpec[] = [
  { name: 'E2E a8 easy one', daysBack: 40, km: 5, pace: 300, hr: null },
  { name: 'E2E a8 easy two', daysBack: 30, km: 5, pace: 300, hr: null },
  { name: 'E2E a8 easy three', daysBack: 22, km: 5, pace: 300, hr: null },
  { name: 'E2E a8 spring ten', daysBack: 14, km: 10, pace: 270, hr: null },
  { name: 'E2E a8 fun run', daysBack: 8, km: 1.2, pace: 250, hr: null },
  { name: 'E2E a8 club five', daysBack: 5, km: 5, pace: 264, hr: null },
];
const RACE_NAMES = ['E2E a8 spring ten', 'E2E a8 fun run', 'E2E a8 club five'];

let runner: Awaited<ReturnType<typeof sharedRunner<null>>>;

test.beforeAll(async () => {
  test.setTimeout(480_000);
  runner = await sharedRunner('a8', async ({ api }) => {
    const ids = await importRunSpecs(api, FIXTURE, { wait: false });
    for (const [index, spec] of FIXTURE.entries()) {
      if (RACE_NAMES.includes(spec.name)) expect((await api.patch(`/api/activities/${ids[index]}`, { runType: 'RACE' })).status).toBe(200);
    }
    return null;
  });
});

async function openEvidence(page: Page): Promise<void> {
  const disclosure = page.locator('.vo2max-estimates-v2__race-evidence');
  await expect(disclosure).toBeVisible();
  if (!(await disclosure.evaluate(node => (node as HTMLDetailsElement).open))) {
    await disclosure.locator(':scope > summary').click();
  }
}

async function openPage(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 2, name: 'VO2max estimates', exact: true })).toBeVisible();
  await openEvidence(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Your races against the number' })).toBeVisible();
}

test.describe('A8 races against the number: what the page says', () => {
  test('A8-H1 each flagged race is a row, newest first, with the number its time gives, the number before it and the difference', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const rows = await rowsOf(runner.api);
    const expected = racesFrom(rows);
    expect(expected.map((race) => race.name)).toEqual(['E2E a8 club five', 'E2E a8 fun run', 'E2E a8 spring ten']);
    expect(rows.filter((row) => row.runType === 'RACE'), 'the list the page loads carries the type').toHaveLength(3);

    const lines = racesTable(page).locator('tbody tr');
    await expect(lines).toHaveCount(3);
    for (const [index, race] of expected.entries()) {
      const line = lines.nth(index);
      await expect(line.locator('th')).toHaveText(shortDate(new Date(`${race.startTime.slice(0, 10)}T12:00:00Z`)));
      await expect(line.locator('td').nth(0)).toHaveText(race.name);
      await expect(line.locator('td').nth(0).getByRole('link')).toHaveAttribute('href', `/runs/${race.id}`);
      await expect(line.locator('td').nth(1)).toHaveText(`${race.distanceKm.toFixed(1)} km`);
      await expect(line.locator('td').nth(2)).toHaveText(clock(race.movingTimeSeconds));
    }

    // The two that can be rated: the number the time gives, the number before it, and the difference as printed.
    const club = expected[0];
    const ten = expected[2];
    // The 10 km race is set against the three easy runs; the 5 km race against the best three of those and the 10 km race, a higher number.
    expect(club.before as number).toBeGreaterThan(ten.before as number);
    for (const race of [club, ten]) {
      const line = lines.nth(expected.indexOf(race));
      await expect(line.locator('td').nth(3)).toHaveText((race.vdot as number).toFixed(1));
      await expect(line.locator('td').nth(4)).toHaveText((race.before as number).toFixed(1));
      await expect(line.locator('td').nth(5)).toHaveText(signedChange(race.gap as number));
    }
    // Both came out above the number: the times were better than the easy running said.
    expect(club.gap).toBeGreaterThan(0);
    expect(ten.gap).toBeGreaterThan(0);
  });

  test('A8-H2 the mean of the differences, and how many came out above, below and level, leave out a race that has none', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const compared = racesFrom(await rowsOf(runner.api)).filter((race) => race.gap !== null);
    expect(compared).toHaveLength(2);
    const average = round1(mean(compared.map((race) => race.gap as number)));
    expect(average).toBeGreaterThan(0);

    await expect(section(page)).toContainText(`On average your 2 races came out ${average.toFixed(1)} above the VO2max you had before them: the times were better than the number said.`);
    await expect(section(page)).toContainText('Of the 2: 2 above the number, 0 below it, 0 level.');
    await expect(section(page)).toContainText('One race says little');
    await expect(section(page).getByRole('link', { name: 'How it is worked out' })).toHaveAttribute('href', /README-ANALYSIS\.md#your-races-against-the-number$/);
  });

  test('A8-H3 a race under 1.5 km is listed with the reason and no number, and has no part in the average', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const fun = racesTable(page).locator('tbody tr').filter({ hasText: 'E2E a8 fun run' });

    await expect(fun.locator('td').nth(1)).toHaveText('1.2 km');
    await expect(fun.locator('td').nth(3)).toHaveText('–Under 1.5 km');
    await expect(fun.locator('td').nth(4)).toHaveText('–');
    await expect(fun.locator('td').nth(5)).toHaveText('–');
    await expect(section(page)).not.toContainText('Of the 3');
  });

  test('A8-H4 the number before a race is the number of that day: the race itself is not in it, nor the runs after it', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openPage(page);
    const rows = await rowsOf(runner.api);
    const [club, , ten] = racesFrom(rows);

    // The 5 km race of 5 days ago sees the 10 km race of 14 days ago, a run before it.
    const withoutTen = standingBefore(club.start, rows.filter((row) => row.name !== 'E2E a8 spring ten'));
    expect(club.before, 'the 10 km race is one of the three best for the later race').not.toBe(withoutTen);

    // The 10 km race does not see itself, nor the 5 km race after it: with either in, the number would be higher.
    const withItself = standingBefore(ten.start + 1, rows);
    const withEverything = standingBefore(Date.now(), rows);
    expect(withItself, 'the race itself would raise the number before it').toBeGreaterThan(ten.before as number);
    expect(withEverything, 'the later race would raise it too').toBeGreaterThan(ten.before as number);
    const line = racesTable(page).locator('tbody tr').filter({ hasText: 'E2E a8 spring ten' });
    await expect(line.locator('td').nth(4)).toHaveText((ten.before as number).toFixed(1));
  });
});

test.describe('A8 races against the number: flagging a race and taking the flag off', () => {
  test('A8-F1 a race flagged on a run\'s page is on the VO2max page when the runner goes back, with no reload, and gone when the flag is taken off', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('a8-flow');
    const ids = await importRunSpecs(made.api, [
      { name: 'E2E a8 flow easy one', daysBack: 30, km: 5, pace: 300, hr: null },
      { name: 'E2E a8 flow easy two', daysBack: 22, km: 5, pace: 300, hr: null },
      { name: 'E2E a8 flow easy three', daysBack: 15, km: 5, pace: 300, hr: null },
      { name: 'E2E a8 flow hard five', daysBack: 4, km: 5, pace: 255, hr: null },
    ], { wait: false });
    const who = { token: made.api.token as string, email: made.email };
    const page = await pages.open(browser, baseURL, guard, who, ROUTE);

    // Nothing flagged: the section says how to flag a race, and draws no table.
    await openPage(page);
    await expect(section(page)).toContainText('None of your runs is flagged as a race.');
    await expect(racesTable(page)).toHaveCount(0);

    // Into the run (the list of runs was read a moment ago and is kept), flag it, and back, all inside the app.
    await runsTable(page).getByRole('link', { name: 'E2E a8 flow hard five' }).click();
    await expect(page).toHaveURL(new RegExp(`/runs/${ids[3]}$`));
    await expandRunLabels(page);
    await expect(typeGroup(page)).toBeVisible();
    const flagged = page.waitForResponse(response => response.request().method() === 'PATCH'
      && new URL(response.url()).pathname === `/api/activities/${ids[3]}`);
    await typeGroup(page).getByRole('radio', { name: 'Race', exact: true }).check();
    expect((await flagged).status()).toBe(200);
    await expect(typeGroup(page).getByRole('radio', { name: 'Race', exact: true })).toBeChecked();
    await expect(typeGroup(page)).not.toHaveAttribute('aria-busy', 'true');
    expect((await rowsOf(made.api)).find((row) => row.id === ids[3])?.runType).toBe('RACE');
    await page.goBack();

    await openPage(page);
    const [race] = racesFrom(await rowsOf(made.api));
    await expect(racesTable(page).locator('tbody tr')).toHaveCount(1);
    const line = racesTable(page).locator('tbody tr').first();
    await expect(line.locator('td').nth(0)).toHaveText('E2E a8 flow hard five');
    await expect(line.locator('td').nth(3)).toHaveText((race.vdot as number).toFixed(1));
    await expect(line.locator('td').nth(4)).toHaveText((race.before as number).toFixed(1));
    await expect(line.locator('td').nth(5)).toHaveText(signedChange(race.gap as number));
    await expect(section(page)).toContainText('This race came out');

    // And the other way: take the flag off.
    await line.getByRole('link').click();
    await expandRunLabels(page);
    await expect(typeGroup(page)).toBeVisible();
    const unflagged = page.waitForResponse(response => response.request().method() === 'PATCH'
      && new URL(response.url()).pathname === `/api/activities/${ids[3]}`);
    await typeGroup(page).getByRole('radio', { name: 'Just a run' }).check();
    expect((await unflagged).status()).toBe(200);
    await expect(typeGroup(page).getByRole('radio', { name: 'Just a run' })).toBeChecked();
    await expect(typeGroup(page)).not.toHaveAttribute('aria-busy', 'true');
    await page.goBack();
    await openPage(page);
    await expect(racesTable(page)).toHaveCount(0);
    await expect(section(page)).toContainText('None of your runs is flagged as a race.');
  });

  test('A8-F2 the empty section offers the way to flag a race, which is the runs list', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('a8-none');
    await importRunSpecs(made.api, [{ name: 'E2E a8 none easy', daysBack: 6, km: 6, pace: 320, hr: null }], { wait: false });
    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await openPage(page);

    expect((await rowsOf(made.api)).every((row) => row.runType === null)).toBe(true);
    await section(page).getByRole('link', { name: 'Choose a run to flag' }).click();
    await expect(page).toHaveURL(/\/runs$/);
  });

  test('A8-E1 a race with no run before it that gives an estimate says so and has no difference, and the summary says why', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('a8-lonely');
    const [id] = await importRunSpecs(made.api, [{ name: 'E2E a8 first ever race', daysBack: 3, km: 5, pace: 290, hr: null }], { wait: false });
    expect((await made.api.patch(`/api/activities/${id}`, { runType: 'RACE' })).status).toBe(200);
    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await openPage(page);
    const [race] = racesFrom(await rowsOf(made.api));

    expect(race.before).toBeNull();
    const line = racesTable(page).locator('tbody tr').first();
    await expect(line.locator('td').nth(3)).toHaveText((race.vdot as number).toFixed(1));
    await expect(line.locator('td').nth(4)).toHaveText('No estimate');
    await expect(line.locator('td').nth(5)).toHaveText('–');
    await expect(section(page)).toContainText('None of these races can be set against the number');
    await expect(section(page)).not.toContainText('Of the');
  });

  test('A8-E2 a runner with no run at all sees both empty sentences, and another runner\'s races are never on the page', async ({ browser, baseURL, guard }) => {
    const none = await newRunner('a8-empty');
    const page = await pages.open(browser, baseURL, guard, { token: none.api.token as string, email: none.email }, ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: 'No run gives an estimate yet' })).toBeVisible();
    await expect(section(page)).toContainText('None of your runs is flagged as a race.');
    await expect(page.locator('body')).not.toContainText('E2E a8');
    expect(await rowsOf(none.api)).toEqual([]);
    expect((await rowsOf(runner.api)).filter((row) => row.runType === 'RACE')).toHaveLength(3);
  });
});

test.describe('A8 races against the number: in other conditions', () => {
  test('A8-U1 in miles the distance of a race and the shortest race are in miles', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await setProfileUnits(runner.api, 'imperial');
    await page.addInitScript(() => localStorage.setItem('hermes_unit', 'mile'));
    await page.goto(ROUTE);
    await openPage(page);
    const [club] = racesFrom(await rowsOf(runner.api));

    await expect(racesTable(page).locator('tbody tr').first().locator('td').nth(1)).toHaveText(`${(club.distanceKm * 0.621371).toFixed(1)} mi`);
    await expect(racesTable(page).getByText('Under 0.9 mi')).toBeVisible();
  });

  test('A8-L1 in Chinese the section is translated and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(ROUTE);
    await openEvidence(page);
    await expect(page.getByRole('heading', { level: 2, name: '你的比赛与这个数字的对照' })).toBeVisible();
    const [club] = racesFrom(await rowsOf(runner.api));
    const table = page.getByRole('table', { name: /^你的比赛，最近的在前/ });
    const cells = table.locator('tbody tr').first().locator('td');

    await expect(cells.nth(3)).toHaveText((club.vdot as number).toFixed(1));
    await expect(cells.nth(5)).toHaveText(signedChange(club.gap as number));
    await expect(section(page)).toContainText('场中：2 场高于这个数字，0 场低于，0 场持平。');
    await expect(section(page)).not.toContainText('Of the');
    await expectNoRawKeys(page);
  });

  for (const theme of ['light', 'midnight']) {
    test(`A8-A1 the section is readable in the ${theme} theme and has no accessibility violations`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await openPage(page);
      await expect(racesTable(page)).toBeVisible();
      expect(await contrastProblems(page, { include: ['.vo2max-estimates-v2__races'] }), `${theme}, contrast`).toEqual([]);
      expect(await a11yViolations(page, { include: ['.vo2max-estimates-v2__races'] }), `${theme}, axe`).toEqual([]);
    });
  }

  test('A8-M1 @mobile the section fits a phone: the table scrolls inside its frame and the page does not', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await page.setViewportSize({ width: 375, height: 812 });
    await openPage(page);
    await expect(racesTable(page)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const frame = await section(page).locator('.vo2max-estimates-v2__table-wrap').evaluate((node) => ({ scroll: node.scrollWidth, client: node.clientWidth }));
    expect(frame.scroll, 'the table is wider than its frame and scrolls there').toBeGreaterThan(frame.client);
  });
});
