// F01 again, the summary of a run (M7): a headline and a few lines on its page, worked out from the runner's own runs by fixed rules, each
// of which opens to the numbers it came from and the rule that decided it. It can be hidden on one run or on every run, which is kept in
// the browser and stops the request; nothing is generated.
//
// A throwaway runner with eight weeks of running (fixtures/history.ts), so there is a history to compare a run with, and the seeded
// runner's runs keep the labels the other specs expect. What the server found is read from the API; what the page says is checked against
// it, sentence by sentence, with the wording of the product written out again here.
import type { Locator, Page } from '@playwright/test';
import { newRunner } from '../fixtures/api.ts';
import { daysAgo, gpxRun, intervalPace } from '../fixtures/gpx.ts';
import { runOn, sharedHistoryRunner, waitForEffort, type HistoryRun, type RunnerWithHistory } from '../fixtures/history.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { a11yViolations, contrastProblems, expect, expectNoHorizontalOverflow, expectNoRawKeys, test } from '../fixtures/test.ts';

const WEEKS = 8;

interface Finding {
  id: string;
  variant: string;
  tone: string;
  weight: number;
  facts: Record<string, any>;
  thresholds: Record<string, any>;
}

interface Summary {
  state: 'ready' | 'none';
  reason: string | null;
  findings: Finding[];
}

let runner: RunnerWithHistory;
let intervals: { id: number; name: string };
let scrap: { id: number; name: string };
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

/** A run that is already in the account (the runner is kept between runs of the suite), or the one made by `make`. */
async function ensureRun(name: string, make: () => string): Promise<{ id: number; name: string }> {
  const known = ((await runner.api.get('/api/activities')).json as Array<{ id: number; name: string }>).find((run) => run.name === name);
  if (known) return known;
  return { id: await runner.api.importRun(`${name.replace(/\s+/g, '-')}.gpx`, make()), name };
}

test.beforeAll(async () => {
  test.setTimeout(420_000);
  runner = await sharedHistoryRunner('summary', WEEKS);
  // A run that goes fast and slow by the kilometre, and one far too short to say anything about.
  intervals = await ensureRun('E2E summary intervals', () => gpxRun({ name: 'E2E summary intervals', start: daysAgo(2), distanceM: 8000, pace: intervalPace(240, 360, 1000), hr: 160, shape: 'line' }));
  scrap = await ensureRun('E2E summary scrap', () => gpxRun({ name: 'E2E summary scrap', start: daysAgo(4), distanceM: 600, pace: 360, hr: 140, shape: 'line' }));
  await waitForEffort(runner.api, runner.runs.length);
});

const easy = (): HistoryRun => runOn(runner, 1);
const hard = (): HistoryRun => runOn(runner, 3);
const long = (): HistoryRun => runOn(runner, 7);
const summaryOf = async (run: { id: number }): Promise<Summary> => (await runner.api.get(`/api/activities/${run.id}/summary`)).json;
const who = (): { token: string; email: string } => runner;

// ---- The wording of the product, written out again ------------------------------------------------------------------------------------

const num = (value: number, digits = 0): string => Number(Number(value).toFixed(digits)).toLocaleString('en-US');
const signed = (value: number, digits = 0): string => (value > 0 ? '+' : value < 0 ? '−' : '') + num(Math.abs(value), digits);
const pace = (seconds: number): string => {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')} /km`;
};
const km = (value: number): string => `${value.toFixed(1)} km`;
const secPer = (value: number): string => `${num(Math.abs(value))} s/km`;
const signedSecPer = (value: number): string => `${signed(value)} s/km`;
const scopeOf = (facts: Finding['facts']): string => (facts.scope === 'workouts' ? 'workouts' : 'runs of about this length');

