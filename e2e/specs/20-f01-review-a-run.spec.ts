// F01 Review a run after it uploads.
// Recon path: Training log -> Overview -> Pace analysis -> Heart rate -> Effort -> Matched runs.
// In HermesRuns: Runs list -> run page -> Pace analysis, Effort, Heart-rate zones, Best efforts, Same-route runs, Splits.
// Case numbers are the ones in replica/test-plan.md.
import type { Locator, Page } from '@playwright/test';
import { Api } from '../fixtures/api.ts';
import { daysAgo } from '../fixtures/gpx.ts';
import { gradeAdjustedPace, hms, mmss, pacePerKm, shortDate, toSeconds } from '../fixtures/format.ts';
import { contextFor, expect, openRun, readSeed, signedIn, test } from '../fixtures/test.ts';

test.use({ storageState: signedIn('a') });

const region = (page: Page, name: string): Locator => page.getByRole('region', { name, exact: true });
const paceCard = (page: Page) => region(page, 'Pace analysis');
const effortCard = (page: Page) => region(page, 'Effort');
const zonesCard = (page: Page) => region(page, 'Heart-rate zones');
const effortsCard = (page: Page) => region(page, 'Best efforts');
const routeCard = (page: Page) => region(page, 'Same-route runs');
/** The text of the <dd> after the <dt> that starts with `term`. */
const definition = (card: Locator, term: string): Locator => card.locator(`dt:has-text("${term}") + dd`);

