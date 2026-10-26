// A2 The pace curve, the page that came out of the Runalyze review: the runner's fastest time over each standard distance by how long
// the effort lasted, and the critical speed line (distance = D' + CS x time) fitted through the efforts of three to forty minutes.
//
// The numbers on the page are checked against the API, and the line against an ordinary least squares done again here from the
// efforts the API lists, so a page that drew the wrong number, or a model that drifted from its own documentation
// (docs/README-ANALYSIS.md, "Pace Curve and Critical Pace"), fails. Case numbers are the rows of replica/runalyze/test-plan.md.
import type { Locator, Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { KM_PER_MILE, importRunSpecs, leastSquares, sharedRunner, waitForBestEfforts, type RunSpec } from '../fixtures/analysis.ts';
import { hms, mmss, shortDate } from '../fixtures/format.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { enlargeText, readingsThatCollide } from '../fixtures/reflow.ts';
import { a11yViolations, contrastProblems, expect, expectNoHorizontalOverflow, expectNoRawKeys, test } from '../fixtures/test.ts';

const ROUTE = '/analysis/pace-curve';
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

interface Point {
  key: string;
  meters: number;
  seconds: number;
  paceSecondsPerKm: number;
  date: string;
  activityId: number;
  name: string;
  edited: boolean;
  inModel: boolean;
}

interface Curve {
  today: string;
  days: number;
  complete: boolean;
  points: Point[];
  model: { status: string; criticalSpeedMps: number | null; criticalPaceSecondsPerKm: number | null; dPrimeMeters: number | null; pointsUsed: number; maxErrorPercent: number | null };
  limits: { minSeconds: number; maxSeconds: number; minPoints: number; minSpread: number; okErrorPercent: number; roughErrorPercent: number };
}

const curveOf = async (api: Api, query = ''): Promise<Curve> => (await api.get(`/api/training/pace-curve${query}`)).json;

const NAMES: Record<string, string> = {
  '400m': '400 m',
  half_mile: '½ mile',
  '1km': '1 km',
  '1mile': '1 mile',
  '3km': '3 km',
  '2mile': '2 miles',
  '5km': '5 km',
  '10km': '10 km',
};

const table = (page: Page): Locator => page.getByRole('table', { name: 'Your fastest time over each distance in this window' });
const tiles = (page: Page): Locator => page.getByRole('region', { name: "The critical pace, D' and how well the line fits" });
const chips = (page: Page): Locator => page.getByRole('group', { name: 'Look back' });
const plot = (page: Page): Locator => page.getByRole('region', { name: 'Pace against duration' });
const timeText = (seconds: number): string => (seconds >= 3600 ? hms(seconds) : mmss(seconds));

/**
 * Seven runs, each long enough for one standard distance and a little over, at the pace a critical speed of 3.7 m/s and a D' of 100 m
 * gives for that distance (time = (distance - 100) / 3.7): 190 s over half a mile, 243 s over 1 km, 408 s over a mile, 784 s over
 * 3 km, 842 s over 2 miles, 1324 s over 5 km and 2675 s over 10 km. Slower paces for longer runs, so each distance's best effort is
 * the run made for it and the efforts line up the way a trained runner's do, with the small scatter that distances measured from a
 * GPS track have.
 */
const CURVE_RUNS: RunSpec[] = [
  { name: 'E2E curve half mile', daysBack: 9, km: 0.82, pace: 236.7, hr: null },
  { name: 'E2E curve one k', daysBack: 8, km: 1.02, pace: 243.2, hr: null },
  { name: 'E2E curve one mile', daysBack: 7, km: 1.64, pace: 253.5, hr: null },
  { name: 'E2E curve three k', daysBack: 6, km: 3.05, pace: 261.3, hr: null },
  { name: 'E2E curve two mile', daysBack: 5, km: 3.28, pace: 261.5, hr: null },
  { name: 'E2E curve five k', daysBack: 4, km: 5.07, pace: 264.9, hr: null },
  { name: 'E2E curve ten k', daysBack: 3, km: 10.15, pace: 267.5, hr: null },
];

let runner: Awaited<ReturnType<typeof sharedRunner<null>>>;

test.beforeAll(async () => {
  test.setTimeout(480_000);
  runner = await sharedRunner('curve', async ({ api }) => {
    await importRunSpecs(api, CURVE_RUNS);
    await waitForBestEfforts(api, 8);
    return null;
  });
});

async function openCurve(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 2, name: 'Pace curve' })).toBeVisible();
  await expect(table(page)).toBeVisible();
}

