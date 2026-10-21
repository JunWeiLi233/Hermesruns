// A1 Time in zones, the card on Analysis > Load balance that came out of the Runalyze review: where each week's running time went by
// heart-rate zone, in three bands (zones 1 to 3, zone 4, zone 5), with the Polarization Index and a name for the spread.
//
// The numbers on the page are checked against the API and against arithmetic done again here from the runs' own moving time, so a
// card that drew the wrong share, or a model that drifted from its own documentation (docs/README-ANALYSIS.md, "Time in Zones and
// the Intensity Distribution"), fails. Case numbers are the rows of replica/runalyze/test-plan.md.
import type { Locator, Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { importRunSpecs, secondsOf, sharedRunner, zoneTime, type RunSpec } from '../fixtures/analysis.ts';
import { addDays, shortDay, utcDay, weekStartOf } from '../fixtures/format.ts';
import { gpxRun } from '../fixtures/gpx.ts';
import { waitForEffort } from '../fixtures/history.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { a11yViolations, contrastProblems, expect, expectNoHorizontalOverflow, expectNoRawKeys, test } from '../fixtures/test.ts';

const ROUTE = '/analysis/load-balance';
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

type Band = 'low' | 'moderate' | 'high';

// A week of the plan: four easy runs of 40 minutes at heart rate 125 (zones 1 to 3), 10 minutes at 165 (zone 4) and 30 minutes at
// 186 (zone 5): 160, 10 and 30 minutes of 200, the spread the methods doc works through (0.80, 0.05, 0.15; the index is log10(240)).
// A held heart rate of 125, 165 or 186 is in the same zone whatever the runner's highest heart rate is between 186 and 190.
const PLAN: Array<{ day: number; band: Band; km: number; pace: number; hr: number }> = [
  { day: 1, band: 'low', km: 6.667, pace: 360, hr: 125 },
  { day: 2, band: 'low', km: 6.667, pace: 360, hr: 125 },
  { day: 3, band: 'moderate', km: 2, pace: 300, hr: 165 },
  { day: 4, band: 'low', km: 6.667, pace: 360, hr: 125 },
  { day: 5, band: 'high', km: 6, pace: 300, hr: 186 },
  { day: 6, band: 'low', km: 6.667, pace: 360, hr: 125 },
];
const WEEKS = 3;

const planRuns = (): RunSpec[] =>
  Array.from({ length: WEEKS }, (_, week) => PLAN.map((item) => ({ ...item, week }))).flat().map((item) => ({
    name: `E2E zones ${item.band} ${item.week * 7 + item.day} days ago`,
    daysBack: item.week * 7 + item.day,
    km: item.km,
    pace: item.pace,
    hr: item.hr,
  }));

interface IntensityWeek {
  start: string;
  end: string;
  complete: boolean;
  runs: number;
  runsWithHeartRate: number;
  zoneSeconds: number[];
  coveredSeconds: number;
}

interface Intensity {
  today: string;
  timeZone: string;
  lowZones: number;
  minRuns: number;
  minCoveredSeconds: number;
  weeks: IntensityWeek[];
  summary: { runs: number; runsWithHeartRate: number; coveredSeconds: number; zoneSeconds: number[]; shares: { low: number; moderate: number; high: number } | null; polarizationIndex: number | null; pattern: string };
  pendingRuns: number;
}

const intensityOf = async (api: Api, query = ''): Promise<Intensity> => (await api.get(`/api/training/intensity${query}`)).json;

const card = (page: Page): Locator => page.getByRole('region', { name: 'Time in zones', exact: true });
const bands = (page: Page): Locator => card(page).getByRole('region', { name: 'The share of heart-rate time in zones 1 to 3, zone 4 and zone 5' });
const chart = (page: Page): Locator => card(page).getByRole('slider');
const history = (page: Page): Locator => card(page).locator('table[data-analysis-history="intensity"]');

/** "10 h 0 min" or "45 min": how the sentence writes a time. */
function inWords(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

const bandSeconds = (zones: number[]): Record<Band, number> => ({
  low: zones[0] + zones[1] + zones[2],
  moderate: zones[3],
  high: zones[4],
});

let polarized: Awaited<ReturnType<typeof sharedRunner<{ seconds: Record<Band, number>; runs: number }>>>;

test.beforeAll(async () => {
  test.setTimeout(480_000);
  polarized = await sharedRunner('zones', async ({ api }) => {
    await importRunSpecs(api, planRuns());
    // What each run is worth, from the runs' own moving time: the arithmetic the card is checked against.
    const rows = (await api.get('/api/activities/analysis')).json as Array<{ name: string; movingTimeSeconds: number }>;
    const seconds: Record<Band, number> = { low: 0, moderate: 0, high: 0 };
    for (const row of rows) seconds[/E2E zones (low|moderate|high)/.exec(row.name)![1] as Band] += row.movingTimeSeconds;
    return { seconds, runs: rows.length };
  });
});

async function openCard(page: Page): Promise<void> {
  await expect(card(page)).toBeVisible();
  await expect(chart(page)).toBeVisible();
}

test.describe('A1 time in zones: what the card says', () => {
  test('A1-H1 the three bands, the name of the spread and the index are the runs\' own arithmetic', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, polarized, ROUTE);
    await openCard(page);
    const { seconds, runs } = polarized.meta;
    const total = seconds.low + seconds.moderate + seconds.high;
    const shares = { low: seconds.low / total, moderate: seconds.moderate / total, high: seconds.high / total };
    expect(runs).toBe(WEEKS * PLAN.length);

    // 80 / 5 / 15 of the time, each band with its time under the percentage.
    const tiles = bands(page).locator('article');
    await expect(tiles).toHaveCount(3);
    await expect(tiles.nth(0).locator('span')).toHaveText('Zones 1–3');
    await expect(tiles.nth(1).locator('span')).toHaveText('Zone 4');
    await expect(tiles.nth(2).locator('span')).toHaveText('Zone 5');
    await expect(tiles.locator('strong')).toHaveText([`${Math.round(shares.low * 100)}%`, `${Math.round(shares.moderate * 100)}%`, `${Math.round(shares.high * 100)}%`]);
    // A run's zones add up to its moving time and up to four seconds more: the last sample takes the gap before it (HrZoneAnalysis).
    const runsIn: Record<Band, number> = { low: 0, moderate: 0, high: 0 };
    for (const item of PLAN) runsIn[item.band] += WEEKS;
    for (const [index, band] of (['low', 'moderate', 'high'] as const).entries()) {
      const shown = secondsOf(await tiles.nth(index).locator('em').innerText());
      expect(shown - seconds[band], `${band} time shown ${shown} s, the runs add up to ${seconds[band]} s`).toBeGreaterThanOrEqual(-runsIn[band]);
      expect(shown - seconds[band], `${band} time shown ${shown} s, the runs add up to ${seconds[band]} s`).toBeLessThanOrEqual(4 * runsIn[band]);
    }

    // The name of the spread and the index: log10((low / moderate) x high x 100), worked out again from the shares.
    await expect(card(page).locator('.analysis-load-v2-zone')).toHaveText('Polarized');
    await expect(card(page)).toContainText('a polarized spread');
    const index = Math.log10((shares.low / shares.moderate) * shares.high * 100);
    const line = await card(page).getByText(/^Polarization index \d/).innerText();
    expect(Number(/Polarization index (\d+\.\d+)/.exec(line)![1])).toBeCloseTo(index, 1);
    expect(index).toBeGreaterThan(2);
    await expect(card(page)).toContainText('20% of the time is above zone 3. About 20% is a common rule of thumb (80/20)');

    // The sentence over all the weeks.
    const covered = (await intensityOf(polarized.api)).summary.coveredSeconds;
    expect(covered - total, 'the total is the moving time of the runs, give or take the last sample of each').toBeLessThanOrEqual(4 * runs);
    await expect(card(page)).toContainText(`These weeks hold ${inWords(covered)} of heart-rate time. Runs with a heart rate: ${runs} of ${runs}.`);
  });

  test('A1-H2 each week of the list is the API\'s, the API\'s weeks run Monday to Sunday, and they add up to the runs', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, polarized, ROUTE);
    await openCard(page);
    const data = await intensityOf(polarized.api);
    expect(data.summary.pattern).toBe('polarized');
    expect(data.lowZones).toBe(3);

    // Monday to Sunday, one after the other, the last one still going.
    for (const [index, week] of data.weeks.entries()) {
      expect(new Date(`${week.start}T12:00:00Z`).getUTCDay(), `${week.start} is a Monday`).toBe(1);
      expect(week.end).toBe(addDays(week.start, 6));
      if (index > 0) expect(week.start).toBe(addDays(data.weeks[index - 1].start, 7));
      expect(week.complete).toBe(week.end < data.today);
      expect(week.coveredSeconds, 'a week adds up to its zones').toBe(week.zoneSeconds.reduce((sum, value) => sum + value, 0));
    }
    expect(data.weeks.at(-1)?.complete).toBe(false);
    expect(data.weeks.reduce((sum, week) => sum + week.runs, 0)).toBe(polarized.meta.runs);
    expect(data.summary.zoneSeconds).toEqual([0, 1, 2, 3, 4].map((zone) => data.weeks.reduce((sum, week) => sum + week.zoneSeconds[zone], 0)));

    // What the screen-reader list says is what the API says, week by week and zone by zone.
    const rows = history(page).locator('tbody tr');
    await expect(rows).toHaveCount(data.weeks.length);
    for (const [index, week] of data.weeks.entries()) {
      const cells = rows.nth(index).locator('th, td');
      await expect(cells.nth(0)).toHaveText(shortDay(week.start));
      await expect(cells.nth(1)).toHaveText(`${week.runsWithHeartRate} of ${week.runs}`);
      for (let zone = 0; zone < 5; zone += 1) await expect(cells.nth(2 + zone)).toHaveText(zoneTime(week.zoneSeconds[zone]));
    }
    // Zones 1 and 5 hold only what the heart rates put there: nothing in zone 1, the hard run in zone 5.
    expect(data.summary.zoneSeconds[0]).toBe(0);
    const { moderate, high } = bandSeconds(data.summary.zoneSeconds);
    expect(Math.abs(moderate - polarized.meta.seconds.moderate)).toBeLessThanOrEqual(WEEKS * 3);
    expect(Math.abs(high - polarized.meta.seconds.high)).toBeLessThanOrEqual(WEEKS * 3);
  });

  test('A1-H3 the week still going is drawn open, the rest closed, and the chart names the unit it is in', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, polarized, ROUTE);
    await openCard(page);
    const data = await intensityOf(polarized.api);

    await expect(card(page).locator('.training-intensity-v2__bar')).toHaveCount(data.weeks.length);
    await expect(card(page).locator('.training-intensity-v2__bar.is-open')).toHaveCount(data.weeks.filter((week) => !week.complete).length);
    await expect(card(page).locator('.training-intensity-v2__bar.is-current')).toHaveCount(1);
    // A week of 3.3 hours is drawn in hours, a week of 20 minutes would be drawn in minutes.
    await expect(chart(page)).toHaveAccessibleName(/^Time in each heart-rate zone, week by week, in hours\./);
    await expect(card(page)).toContainText('Hours of heart-rate time a week');
    // A bar is made of the zones that hold time: zones 3, 4 and 5 here, never an empty one.
    await expect(card(page).locator('.training-intensity-v2__segment.is-zone-1')).toHaveCount(0);
    await expect(card(page).locator('.training-intensity-v2__segment.is-zone-5').first()).toBeVisible();
  });
});