test.describe('F01 happy path: the cards of one run', () => {
  test('F01-H1 open a run from the Runs list: the headline numbers are the ones the file holds', async ({ page, seed }) => {
    await page.goto('/runs');
    await page.getByRole('textbox', { name: 'Search runs by name...' }).fill('E2E Hill intervals');
    const row = page.getByRole('button', { name: /E2E Hill intervals/ }).first();
    await expect(row).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/runs/${seed.ids.hills}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'E2E Hill intervals' })).toBeVisible();
    // 8 km loop built as 7.99 km of readings, 41:00 on the clock with a one-minute stop, 5:08 /km counting the stop.
    const stats = page.locator('main');
    await expect(stats).toContainText('7.99');
    await expect(stats).toContainText('5:08');
    await expect(stats).toContainText('41:00');
    await expect(stats).toContainText('120'); // metres climbed: four 30 m hills
    await expect(stats).toContainText('172'); // cadence
  });

  test('F01-H2 the run page navigation takes you to each card', async ({ page }) => {
    await openRun(page, 'hills');
    const nav = page.getByRole('navigation', { name: 'Run detail navigation' });
    const targets: Array<[string, string]> = [
      ['Pace', 'Pace analysis'],
      ['Effort and zones', 'Effort'],
      ['Best efforts', 'Best efforts'],
      ['Same route', 'Same-route runs'],
      ['Splits', 'Splits'],
    ];
    for (const [link, heading] of targets) {
      await nav.getByRole('link', { name: link, exact: true }).click();
      await expect(page.getByRole('heading', { level: 2, name: heading, exact: true })).toBeInViewport();
    }
  });

  test('F01-H3 Pace analysis: splits, fastest, slowest and average match the pace the file was built with', async ({ page, api }) => {
    const id = await openRun(page, 'hills');
    const card = paceCard(page);
    await expect(card.getByRole('button', { name: 'Splits' })).toHaveAttribute('aria-pressed', 'true');
    // The file alternates 4:30 and 5:30 kilometres; the fourth one holds a one-minute stop on top of the 5:30 pace.
    await expect(definition(card, 'Fastest')).toHaveText('4:30 /km');
    await expect(card.locator('dt:has-text("Fastest")')).toContainText('km 1');
    await expect(definition(card, 'Slowest')).toHaveText(/5:3[0-9] \/km/); // moving pace, the stop is left out
    await expect(card.locator('dt:has-text("Slowest")')).toContainText('km 4');
    await expect(card).toContainText('Standing still: 0:55');
    await expect(card).toContainText('the average pace is 5:08 /km');

    // The card shows what the server worked out.
    const profile = (await api.get(`/api/activities/${id}/pace-profile`)).json;
    await expect(definition(card, 'Average')).toHaveText(pacePerKm(profile.summary.paceSecPerKm));
  });

  test('F01-H4 Pace analysis: Smoothed view and the Grade adjusted switch', async ({ page }) => {
    await openRun(page, 'hills');
    const card = paceCard(page);
    await card.getByRole('button', { name: 'Smoothed' }).click();
    await expect(card.getByRole('button', { name: 'Smoothed' })).toHaveAttribute('aria-pressed', 'true');
    await expect(card.getByRole('button', { name: 'Splits' })).toHaveAttribute('aria-pressed', 'false');
    await expect(card.getByRole('group', { name: /Pace along the run/ })).toBeVisible();

    await card.getByRole('button', { name: 'Splits' }).click();
    const toggle = card.getByRole('switch', { name: 'Grade adjusted' });
    await expect(toggle).toBeEnabled();
    await toggle.click();
    await expect(toggle).toBeChecked();
    await expect(card).toContainText('Counted on grade-adjusted pace');
    // Kilometre 1 climbs 30 m (3 %): the documented cost curve turns 4:30.3 into about 4:05.
    const expected = gradeAdjustedPace(270.3, 0.03);
    const shown = toSeconds((await definition(card, 'Fastest').innerText()).replace(' /km', ''));
    expect(Math.abs(shown - expected), `fastest grade-adjusted pace ${mmss(shown)} vs ${mmss(expected)}`).toBeLessThanOrEqual(3);
    // Kilometre 2 drops 30 m: the adjusted pace is slower than the pace actually run, not faster.
    await expect(card.locator('dt:has-text("Slowest")')).toContainText(/km [2468]/);
  });

  test('F01-H5 Pace analysis: time at each pace adds up to the moving time', async ({ page, api }) => {
    const id = await openRun(page, 'hills');
    const items = paceCard(page).getByRole('heading', { name: 'Time at each pace' }).locator('xpath=following-sibling::ul[1]/li');
    await expect(items).toHaveCount(6);
    let seconds = 0;
    let percent = 0;
    for (const item of await items.all()) {
      const text = (await item.innerText()).replace(/\s+/g, ' ');
      const time = text.match(/(\d+:\d\d(?::\d\d)?)\s+(<?\d+)%/);
      if (time) {
        seconds += toSeconds(time[1]);
        percent += time[2].startsWith('<') ? 0.5 : Number(time[2]);
      }
    }
    const summary = (await api.get(`/api/activities/${id}/pace-profile`)).json.summary;
    // The zones are counted on the smoothed line, so a stop leaks a few seconds of blended pace into the slowest zone:
    // the total may run a little over the moving time, never over the clock time.
    expect(seconds, `zone times add to ${seconds}s, moving time is ${summary.movingSeconds}s`).toBeGreaterThanOrEqual(summary.movingSeconds - 6);
    expect(seconds, `zone times add to ${seconds}s, clock time is ${summary.elapsedSeconds}s`).toBeLessThanOrEqual(summary.elapsedSeconds + 6);
    expect(percent).toBeGreaterThanOrEqual(98);
    expect(percent).toBeLessThanOrEqual(102);
  });

  test('F01-H6 Effort and Heart-rate zones for a run with a heart-rate stream', async ({ page }) => {
    await openRun(page, 'hills');
    // 22:05 in zone 3 (134-153) and 18:59 in zone 4 (154-172), max heart rate 192: (22.08 x 3 + 18.98 x 4) = 142.
    await expect(effortCard(page)).toContainText('142');
    await expect(effortCard(page)).toContainText('From your heart-rate zones');
    const zones = zonesCard(page);
    await expect(zones.getByRole('listitem').filter({ hasText: 'Zone 3 · Steady' })).toContainText('134–153 bpm');
    await expect(zones.getByRole('listitem').filter({ hasText: 'Zone 3 · Steady' })).toContainText('22:05');
    await expect(zones.getByRole('listitem').filter({ hasText: 'Zone 3 · Steady' })).toContainText('54%');
    await expect(zones.getByRole('listitem').filter({ hasText: 'Zone 4 · Hard' })).toContainText('154–172 bpm');
    await expect(zones.getByRole('listitem').filter({ hasText: 'Zone 4 · Hard' })).toContainText('18:59');
    await expect(zones.getByRole('listitem').filter({ hasText: 'Zone 4 · Hard' })).toContainText('46%');
    await expect(zones).toContainText('max heart rate of 192 bpm');
    await expect(zones).toContainText('covers 100% of this run');
    await expect(zones.getByRole('link', { name: 'Edit zones' })).toHaveAttribute('href', '/settings?section=training');
  });

  test('F01-H7 Effort card links to Load balance, which says the two scales differ', async ({ page }) => {
    await openRun(page, 'hills');
    await effortCard(page).getByRole('link', { name: 'Open Load balance' }).click();
    await expect(page).toHaveURL(/\/analysis\/load-balance$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('F01-H8 Best efforts: each row is a measured stretch of the run, in order of distance', async ({ page, api, seed }) => {
    await openRun(page, 'fast10k');
    const rows = effortsCard(page).getByRole('row').filter({ has: page.getByRole('rowheader') });
    const server = (await api.get(`/api/activities/${seed.ids.fast10k}/best-efforts`)).json.efforts as Array<{
      distanceKey: string;
      distanceMeters: number;
      elapsedSeconds: number;
      paceSecPerKm: number;
    }>;
    // 400 m, half a mile, 1 km, 1 mile, 3 km, 2 miles, 5 km and 10 km: every distance the run is long enough for.
    await expect(rows).toHaveCount(server.length);
    expect(server.map((effort) => effort.distanceKey)).toEqual(['400m', 'half_mile', '1km', '1mile', '3km', '2mile', '5km', '10km']);
    let lastMetres = 0;
    let lastSeconds = 0;
    for (const effort of server.filter((entry) => entry.distanceMeters <= 10000 && entry.distanceMeters > 0)) {
      expect(effort.distanceMeters).toBeGreaterThan(lastMetres);
      expect(effort.elapsedSeconds, `${effort.distanceKey} takes longer than the shorter distance before it`).toBeGreaterThan(lastSeconds);
      // Time = distance x pace, to the second the app rounds to.
      expect(Math.abs(effort.elapsedSeconds - (effort.distanceMeters / 1000) * effort.paceSecPerKm)).toBeLessThanOrEqual(1.5);
      lastMetres = effort.distanceMeters;
      lastSeconds = effort.elapsedSeconds;
    }
    // The second half was run at 4:30 /km, so the fastest 5 km is that half: 22:30 on the clock, a little more because the
    // readings add up to 4.99 km, and it starts at the turn (25:00 in, give or take the same shortfall).
    const fiveK = server.find((effort) => effort.distanceKey === '5km') as (typeof server)[number] & { startOffsetSeconds: number };
    expect(Math.abs(fiveK.elapsedSeconds - 1350)).toBeLessThanOrEqual(5);
    expect(Math.abs(fiveK.startOffsetSeconds - 1500)).toBeLessThanOrEqual(10);
    await expect(effortsCard(page).getByRole('row', { name: new RegExp(`^5 km from ${mmss(fiveK.startOffsetSeconds)}`) })).toContainText(mmss(fiveK.elapsedSeconds));
  });

  test('F01-H9 Best efforts: type a chip time, see it marked Edited, go back to the measured time', async ({ page }) => {
    await openRun(page, 'flat');
    const card = effortsCard(page);
    const row = card.getByRole('row', { name: /^1 km from/ });
    const measured = (await row.getByRole('cell').nth(0).innerText()).trim();
    try {
      await card.getByRole('button', { name: 'Edit the time for 1 km' }).click();
      await card.getByRole('textbox', { name: 'Time for 1 km' }).fill('5:00');
      await card.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(card.getByRole('status')).toContainText('Time saved.');
      await expect(row).toContainText('5:00');
      await expect(row).toContainText('Edited');
      await expect(row).toContainText(`Measured ${measured}`);
      await page.reload();
      await expect(effortsCard(page).getByRole('row', { name: /^1 km from/ })).toContainText('Edited');
    } finally {
      await page.goto(page.url());
      await expect(effortsCard(page).getByRole('table')).toBeVisible();
      const restore = effortsCard(page).getByRole('button', { name: 'Use the measured time for 1 km' });
      if (await restore.count()) {
        await restore.click();
        await expect(effortsCard(page).getByRole('status')).toContainText('Measured time restored.');
      }
    }
    await expect(effortsCard(page).getByRole('row', { name: /^1 km from/ })).not.toContainText('Edited');
  });

  test('F01-H10 Best efforts: hide an effort and show it again', async ({ page }) => {
    await openRun(page, 'flat');
    const card = effortsCard(page);
    const row = card.getByRole('row', { name: /^3 km from/ });
    try {
      await card.getByRole('button', { name: 'Hide the 3 km effort' }).click();
      await expect(card.getByRole('status')).toContainText('Effort hidden.');
      await expect(row).toContainText('Hidden');
      await expect(card.getByRole('button', { name: 'Show the 3 km effort' })).toBeVisible();
    } finally {
      const show = effortsCard(page).getByRole('button', { name: 'Show the 3 km effort' });
      if (await show.count()) await show.click();
    }
    await expect(row).not.toContainText('Hidden');
    await expect(card.getByRole('button', { name: 'Hide the 3 km effort' })).toBeVisible();
  });

  test('F01-H11 Same-route runs: three runs over the same loop, fastest and current marked', async ({ page, seed }) => {
    await openRun(page, 'loop3');
    const card = routeCard(page);
    await expect(card).toContainText('You have run this route 3 times');
    await expect(card).toContainText(`The fastest was on ${shortDate(daysAgo(3))}, at 4:55 /km. This run is the fastest.`);
    const rows = card.getByRole('row').filter({ has: page.getByRole('rowheader') });
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('This run');
    await expect(rows.nth(0)).toContainText('Fastest');
    await expect(rows.nth(1)).toContainText('E2E Park loop (middle)');
    await expect(rows.nth(1)).toContainText('5:05 /km');
    await expect(rows.nth(1)).toContainText('+0:10 /km'); // slower than this run by 10 s per km
    await expect(rows.nth(2)).toContainText('+0:25 /km');
    // The reversed loop starts and ends at the same door but goes the other way round: it is not in the list.
    await expect(card).not.toContainText('reversed');
    // Open the middle run from the table.
    await rows.nth(1).getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/runs/${seed.ids.loop2}$`));
    await expect(routeCard(page)).toContainText('You have run this route 3 times');
    await expect(routeCard(page).getByRole('row', { name: /This run/ })).toContainText('E2E Park loop (middle)');
  });

  test('F01-H12 Splits table: first rows are the kilometres of the file, View all shows every one', async ({ page }) => {
    await openRun(page, 'hills');
    const splits = page.getByRole('heading', { level: 2, name: 'Splits', exact: true }).locator('xpath=ancestor::*[.//table][1]').first();
    const rows = splits.getByRole('row');
    await expect(rows.nth(1)).toContainText('1.0 km');
    await expect(rows.nth(1)).toContainText('4:30 /km');
    await expect(rows.nth(1)).toContainText('+30 m');
    await expect(rows.nth(1)).toContainText('172');
    await expect(rows.nth(2)).toContainText('5:30 /km');
    await expect(rows.nth(2)).toContainText('150');
    await page.getByRole('button', { name: 'View all' }).click();
    // The seven whole kilometres.
    await expect(splits.getByRole('row').nth(7)).toContainText('4:31 /km');
    await expect(splits.getByRole('row').nth(4)).toContainText('6:30 /km'); // the stop is counted in the splits table
  });

  // BUG-004: the table is fed by whole-kilometre laps only, so the 0.99 km at the end of this 7.99 km run has no row,
  // while the Pace analysis card above it lists that split. Remove test.fail() when it is fixed.
  test('F01-E10 Splits table: the last partial kilometre is listed, as it is in Pace analysis', async ({ page }) => {
    test.fail(true, 'BUG-004: splits table drops the final partial kilometre');
    await openRun(page, 'hills');
    await page.getByRole('button', { name: 'View all' }).click();
    const splits = page.getByRole('heading', { level: 2, name: 'Splits', exact: true }).locator('xpath=ancestor::*[.//table][1]').first();
    await expect(splits.getByRole('row')).toHaveCount(1 + 8);
    await expect(splits.getByRole('row').nth(8)).toContainText('0.99 km');
  });
});

test.describe('F01 edge: states of the cards', () => {
  test('F01-E1 a run without heart rate: the effort is estimated from pace, and the zones card says why it is empty', async ({ page, seed, api }) => {
    await openRun(page, 'nohr');
    await expect(effortCard(page)).toContainText('Estimated from pace, matched to your heart-rate runs');
    await expect(zonesCard(page)).toContainText('This run has no heart-rate stream, so there is no time in zones to show.');
    await expect(page.locator('main')).toContainText('Average HR');
    const metrics = (await api.get(`/api/activities/${seed.ids.nohr}/training-metrics`)).json;
    expect(metrics.effort.source).toBe('PACE_CALIBRATED');
    expect(metrics.heartRate.hasStream).toBe(false);
  });

  test('F01-E2 a run without elevation: Grade adjusted is off and says why', async ({ page }) => {
    await openRun(page, 'flat');
    await expect(paceCard(page).getByRole('switch', { name: 'Grade adjusted' })).toBeDisabled();
    await expect(paceCard(page)).toContainText('This run has no usable elevation, so there is no grade-adjusted pace.');
    // Only one split-speed value is meaningful on a perfectly even run: the card shows the average.
    await expect(definition(paceCard(page), 'Average')).toHaveText('5:30 /km');
  });

  test('F01-E3 a route with no timestamps: no pace profile, no effort, a reason on each card, no crash', async ({ page }) => {
    await openRun(page, 'notimes');
    await expect(paceCard(page)).toContainText('has positions but no timestamps');
    await expect(effortCard(page)).toContainText('needs a time or a distance');
    await expect(effortsCard(page)).toContainText('no best efforts');
    await expect(routeCard(page)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'E2E Route without times' })).toBeVisible();
  });

  test('F01-E4 a 60 m scrap of a run: every card explains why it has nothing to show', async ({ page }) => {
    await openRun(page, 'scrap');
    await expect(paceCard(page)).toContainText('too short for a pace profile');
    await expect(effortsCard(page)).toContainText('no best efforts');
    await expect(routeCard(page)).toContainText('has no route to compare');
  });

  test('F01-E5 first run on a route: Same-route runs says so instead of showing an empty chart', async ({ page }) => {
    await openRun(page, 'hills');
    await expect(routeCard(page)).toContainText('This is the only run over this route so far.');
    await expect(routeCard(page).getByRole('table')).toHaveCount(0);
  });

  test('F01-E6 the same loop run the other way round is a different route', async ({ page }) => {
    await openRun(page, 'loopReversed');
    await expect(routeCard(page)).toContainText('This is the only run over this route so far.');
  });

  test('F01-E7 a half marathon: the 21.1 km run has a half-marathon best effort, marked as an estimate when the stream falls short', async ({ page, api, seed }) => {
    await openRun(page, 'long');
    const card = effortsCard(page);
    await expect(card.getByRole('row', { name: /^Half marathon/ })).toBeVisible();
    const server = (await api.get(`/api/activities/${seed.ids.long}/best-efforts`)).json.efforts as Array<{ distanceKey: string; estimated: boolean; elapsedSeconds: number }>;
    const half = server.find((effort) => effort.distanceKey === 'half');
    expect(half, 'the server reports a half-marathon effort').toBeTruthy();
    // 21.1 km at 5:30 /km: 1:56:03 on the clock, so a 21.0975 km effort is a little under that.
    expect(half!.elapsedSeconds).toBeGreaterThan(6900);
    expect(half!.elapsedSeconds).toBeLessThan(7000);
    await expect(card.getByRole('row', { name: /^Half marathon/ })).toContainText(hms(half!.elapsedSeconds));
    await expect(page.locator('main')).toContainText('21.07'); // distance the 10 m readings add up to
  });

  test('F01-E8 a second runner cannot open this run: the page shows no data and the API answers 404', async ({ browser, seed, baseURL, guard }) => {
    guard.allow(/status of 40[34]/); // the run is not B's: the API says so, and the browser logs it
    const context = await contextFor(browser, 'b', baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto(`/runs/${seed.ids.hills}`);
      await page.waitForTimeout(2500);
      await expect(page.locator('body')).not.toContainText('E2E Hill intervals');
      await expect(page.locator('body')).not.toContainText('7.99');
      const other = new Api(seed.baseUrl, seed.b.token);
      for (const route of ['/analytics', '/training-metrics', '/pace-profile', '/best-efforts', '/matches']) {
        const res = await other.get(`/api/activities/${seed.ids.hills}${route}`);
        expect(res.status, `GET /api/activities/{id}${route} for another runner`).toBe(404);
      }
    } finally {
      await context.close();
    }
  });
});

test.describe('F01 perceived exertion', () => {
  test.describe.configure({ mode: 'serial' });

  test('F01-H13 rate a run with no heart rate: the score now comes from the rating, and it survives a reload', async ({ page, api, seed }) => {
    await openRun(page, 'nohr');
    const card = effortCard(page);
    const before = Number(await card.locator('strong').first().innerText());
    try {
      await card.getByRole('button', { name: '7 out of 10' }).click();
      await expect(card.getByRole('status')).toContainText('Rating saved.');
      await expect(card).toContainText('Moving time, scaled by how hard you said the run felt.');
      await expect(card.getByRole('button', { name: '7 out of 10' })).toHaveAttribute('aria-pressed', 'true');
      const after = Number(await card.locator('strong').first().innerText());
      expect(after).not.toBe(before);
      expect(after).toBeGreaterThan(0);
      await page.reload();
      await expect(effortCard(page).getByRole('button', { name: '7 out of 10' })).toHaveAttribute('aria-pressed', 'true');
      const stored = (await api.get(`/api/activities/${seed.ids.nohr}/training-metrics`)).json.effort;
      expect(stored.source).toBe('PERCEIVED');
      expect(stored.perceivedExertion).toBe(7);
    } finally {
      await api.patch(`/api/activities/${seed.ids.nohr}`, { perceivedExertion: null });
    }
    await page.reload();
    await expect(effortCard(page)).toContainText('Estimated from pace, matched to your heart-rate runs');
  });

  test('F01-H14 rate a run that has heart rate: the heart rate keeps deciding the score', async ({ page, api, seed }) => {
    await openRun(page, 'hills');
    const card = effortCard(page);
    try {
      await card.getByRole('button', { name: '9 out of 10' }).click();
      await expect(card.getByRole('status')).toContainText('Rating saved.');
      await expect(card).toContainText('From your heart-rate zones');
      await expect(card.locator('strong').first()).toHaveText('142');
    } finally {
      await api.patch(`/api/activities/${seed.ids.hills}`, { perceivedExertion: null });
    }
  });

  test('F01-E9 clear a rating with the button', async ({ page, api, seed }) => {
    await openRun(page, 'nohr');
    const card = effortCard(page);
    try {
      await card.getByRole('button', { name: '4 out of 10' }).click();
      await expect(card.getByRole('button', { name: 'Clear rating' })).toBeVisible();
      await card.getByRole('button', { name: 'Clear rating' }).click();
      await expect(card.getByRole('button', { name: '4 out of 10' })).toHaveAttribute('aria-pressed', 'false');
      await expect(card).toContainText('Estimated from pace');
    } finally {
      await api.patch(`/api/activities/${seed.ids.nohr}`, { perceivedExertion: null });
    }
  });
});

test('X00-H1 seed sanity: every seed run exists for the signed-in runner', async ({ api }) => {
  const seed = readSeed();
  const runs = (await api.get('/api/activities')).json as Array<{ id: number }>;
  const ids = new Set(runs.map((run) => run.id));
  for (const [key, id] of Object.entries(seed.ids)) expect(ids.has(id), `seed run ${key}`).toBe(true);
});