/** What the line for a finding says. A kind of finding that is not written out here fails the test, so a new one cannot go unchecked. */
function sentenceOf(finding: Finding): string {
  const f = finding.facts;
  const key = `${finding.id}.${finding.variant}`;
  switch (key) {
    case 'character.race': return 'You marked this run as a race, so it is not judged against your training.';
    case 'character.workout': return 'You marked this run as a workout, so it is not called easy or steady.';
    case 'character.unclear': return 'There is too little heart rate or history to say how hard this run was.';
    case 'character.changes':
      return `A run with changes of pace: your kilometres went from ${pace(f.fastestPaceSecPerKm)} to ${pace(f.slowestPaceSecPerKm)}, so it was not one steady effort.`;
    case 'character.easy':
    case 'character.moderate':
    case 'character.hard': {
      if (f.basis === 'zones') {
        const zones = f.zonePercents as number[];
        const top = zones.reduce((best, percent, index) => (percent > best.percent ? { percent, zone: index + 1 } : best), { percent: -1, zone: 1 });
        if (finding.variant === 'easy') return `An easy run: ${num(f.easyPercent)}% of your time with heart rate was in zones 1 and 2.`;
        if (finding.variant === 'hard') return `A hard run: ${num(f.hardPercent)}% of your time with heart rate was in zones 4 and 5.`;
        return `A moderate run: you spent the most time in zone ${top.zone} (${num(top.percent)}% of your time with heart rate).`;
      }
      const lead = { easy: 'An easy run for you', moderate: 'An ordinary run for you', hard: 'A hard run for you' }[finding.variant as 'easy' | 'moderate' | 'hard'];
      return `${lead}: effort ${num(f.effort)}, against a usual ${num(f.usualEffort)}.`;
    }
    case 'longest.longest': return `Your longest run in ${num(f.windowDays)} days: ${km(f.distanceKm)}, against ${km(f.previousLongestKm)} for the longest before it.`;
    case 'effort.hardest': return `The hardest of your last ${num(f.count)} ${scopeOf(f)}: effort ${num(f.effort)}, against a usual ${num(f.usualEffort)}.`;
    case 'effort.higher': return `Harder than usual: effort ${num(f.effort)}, against a usual ${num(f.usualEffort)} for ${scopeOf(f)}.`;
    case 'effort.lower': return `Easier than usual: effort ${num(f.effort)}, against a usual ${num(f.usualEffort)} for ${scopeOf(f)}.`;
    case 'effort.typical': return `About as hard as usual: effort ${num(f.effort)}, against a usual ${num(f.usualEffort)} for ${scopeOf(f)}.`;
    case 'drift.high': return `Your heart rate rose a lot for the same pace: ${num(f.firstHalfHeartRate)} bpm in the first half, ${num(f.secondHalfHeartRate)} bpm in the second (efficiency down ${num(f.driftPercent, 1)}%).`;
    case 'drift.moderate': return `Your heart rate rose a little for the same pace: ${num(f.firstHalfHeartRate)} bpm in the first half, ${num(f.secondHalfHeartRate)} bpm in the second (efficiency down ${num(f.driftPercent, 1)}%).`;
    case 'drift.low': return `Your heart rate stayed steady for the pace: ${num(f.firstHalfHeartRate)} bpm in the first half, ${num(f.secondHalfHeartRate)} bpm in the second.`;
    case 'shape.negative': return `You sped up: the second half was ${secPer(f.deltaSeconds)} faster than the first (${pace(f.firstHalfPaceSecPerKm)}, then ${pace(f.secondHalfPaceSecPerKm)}).`;
    case 'shape.faded': return `You slowed down: the second half was ${secPer(f.deltaSeconds)} slower than the first (${pace(f.firstHalfPaceSecPerKm)}, then ${pace(f.secondHalfPaceSecPerKm)}).`;
    case 'shape.even': return `Evenly paced: ${pace(f.firstHalfPaceSecPerKm)} in the first half and ${pace(f.secondHalfPaceSecPerKm)} in the second.`;
    case 'pace.faster': return `Faster than your recent runs: ${pace(f.paceSecPerKm)}, against ${pace(f.recentPaceSecPerKm)} across ${num(f.count)} runs of this length in the last ${num(f.windowDays)} days.`;
    case 'pace.slower': return `Slower than your recent runs: ${pace(f.paceSecPerKm)}, against ${pace(f.recentPaceSecPerKm)} across ${num(f.count)} runs of this length in the last ${num(f.windowDays)} days.`;
    case 'pace.similar': return `About the pace of your recent runs: ${pace(f.paceSecPerKm)}, against ${pace(f.recentPaceSecPerKm)} across ${num(f.count)} runs of this length in the last ${num(f.windowDays)} days.`;
    case 'form.fresh': return `You started fresh: your form was ${signed(f.form)} the day before.`;
    case 'form.tired': return `You started tired: your form was ${signed(f.form)} the day before.`;
    default: throw new Error(`the test does not know how the page words a ${key} finding: ${JSON.stringify(f)}`);
  }
}