test.describe('A1 time in zones: runs that do not fit the usual picture', () => {
  test('A1-E1 the card names the time zone the weeks are counted in: UTC when the runner set none', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, polarized, ROUTE);
    await openCard(page);

    // The API says "Z" for a runner with no zone (that is what UTC is called in an offset); a person reads UTC.
    expect((await intensityOf(polarized.api)).timeZone).toBe('Z');
    await expect(card(page)).toContainText('Weeks run Monday to Sunday in your time zone (UTC).');
    await expect(card(page)).not.toContainText('(Z)');
  });

  test('A1-E2 a week starts on the Monday of the runner\'s own calendar: a Sunday-night run belongs to the next week in Auckland', async ({ browser, baseURL, guard }) => {
    // The last Sunday at least three days ago, and a run at 22:00 UTC that evening: Monday 10:00 or 11:00 in Auckland.
    let sundayBack = 3;
    while (new Date(`${utcDay(sundayBack)}T12:00:00Z`).getUTCDay() !== 0) sundayBack += 1;
    const sunday = utcDay(sundayBack);
    const run: RunSpec = { name: 'E2E zones Sunday night', daysBack: sundayBack, km: 6.667, pace: 360, hr: 125, hourUtc: 22 };

    const auckland = await newRunner('zones-auckland');
    expect((await auckland.api.patch('/api/profile/me/time-zone', { timeZone: 'Pacific/Auckland' })).status).toBe(200);
    await importRunSpecs(auckland.api, [run]);
    const utc = await newRunner('zones-utc');
    await importRunSpecs(utc.api, [run]);

    const inAuckland = await intensityOf(auckland.api);
    const inUtc = await intensityOf(utc.api);
    expect(inAuckland.timeZone).toBe('Pacific/Auckland');
    expect(inUtc.weeks.filter((week) => week.runs > 0).map((week) => week.start), 'UTC: the run is in the week that ends that Sunday').toEqual([weekStartOf(sunday)]);
    expect(inAuckland.weeks.filter((week) => week.runs > 0).map((week) => week.start), 'Auckland: it is already Monday').toEqual([addDays(weekStartOf(sunday), 7)]);

    // And the card says which zone the weeks are counted in.
    const page = await pages.open(browser, baseURL, guard, { token: auckland.api.token as string, email: auckland.email }, ROUTE);
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText('Weeks run Monday to Sunday in your time zone (Pacific/Auckland).');
  });

  test('A1-E8 a week across a daylight-saving change: runs are counted on the dates the runner\'s clock had, not a fixed offset', async () => {
    // New Zealand put its clocks forward at 02:00 on Sunday 27 September 2026 (UTC+12 to UTC+13). Four runs around the change, in UTC:
    //   Sat 26 Sep 13:30 is Sun 27 Sep 01:30 NZST (before the change)   the week of Monday 21 Sep
    //   Sat 26 Sep 14:30 is Sun 27 Sep 03:30 NZDT (after it)            the week of Monday 21 Sep
    //   Sun 27 Sep 10:59 is Sun 27 Sep 23:59 NZDT                       the week of Monday 21 Sep
    //   Sun 27 Sep 11:01 is Mon 28 Sep 00:01 NZDT, the next week        the week of Monday 28 Sep
    // A clock fixed at UTC+12 would put the last two on Sunday evening, in the same week. The dates are absolute: the case holds while
    // the runner's weeks reach back to them (the API is asked for 52).
    const made = await newRunner('zones-dst');
    expect((await made.api.patch('/api/profile/me/time-zone', { timeZone: 'Pacific/Auckland' })).status).toBe(200);
    for (const [index, start] of ['2026-09-26T13:30:00Z', '2026-09-26T14:30:00Z', '2026-09-27T10:59:00Z', '2026-09-27T11:01:00Z'].entries()) {
      await made.api.importRun(`dst-${index}.gpx`, gpxRun({ name: `E2E zones dst ${index}`, start: new Date(start), distanceM: 4000, pace: 360, hr: 125, shape: 'line' }));
    }
    await waitForEffort(made.api, 4);
    const data = await intensityOf(made.api, '?weeks=52');
    expect(data.timeZone).toBe('Pacific/Auckland');
    expect(data.weeks.filter((week) => week.runs > 0).map((week) => [week.start, week.runs])).toEqual([['2026-09-21', 3], ['2026-09-28', 1]]);
  });

  test('A1-E3 a runner with no runs gets a sentence, not a chart', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('zones-none');
    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText('No run has been analysed yet, so there is no time in zones to show.');
    await expect(chart(page)).toHaveCount(0);
    await expect(bands(page)).toHaveCount(0);
    expect((await intensityOf(made.api)).summary).toMatchObject({ runs: 0, pattern: 'insufficient', shares: null, polarizationIndex: null });
  });

  test('A1-E4 runs with no heart rate add no time and the card says why there is none', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('zones-no-hr');
    await importRunSpecs(made.api, [
      { name: 'E2E zones watchless 2', daysBack: 2, km: 6, pace: 360, hr: null },
      { name: 'E2E zones watchless 4', daysBack: 4, km: 6, pace: 360, hr: null },
    ]);
    const data = await intensityOf(made.api);
    expect(data.summary).toMatchObject({ runs: 2, runsWithHeartRate: 0, coveredSeconds: 0, pattern: 'insufficient' });

    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await expect(card(page)).toContainText('None of your runs in these weeks has heart-rate data, so there is no time in zones to show.');
    await expect(chart(page)).toHaveCount(0);
  });

  test('A1-E5 a few runs with a heart rate are not enough for a name, and a run without one is counted as such', async ({ browser, baseURL, guard }) => {
    const made = await newRunner('zones-few');
    await importRunSpecs(made.api, [
      { name: 'E2E zones few 1', daysBack: 1, km: 6.667, pace: 360, hr: 125 },
      { name: 'E2E zones few 3', daysBack: 3, km: 6.667, pace: 360, hr: 125 },
      { name: 'E2E zones few 5', daysBack: 5, km: 6, pace: 360, hr: null },
    ]);
    const page = await pages.open(browser, baseURL, guard, { token: made.api.token as string, email: made.email }, ROUTE);
    await openCard(page);

    await expect(card(page).locator('.analysis-load-v2-zone')).toHaveText('Not enough yet');
    await expect(card(page)).toContainText('A pattern needs at least 3 runs with a heart rate and 60 minutes of heart-rate time.');
    await expect(card(page)).toContainText('Runs with a heart rate: 2 of 3.');
    await expect(card(page)).toContainText('1 run in these weeks has no heart-rate data and adds no time.');
    // No index, no 80/20 line: there is no pattern to measure.
    await expect(card(page)).not.toContainText('Polarization index');
  });

  test('A1-E6 the keyboard walks the weeks: arrows, Home, End and Escape', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, polarized, ROUTE);
    await openCard(page);
    const data = await intensityOf(polarized.api);
    const last = data.weeks.length - 1;
    const slider = chart(page);

    await expect(slider).toHaveAttribute('aria-valuemin', '0');
    await expect(slider).toHaveAttribute('aria-valuemax', String(last));
    await expect(slider).toHaveAttribute('aria-valuenow', String(last));
    await slider.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(slider).toHaveAttribute('aria-valuenow', String(last - 1));
    const earlier = data.weeks[last - 1];
    await expect(slider).toHaveAttribute('aria-valuetext', new RegExp(`^Week of ${shortDay(earlier.start)}: .+ of heart-rate time, \\d+% in zones 1 to 3, \\d+% in zone 4, \\d+% in zone 5$`));
    await page.keyboard.press('Home');
    await expect(slider).toHaveAttribute('aria-valuenow', '0');
    await page.keyboard.press('ArrowLeft');
    await expect(slider, 'the first week is the end of the line').toHaveAttribute('aria-valuenow', '0');
    await expect(card(page).locator('.analysis-fit-v2-tooltip')).toContainText(`Week of ${shortDay(data.weeks[0].start)}`);
    await page.keyboard.press('End');
    await expect(slider).toHaveAttribute('aria-valuenow', String(last));
    await page.keyboard.press('Escape');
    await expect(card(page).locator('.analysis-fit-v2-tooltip')).toHaveCount(0);
  });

  test('A1-E7 the pointer reads a week: the tooltip lists the five zones and the runs with a heart rate', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, polarized, ROUTE);
    await openCard(page);
    const data = await intensityOf(polarized.api);
    await chart(page).hover({ position: { x: (await chart(page).evaluate((node) => node.getBoundingClientRect().width)) * 0.5, y: 100 } });
    const tip = card(page).locator('.analysis-fit-v2-tooltip');
    await expect(tip).toBeVisible();
    await expect(tip.locator('i')).toHaveCount(5);
    await expect(tip).toContainText('Heart-rate time');
    await expect(tip).toContainText(/Runs with a heart rate: \d of \d/);
    // Whatever week the pointer is over, the readout belongs to a week the API lists.
    const title = await tip.locator('time').innerText();
    expect(data.weeks.map((week) => `Week of ${shortDay(week.start)}`)).toContain(title);
    await page.mouse.move(2, 2);
    await expect(tip).toHaveCount(0);
  });
});