test.describe('A2 pace curve: what the page says', () => {
  test('A2-H1 the table is the API\'s efforts, with the time, pace, day and run of each, and the line says which it was fitted through', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCurve(page);
    const curve = await curveOf(runner.api);
    expect(curve.complete).toBe(true);
    expect(curve.days).toBe(180);
    expect(curve.points.map((point) => point.key)).toEqual(Object.keys(NAMES));

    const rows = table(page).locator('tbody tr');
    await expect(rows).toHaveCount(curve.points.length);
    for (const [index, point] of curve.points.entries()) {
      const cells = rows.nth(index).locator('th, td');
      await expect(cells.nth(0)).toHaveText(NAMES[point.key]);
      await expect(cells.nth(1)).toHaveText(timeText(point.seconds));
      await expect(cells.nth(2)).toHaveText(`${mmss(point.paceSecondsPerKm)} /km`);
      await expect(cells.nth(3)).toHaveText(shortDate(new Date(`${point.date}T12:00:00Z`)));
      await expect(cells.nth(4).getByRole('link')).toHaveText(point.name);
      await expect(cells.nth(4).getByRole('link')).toHaveAttribute('href', `/runs/${point.activityId}`);
      const inLine = point.seconds < curve.limits.minSeconds ? 'No, under 3 min' : point.seconds > curve.limits.maxSeconds ? 'No, over 40 min' : 'Yes';
      await expect(cells.nth(5)).toHaveText(inLine);
      expect(point.inModel, `${point.key} is in the line exactly when it lasted 3 to 40 minutes`).toBe(inLine === 'Yes');
    }
    // The fastest effort of each distance really is the fastest: a 1 km is never faster than the pace of the 400 m inside it, and
    // a longer effort is never over the same pace as a shorter one a runner has held for half as long (monotone in time).
    for (let index = 1; index < curve.points.length; index += 1) {
      expect(curve.points[index].seconds, `${curve.points[index].key} takes longer than ${curve.points[index - 1].key}`).toBeGreaterThan(curve.points[index - 1].seconds);
    }
  });

  test('A2-H2 the critical pace, D\' and the fit are an ordinary least squares through the efforts of three to forty minutes', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCurve(page);
    const curve = await curveOf(runner.api);
    const inRange = curve.points.filter((point) => point.seconds >= curve.limits.minSeconds && point.seconds <= curve.limits.maxSeconds);
    expect(inRange.length).toBeGreaterThanOrEqual(curve.limits.minPoints);

    // Worked out again here: distance on time, the slope is the critical speed and the intercept is D'.
    const { slope, intercept } = leastSquares(inRange.map((point) => ({ seconds: point.seconds, meters: point.meters })));
    const worst = Math.max(...inRange.map((point) => (Math.abs((point.meters - intercept) / slope - point.seconds) / point.seconds) * 100));
    expect(curve.model.status).toBe(worst <= curve.limits.okErrorPercent ? 'ok' : worst <= curve.limits.roughErrorPercent ? 'rough' : 'no_fit');
    expect(curve.model.pointsUsed).toBe(inRange.length);
    expect(curve.model.criticalSpeedMps).toBeCloseTo(slope, 2);
    expect(curve.model.dPrimeMeters).toBeCloseTo(intercept, 0);
    expect(curve.model.criticalPaceSecondsPerKm).toBeCloseTo(1000 / slope, 0);
    expect(curve.model.maxErrorPercent).toBeCloseTo(worst, 0);

    // And the page says the same, in its own words.
    const [pace, dPrime, fit] = [0, 1, 2].map((index) => tiles(page).locator('article').nth(index));
    await expect(pace.locator('span')).toHaveText('Critical pace');
    await expect(pace.locator('strong')).toHaveText(`${mmss(1000 / slope)} /km`);
    await expect(dPrime.locator('span')).toHaveText('D′');
    await expect(dPrime.locator('strong')).toHaveText(new RegExp(`^${Math.round(intercept).toLocaleString('en-US')} m$`));
    await expect(fit.locator('strong')).toHaveText(`Within ${(curve.model.maxErrorPercent as number).toFixed(1)}%`);
    await expect(fit.locator('small')).toContainText(`The worst of ${inRange.length} efforts`);
  });

  test('A2-H3 the drawing has a dot for each effort, filled for the ones in the line, and the line and its critical pace', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCurve(page);
    const curve = await curveOf(runner.api);

    await expect(plot(page).getByRole('img')).toHaveAccessibleName(/^Pace \(\/km\) against how long each effort lasted, one dot for your fastest time over each standard distance\./);
    await expect(plot(page).locator('circle.pace-curve-v2__dot')).toHaveCount(curve.points.length);
    await expect(plot(page).locator('circle.pace-curve-v2__dot.is-in-line')).toHaveCount(curve.points.filter((point) => point.inModel).length);
    await expect(plot(page).locator('path.pace-curve-v2__line')).toHaveCount(2); // the dashed stretch the whole way, the solid one where fitted
    await expect(plot(page).locator('line.pace-curve-v2__critical')).toHaveCount(1);
    await expect(plot(page).locator('text.pace-curve-v2__critical-label')).toContainText(`Critical pace ${mmss(curve.model.criticalPaceSecondsPerKm as number)}`);
    await expect(plot(page)).toContainText('Up is faster.');
  });

  test('A2-H4 the window is in the address: six months to begin with, and a choice stays through a reload', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCurve(page);
    await expect(chips(page).getByRole('button')).toHaveText(['3 months', '6 months', '12 months', 'All time']);
    for (const [index, pressed] of ['false', 'true', 'false', 'false'].entries()) {
      await expect(chips(page).getByRole('button').nth(index)).toHaveAttribute('aria-pressed', pressed);
    }

    const asked: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/training/pace-curve')) asked.push(new URL(request.url()).search);
    });
    await chips(page).getByRole('button', { name: '12 months' }).click();
    await expect(page).toHaveURL(/\/analysis\?days=365#pace-curve$/);
    await expect(chips(page).getByRole('button', { name: '12 months' })).toHaveAttribute('aria-pressed', 'true');
    await chips(page).getByRole('button', { name: 'All time' }).click();
    await expect(page).toHaveURL(/\?days=all#pace-curve$/);
    await expect.poll(() => asked).toEqual(expect.arrayContaining(['?days=365', '?days=all']));

    await page.reload();
    await expect(chips(page).getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'true');
    await expect(table(page)).toBeVisible();

    // Back to six months is the plain address again.
    await chips(page).getByRole('button', { name: '6 months' }).click();
    await expect(page).toHaveURL(/\/analysis#pace-curve$/);
  });

  test('A2-H5 a window the page does not offer is taken for six months, and the window changes what the dots are made of', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, `${ROUTE}?days=7`);
    await openCurve(page);
    await expect(chips(page).getByRole('button', { name: '6 months' })).toHaveAttribute('aria-pressed', 'true');

    // The runs are from 3 to 9 days ago: a window of three months holds them all, so the curves of the two windows are the same.
    const three = await curveOf(runner.api, '?days=90');
    const six = await curveOf(runner.api, '?days=180');
    expect(three.points).toEqual(six.points);
    // A one-day window ends before any of the runs.
    expect((await curveOf(runner.api, '?days=1')).points).toEqual([]);
  });

  test('A2-H6 the page is a part of Analysis: it sits under it, has its own title and is reached from Analysis and from a prediction', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, '/analysis');
    await page.getByRole('link', { name: 'Pace curve and critical pace' }).first().click();
    await expect(page).toHaveURL(/\/analysis#pace-curve$/);
    await openCurve(page);
    await expect(page).toHaveTitle('Analysis | HermesRuns');
    await expect(page.getByRole('heading', { level: 1, name: 'Your fitness picture' })).toBeVisible();

    await page.goto('/prediction/10k');
    await page.getByRole('link', { name: 'Pace curve and critical pace' }).click();
    await expect(page).toHaveURL(/\/analysis#pace-curve$/);
    await openCurve(page);

    // From the page itself the way back and across.
    await page.getByRole('region', { name: 'Race predictions' }).getByRole('link', { name: /^10K/ }).click();
    await expect(page).toHaveURL(/\/prediction\/10k$/);
  });

  test('A2-H7 changing the window replaces the address: Back leaves the page, not the last window', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, '/analysis');
    await page.getByRole('link', { name: 'Pace curve and critical pace' }).first().click();
    await openCurve(page);
    await chips(page).getByRole('button', { name: '3 months' }).click();
    await expect(page).toHaveURL(/\?days=90#pace-curve$/);
    await chips(page).getByRole('button', { name: '12 months' }).click();
    await expect(page).toHaveURL(/\?days=365#pace-curve$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/analysis$/);
  });
});