/** The numbers shown when a line is opened, for the kinds whose rows are worked out here; null for the others. */
function rowsOf(finding: Finding): string[] | null {
  const f = finding.facts;
  if (finding.id === 'pace') {
    return [
      `Pace of this run ${pace(f.paceSecPerKm)}`,
      `Pace of your recent runs ${pace(f.recentPaceSecPerKm)}`,
      `Difference ${signedSecPer(f.deltaSeconds)} (${signed(f.deltaPercent, 1)}%)`,
      `Runs compared ${num(f.count)}`,
      `Days looked back ${num(f.windowDays)}`,
      `Lengths compared ${km(f.fromKm)} – ${km(f.toKm)}`,
    ];
  }
  if (finding.id === 'effort') {
    const rows = [
      `Effort of this run ${num(f.effort, 1)}`,
      `Your usual effort ${num(f.usualEffort, 1)}`,
      `This run against usual ${num(f.ratio, 2)}×`,
      `Runs compared ${num(f.count)}`,
      `Compared with ${scopeOf(f)}`,
      `Days looked back ${num(f.windowDays)}`,
    ];
    if (finding.variant === 'hardest') rows.splice(4, 0, `Highest effort before ${num(f.highestBefore, 1)}`);
    return rows;
  }
  if (finding.id === 'character' && f.basis === 'zones') {
    return [...(f.zonePercents as number[]).map((percent, index) => `Zone ${index + 1} ${num(percent)}%`), `Time with heart rate ${num(f.heartRateMinutes)} min`];
  }
  return null;
}

// ---- Locators ---------------------------------------------------------------------------------------------------------------------------

const card = (page: Page): Locator => page.getByRole('region', { name: 'Run summary', exact: true });
const lines = (page: Page): Locator => card(page).getByRole('list', { name: 'What stands out about this run' }).getByRole('listitem');
const toggles = (page: Page): Locator => card(page).getByRole('button', { name: 'How this was worked out' });
const hideHere = (page: Page): Locator => card(page).getByRole('button', { name: 'Hide for this run' });
const turnOff = (page: Page): Locator => card(page).getByRole('button', { name: 'Turn off for every run' });
const showIt = (page: Page): Locator => card(page).getByRole('button', { name: 'Show it' });
const paceCard = (page: Page): Locator => page.getByRole('region', { name: 'Pace analysis' });
/** The text of each line: its sentence is the first paragraph; the rest is the button and the working. */
const sentences = (page: Page): Promise<string[]> => lines(page).evaluateAll((items) => items.map((item) => (item.querySelector('.run-summary__text')?.textContent ?? '').trim()));
/** A list of captions and figures as written in the markup. */
const pairs = (list: Locator): Promise<string[]> =>
  list.evaluate((dl) => Array.from(dl.querySelectorAll(':scope > div')).map((row) => `${row.querySelector('dt')?.textContent ?? ''} ${row.querySelector('dd')?.textContent ?? ''}`.replace(/\s+/g, ' ').trim()));

/** A run's page, without waiting for the card (the summary may be turned off). */
async function visit(page: Page, run: { id: number }): Promise<void> {
  await page.goto(`/runs/${run.id}`);
}

async function open(page: Page, run: { id: number }): Promise<void> {
  await visit(page, run);
  await expect(card(page)).toBeVisible({ timeout: 20_000 });
}

/** A page of a run with its summary on it: the card and at least its headline. */
async function openAs(browser: Parameters<typeof pages.open>[0], baseURL: string | undefined, guard: Parameters<typeof pages.open>[2], run: { id: number }): Promise<Page> {
  const page = await pages.open(browser, baseURL, guard, who(), null);
  await open(page, run);
  await expect(lines(page).first()).toBeVisible();
  return page;
}

