// F04 Tune zones, pace zones from a race. Recon feature: "Pace zones from a recent race or time trial" (Strava: Settings > My Performance).
// In HermesRuns: Settings > Training > Pace zones. The six zones of the run page (Recovery to Repetition) are cut from the runner's best
// runs of the last 90 days. A race or time trial (a distance, a time, the day it was run) sets them instead for runs on or after that
// day; runs before it keep the zones they had. The race is one per runner, and it is removed with one click.
//
// A throwaway runner with five runs around the race day: 70 and 40 days back, the day before the race, the race day itself, and 5 days
// back. Every number on the page is checked against Daniels and Gilbert's model written out again in fixtures/format.ts and below.
import type { Browser, Locator, Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { addDays, danielsVdot, mmss, utcDay } from '../fixtures/format.ts';
import { daysAgo, gpxRun } from '../fixtures/gpx.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { a11yViolations, contrastProblems, expect, expectNoHorizontalOverflow, expectNoRawKeys, test, type Guard } from '../fixtures/test.ts';
import { unzip } from '../fixtures/unzip.ts';

test.describe.configure({ mode: 'serial' });

const ROUTE = '/api/training/pace-zones';
const RACE_DAY = utcDay(20);
const TEN_K = { distanceMeters: 10000, seconds: 2700, date: RACE_DAY }; // 10K in 45:00, a VDOT of 45.3
const SAVED = 'Saved. Pace zones now follow this race for runs on or after its date.';
const REMOVED = 'Removed. Pace zones are cut from your runs again.';

// The six zones of the run page, as the model cuts them: the share of VO2max at the edges, from the slowest edge to the fastest.
const CUTS = [0.59, 0.75, 0.83, 0.92, 1.05];
const ZONE_NAMES = ['Repetition', 'Interval', 'Threshold', 'Marathon', 'Easy', 'Recovery'];

/** The pace (seconds a kilometre) at `fraction` of the VO2max of a runner of this VDOT. */
function edgePace(vdot: number, fraction: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - vdot * fraction;
  const metresPerMinute = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  return (1000 / metresPerMinute) * 60;
}

/** The six pace ranges for a VDOT, fastest zone first, written the way the pages write them. */
function zoneRanges(vdot: number): string[] {
  const edges = CUTS.map((fraction) => mmss(edgePace(vdot, fraction)));
  return [
    `faster than ${edges[4]} /km`,
    `${edges[4]}–${edges[3]} /km`,
    `${edges[3]}–${edges[2]} /km`,
    `${edges[2]}–${edges[1]} /km`,
    `${edges[1]}–${edges[0]} /km`,
    `slower than ${edges[0]} /km`,
  ];
}

const vdotOf = (distanceM: number, seconds: number): number => Math.round(danielsVdot(distanceM, seconds) * 10) / 10;
const longDay = (day: string): string =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

let runner: { api: Api; email: string; token: string };
const runIds: Record<'old' | 'mid' | 'eve' | 'day' | 'recent', number> = { old: 0, mid: 0, eve: 0, day: 0, recent: 0 };
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

test.beforeAll(async () => {
  const made = await newRunner('pacerace');
  runner = { api: made.api, email: made.email, token: made.api.token as string };
  const plan = [
    ['old', 70, 8, 330],
    ['mid', 40, 8, 320],
    ['eve', 21, 6, 325],
    ['day', 20, 6, 322],
    ['recent', 5, 8, 318],
  ] as const;
  for (const [key, back, km, pace] of plan) {
    runIds[key] = await made.api.importRun(
      `pace-race-${key}.gpx`,
      gpxRun({ name: `E2E pace ${key}`, start: daysAgo(back), distanceM: km * 1000, pace, hr: 150, shape: 'line' }),
    );
  }
});

test.beforeEach(async () => {
  expect((await runner.api.delete(ROUTE)).status).toBe(200);
});

test.afterAll(async () => {
  await runner.api.delete(ROUTE);
});

// --- what the pages are made of -------------------------------------------------------------------------------------------------

const distanceMenu = (page: Page): Locator => page.getByRole('combobox', { name: 'Distance', exact: true });
const customDistance = (page: Page): Locator => page.getByRole('textbox', { name: /^Distance \(/ });
const timeBox = (page: Page): Locator => page.getByRole('textbox', { name: 'Time (h:mm:ss or mm:ss)' });
const dateBox = (page: Page): Locator => page.getByLabel('Date of the race');
const useButton = (page: Page): Locator => page.getByRole('button', { name: 'Use this race', exact: true });
const replaceButton = (page: Page): Locator => page.getByRole('button', { name: 'Use this race instead', exact: true });
const removeButton = (page: Page): Locator => page.getByRole('button', { name: 'Remove the race', exact: true });
const basis = (page: Page): Locator => page.getByText(/^Now: /);
const zones = (page: Page): Locator => page.getByRole('list', { name: 'Pace for each zone' }).getByRole('listitem');
const paceCard = (page: Page): Locator => page.getByRole('region', { name: 'Pace analysis' });
const runZones = (page: Page): Locator => paceCard(page).getByRole('heading', { name: 'Time at each pace' }).locator('xpath=following-sibling::ul[1]/li');

async function openSettings(
  browser: Browser,
  baseURL: string | undefined,
  guard: Guard,
  options: { lang?: string; theme?: string; unit?: string } = {},
): Promise<Page> {
  const page = await pages.open(browser, baseURL, guard, runner, null);
  await page.addInitScript(
    ({ lang, theme, unit }) => {
      if (lang) localStorage.setItem('hermes_lang', lang);
      if (theme) localStorage.setItem('hermes_theme', theme);
      if (unit) localStorage.setItem('hermes_unit', unit);
    },
    { lang: options.lang, theme: options.theme, unit: options.unit },
  );
  await page.goto('/settings?section=training');
  await expect(options.lang === 'zh-CN' ? page.getByRole('combobox', { name: '距离', exact: true }) : distanceMenu(page)).toBeVisible();
  return page;
}

async function openRunPage(page: Page, id: number): Promise<void> {
  await page.goto(`/runs/${id}`);
  await expect(paceCard(page)).toBeVisible();
  await expect(runZones(page)).toHaveCount(6);
}

/** Types a race into the form (a missing part is left as it is). */
async function typeRace(page: Page, race: { distance?: string; custom?: string; time?: string; date?: string }): Promise<void> {
  if (race.distance) await distanceMenu(page).selectOption({ label: race.distance });
  if (race.custom !== undefined) await customDistance(page).fill(race.custom);
  if (race.time !== undefined) await timeBox(page).fill(race.time);
  if (race.date !== undefined) await dateBox(page).fill(race.date);
}

const raceOnServer = async (): Promise<unknown> => (await runner.api.get(ROUTE)).json.race;

/** The six zones, by name and exactly by pace: for a VDOT the page shows to the decimal, as a race gives. */
async function expectZones(rows: Locator, vdot: number): Promise<void> {
  const ranges = zoneRanges(vdot);
  for (const [index, name] of ZONE_NAMES.entries()) {
    await expect(rows.nth(index)).toContainText(name);
    await expect(rows.nth(index)).toContainText(ranges[index]);
  }
}

/**
 * The six zones, by name and by pace to within two seconds: for a VDOT the page names to one decimal but cuts the zones from in full,
 * as the VDOT of a runner's runs is.
 */
async function expectZonesNear(rows: Locator, vdot: number): Promise<void> {
  const wanted = zoneRanges(vdot);
  for (const [index, name] of ZONE_NAMES.entries()) {
    await expect(rows.nth(index)).toContainText(name);
    // The name is the first line and the pace range the second; a run page adds the time in the zone after them.
    const range = (await rows.nth(index).innerText()).split('\n')[1] ?? '';
    const shown = range.match(/\d+:\d\d/g) ?? [];
    const expected = wanted[index].match(/\d+:\d\d/g) ?? [];
    expect(shown.length, `${name}: the paces in "${range}"`).toBe(expected.length);
    for (const [at, pace] of expected.entries()) {
      const seconds = (text: string): number => Number(text.split(':')[0]) * 60 + Number(text.split(':')[1]);
      expect(Math.abs(seconds(shown[at]) - seconds(pace)), `${name}: ${shown[at]} against ${pace}`).toBeLessThanOrEqual(2);
    }
  }
}

/** The VDOT a sentence on the page names: "(VDOT 45.3)". */
async function vdotNamedBy(text: Locator): Promise<number> {
  const found = /VDOT (\d+(?:\.\d)?)/.exec(await text.innerText());
  expect(found, 'a VDOT in the sentence').not.toBeNull();
  return Number(found?.[1]);
}

// --- happy path ---------------------------------------------------------------------------------------------------------------

test.describe('F04 pace zones: happy path', () => {
  test('F04-PZ-H1 Settings > Training has a Pace zones card that says the zones come from your own runs, with the six zones', async ({ browser, baseURL, guard }) => {
    const page = await openSettings(browser, baseURL, guard);
    await expect(page.getByRole('heading', { level: 3, name: 'Pace zones' })).toBeVisible();
    await expect(basis(page)).toContainText('cut from your best runs of the last 90 days');
    const vdot = await vdotNamedBy(basis(page));
    expect(vdot).toBeGreaterThan(25);
    expect(vdot).toBeLessThan(45);
    await expect(zones(page)).toHaveCount(6);
    await expectZonesNear(zones(page), vdot);
    await expect(page.getByText('A race sets the pace zones of runs on or after its date. Earlier runs keep the zones they had.')).toBeVisible();
    await expect(distanceMenu(page)).toHaveValue('10k');
    await expect(timeBox(page)).toHaveValue('');
    await expect(dateBox(page)).toHaveValue('');
    await expect(removeButton(page)).toHaveCount(0);
    expect(await raceOnServer()).toBeNull();
  });

  test('F04-PZ-H2 a race typed in previews the zones it would give, and changes nothing until it is used', async ({ browser, baseURL, guard }) => {
    const page = await openSettings(browser, baseURL, guard);
    const before = await vdotNamedBy(basis(page));
    await typeRace(page, { time: '45:00', date: RACE_DAY });

    const race = vdotOf(10000, 2700);
    expect(race).toBe(45.3);
    await expect(page.getByText(`A preview with this race (VDOT ${race}). Nothing changes until you use it.`)).toBeVisible();
    await expectZones(zones(page), race);
    await expect(basis(page)).toContainText('cut from your best runs of the last 90 days');
    expect(await vdotNamedBy(basis(page))).toBe(before);
    expect(await raceOnServer()).toBeNull();

    // A refresh drops what was typed, and the zones in force are the ones from the runs.
    await page.reload();
    await expect(distanceMenu(page)).toBeVisible();
    await expect(timeBox(page)).toHaveValue('');
    await expect(page.getByText(/A preview with this race/)).toHaveCount(0);
    await expectZonesNear(zones(page), before);
  });

  test('F04-PZ-H3 using the race saves it, says where the zones come from, and keeps it after a reload', async ({ browser, baseURL, guard }) => {
    const page = await openSettings(browser, baseURL, guard);
    await typeRace(page, { time: '45:00', date: RACE_DAY });
    await useButton(page).click();

    await expect(page.getByText(SAVED)).toBeVisible();
    expect(await raceOnServer()).toMatchObject(TEN_K);
    await expect(basis(page)).toHaveText(`Now: cut from 10K in 45:00 on ${longDay(RACE_DAY)} (VDOT 45.3).`);
    await expectZones(zones(page), 45.3);
    await expect(page.getByText(/A preview with this race/)).toHaveCount(0);
    await expect(replaceButton(page)).toBeDisabled();
    await expect(removeButton(page)).toBeEnabled();

    await page.reload();
    await expect(distanceMenu(page)).toHaveValue('10k');
    await expect(timeBox(page)).toHaveValue('45:00');
    await expect(dateBox(page)).toHaveValue(RACE_DAY);
    await expect(basis(page)).toHaveText(`Now: cut from 10K in 45:00 on ${longDay(RACE_DAY)} (VDOT 45.3).`);
    await expectZones(zones(page), 45.3);
  });

  test('F04-PZ-H4 the run pages follow the race from the race day on, and earlier runs keep the zones they had', async ({ browser, baseURL, guard }) => {
    expect((await runner.api.put(ROUTE, TEN_K)).status).toBe(200);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    const race = `Zones are cut from 10K in 45:00 on ${longDay(RACE_DAY)} (VDOT 45.3), which you entered in Settings.`;

    // 5 days ago and the very day of the race: the race's zones.
    for (const key of ['recent', 'day'] as const) {
      await openRunPage(page, runIds[key]);
      await expect(paceCard(page).getByText(race)).toBeVisible();
      await expectZones(runZones(page), 45.3);
    }

    // The day before the race and 40 days ago: the zones from the best runs in the 90 days before each run.
    for (const key of ['eve', 'mid'] as const) {
      await openRunPage(page, runIds[key]);
      const note = paceCard(page).getByText(/^Zones come from your best runs in the 90 days before this one/);
      await expect(note).toBeVisible();
      await expect(paceCard(page).getByText(/which you entered in Settings/)).toHaveCount(0);
      const vdot = await vdotNamedBy(note);
      expect(vdot).not.toBe(45.3);
      await expectZonesNear(runZones(page), vdot);
    }

    // 70 days ago: nothing before it, so the zones of today, as before the race was entered.
    await openRunPage(page, runIds.old);
    await expect(paceCard(page).getByText(/^Zones come from your recent best runs/)).toBeVisible();
    await expect(paceCard(page).getByText(/which you entered in Settings/)).toHaveCount(0);
  });

  test('F04-PZ-H4b a race entered in Settings is seen by the run page opened next, and a removed one is gone, with no reload in between', async ({ browser, baseURL, guard }) => {
    const page = await openSettings(browser, baseURL, guard);
    // Inside the app, not a new page load: what the app remembers of what it has read must not hide a change made a moment ago.
    const goTo = (path: string): Promise<void> =>
      page.evaluate((target) => {
        window.history.pushState({}, '', target);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, path);
    await typeRace(page, { time: '45:00', date: RACE_DAY });
    await useButton(page).click();
    await expect(page.getByText(SAVED)).toBeVisible();

    await goTo(`/runs/${runIds.recent}`);
    await expect(paceCard(page).getByText(`Zones are cut from 10K in 45:00 on ${longDay(RACE_DAY)} (VDOT 45.3), which you entered in Settings.`)).toBeVisible();
    await expectZones(runZones(page), 45.3);

    await goTo('/settings?section=training');
    await removeButton(page).click();
    await expect(page.getByText(REMOVED)).toBeVisible();
    await goTo(`/runs/${runIds.recent}`);
    await expect(paceCard(page).getByText(/^Zones come from your best runs in the 90 days before this one/)).toBeVisible();
    await expect(paceCard(page).getByText(/which you entered in Settings/)).toHaveCount(0);
  });

  test('F04-PZ-H5 replacing the race changes the zones again, and the button wants a difference first', async ({ browser, baseURL, guard }) => {
    expect((await runner.api.put(ROUTE, TEN_K)).status).toBe(200);
    const page = await openSettings(browser, baseURL, guard);
    await expect(replaceButton(page)).toBeDisabled();
    await typeRace(page, { time: '44:00' });
    await expect(replaceButton(page)).toBeEnabled();
    await expect(page.getByText('A preview with this race (VDOT 46.5). Nothing changes until you use it.')).toBeVisible();
    await typeRace(page, { time: '45:00' });
    await expect(replaceButton(page)).toBeDisabled();

    await typeRace(page, { distance: 'Half marathon', time: '1:45:30' });
    await replaceButton(page).click();
    await expect(page.getByText(SAVED)).toBeVisible();
    expect(await raceOnServer()).toMatchObject({ distanceMeters: 21097.5, seconds: 6330, date: RACE_DAY });
    const half = vdotOf(21097.5, 6330);
    await expect(basis(page)).toHaveText(`Now: cut from Half marathon in 1:45:30 on ${longDay(RACE_DAY)} (VDOT ${half}).`);

    await openRunPage(page, runIds.recent);
    await expect(paceCard(page).getByText(`Zones are cut from Half marathon in 1:45:30 on ${longDay(RACE_DAY)} (VDOT ${half}), which you entered in Settings.`)).toBeVisible();
    await expectZones(runZones(page), half);
  });

  test('F04-PZ-H6 removing the race goes back to the zones from your runs, on Settings and on the run pages', async ({ browser, baseURL, guard }) => {
    expect((await runner.api.put(ROUTE, TEN_K)).status).toBe(200);
    const page = await openSettings(browser, baseURL, guard);
    await removeButton(page).click();

    await expect(page.getByText(REMOVED)).toBeVisible();
    expect(await raceOnServer()).toBeNull();
    await expect(basis(page)).toContainText('cut from your best runs of the last 90 days');
    await expect(removeButton(page)).toHaveCount(0);
    await expect(timeBox(page)).toHaveValue('');
    await expect(dateBox(page)).toHaveValue('');

    await openRunPage(page, runIds.recent);
    await expect(paceCard(page).getByText(/which you entered in Settings/)).toHaveCount(0);
    await expect(paceCard(page).getByText(/^Zones come from your best runs in the 90 days before this one/)).toBeVisible();
  });

  test('F04-PZ-H7 a distance of your own is typed in your unit and saved in metres', async ({ browser, baseURL, guard }) => {
    const page = await openSettings(browser, baseURL, guard);
    await typeRace(page, { distance: 'Another distance' });
    await expect(page.getByRole('textbox', { name: 'Distance (km)' })).toBeVisible();
    await typeRace(page, { custom: '12,5', time: '59:10', date: RACE_DAY });
    await useButton(page).click();
    await expect(page.getByText(SAVED)).toBeVisible();
    expect(await raceOnServer()).toMatchObject({ distanceMeters: 12500, seconds: 3550, date: RACE_DAY });
    await expect(basis(page)).toHaveText(`Now: cut from 12.5 km in 59:10 on ${longDay(RACE_DAY)} (VDOT ${vdotOf(12500, 3550)}).`);

    // In miles the box says so, and 8 miles are 12 874.8 metres.
    const miles = await openSettings(browser, baseURL, guard, { unit: 'mile' });
    await expect(miles.getByRole('textbox', { name: 'Distance (mi)' })).toHaveValue('7.77');
    await typeRace(miles, { custom: '8', time: '1:00:00' });
    await replaceButton(miles).click();
    await expect(miles.getByText(SAVED)).toBeVisible();
    expect(await raceOnServer()).toMatchObject({ distanceMeters: 12874.8, seconds: 3600 });
    await expect(basis(miles)).toContainText('8 mi in 1:00:00');
  });
});

// --- negative cases -----------------------------------------------------------------------------------------------------------

test.describe('F04 pace zones: what the form refuses', () => {
  const future = addDays(utcDay(0), 2);
  const tooOld = addDays(utcDay(0), -1830);
  const refusals: Array<[string, string, { time?: string; date?: string }, string, 'time' | 'date']> = [
    ['F04-PZ-N1', 'a time with no colon', { time: '45' }, 'Write the time as mm:ss or h:mm:ss, like 45:00 or 1:45:30.', 'time'],
    ['F04-PZ-N2', 'seconds over 59', { time: '45:75' }, 'Write the time as mm:ss or h:mm:ss, like 45:00 or 1:45:30.', 'time'],
    ['F04-PZ-N3', 'a time under four minutes', { time: '3:59' }, 'The time must be from 4 minutes to 24 hours.', 'time'],
    ['F04-PZ-N4', 'a time over a day', { time: '25:00:00' }, 'The time must be from 4 minutes to 24 hours.', 'time'],
    ['F04-PZ-N5', 'a pace nobody could hold', { time: '17:00' }, 'That is not a pace anyone could hold for that distance. Check the distance and the time.', 'time'],
    ['F04-PZ-N6', 'a day in the future', { date: future }, 'The race cannot be in the future.', 'date'],
    ['F04-PZ-N7', 'a day more than five years back', { date: tooOld }, 'A race from more than five years ago says little about your pace now.', 'date'],
    ['F04-PZ-N8', 'no date', { date: '' }, 'Pick the date of the race.', 'date'],
  ];

  for (const [id, what, typed, message, field] of refusals) {
    test(`${id} ${what} is refused with a message, and nothing is saved`, async ({ browser, baseURL, guard }) => {
      const page = await openSettings(browser, baseURL, guard);
      await typeRace(page, { time: '45:00', date: RACE_DAY, ...typed });
      await useButton(page).click();
      await expect(page.getByRole('alert')).toContainText(message);
      await expect(field === 'time' ? timeBox(page) : dateBox(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(field === 'time' ? dateBox(page) : timeBox(page)).not.toHaveAttribute('aria-invalid', 'true');
      expect(await raceOnServer()).toBeNull();
      await expect(page.getByText(SAVED)).toHaveCount(0);
    });
  }

  test('F04-PZ-N8b an empty form says everything that is missing, each under its own field, and sends nothing', async ({ browser, baseURL, guard }) => {
    const page = await openSettings(browser, baseURL, guard);
    let sent = 0;
    page.on('request', (request) => {
      if (request.method() === 'PUT' && request.url().endsWith(ROUTE)) sent += 1;
    });
    await useButton(page).click();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Write the time as mm:ss or h:mm:ss');
    await expect(alert).toContainText('Pick the date of the race.');
    await expect(timeBox(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(dateBox(page)).toHaveAttribute('aria-invalid', 'true');
    expect(sent).toBe(0);
  });

  test('F04-PZ-N8c a distance that is not a number, or too short or too long, is refused in the unit you use', async ({ browser, baseURL, guard }) => {
    const page = await openSettings(browser, baseURL, guard);
    await typeRace(page, { distance: 'Another distance', time: '45:00', date: RACE_DAY, custom: 'far' });
    await useButton(page).click();
    await expect(page.getByRole('alert')).toContainText('Give the distance as a number.');
    await expect(customDistance(page)).toHaveAttribute('aria-invalid', 'true');
    for (const custom of ['1', '101']) {
      await customDistance(page).fill(custom);
      await expect(page.getByRole('alert')).toContainText('The distance must be from 1.5 to 100 km.');
    }
    expect(await raceOnServer()).toBeNull();

    const miles = await openSettings(browser, baseURL, guard, { unit: 'mile' });
    await typeRace(miles, { distance: 'Another distance', time: '45:00', date: RACE_DAY, custom: '0.5' });
    await useButton(miles).click();
    await expect(miles.getByRole('alert')).toContainText('The distance must be from 0.93 to 62.14 mi.');
    expect(await raceOnServer()).toBeNull();
  });

  test('F04-PZ-N9 the API refuses what no runner could have run, with a reason, and stores nothing', async () => {
    const cases: Array<[string, unknown, RegExp]> = [
      ['no body', undefined, /distance/i],
      ['an empty body', {}, /distance/i],
      ['a distance that is text', { distanceMeters: 'far', seconds: 2700, date: RACE_DAY }, /distance/i],
      ['a distance under 1.5 km', { distanceMeters: 1499, seconds: 300, date: RACE_DAY }, /1\.5 km to 100 km/],
      ['a distance over 100 km', { distanceMeters: 100001, seconds: 20000, date: RACE_DAY }, /1\.5 km to 100 km/],
      ['a time that is text', { distanceMeters: 10000, seconds: 'long', date: RACE_DAY }, /time/i],
      ['a time that is a fraction of a second', { distanceMeters: 10000, seconds: 2700.5, date: RACE_DAY }, /whole number of seconds/],
      ['a time under 4 minutes', { distanceMeters: 5000, seconds: 239, date: RACE_DAY }, /4 minutes to 24 hours/],
      ['a time over 24 hours', { distanceMeters: 100000, seconds: 86401, date: RACE_DAY }, /4 minutes to 24 hours/],
      ['a pace faster than 2:00 a kilometre', { distanceMeters: 10000, seconds: 1100, date: RACE_DAY }, /not a pace a runner could hold/],
      ['a pace slower than 20:00 a kilometre', { distanceMeters: 5000, seconds: 6001, date: RACE_DAY }, /not a pace a runner could hold/],
      ['no date', { distanceMeters: 10000, seconds: 2700 }, /date/i],
      ['a date that is not written year-month-day', { distanceMeters: 10000, seconds: 2700, date: '20/09/2026' }, /year-month-day/],
      ['a date that is not a day', { distanceMeters: 10000, seconds: 2700, date: '2026-02-30' }, /year-month-day/],
      ['a date in the future', { distanceMeters: 10000, seconds: 2700, date: addDays(utcDay(0), 3) }, /cannot be in the future/],
      ['a date more than five years back', { distanceMeters: 10000, seconds: 2700, date: addDays(utcDay(0), -1830) }, /more than five years ago/],
    ];
    for (const [what, body, reason] of cases) {
      const res = await runner.api.put(ROUTE, body);
      expect(res.status, what).toBe(400);
      expect(res.json.code, what).toBe('INVALID_RACE');
      expect(res.json.error, what).toMatch(reason);
    }
    expect(await raceOnServer()).toBeNull();
  });

  test('F04-PZ-N10 signed out, the race cannot be read, set or removed', async ({ seed }) => {
    const nobody = new Api(seed.baseUrl, null);
    expect((await nobody.get(ROUTE)).status).toBe(401);
    expect((await nobody.put(ROUTE, TEN_K)).status).toBe(401);
    expect((await nobody.delete(ROUTE)).status).toBe(401);
    const stale = new Api(seed.baseUrl, 'not-a-session');
    expect((await stale.get(ROUTE)).status).toBe(401);
  });

  test('F04-PZ-N11 a save that is refused by the server says so, and a save that fails on the network can be tried again', async ({ browser, baseURL, guard }) => {
    guard.allow(/ERR_FAILED|status of 400|HTTP 400/);
    const page = await openSettings(browser, baseURL, guard);
    await typeRace(page, { time: '45:00', date: RACE_DAY });
    let mode: 'offline' | 'refused' | 'working' = 'offline';
    await page.route(`**${ROUTE}`, (route) => {
      if (route.request().method() !== 'PUT' || mode === 'working') return route.continue();
      return mode === 'offline'
        ? route.abort('failed')
        : route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'The race cannot be in the future.', code: 'INVALID_RACE' }) });
    });
    await useButton(page).click();
    await expect(page.getByRole('alert')).toContainText('Could not save the race. Please retry.');
    await expect(timeBox(page)).toHaveValue('45:00');

    mode = 'refused';
    await useButton(page).click();
    await expect(page.getByRole('alert')).toContainText('That race was not accepted. Check the distance, the time and the date.');
    await expect(timeBox(page)).toHaveValue('45:00');
    expect(await raceOnServer()).toBeNull();

    mode = 'working';
    await useButton(page).click();
    await expect(page.getByText(SAVED)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(await raceOnServer()).toMatchObject(TEN_K);
  });
});

// --- edge cases ---------------------------------------------------------------------------------------------------------------

test.describe('F04 pace zones: edges', () => {
  test('F04-PZ-E1 a double click on Use this race sends one request', async ({ browser, baseURL, guard }) => {
    const page = await openSettings(browser, baseURL, guard);
    await typeRace(page, { time: '45:00', date: RACE_DAY });
    let sent = 0;
    page.on('request', (request) => {
      if (request.method() === 'PUT' && request.url().endsWith(ROUTE)) sent += 1;
    });
    await useButton(page).dblclick();
    await expect(page.getByText(SAVED)).toBeVisible();
    expect(sent).toBe(1);
  });

  test('F04-PZ-E2 another runner\'s race is their own: nobody else sees it, changes it or removes it', async ({ browser, baseURL, guard }) => {
    expect((await runner.api.put(ROUTE, TEN_K)).status).toBe(200);
    const other = await newRunner('pacerace-other');
    expect((await other.api.get(ROUTE)).json.race).toBeNull();
    expect((await other.api.delete(ROUTE)).status).toBe(200);
    expect((await other.api.put(ROUTE, { distanceMeters: 5000, seconds: 1200, date: utcDay(3) })).status).toBe(200);
    expect(await raceOnServer()).toMatchObject(TEN_K);
    expect((await other.api.get(ROUTE)).json.race).toMatchObject({ distanceMeters: 5000, seconds: 1200 });

    const page = await openSettings(browser, baseURL, guard);
    await expect(timeBox(page)).toHaveValue('45:00');
    await expect(basis(page)).toContainText('10K in 45:00');
  });

  test('F04-PZ-E3 a race from more than six months ago is kept, and Settings says it is getting old', async ({ browser, baseURL, guard }) => {
    const old = utcDay(200);
    expect((await runner.api.put(ROUTE, { distanceMeters: 5000, seconds: 1320, date: old })).status).toBe(200);
    const page = await openSettings(browser, baseURL, guard);
    await expect(page.getByText(/This race was (199|200|201) days ago\. A newer race or time trial gives zones closer to how you run now\./)).toBeVisible();
    await expect(basis(page)).toContainText(`5K in 22:00 on ${longDay(old)}`);

    expect((await runner.api.put(ROUTE, TEN_K)).status).toBe(200);
    await page.reload();
    await expect(basis(page)).toContainText('10K in 45:00');
    await expect(page.getByText(/This race was \d+ days ago/)).toHaveCount(0);
  });

  test('F04-PZ-E4 in Chinese the card and the run page are translated and show no raw key', async ({ browser, baseURL, guard }) => {
    expect((await runner.api.put(ROUTE, TEN_K)).status).toBe(200);
    const page = await openSettings(browser, baseURL, guard, { lang: 'zh-CN' });
    await expect(page.getByRole('heading', { level: 3, name: '配速区间' })).toBeVisible();
    await expect(page.getByText(/^当前：根据比赛成绩计算——10 公里 45:00，/)).toBeVisible();
    await expect(page.getByRole('combobox', { name: '距离', exact: true })).toHaveValue('10k');
    await expect(page.getByRole('textbox', { name: '成绩（时:分:秒 或 分:秒）' })).toHaveValue('45:00');
    await expect(page.getByRole('button', { name: '改用这场比赛' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '移除这场比赛' })).toBeEnabled();
    const rows = page.getByRole('list', { name: '各区间配速' }).getByRole('listitem');
    await expect(rows).toHaveCount(6);
    await expect(rows.nth(0)).toContainText('重复');
    await expect(rows.nth(0)).toContainText(zoneRanges(45.3)[0].replace('faster than', '快于').replace('/km', '/公里'));
    await expectNoRawKeys(page);

    await page.getByRole('button', { name: '移除这场比赛' }).click();
    await expect(page.getByText('已移除。配速区间重新根据你的跑步计算。')).toBeVisible();
    await page.getByRole('textbox', { name: '成绩（时:分:秒 或 分:秒）' }).fill('45');
    await page.getByRole('button', { name: '采用这场比赛' }).click();
    await expect(page.getByRole('alert')).toContainText('成绩请写成 分:秒 或 时:分:秒，例如 45:00 或 1:45:30。');
    await expect(page.getByRole('alert')).toContainText('请选择比赛日期。');

    expect((await runner.api.put(ROUTE, TEN_K)).status).toBe(200);
    await page.goto(`/runs/${runIds.recent}`);
    await expect(page.getByText(/^区间根据你在设置中填入的比赛成绩计算——10 公里 45:00，/)).toBeVisible();
    await expectNoRawKeys(page);
  });

  test('F04-PZ-E5 the card has no serious accessibility violations and its text reaches 4.5 to 1 in both themes', async ({ browser, baseURL, guard }) => {
    for (const theme of ['light', 'midnight']) {
      const page = await openSettings(browser, baseURL, guard, { theme });
      await typeRace(page, { time: '44:00', date: RACE_DAY });
      await expect(page.getByText(/A preview with this race/)).toBeVisible();
      expect(await a11yViolations(page), `${theme}, preview`).toEqual([]);
      expect(await contrastProblems(page, { include: ['#st-v2-training'] }), `${theme}, preview, contrast`).toEqual([]);

      expect((await runner.api.put(ROUTE, TEN_K)).status).toBe(200);
      await page.reload();
      await expect(removeButton(page)).toBeVisible();
      expect(await a11yViolations(page), `${theme}, with a race`).toEqual([]);
      expect(await contrastProblems(page, { include: ['#st-v2-training'] }), `${theme}, with a race, contrast`).toEqual([]);

      await timeBox(page).fill('45');
      await replaceButton(page).click();
      await expect(page.getByRole('alert')).toBeVisible();
      expect(await a11yViolations(page), `${theme}, with a problem`).toEqual([]);
      expect(await contrastProblems(page, { include: ['#st-v2-training'] }), `${theme}, with a problem, contrast`).toEqual([]);

      await openRunPage(page, runIds.recent);
      expect(await contrastProblems(page, { include: ['.run-detail-v2__pa-zones'] }), `${theme}, run page, contrast`).toEqual([]);
      expect((await runner.api.delete(ROUTE)).status).toBe(200);
    }
  });

  test('F04-PZ-E6 on a phone the card fits the screen and its controls are big enough to touch', async ({ browser, baseURL, guard }) => {
    const page = await openSettings(browser, baseURL, guard);
    await page.setViewportSize({ width: 375, height: 812 });
    await typeRace(page, { distance: 'Another distance', custom: '12.5', time: '59:10', date: RACE_DAY });
    await expect(zones(page)).toHaveCount(6);
    await expectNoHorizontalOverflow(page);
    for (const control of [distanceMenu(page), customDistance(page), timeBox(page), dateBox(page), useButton(page)]) {
      await control.scrollIntoViewIfNeeded();
      const box = await control.boundingBox();
      expect(box?.height ?? 0, 'touch target height').toBeGreaterThanOrEqual(40);
      expect(box?.x ?? -1, 'inside the screen, left').toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0), 'inside the screen, right').toBeLessThanOrEqual(375);
    }
  });

  test('F04-PZ-E7 the data export includes the race, and a header alone when there is none', async ({ seed }) => {
    const exportOf = async (): Promise<string> => {
      const res = await fetch(`${seed.baseUrl}/api/account/export`, { headers: { Authorization: `Bearer ${runner.token}`, 'X-Forwarded-For': runner.api.clientIp ?? '' } });
      expect(res.status).toBe(200);
      const files = unzip(Buffer.from(await res.arrayBuffer()));
      expect(files.get('README.txt')?.toString('utf8')).toContain('pace-zone-race.csv');
      return files.get('pace-zone-race.csv')?.toString('utf8') ?? '';
    };
    expect(await exportOf()).toBe('distance_m,time_s,race_date,updated_at\n');
    expect((await runner.api.put(ROUTE, TEN_K)).status).toBe(200);
    const lines = (await exportOf()).split(/\r?\n/).filter(Boolean);
    expect(lines[0]).toBe('distance_m,time_s,race_date,updated_at');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(new RegExp(`^10000(\\.0)?,2700,${RACE_DAY},`));
  });

  test('F04-PZ-E8 when the race cannot be loaded the card says so and Retry brings it back; a run page still shows its zones', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    expect((await runner.api.put(ROUTE, TEN_K)).status).toBe(200);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    let failures = 1;
    await page.route(`**${ROUTE}`, (route) =>
      route.request().method() === 'GET' && failures-- > 0
        ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'down' }) })
        : route.continue());
    await page.goto('/settings?section=training');
    await expect(page.getByText('Could not load your pace zones. Please retry.')).toBeVisible();
    await page.getByRole('button', { name: 'Retry' }).last().click();
    await expect(distanceMenu(page)).toBeVisible();
    await expect(basis(page)).toContainText('10K in 45:00');

    // The run page does not depend on it: with the race unreachable it falls back to the zones from the runs.
    failures = 1_000;
    await openRunPage(page, runIds.recent);
    await expect(paceCard(page).getByText(/^Zones come from your best runs in the 90 days before this one/)).toBeVisible();
    await expect(runZones(page)).toHaveCount(6);
  });

  test('F04-PZ-E9 keyboard only: the form is filled in and saved with Enter', async ({ browser, baseURL, guard }) => {
    const page = await openSettings(browser, baseURL, guard);
    await distanceMenu(page).focus();
    await page.keyboard.press('ArrowDown'); // 10K -> half marathon
    await page.keyboard.press('Tab');
    await page.keyboard.type('1:45:30');
    await page.keyboard.press('Tab');
    await expect(dateBox(page)).toBeFocused();
    await dateBox(page).fill(RACE_DAY);
    await timeBox(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(SAVED)).toBeVisible();
    expect(await raceOnServer()).toMatchObject({ distanceMeters: 21097.5, seconds: 6330, date: RACE_DAY });
  });
});