test.describe('A2 pace curve: efforts that do not make a picture', () => {
  test('A2-E1 a runner with no runs gets a sentence, not a chart, and a longer window is suggested', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('curve-none');
    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: 'No best efforts here yet' })).toBeVisible();
    await expect(page.getByText('Try a longer window')).toBeVisible();
    await expect(table(page)).toHaveCount(0);
    await expect(plot(page)).toHaveCount(0);

    await chips(page).getByRole('button', { name: 'All time' }).click();
    await expect(page.getByText('None of your runs has a best effort yet.')).toBeVisible();
    expect((await curveOf(made.api)).model.status).toBe('too_few_points');
  });

  test('A2-E2 a run older than the window is left out of it and is there in a longer one', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('curve-old');
    await importRunSpecs(made.api, [{ name: 'E2E curve old run', daysBack: 200, km: 6.2, pace: 330, hr: null }], { wait: false });
    await waitForBestEfforts(made.api, 6);
    const who = { token: made.api.token as string, email: made.email };

    const page = await pages.open(browser, baseURL, guard, who, ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: 'No best efforts here yet' })).toBeVisible();
    await chips(page).getByRole('button', { name: '12 months' }).click();
    await expect(table(page)).toBeVisible();
    await expect(table(page).locator('tbody tr')).toHaveCount((await curveOf(made.api, '?days=365')).points.length);
    expect((await curveOf(made.api, '?days=180')).points).toEqual([]);
    expect((await curveOf(made.api, '?days=199')).points).toEqual([]);
    expect((await curveOf(made.api, '?days=201')).points.length, 'a window that reaches back 201 days holds a run from 200 days ago').toBeGreaterThan(0);
  });

  test('A2-E3 with fewer than three efforts of three to forty minutes there are dots and no line, and the page says how many there are', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('curve-tiny');
    await importRunSpecs(made.api, [{ name: 'E2E curve one short run', daysBack: 3, km: 1.2, pace: 250, hr: null }]);
    await waitForBestEfforts(made.api, 3);
    const curve = await curveOf(made.api);
    expect(curve.model.status).toBe('too_few_points');

    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await expect(table(page)).toBeVisible();
    await expect(table(page).locator('tbody tr')).toHaveCount(curve.points.length);
    await expect(page.getByText(`A line needs at least 3 best efforts that lasted 3 to 40 minutes. This window has ${curve.model.pointsUsed}.`)).toBeVisible();
    await expect(tiles(page)).toHaveCount(0);
    await expect(plot(page).locator('path.pace-curve-v2__line')).toHaveCount(0);
    // Without a line nothing is "in" it.
    await expect(table(page).locator('tbody td:last-child')).toHaveText(Array.from({ length: curve.points.length }, () => '–'));
  });

  test('A2-E4 efforts that do not lie on a line give no critical pace, and the page says so instead of drawing one', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('curve-nofit');
    await importRunSpecs(made.api, [
      { name: 'E2E curve a fast kilometre', daysBack: 4, km: 1, pace: 240, hr: null },
      { name: 'E2E curve a slow five', daysBack: 3, km: 5.3, pace: 360, hr: null },
    ]);
    await waitForBestEfforts(made.api, 7);
    const curve = await curveOf(made.api);
    expect(curve.model).toMatchObject({ status: 'no_fit', criticalSpeedMps: null, criticalPaceSecondsPerKm: null, dPrimeMeters: null });

    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await expect(page.getByText('The efforts do not lie close enough to a line (the worst is more than 10% off), so there is no critical pace to show.')).toBeVisible();
    await expect(tiles(page)).toHaveCount(0);
    await expect(plot(page).locator('line.pace-curve-v2__critical')).toHaveCount(0);
    await expect(table(page).locator('tbody tr')).toHaveCount(curve.points.length);
  });

  test('A2-E5 in miles every pace is in miles, the critical pace included', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_unit', 'mile'));
    await page.goto(ROUTE);
    await openCurve(page);
    const curve = await curveOf(runner.api);

    await expect(table(page).locator('tbody tr').first().locator('td').nth(1)).toHaveText(`${mmss(curve.points[0].paceSecondsPerKm * KM_PER_MILE)} /mi`);
    await expect(tiles(page).locator('article').nth(0).locator('strong')).toHaveText(`${mmss((curve.model.criticalPaceSecondsPerKm as number) * KM_PER_MILE)} /mi`);
    await expect(plot(page).getByRole('img')).toHaveAccessibleName(/^Pace \(\/mi\) against how long each effort lasted/);
    await expect(table(page)).not.toContainText('/km');
  });

  test('A2-E6 a run whose name is long, has accents or an emoji keeps its row and its link', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('curve-names');
    const longName = `Zürich café 🏃‍♀️ ${'très long '.repeat(12)}`.trim();
    const id = await importRunSpecs(made.api, [{ name: longName, daysBack: 2, km: 6.2, pace: 320, hr: null }]);
    await waitForBestEfforts(made.api, 6);
    expect(id).toHaveLength(1);
    const who = { token: made.api.token as string, email: made.email };

    const page = await pages.open(browser, baseURL, guard, who, ROUTE);
    await openCurve(page);
    const links = table(page).locator('tbody tr td:nth-child(5) a');
    // The name is the server's to keep or to shorten; whatever it kept, accents and the emoji are in it and the link goes to the run.
    const kept = (await curveOf(made.api)).points[0].name;
    expect(kept.startsWith('Zürich café 🏃‍♀️')).toBe(true);
    await expect(links.first()).toHaveText(kept);
    await expect(links.first()).toHaveAttribute('href', new RegExp(`/runs/${id[0]}$`));
    await expectNoHorizontalOverflow(page);
  });

  test('A2-E7 the keyboard reaches every control in turn and each shows where it is', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await openCurve(page);
    const disclosure = page.locator('#pace-curve > summary');
    await disclosure.focus();
    await expect(disclosure).toBeFocused();

    const seen: string[] = [];
    for (let step = 0; step < 120 && seen.length < 12; step += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body || !el.closest('.pace-curve-v2')) return null;
        const style = getComputedStyle(el);
        return { name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40), outline: `${style.outlineStyle} ${style.outlineWidth}` };
      });
      if (info) {
        expect(info.outline, `${info.name} shows the keyboard focus`).toMatch(/solid 2px/);
        seen.push(info.name);
      }
    }
    // The embedded section's four window buttons and a link to each run in the table.
    expect(seen.slice(0, 4)).toEqual(['3 months', '6 months', '12 months', 'All time']);
    expect(seen.filter((name) => name.startsWith('E2E curve')).length).toBeGreaterThanOrEqual(4);
    // Keyboard: Enter on a window button chooses it.
    await chips(page).getByRole('button', { name: '3 months' }).focus();
    await page.keyboard.press('Enter');
    await expect(chips(page).getByRole('button', { name: '3 months' })).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('A2 pace curve: efforts the runner has decided about', () => {
  const THREE_RUNS: RunSpec[] = [
    { name: 'E2E decided one k', daysBack: 8, km: 1.02, pace: 243.2, hr: null },
    { name: 'E2E decided three k', daysBack: 6, km: 3.05, pace: 261.3, hr: null },
    { name: 'E2E decided five k', daysBack: 4, km: 5.07, pace: 264.9, hr: null },
  ];
  const row = (page: Page, name: string): Locator => table(page).getByRole('row', { name: new RegExp(`^${name} `) });

  test('A2-E8 a typed time counts as typed, is marked so, and taking it back returns the measured time', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('curve-typed');
    await importRunSpecs(made.api, THREE_RUNS);
    await waitForBestEfforts(made.api, 5);
    const who = { token: made.api.token as string, email: made.email };
    const measured = (await curveOf(made.api)).points.find((point) => point.key === '5km') as Point;
    expect(measured.edited).toBe(false);

    // The runner types 21:30 for the 5 km of the run.
    expect((await made.api.patch(`/api/activities/${measured.activityId}/best-efforts/5km`, { elapsedSeconds: 1290 })).status).toBe(200);
    const typed = await curveOf(made.api);
    expect(typed.points.find((point) => point.key === '5km')).toMatchObject({ seconds: 1290, edited: true, activityId: measured.activityId });
    // The line is fitted through the time as typed.
    const inRange = typed.points.filter((point) => point.seconds >= 180 && point.seconds <= 2400);
    expect(typed.model.criticalSpeedMps).toBeCloseTo(leastSquares(inRange.map((point) => ({ seconds: point.seconds, meters: point.meters }))).slope, 2);

    const page = await pages.open(browser, baseURL, guard, who, ROUTE);
    await openCurve(page);
    await expect(row(page, '5 km')).toContainText('21:30');
    await expect(row(page, '5 km').locator('.pace-curve-v2__tag')).toHaveText('typed');
    await expect(row(page, '3 km').locator('.pace-curve-v2__tag')).toHaveCount(0);

    // Taking it back: the measured time again, no tag.
    expect((await made.api.patch(`/api/activities/${measured.activityId}/best-efforts/5km`, { elapsedSeconds: null })).status).toBe(200);
    await page.reload();
    await openCurve(page);
    await expect(row(page, '5 km')).toContainText(timeText(measured.seconds));
    await expect(row(page, '5 km').locator('.pace-curve-v2__tag')).toHaveCount(0);
    // A time nobody could run is refused, and nothing changes.
    expect((await made.api.patch(`/api/activities/${measured.activityId}/best-efforts/5km`, { elapsedSeconds: 100 })).status).toBe(400);
    expect((await curveOf(made.api)).points.find((point) => point.key === '5km')?.seconds).toBe(measured.seconds);
  });

  test('A2-E9 a hidden effort is out of the curve and the next best takes its place; hiding every one takes the row away; showing brings them back', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('curve-hidden');
    await importRunSpecs(made.api, THREE_RUNS);
    await waitForBestEfforts(made.api, 5);
    const who = { token: made.api.token as string, email: made.email };
    const before = await curveOf(made.api);
    const three = before.points.find((point) => point.key === '3km') as Point;
    expect(three.name).toBe('E2E decided three k');
    const page = await pages.open(browser, baseURL, guard, who, ROUTE);
    await openCurve(page);
    await expect(row(page, '3 km')).toContainText('E2E decided three k');

    try {
      // Hide the run's own 3 km: the 3 km inside the 5 km run (a little slower) is the fastest left.
      expect((await made.api.patch(`/api/activities/${three.activityId}/best-efforts/3km`, { hidden: true })).status).toBe(200);
      const next = (await curveOf(made.api)).points.find((point) => point.key === '3km') as Point;
      expect(next.name).toBe('E2E decided five k');
      expect(next.seconds).toBeGreaterThan(three.seconds);
      await page.reload();
      await openCurve(page);
      await expect(row(page, '3 km')).toContainText('E2E decided five k');
      // The run still holds the fastest 1 mile: only its 3 km is hidden.
      await expect(row(page, '3 km')).not.toContainText('E2E decided three k');
      await expect(row(page, '1 mile')).toContainText('E2E decided three k');

      // Hide that one too: no measured 3 km is left, so the row is gone and the line is fitted without it.
      expect((await made.api.patch(`/api/activities/${next.activityId}/best-efforts/3km`, { hidden: true })).status).toBe(200);
      const none = await curveOf(made.api);
      expect(none.points.find((point) => point.key === '3km')).toBeUndefined();
      await page.reload();
      await openCurve(page);
      await expect(table(page).getByRole('row', { name: /^3 km / })).toHaveCount(0);
      await expect(table(page).locator('tbody tr')).toHaveCount(none.points.length);
    } finally {
      await made.api.patch(`/api/activities/${three.activityId}/best-efforts/3km`, { hidden: false });
      const five = (await curveOf(made.api)).points.find((point) => point.key === '5km') as Point;
      await made.api.patch(`/api/activities/${five.activityId}/best-efforts/3km`, { hidden: false });
    }
    await page.reload();
    await openCurve(page);
    await expect(row(page, '3 km')).toContainText('E2E decided three k');
    expect((await curveOf(made.api)).points.map((point) => point.key)).toEqual(before.points.map((point) => point.key));
  });
});