/** What is in the browser's storage about summaries; the list of runs it is hidden on is gone from storage when it is empty. */
const stored = (page: Page): Promise<{ all: string | null; hidden: number[] }> =>
  page.evaluate(() => ({ all: localStorage.getItem('hermes_run_summaries'), hidden: JSON.parse(localStorage.getItem('hermes_run_summaries_hidden') ?? '[]') as number[] }));

/** Counts the requests for summaries a page makes. */
function countSummaryRequests(page: Page): { readonly count: number; forRun(id: number): number } {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (/\/api\/activities\/\d+\/summary/.test(request.url())) urls.push(request.url());
  });
  return { get count() { return urls.length; }, forRun: (id) => urls.filter((url) => url.includes(`/api/activities/${id}/summary`)).length };
}

test.describe('F01 what the summary says (M7)', () => {
  test('F01-H27 the card is a headline and a few lines, each the server\'s finding in the product\'s words, the headline first', async ({ browser, baseURL, guard }) => {
    for (const run of [easy(), long(), intervals]) {
      const summary = await summaryOf(run);
      expect(summary.state).toBe('ready');
      expect(summary.findings.length, 'a headline and up to three lines').toBeGreaterThanOrEqual(1);
      expect(summary.findings.length).toBeLessThanOrEqual(4);
      expect(summary.findings[0].id, 'the headline is what kind of run it was').toBe('character');
      const page = await openAs(browser, baseURL, guard, run);
      await expect(lines(page)).toHaveCount(summary.findings.length);
      expect(await sentences(page), `${run.name}: the lines, in the server's order`).toEqual(summary.findings.map(sentenceOf));
      await expect(card(page)).toContainText('Worked out from your own runs by fixed rules, not generated. Open any line to see its numbers and its rule.');
      await pages.closeAll();
    }
  });

  test('F01-H27b the same run says the same thing each time: nothing is generated', async ({ browser, baseURL, guard }) => {
    const first = await summaryOf(easy());
    const second = await summaryOf(easy());
    expect(second).toEqual(first);
    const page = await openAs(browser, baseURL, guard, easy());
    const before = await sentences(page);
    await page.reload();
    await expect(lines(page).first()).toBeVisible();
    expect(await sentences(page)).toEqual(before);
    // Nothing on the page calls it by a name it does not deserve.
    const text = await card(page).innerText();
    expect(text).not.toMatch(/\bAI\b|artificial|generated by|machine learning|coach says/i);
  });

  test('F01-H28 every line opens to the numbers it was worked out from and the rule that decided it, and closes again', async ({ browser, baseURL, guard }) => {
    const summary = await summaryOf(easy());
    const page = await openAs(browser, baseURL, guard, easy());
    await expect(toggles(page)).toHaveCount(summary.findings.length);
    // Closed to begin with: the numbers are not on the page for a reader to wade through.
    for (const toggle of await toggles(page).all()) await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(card(page).getByText('The numbers', { exact: true }).first()).toBeHidden();

    for (const [index, finding] of summary.findings.entries()) {
      const item = lines(page).nth(index);
      const toggle = item.getByRole('button', { name: 'How this was worked out' });
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(item.getByText('The numbers', { exact: true })).toBeVisible();
      await expect(item.getByText('The rule', { exact: true })).toBeVisible();
      const rows = await pairs(item.locator('dl'));
      const wanted = rowsOf(finding);
      if (wanted) expect(rows, `${finding.id}.${finding.variant}: the numbers`).toEqual(wanted);
      else expect(rows.length, `${finding.id}.${finding.variant}: some numbers`).toBeGreaterThan(0);
      // The rule says the thresholds the server used.
      const rule = (await item.locator('.run-summary__rule').innerText()).trim();
      expect(rule.length).toBeGreaterThan(40);
      if (typeof finding.thresholds.windowDays === 'number') expect(rule).toContain(`${num(finding.thresholds.windowDays)} days`);
      if (typeof finding.thresholds.bandPercent === 'number') expect(rule).toContain(`${num(finding.thresholds.bandPercent)}%`);
    }
    // Two lines can be open together, and each closes on its own.
    await expect(lines(page).locator('[aria-expanded="true"]')).toHaveCount(summary.findings.length);
    await toggles(page).first().click();
    await expect(toggles(page).first()).toHaveAttribute('aria-expanded', 'false');
    await expect(toggles(page).nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(lines(page).first().getByText('The numbers', { exact: true })).toBeHidden();
  });

  test('F01-H29 a race, or a workout, is not judged against the runner\'s training: the headline says so, and the comparisons that would mislead are left out', async ({ browser, baseURL, guard }) => {
    const run = runOn(runner, 5);
    try {
      expect((await runner.api.patch(`/api/activities/${run.id}`, { runType: 'RACE' })).status).toBe(200);
      let summary = await summaryOf(run);
      expect(summary.findings[0]).toMatchObject({ id: 'character', variant: 'race' });
      expect(summary.findings.map((finding) => finding.id), 'a race has no effort line').not.toContain('effort');
      let page = await openAs(browser, baseURL, guard, run);
      expect((await sentences(page))[0]).toBe('You marked this run as a race, so it is not judged against your training.');
      expect(await sentences(page)).toEqual(summary.findings.map(sentenceOf));
      await pages.closeAll();

      expect((await runner.api.patch(`/api/activities/${run.id}`, { runType: 'WORKOUT' })).status).toBe(200);
      summary = await summaryOf(run);
      expect(summary.findings[0]).toMatchObject({ id: 'character', variant: 'workout' });
      const ids = summary.findings.map((finding) => finding.id);
      for (const left of ['pace', 'shape', 'drift']) expect(ids, `a workout has no ${left} line`).not.toContain(left);
      page = await openAs(browser, baseURL, guard, run);
      expect((await sentences(page))[0]).toBe('You marked this run as a workout, so it is not called easy or steady.');
      expect(await sentences(page)).toEqual(summary.findings.map(sentenceOf));
    } finally {
      expect((await runner.api.patch(`/api/activities/${run.id}`, { runType: null })).status).toBe(200);
    }
  });

  test('F01-H30 a run that goes fast and slow by the kilometre is called a run with changes of pace, whatever its heart rate was', async ({ browser, baseURL, guard }) => {
    const summary = await summaryOf(intervals);
    expect(summary.findings[0]).toMatchObject({ id: 'character', variant: 'changes' });
    expect(summary.findings[0].facts.variationPercent).toBeGreaterThan(10);
    const page = await openAs(browser, baseURL, guard, intervals);
    const [headline] = await sentences(page);
    expect(headline).toBe(sentenceOf(summary.findings[0]));
    expect(headline).toMatch(/^A run with changes of pace: your kilometres went from (3:5\d|4:0\d) \/km to (5:5\d|6:0\d) \/km/);
    // The numbers behind it are the paces of the kilometres, in the working.
    await toggles(page).first().click();
    const rows = await pairs(lines(page).first().locator('dl'));
    expect(rows).toEqual(expect.arrayContaining([expect.stringMatching(/^Fastest kilometre (3:5\d|4:0\d) \/km$/), expect.stringMatching(/^Slowest kilometre (5:5\d|6:0\d) \/km$/)]));
  });

  test('F01-E51 a run too short to say anything about says so, and has no lines to open or hide', async ({ browser, baseURL, guard }) => {
    const summary = await summaryOf(scrap);
    expect(summary).toMatchObject({ state: 'none', reason: 'too_short', findings: [] });
    const page = await pages.open(browser, baseURL, guard, who(), null);
    await page.goto(`/runs/${scrap.id}`);
    await expect(card(page)).toBeVisible({ timeout: 20_000 });
    await expect(card(page)).toContainText('This run is too short to say anything useful about.');
    await expect(lines(page)).toHaveCount(0);
    await expect(toggles(page)).toHaveCount(0);
    await expect(hideHere(page)).toHaveCount(0);
  });
});

test.describe('F01 hiding the summary', () => {
  test('F01-H31 the summary can be hidden on one run: kept in the browser, no request is made for it, and Show it brings it back', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, who(), null);
    const requests = countSummaryRequests(page);
    await open(page, easy());
    await expect(lines(page).first()).toBeVisible();
    expect(requests.forRun(easy().id)).toBe(1);

    await hideHere(page).click();
    await expect(card(page)).toContainText('The summary is hidden for this run.');
    await expect(lines(page)).toHaveCount(0);
    await expect(showIt(page)).toBeFocused();
    expect((await stored(page)).hidden).toEqual([easy().id]);
    expect((await stored(page)).all, 'the other runs are not affected').toBeNull();

    // It stays hidden after a reload, and then nothing is asked of the server for it.
    await page.reload();
    await expect(card(page)).toContainText('The summary is hidden for this run.');
    await page.waitForTimeout(1500);
    expect(requests.forRun(easy().id), 'a hidden summary is not requested').toBe(1);

    // Another run still has its summary.
    await open(page, hard());
    await expect(lines(page).first()).toBeVisible();
    expect(requests.forRun(hard().id)).toBe(1);

    await open(page, easy());
    await showIt(page).click();
    await expect(lines(page).first()).toBeVisible();
    await expect(card(page).getByRole('heading', { level: 2, name: 'Run summary' })).toBeFocused();
    expect((await stored(page)).hidden).toEqual([]);
    expect(requests.forRun(easy().id)).toBe(2);
  });

  test('F01-H32 the summary can be turned off for every run, and the Settings switch says so and turns it back on', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, who(), null);
    const requests = countSummaryRequests(page);
    await open(page, easy());
    await expect(lines(page).first()).toBeVisible();
    await expect(card(page)).toContainText('Summaries can be turned back on in Settings.');
    await turnOff(page).click();
    await expect(card(page)).toHaveCount(0);
    expect((await stored(page)).all).toBe('off');
    const asked = requests.count;

    // On another run, and after a reload: no card, and no request.
    await visit(page, hard());
    await expect(paceCard(page)).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(card(page)).toHaveCount(0);
    expect(requests.count, 'nothing asked while it is off').toBe(asked);

    // Settings has the switch, pressed to Hide.
    await page.goto('/settings?section=preferences');
    const group = page.getByRole('group', { name: 'Run summaries' });
    await expect(group).toBeVisible();
    await expect(group.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-pressed', 'true');
    await expect(group.getByRole('button', { name: 'Show' })).toHaveAttribute('aria-pressed', 'false');
    await group.getByRole('button', { name: 'Show' }).click();
    await expect(group.getByRole('button', { name: 'Show' })).toHaveAttribute('aria-pressed', 'true');
    expect((await stored(page)).all).not.toBe('off');
    await open(page, hard());
    await expect(lines(page).first()).toBeVisible();
    expect(requests.count).toBe(asked + 1);
  });

  test('F01-H33 the switch in Settings turns the summary off and on, and what is hidden on one run stays hidden when it is turned back on', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, who(), null);
    await open(page, easy());
    await hideHere(page).click();
    await expect(showIt(page)).toBeVisible();
    await page.goto('/settings?section=preferences');
    const group = page.getByRole('group', { name: 'Run summaries' });
    await group.getByRole('button', { name: 'Hide' }).click();
    expect((await stored(page)).all).toBe('off');
    await group.getByRole('button', { name: 'Show' }).click();
    expect((await stored(page)).all).not.toBe('off');
    await open(page, easy());
    await expect(card(page)).toContainText('The summary is hidden for this run.');
    await open(page, hard());
    await expect(lines(page).first()).toBeVisible();
  });

  test('F01-E52 the choice is the browser\'s, not the account\'s: another browser of the same runner still has the summary', async ({ browser, baseURL, guard }) => {
    const first = await pages.open(browser, baseURL, guard, who(), null);
    await open(first, easy());
    await turnOff(first).click();
    await expect(card(first)).toHaveCount(0);
    const second = await pages.open(browser, baseURL, guard, who(), null);
    await open(second, easy());
    await expect(lines(second).first()).toBeVisible();
  });

  test('F01-E53 two tabs: turning the summary off in one takes it off the other, without a reload', async ({ browser, baseURL, guard }) => {
    const one = await openAs(browser, baseURL, guard, easy());
    const two = await pages.tab(one, `/runs/${hard().id}`);
    await expect(lines(two).first()).toBeVisible({ timeout: 20_000 });
    await turnOff(one).click();
    await expect(card(one)).toHaveCount(0);
    await expect(card(two)).toHaveCount(0);
  });
});