test.describe('A1 time in zones: when the server or the network does not play along', () => {
  test('A1-N1 a failed load says so, offers another try, and the try works', async ({ browser, baseURL, guard }) => {
    guard.allow(/ERR_FAILED|Failed to load resource/);
    const page = await pages.open(browser, baseURL, guard, polarized, null);
    await page.route('**/api/training/intensity**', (route) => route.abort());
    await page.goto(ROUTE);
    await expect(card(page).getByRole('alert')).toHaveText('Your time in zones could not be loaded.');
    await expect(chart(page)).toHaveCount(0);

    await page.unroute('**/api/training/intensity**');
    await card(page).getByRole('button', { name: 'Try again' }).click();
    await expect(chart(page)).toBeVisible();
    await expect(card(page).getByRole('alert')).toHaveCount(0);
  });

  test('A1-N2 a server error is the same as a lost connection: a sentence and a way to try again', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|Failed to load resource/);
    const page = await pages.open(browser, baseURL, guard, polarized, null);
    await page.route('**/api/training/intensity**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }));
    await page.goto(ROUTE);
    await expect(card(page).getByRole('alert')).toHaveText('Your time in zones could not be loaded.');
    await expect(card(page).getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('A1-N3 a slow answer shows a busy card, not an empty or a broken one', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, polarized, null);
    await page.route('**/api/training/intensity**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await page.goto(ROUTE);
    await expect(card(page)).toHaveAttribute('aria-busy', 'true');
    await expect(card(page).getByRole('status')).toHaveText('Adding up your zones...');
    await expect(card(page)).not.toContainText('No run has been analysed yet');
    await expect(chart(page)).toBeVisible({ timeout: 15_000 });
    await expect(card(page)).not.toHaveAttribute('aria-busy', 'true');
  });

  test('A1-N4 a signed-out visitor never sees it, and the API refuses without a token or with an odd number of weeks', async ({ browser, baseURL, guard }) => {
    guard.allow(/status of 401/);
    const bad = new Api(polarized.api.baseUrl, null);
    expect((await bad.get('/api/training/intensity')).status).toBe(401);
    expect((await bad.get('/api/training/intensity', { token: 'not-a-token' })).status).toBe(401);
    for (const weeks of ['0', '-3', 'abc', '53', '1.5']) {
      const answer = await polarized.api.get(`/api/training/intensity?weeks=${weeks}`);
      expect(answer.status, `weeks=${weeks}`).toBe(400);
    }
    expect((await polarized.api.get('/api/training/intensity?weeks=1')).json.weeks.length).toBeLessThanOrEqual(2);
    expect((await polarized.api.get('/api/training/intensity?weeks=52')).status).toBe(200);

    const context = await browser.newContext({ baseURL });
    guard.watch(context);
    const page = await context.newPage();
    await page.goto(ROUTE);
    await expect(page).toHaveURL(/\/login/);
    await expect(card(page)).toHaveCount(0);
    await context.close();
  });

  test('A1-N5 another runner\'s weeks are never in yours', async ({ browser, baseURL, guard }) => {
    const other = await newRunner('zones-other');
    expect((await intensityOf(other.api)).summary.runs).toBe(0);
    const page = await pages.open(browser, baseURL, guard, { token: other.api.token as string, email: other.email }, ROUTE);
    await expect(card(page)).toContainText('No run has been analysed yet');
    await expect(card(page)).not.toContainText('Polarized');
    // The same call with the other runner's token is the other runner's data, never a parameter that picks someone.
    const sneaky = await other.api.get(`/api/training/intensity?runnerId=1&email=${encodeURIComponent(polarized.email)}`);
    expect(sneaky.status).toBe(200);
    expect(sneaky.json.summary.runs).toBe(0);
  });
});

test.describe('A1 time in zones: in other conditions', () => {
  test('A1-L1 in Chinese the card is translated and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, polarized, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(ROUTE);
    const zh = page.locator('#load-intensity');
    await expect(zh).toBeVisible();
    await expect(zh.getByRole('slider')).toBeVisible();
    await expect(zh.locator('h2')).not.toHaveText('Time in zones');
    await expect(zh).not.toContainText('Polarization index');
    await expectNoRawKeys(page);
  });

  for (const theme of ['light', 'midnight']) {
    test(`A1-A1 the card is readable in the ${theme} theme and has no accessibility violations`, async ({ browser, baseURL, guard }) => {
      const page = await pages.open(browser, baseURL, guard, polarized, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await page.goto(ROUTE);
      await openCard(page);
      expect(await contrastProblems(page, { include: ['#load-intensity'] }), `${theme}, contrast`).toEqual([]);
      expect(await a11yViolations(page, { include: ['#load-intensity'] }), `${theme}, axe`).toEqual([]);
    });
  }

  test('A1-M1 @mobile the card fits a phone: the page does not scroll sideways and the bands are read in turn', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, polarized, ROUTE);
    await page.setViewportSize({ width: 375, height: 812 });
    await openCard(page);
    await expectNoHorizontalOverflow(page);
    // What can be seen: the list kept for screen readers is clipped to nothing and its box does not count.
    const widest = await card(page).evaluate((node) => Math.max(...Array.from(node.querySelectorAll('*')).filter((child) => !child.closest('.sr-only')).map((child) => child.getBoundingClientRect().right)) - node.getBoundingClientRect().left);
    const own = await card(page).evaluate((node) => node.getBoundingClientRect().width);
    expect(widest, 'nothing inside the card sticks out of it').toBeLessThanOrEqual(own + 1);
    await expect(bands(page).locator('article')).toHaveCount(3);
  });
});