test.describe('A2 pace curve: when the server or the network does not play along', () => {
  test('A2-N1 a failed load says so, offers another try, and the try works', async ({ browser, baseURL, guard }) => {
    guard.allow(/ERR_FAILED|Failed to load resource/);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.route('**/api/training/pace-curve**', (route) => route.abort());
    await page.goto(ROUTE);
    await expect(page.getByRole('alert')).toHaveText('Your pace curve could not be loaded.');
    await expect(table(page)).toHaveCount(0);

    await page.unroute('**/api/training/pace-curve**');
    await page.getByRole('button', { name: 'Try again' }).click();
    await openCurve(page);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('A2-N2 an answer the page cannot draw is a failed load, not a half-drawn page', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.route('**/api/training/pace-curve**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ today: '2026-10-10', points: [] }) }));
    await page.goto(ROUTE);
    await expect(page.getByRole('alert')).toHaveText('Your pace curve could not be loaded.');
  });

  test('A2-N3 a slow answer shows a busy page with a skeleton, never an empty one', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.route('**/api/training/pace-curve**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await page.goto(ROUTE);
    await expect(page.locator('.pace-curve-v2')).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('.pace-curve-v2').getByRole('status')).toHaveText('Reading your best efforts...');
    await expect(page.locator('.pace-curve-v2__skeleton')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'No best efforts here yet' })).toHaveCount(0);
    await expect(table(page)).toBeVisible({ timeout: 15_000 });
  });

  test('A2-N4 the API refuses a window that is not a whole number of days, and a missing or bad token', async () => {
    const bad = new Api(runner.api.baseUrl, null);
    expect((await bad.get('/api/training/pace-curve')).status).toBe(401);
    expect((await bad.get('/api/training/pace-curve', { token: 'not-a-token' })).status).toBe(401);
    for (const days of ['abc', '0', '-5', '3661', '1.5', '99999', '1e3', '%20x']) {
      const answer = await runner.api.get(`/api/training/pace-curve?days=${days}`);
      expect(answer.status, `days=${days}`).toBe(400);
      expect(answer.json.code, `days=${days}`).toBe('INVALID_RANGE');
    }
    for (const days of ['1', '180', '3660', 'all', 'ALL', '']) {
      expect((await runner.api.get(`/api/training/pace-curve?days=${days}`)).status, `days=${days}`).toBe(200);
    }
    expect((await runner.api.get('/api/training/pace-curve?days=')).json.days, 'a blank window is the default').toBe(180);
  });

  test('A2-N5 a signed-out visitor is sent to sign in, and another runner\'s efforts are never in yours', async ({ browser, baseURL, guard }) => {
    guard.allow(/status of 401/);
    const context = await browser.newContext({ baseURL });
    guard.watch(context);
    const anonymous = await context.newPage();
    await anonymous.goto(ROUTE);
    await expect(anonymous).toHaveURL(/\/login/);
    await context.close();

    const other = await newRunner('curve-other');
    const answer = await curveOf(other.api, '?days=all');
    expect(answer.points).toEqual([]);
    const sneaky = await other.api.get(`/api/training/pace-curve?days=all&runnerId=1&email=${encodeURIComponent(runner.email)}`);
    expect(sneaky.status).toBe(200);
    expect(sneaky.json.points).toEqual([]);
  });
});