test.describe('F01 the summary under bad conditions', () => {
  test('F01-E54 when the summary cannot be loaded the card says so and Try again works; the other cards stay', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    const page = await pages.open(browser, baseURL, guard, who(), null);
    let failures = 1;
    await page.route('**/api/activities/*/summary', (route) => (failures-- > 0
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' })
      : route.fallback()));
    await page.goto(`/runs/${easy().id}`);
    await expect(card(page).getByRole('alert')).toHaveText('The summary for this run could not be loaded.');
    await expect(paceCard(page)).toBeVisible();
    await card(page).getByRole('button', { name: 'Try again' }).click();
    await expect(lines(page).first()).toBeVisible();
    await expect(card(page).getByRole('alert')).toHaveCount(0);
  });

  test('F01-E55 slow network: the card says it is looking, and the rest of the page is there meanwhile', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, who(), null);
    await page.route('**/api/activities/*/summary', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.fallback();
    });
    await page.goto(`/runs/${easy().id}`);
    await expect(card(page)).toHaveAttribute('aria-busy', 'true');
    await expect(card(page).getByRole('status').filter({ hasText: 'Looking at this run...' })).toBeAttached();
    await expect(paceCard(page)).toBeVisible();
    await expect(lines(page).first()).toBeVisible({ timeout: 15_000 });
    await expect(card(page)).not.toHaveAttribute('aria-busy', 'true');
  });

  test('F01-E56 the summary is asked for once the streams of the run have been checked, once for each visit; opening a line asks for nothing', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, who(), null);
    const events: string[] = [];
    const streams = new Set<string>();
    page.on('request', (request) => {
      if (/\/api\/activities\/\d+\/summary/.test(request.url())) events.push('summary asked');
    });
    page.on('response', (response) => {
      const match = /\/api\/activities\/\d+\/(points|analytics|telemetry)$/.exec(new URL(response.url()).pathname);
      if (match) {
        streams.add(match[1]);
        if (streams.size === 3 && !events.includes('streams answered')) events.push('streams answered');
      }
    });
    await open(page, easy());
    await expect(lines(page).first()).toBeVisible();
    // The page loads the points, the analytics and the telemetry of the run first; the summary and the cards that read the
    // stream wait for them, so that they do not ask for what a run without a stream cannot give.
    expect(events, 'the streams are answered, then the summary is asked for').toEqual(['streams answered', 'summary asked']);
    await toggles(page).first().click();
    await toggles(page).first().click();
    await page.waitForTimeout(500);
    expect(events.filter((event) => event === 'summary asked'), 'opening and closing a line asks for nothing').toHaveLength(1);
    await page.reload();
    await expect(lines(page).first()).toBeVisible();
    expect(events.filter((event) => event === 'summary asked')).toHaveLength(2);
  });

  test('F01-E57 keyboard only: open a line, hide the summary, and bring it back, with the keyboard always on something that is there', async ({ browser, baseURL, guard }) => {
    const page = await openAs(browser, baseURL, guard, easy());
    await expect(lines(page).first()).toBeVisible();
    await toggles(page).first().focus();
    await page.keyboard.press('Enter');
    await expect(toggles(page).first()).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Space');
    await expect(toggles(page).first()).toHaveAttribute('aria-expanded', 'false');
    await hideHere(page).focus();
    await page.keyboard.press('Enter');
    await expect(showIt(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(card(page).getByRole('heading', { level: 2, name: 'Run summary' })).toBeFocused();
    await expect(lines(page).first()).toBeVisible();
  });
});

test.describe('F01 the summary in other words and other units', () => {
  test('F01-E58 in miles the paces and distances of the lines are in miles, and the working agrees', async ({ browser, baseURL, guard }) => {
    const summary = await summaryOf(easy());
    const found = summary.findings.find((finding) => finding.id === 'pace') as Finding;
    expect(found, 'the easy run has a pace line').toBeTruthy();
    const mile = (secondsPerKm: number): string => {
      const rounded = Math.round(secondsPerKm * 1.609344);
      return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')} /mi`;
    };
    const page = await pages.open(browser, baseURL, guard, who(), null);
    await page.addInitScript(() => localStorage.setItem('hermes_unit', 'mile'));
    await open(page, easy());
    await expect(lines(page).first()).toBeVisible();
    const f = found.facts;
    const texts = await sentences(page);
    const index = summary.findings.indexOf(found);
    expect(texts[index]).toBe(`${found.variant === 'faster' ? 'Faster than' : found.variant === 'slower' ? 'Slower than' : 'About the pace of'} your recent runs: ${mile(f.paceSecPerKm)}, against ${mile(f.recentPaceSecPerKm)} across ${num(f.count)} runs of this length in the last ${num(f.windowDays)} days.`);
    expect(texts.join(' ')).not.toMatch(/\/km|\bkm\b/);
    // The working is in miles too: the lengths compared, and the difference per mile.
    await toggles(page).nth(index).click();
    const rows = await pairs(lines(page).nth(index).locator('dl'));
    expect(rows).toContain(`Lengths compared ${(f.fromKm * 0.621371).toFixed(1)} mi – ${(f.toKm * 0.621371).toFixed(1)} mi`);
    expect(rows.find((row) => row.startsWith('Difference'))).toMatch(/ s\/mi \(/);
  });

  test('F01-E59 in Chinese the card, the lines and the working are translated and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, who(), null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(`/runs/${easy().id}`);
    const zh = page.getByRole('region', { name: '跑步小结', exact: true });
    await expect(zh).toBeVisible({ timeout: 20_000 });
    await expect(zh.getByRole('list', { name: '这次跑步的要点' }).getByRole('listitem').first()).toBeVisible();
    await zh.getByRole('button', { name: '这是怎么得出的' }).first().click();
    await expect(zh.getByText('数据', { exact: true }).first()).toBeVisible();
    await expect(zh.getByText('规则', { exact: true }).first()).toBeVisible();
    await expectNoRawKeys(page);
    const text = await zh.innerText();
    expect(text).not.toMatch(/How this was worked out|Hide for this run|Run summary|A moderate run/);
    expect(text).toMatch(/中等强度|轻松|强度/);
  });
});