test.describe('A2 pace curve: in other conditions', () => {
  test('A2-L1 in Chinese the page is translated and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(ROUTE);
    await expect(page.getByRole('heading', { level: 2, name: '配速曲线' })).toBeVisible();
    await expect(page.getByRole('table', { name: '这个范围内你在每个距离上的最快用时', exact: true })).toBeVisible();
    await expect(page).toHaveTitle('分析 | HermesRuns');
    await expectNoRawKeys(page);
    await expect(page.locator('.pace-curve-v2')).not.toContainText('Critical pace');
  });

  for (const theme of ['light', 'midnight']) {
    test(`A2-A1 the page is readable in the ${theme} theme and has no accessibility violations`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await openCurve(page);
      expect(await contrastProblems(page, { include: ['.pace-curve-v2'] }), `${theme}, contrast`).toEqual([]);
      expect(await a11yViolations(page, { include: ['.pace-curve-v2'] }), `${theme}, axe`).toEqual([]);
    });
  }

  test('A2-M2 @mobile on a phone the three tiles are the rows of one card, a number beside its name, and take under 340 px', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await page.setViewportSize({ width: 375, height: 812 });
    await openCurve(page);
    const box = await tiles(page).evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { height: rect.height, rows: Array.from(node.querySelectorAll('article')).map((article) => Math.round(article.getBoundingClientRect().top)) };
    });

    expect(box.height).toBeLessThan(340);
    expect(new Set(box.rows).size, 'three rows, one above the other').toBe(3);
    for (const index of [0, 1, 2]) {
      const parts = await tiles(page).locator('article').nth(index).evaluate((article) => ['span', 'strong', 'small'].map((tag) => Math.round((article.querySelector(tag) as HTMLElement).getBoundingClientRect().top)));
      expect(Math.abs(parts[0] - parts[1]), `row ${index}: the label and the number sit on one line`).toBeLessThan(14);
      expect(parts[2], `row ${index}: the explanation is under them`).toBeGreaterThan(parts[0]);
    }
    await expectNoHorizontalOverflow(page);
  });

  test('A2-M3 @mobile at 320 px with the text at 150% and 200% the name of a tile never runs into its number (BUG-053)', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await page.setViewportSize({ width: 320, height: 640 });
    await openCurve(page);
    for (const percent of [150, 200]) {
      await enlargeText(page, percent);
      expect(await readingsThatCollide(page, '.pace-curve-v2__tiles article'), `the three tiles at ${percent}%`).toEqual([]);
    }
  });

  test('A2-M1 @mobile the page fits a phone: the table scrolls inside its frame, the page does not', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, ROUTE);
    await page.setViewportSize({ width: 375, height: 812 });
    await openCurve(page);
    await expectNoHorizontalOverflow(page);
    const frame = await page.locator('.pace-curve-v2__table-wrap').evaluate((node) => ({ scroll: node.scrollWidth, client: node.clientWidth }));
    expect(frame.scroll, 'the table is wider than its frame and scrolls there').toBeGreaterThan(frame.client);
    const svg = await plot(page).locator('svg').evaluate((node) => node.getBoundingClientRect().width);
    expect(svg, 'the chart is not wider than the screen').toBeLessThanOrEqual(375);
  });
});