test.describe('F01 the summary card as a whole', () => {
  test('F01-E60 the card has no serious accessibility violation, shown, opened or hidden, and its text is readable in both themes', async ({ browser, baseURL, guard }) => {
    for (const theme of ['light', 'midnight']) {
      const page = await pages.open(browser, baseURL, guard, who(), null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await open(page, easy());
      await expect(lines(page).first()).toBeVisible();
      await toggles(page).first().click();
      await toggles(page).nth(1).click();
      expect(await a11yViolations(page, { ignoreRules: ['color-contrast'] }), `${theme}, shown`).toEqual([]);
      expect(await contrastProblems(page, { include: ['.run-summary'] }), `${theme}, shown and opened`).toEqual([]);
      await hideHere(page).click();
      await expect(showIt(page)).toBeVisible();
      expect(await a11yViolations(page, { ignoreRules: ['color-contrast'] }), `${theme}, hidden`).toEqual([]);
      expect(await contrastProblems(page, { include: ['.run-summary'] }), `${theme}, hidden`).toEqual([]);
      await pages.closeAll();
    }
  });

  test('F01-E61 @mobile the card fits a phone, with a line open', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, who(), null);
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, easy());
    await expect(lines(page).first()).toBeVisible();
    await toggles(page).first().click();
    await expect(lines(page).first().getByText('The numbers', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const frame = await card(page).boundingBox();
    expect(frame && frame.x >= 0 && frame.x + frame.width <= 375, `card at ${JSON.stringify(frame)}`).toBe(true);
  });
});

test.describe('F01 the summary API', () => {
  test('F01-N4 the summary is the runner\'s own: signed out is refused, another runner and unknown runs are not found, and a bad id is not a server error', async ({ api }) => {
    const signedOut = await api.get(`/api/activities/${easy().id}/summary`, { token: null });
    expect(signedOut.status).toBe(401);
    // A run of another runner, said as if it did not exist.
    const mine = await api.get(`/api/activities/${easy().id}/summary`);
    expect(mine.status).toBe(404);
    expect(JSON.stringify(mine.json)).not.toContain(easy().name);
    const other = await newRunner('summary-other');
    expect((await other.api.get(`/api/activities/${easy().id}/summary`)).status).toBe(404);
    expect((await other.api.get('/api/activities/987654321/summary')).status).toBe(404);
    const odd = await other.api.get('/api/activities/abc/summary');
    expect(odd.status).toBeGreaterThanOrEqual(400);
    expect(odd.status).toBeLessThan(500);
  });
});
