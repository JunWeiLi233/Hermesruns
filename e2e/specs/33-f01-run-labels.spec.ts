// F01 again, the labels of a run (M5): its type (a race, a long run, a workout, or just a run) and up to six tags of the runner's own.
// A card called "Type and tags" on the run page. Each change is saved at once and shown before the server answers; the training log
// filters by both, and a race is flagged on the fitness chart. Nothing is computed from them.
//
// A throwaway runner with three runs, so the seeded runner's runs keep the labels the other specs expect.
import type { Locator, Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { importHistoryRun, waitForEffort, type HistoryRun } from '../fixtures/history.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { expandRunLabels as expandLabels } from '../fixtures/run-labels.ts';
import { a11yViolations, contrastProblems, expect, expectNoHorizontalOverflow, expectNoRawKeys, test } from '../fixtures/test.ts';

let api: Api;
let who: { token: string; email: string };
let runs: HistoryRun[];
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

test.beforeAll(async () => {
  test.setTimeout(180_000);
  const made = await newRunner('labels');
  api = made.api;
  who = { token: api.token as string, email: made.email };
  runs = [
    await importHistoryRun(api, 1, 'easy', 6, 340, 138),
    await importHistoryRun(api, 3, 'hard', 8, 285, 170),
    await importHistoryRun(api, 5, 'easy', 7, 345, 140),
  ];
  await waitForEffort(api, runs.length);
});

// Every test starts from runs with no labels.
test.beforeEach(async () => {
  for (const run of runs) expect((await api.patch(`/api/activities/${run.id}`, { runType: null, tags: [] })).status).toBe(200);
});

const [first, second, third] = [0, 1, 2];
const labelsOf = async (run: HistoryRun): Promise<{ runType: string | null; tags: string[]; suggestions: Array<{ tag: string; runs: number }> }> =>
  (await api.get(`/api/activities/${run.id}/labels`)).json;

const card = (page: Page): Locator => page.getByRole('region', { name: 'Labels', exact: true });
const typeGroup = (page: Page): Locator => card(page).getByRole('group', { name: 'Run type' });
const tagInput = (page: Page): Locator => card(page).getByRole('textbox', { name: 'Add a tag' });
const addButton = (page: Page): Locator => card(page).getByRole('button', { name: 'Add tag', exact: true });
const chips = (page: Page): Locator => card(page).getByRole('list', { name: 'Tags', exact: true }).getByRole('listitem');
const announced = (page: Page, text: string): Locator => card(page).getByRole('status').filter({ hasText: text });
/** The chips and the radio buttons change at once; the server has the change once the card is no longer busy saving it. */
const settled = (page: Page): Promise<void> => expect(typeGroup(page)).not.toHaveAttribute('aria-busy', 'true');

async function openRun(page: Page, run: HistoryRun): Promise<void> {
  await page.goto(`/runs/${run.id}`);
  await expandLabels(page);
  await expect(typeGroup(page)).toBeVisible();
}

async function open(browser: Parameters<typeof pages.open>[0], baseURL: string | undefined, guard: Parameters<typeof pages.open>[2], run: HistoryRun): Promise<Page> {
  const page = await pages.open(browser, baseURL, guard, who, null);
  await openRun(page, run);
  return page;
}

/** Adds a tag the way a person does: types it and presses Enter. */
async function typeTag(page: Page, text: string): Promise<void> {
  await tagInput(page).fill(text);
  await tagInput(page).press('Enter');
}

test.describe('F01 the type of a run', () => {
  test('F01-H21 a run is marked as a race, a long run or a workout, or cleared; it is saved at once and kept', async ({ browser, baseURL, guard }) => {
    const page = await open(browser, baseURL, guard, runs[first]);
    await expect(typeGroup(page).getByRole('radio')).toHaveCount(4);
    await expect(typeGroup(page).getByRole('radio', { name: 'Just a run' })).toBeChecked();
    await expect(card(page)).toContainText('Races are flagged on your fitness chart. The type changes none of your numbers.');

    for (const [name, value] of [['Race', 'RACE'], ['Long run', 'LONG_RUN'], ['Workout', 'WORKOUT']] as const) {
      const saved = page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().endsWith(`/api/activities/${runs[first].id}`));
      await typeGroup(page).getByRole('radio', { name, exact: true }).check();
      await expect(typeGroup(page).getByRole('radio', { name, exact: true })).toBeChecked();
      expect((await saved).status()).toBe(200);
      await expect(announced(page, `Run type set to ${name}.`)).toBeAttached();
      expect((await labelsOf(runs[first])).runType).toBe(value);
    }
    // It is still there after a reload, and the other runs are untouched.
    await page.reload();
    await expandLabels(page);
    await expect(typeGroup(page).getByRole('radio', { name: 'Workout' })).toBeChecked();
    expect((await labelsOf(runs[second])).runType).toBeNull();

    await typeGroup(page).getByRole('radio', { name: 'Just a run' }).check();
    await expect(announced(page, 'Run type cleared.')).toBeAttached();
    expect((await labelsOf(runs[first])).runType).toBeNull();
    await page.reload();
    await expandLabels(page);
    await expect(typeGroup(page).getByRole('radio', { name: 'Just a run' })).toBeChecked();
  });

  test('F01-H22 the type changes none of the numbers of a run, and a race shows on the fitness chart and in the training log', async ({ browser, baseURL, guard }) => {
    const run = runs[second];
    // Everything the run page works out, but when it was worked out.
    const numbers = async () => {
      const read = async (route: string) => JSON.stringify((await api.get(`/api/activities/${run.id}/${route}`)).json, (key, value) => (key === 'computedAt' ? undefined : value));
      return [await read('training-metrics'), await read('pace-profile'), await read('best-efforts')].join(' | ');
    };
    const before = await numbers();
    const page = await open(browser, baseURL, guard, run);
    await typeGroup(page).getByRole('radio', { name: 'Race', exact: true }).check();
    await expect(announced(page, 'Run type set to Race.')).toBeAttached();
    expect(await numbers(), 'effort, zones, pace and best efforts after the run was called a race').toBe(before);

    // The fitness chart flags the day, and the log shows the type.
    const series = (await api.get(`/api/training/series?from=${new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)}`)).json;
    expect(series.raceDays).toHaveLength(1);
    await page.goto('/training-log');
    await expect(page.getByRole('link', { name: run.name, exact: true })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ has: page.getByRole('link', { name: run.name, exact: true }) }).getByText('Race', { exact: true })).toBeVisible();
  });
});

test.describe('F01 the tags of a run', () => {
  test('F01-H23 a tag is typed and added with Enter or the Add button; spaces are tidied; it is kept; the field stays ready for the next', async ({ browser, baseURL, guard }) => {
    const page = await open(browser, baseURL, guard, runs[first]);
    await expect(card(page)).toContainText('No tags yet. A few words of your own make this run easy to find in your training log.');
    await expect(card(page)).toContainText('0 of 6');

    await typeTag(page, '  hills   and  stairs ');
    await expect(chips(page)).toHaveText(['hills and stairs×']);
    await expect(announced(page, 'Added the tag hills and stairs.')).toBeAttached();
    await expect(tagInput(page)).toHaveValue('');
    await expect(tagInput(page)).toBeFocused();
    expect((await labelsOf(runs[first])).tags).toEqual(['hills and stairs']);

    await tagInput(page).fill('with the dog');
    await addButton(page).click();
    await expect(chips(page)).toHaveCount(2);
    await expect(card(page)).toContainText('2 of 6');
    await expect(card(page)).not.toContainText('No tags yet');
    // The chip shows at once; the server has the tag once the card says it was added.
    await expect(announced(page, 'Added the tag with the dog.')).toBeAttached();
    expect((await labelsOf(runs[first])).tags).toEqual(['hills and stairs', 'with the dog']);

    await page.reload();
    await expandLabels(page);
    await expect(typeGroup(page)).toBeVisible();
    await expect(chips(page)).toHaveCount(2);
    await expect(card(page).getByRole('button', { name: 'Remove tag with the dog' })).toBeVisible();
  });

  test('F01-H24 a tag is taken off with its x; the keyboard stays on the card', async ({ browser, baseURL, guard }) => {
    expect((await api.patch(`/api/activities/${runs[first].id}`, { tags: ['hills', 'tempo', 'rain'] })).status).toBe(200);
    const page = await open(browser, baseURL, guard, runs[first]);
    await expect(chips(page)).toHaveCount(3);
    await card(page).getByRole('button', { name: 'Remove tag tempo' }).click();
    await expect(chips(page)).toHaveCount(2);
    await expect(card(page).getByRole('button', { name: 'Remove tag tempo' })).toHaveCount(0);
    await expect(announced(page, 'Removed the tag tempo.')).toBeAttached();
    await expect(card(page)).toBeFocused();
    expect((await labelsOf(runs[first])).tags).toEqual(['hills', 'rain']);
    // The last one goes too, and the invitation comes back.
    await card(page).getByRole('button', { name: 'Remove tag hills' }).click();
    await card(page).getByRole('button', { name: 'Remove tag rain' }).click();
    await expect(chips(page)).toHaveCount(0);
    await expect(card(page)).toContainText('No tags yet');
    await settled(page);
    expect((await labelsOf(runs[first])).tags).toEqual([]);
  });

  test('F01-H25 the tags the runner has used on other runs are offered, most used first, and a tap adds one', async ({ browser, baseURL, guard }) => {
    await api.patch(`/api/activities/${runs[second].id}`, { tags: ['tempo', 'hills'] });
    await api.patch(`/api/activities/${runs[third].id}`, { tags: ['tempo', 'rain'] });
    const page = await open(browser, baseURL, guard, runs[first]);
    const offered = card(page).getByRole('list', { name: 'Your tags' }).getByRole('button');
    await expect(offered).toHaveText(['+ tempo', '+ hills', '+ rain']);
    await expect(offered.first()).toHaveAccessibleName('Add tag tempo');
    await card(page).getByRole('button', { name: 'Add tag hills' }).click();
    await expect(chips(page)).toHaveText(['hills×']);
    await expect(offered).toHaveText(['+ tempo', '+ rain']);
    await expect(card(page)).toBeFocused();
    await settled(page);
    expect((await labelsOf(runs[first])).tags).toEqual(['hills']);
    // The tags of the other runs are untouched.
    expect((await labelsOf(runs[second])).tags).toEqual(['tempo', 'hills']);
    // The card links to the log, where the tags can be used.
    await expect(card(page).getByRole('link', { name: 'See your tagged runs in the training log' })).toHaveAttribute('href', '/runs#training-log');
  });

  test('F01-H26 what is put on a run is what the training log shows and filters by', async ({ browser, baseURL, guard }) => {
    const page = await open(browser, baseURL, guard, runs[third]);
    await typeGroup(page).getByRole('radio', { name: 'Long run' }).check();
    await typeTag(page, 'Sunday loop');
    await expect(chips(page)).toHaveCount(1);
    await card(page).getByRole('link', { name: 'See your tagged runs in the training log' }).click();
    await expect(page).toHaveURL(/\/runs#training-log$/);
    const row = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: runs[third].name, exact: true }) });
    await expect(row.getByText('Long run', { exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Filter by the tag Sunday loop' })).toBeVisible();
    await page.getByRole('region', { name: 'Filter the log' }).getByRole('group', { name: 'Tags' }).getByRole('button', { name: /^Sunday loop/ }).click();
    await expect(page.locator('[data-week]').getByRole('link')).toHaveText([runs[third].name]);
  });
});

test.describe('F01 what a tag may be', () => {
  test('F01-E39 empty, too long, repeated (in any case) and seventh tags are refused with a reason, and nothing is sent', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, who, null);
    const sent: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'PATCH') sent.push(request.postData() ?? '');
    });
    await openRun(page, runs[first]);
    const problem = card(page).getByRole('alert');

    // Nothing, or only spaces: ignored without a word.
    await tagInput(page).fill('   ');
    await addButton(page).click();
    await tagInput(page).press('Enter');
    await expect(problem).toHaveCount(0);
    expect(sent).toEqual([]);

    // One character over the limit of 24.
    await typeTag(page, 'abcdefghijklmnopqrstuvwxy');
    await expect(problem).toHaveText('A tag can be at most 24 characters.');
    await expect(tagInput(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(tagInput(page)).toHaveValue('abcdefghijklmnopqrstuvwxy');
    // Typing lets go of the message, and the 24 that fit are taken.
    await tagInput(page).fill('abcdefghijklmnopqrstuvwx');
    await expect(problem).toHaveCount(0);
    await tagInput(page).press('Enter');
    await expect(chips(page)).toHaveCount(1);
    // Characters are counted as a person counts them: 24 runners are 24, though each is two code units.
    await typeTag(page, '🏃'.repeat(24));
    await expect(chips(page)).toHaveCount(2);
    await typeTag(page, '🏃'.repeat(25));
    await expect(problem).toHaveText('A tag can be at most 24 characters.');
    await tagInput(page).fill('');

    // The same word in another case is the same tag.
    await typeTag(page, 'hills');
    await expect(chips(page)).toHaveCount(3);
    await typeTag(page, 'HILLS');
    await expect(problem).toHaveText('This run already has that tag.');
    await typeTag(page, '  Hills ');
    await expect(problem).toHaveText('This run already has that tag.');
    await expect(chips(page)).toHaveCount(3);

    // Three more fill the six; the seventh is refused and says what to do.
    for (const tag of ['one', 'two', 'three']) await typeTag(page, tag);
    await expect(chips(page)).toHaveCount(6);
    await expect(card(page)).toContainText('6 of 6');
    await typeTag(page, 'seven');
    await expect(problem).toHaveText('A run can have 6 tags. Remove one to add another.');
    await expect(chips(page)).toHaveCount(6);
    await settled(page);
    const stored = (await labelsOf(runs[first])).tags;
    expect(stored).toHaveLength(6);
    expect(stored).not.toContain('seven');
    expect(sent, 'one request for each tag that was taken, none for the ones refused').toHaveLength(6);
  });

  test('F01-E40 accents, emoji and markup are kept as the text they are, and nothing runs', async ({ browser, baseURL, guard }) => {
    const page = await open(browser, baseURL, guard, runs[first]);
    let dialogs = 0;
    page.on('dialog', async (dialog) => {
      dialogs += 1;
      await dialog.dismiss();
    });
    for (const tag of ['café ☕', '长距离', '<svg onload=alert(1)>', "o'clock", '100%']) await typeTag(page, tag);
    await expect(chips(page)).toHaveCount(5);
    await expect(chips(page).nth(0)).toContainText('café ☕');
    await expect(chips(page).nth(2)).toContainText('<svg onload=alert(1)>');
    await expect(card(page).locator('li svg')).toHaveCount(0);
    await settled(page);
    expect((await labelsOf(runs[first])).tags).toEqual(['café ☕', '长距离', '<svg onload=alert(1)>', "o'clock", '100%']);
    await page.reload();
    await expandLabels(page);
    await expect(typeGroup(page)).toBeVisible();
    await expect(chips(page)).toHaveCount(5);
    await page.goto('/training-log');
    await expect(page.locator('[data-week]').first()).toBeVisible();
    await expect(page.locator('[data-week] svg')).toHaveCount(0);
    expect(dialogs, 'no script ran').toBe(0);
  });

  test('F01-E41 double click on Add and Enter twice make one tag', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, who, null);
    const patches: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'PATCH') patches.push(request.postData() ?? '');
    });
    await openRun(page, runs[first]);
    await tagInput(page).fill('hills');
    await addButton(page).dblclick();
    await expect(chips(page)).toHaveCount(1);
    await tagInput(page).fill('tempo');
    await tagInput(page).press('Enter');
    await tagInput(page).press('Enter');
    await expect(chips(page)).toHaveCount(2);
    expect(patches).toHaveLength(2);
    await settled(page);
    expect((await labelsOf(runs[first])).tags).toEqual(['hills', 'tempo']);
  });

  test('F01-E42 quick changes in a row are all kept, in order', async ({ browser, baseURL, guard }) => {
    const page = await open(browser, baseURL, guard, runs[first]);
    // Slow every save, so the next change is made before the last one has been answered.
    await page.route('**/api/activities/*', async (route) => {
      if (route.request().method() === 'PATCH') await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fallback();
    });
    for (const tag of ['one', 'two', 'three']) {
      await tagInput(page).fill(tag);
      await tagInput(page).press('Enter');
    }
    await typeGroup(page).getByRole('radio', { name: 'Race', exact: true }).check();
    // What is shown is the confirmed labels with the waiting changes on top: all of them, at once.
    await expect(chips(page)).toHaveText(['one×', 'two×', 'three×']);
    await expect(typeGroup(page).getByRole('radio', { name: 'Race', exact: true })).toBeChecked();
    await expect.poll(async () => labelsOf(runs[first]), { timeout: 15_000 }).toMatchObject({ runType: 'RACE', tags: ['one', 'two', 'three'] });
  });
});

test.describe('F01 labels under bad conditions', () => {
  test('F01-E43 a save that fails brings the earlier labels back and says so, and the next one works', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    const page = await open(browser, baseURL, guard, runs[first]);
    await typeTag(page, 'kept');
    await expect(chips(page)).toHaveCount(1);
    let failures = 2;
    await page.route('**/api/activities/*', (route) => (route.request().method() === 'PATCH' && failures-- > 0
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' })
      : route.fallback()));
    await typeTag(page, 'lost');
    await expect(card(page).getByRole('alert')).toHaveText('That could not be saved, so nothing was changed. Try again.');
    await expect(chips(page)).toHaveText(['kept×']);
    expect((await labelsOf(runs[first])).tags).toEqual(['kept']);
    // The type too. A click, not check(): the failed save puts the choice back so quickly that check() sees no change and gives up.
    await typeGroup(page).getByRole('radio', { name: 'Race', exact: true }).click();
    await expect(card(page).getByRole('alert')).toHaveText('That could not be saved, so nothing was changed. Try again.');
    await expect(typeGroup(page).getByRole('radio', { name: 'Just a run' })).toBeChecked();
    expect((await labelsOf(runs[first])).runType).toBeNull();
    // Once the server answers again the same steps work, and the message goes.
    await typeTag(page, 'lost');
    await expect(chips(page)).toHaveText(['kept×', 'lost×']);
    await expect(card(page).getByRole('alert')).toHaveCount(0);
    await settled(page);
    expect((await labelsOf(runs[first])).tags).toEqual(['kept', 'lost']);
  });

  test('F01-E44 when the labels cannot be loaded the card says so and Try again works; the rest of the page stays', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    const page = await pages.open(browser, baseURL, guard, who, null);
    let failures = 1;
    await page.route('**/api/activities/*/labels', (route) => (failures-- > 0
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' })
      : route.fallback()));
    await page.goto(`/runs/${runs[first].id}`);
    await expect(card(page).getByRole('alert')).toHaveText('The type and tags of this run could not be loaded.');
    await expect(page.getByRole('region', { name: 'Pace analysis' })).toBeVisible();
    await card(page).getByRole('button', { name: 'Try again' }).click();
    await expandLabels(page);
    await expect(typeGroup(page)).toBeVisible();
    await expect(card(page).getByRole('alert')).toHaveCount(0);
  });

  test('F01-E45 two tabs: the last save wins, and a reload shows it (the tags are replaced as a whole list, not merged)', async ({ browser, baseURL, guard }) => {
    const one = await open(browser, baseURL, guard, runs[first]);
    const two = await pages.tab(one, `/runs/${runs[first].id}`);
    await expandLabels(two);
    await expect(typeGroup(two)).toBeVisible();
    await typeGroup(one).getByRole('radio', { name: 'Race', exact: true }).check();
    await typeTag(one, 'from one');
    await expect(announced(one, 'Added the tag from one.')).toBeAttached();
    // The second tab has not heard of either; what it saves replaces them.
    await typeGroup(two).getByRole('radio', { name: 'Workout', exact: true }).check();
    await typeTag(two, 'from two');
    await expect(announced(two, 'Added the tag from two.')).toBeAttached();
    const stored = await labelsOf(runs[first]);
    expect(stored.runType).toBe('WORKOUT');
    expect(stored.tags).toEqual(['from two']);
    await one.reload();
    await expandLabels(one);
    await expect(typeGroup(one).getByRole('radio', { name: 'Workout' })).toBeChecked();
    await expect(chips(one)).toHaveText(['from two×']);
  });

  test('F01-E46 a run of another runner has no labels to read or change: not found', async ({ browser, baseURL, guard }) => {
    guard.allow(/status of 40[34]/); // the run is not theirs: the API says so, and the browser logs it
    const other = await newRunner('labels-other');
    const page = await pages.open(browser, baseURL, guard, { token: other.api.token as string, email: other.email }, null);
    const lookup = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === '/api/activities' && url.searchParams.get('id') === String(runs[first].id);
    });
    await page.goto(`/runs/${runs[first].id}`);
    expect((await lookup).status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'No run selected', exact: true })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(runs[first].name);
    expect((await other.api.get(`/api/activities/${runs[first].id}/labels`)).status).toBe(404);
    expect((await other.api.patch(`/api/activities/${runs[first].id}`, { runType: 'RACE', tags: ['mine now'] })).status).toBe(404);
    expect((await labelsOf(runs[first])).tags).toEqual([]);
    expect((await labelsOf(runs[first])).runType).toBeNull();
  });
});

test.describe('F01 the labels card as a whole', () => {
  test('F01-E47 keyboard only: choose a type with the arrow keys, type a tag, add it with Enter, remove it from the keyboard', async ({ browser, baseURL, guard }) => {
    const page = await open(browser, baseURL, guard, runs[first]);
    await typeGroup(page).getByRole('radio', { name: 'Just a run' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(typeGroup(page).getByRole('radio', { name: 'Race', exact: true })).toBeChecked();
    await page.keyboard.press('ArrowDown');
    await expect(typeGroup(page).getByRole('radio', { name: 'Long run' })).toBeChecked();
    await expect.poll(async () => (await labelsOf(runs[first])).runType).toBe('LONG_RUN');
    await page.keyboard.press('Tab');
    await expect(tagInput(page)).toBeFocused();
    await page.keyboard.type('by keyboard');
    await page.keyboard.press('Enter');
    await expect(chips(page)).toHaveText(['by keyboard×']);
    await expect(tagInput(page)).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(card(page).getByRole('button', { name: 'Remove tag by keyboard' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(chips(page)).toHaveCount(0);
    await expect(card(page)).toBeFocused();
  });

  test('F01-E48 the card has no serious accessibility violation, with tags, suggestions and a message showing, and its text is readable in both themes', async ({ browser, baseURL, guard }) => {
    await api.patch(`/api/activities/${runs[second].id}`, { runType: 'WORKOUT', tags: ['tempo', 'hills'] });
    for (const theme of ['light', 'midnight']) {
      const page = await pages.open(browser, baseURL, guard, who, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await openRun(page, runs[first]);
      await typeGroup(page).getByRole('radio', { name: 'Race', exact: true }).check();
      await typeTag(page, 'rain');
      await tagInput(page).fill('x'.repeat(30));
      await tagInput(page).press('Enter');
      await expect(card(page).getByRole('alert')).toBeVisible();
      await expect(card(page).getByRole('list', { name: 'Your tags' })).toBeVisible();
      expect(await a11yViolations(page, { ignoreRules: ['color-contrast'] }), `${theme}, whole page`).toEqual([]);
      expect(await contrastProblems(page, { include: ['.run-labels'] }), `${theme}, contrast`).toEqual([]);
    }
  });

  test('F01-E49 in Chinese the card is translated and no raw key shows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, who, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(`/runs/${runs[first].id}`);
    const zh = page.getByRole('region', { name: '标签', exact: true });
    await expect(zh).toBeVisible({ timeout: 15_000 });
    await expandLabels(page, zh);
    await expect(zh.getByRole('group', { name: '跑步类型' }).getByRole('radio', { name: '比赛' })).toBeVisible();
    await zh.getByRole('textbox', { name: '添加标签' }).fill('山路');
    await zh.getByRole('textbox', { name: '添加标签' }).press('Enter');
    await expect(zh.getByRole('list', { name: '标签', exact: true }).getByRole('listitem')).toHaveText(['山路×']);
    await expectNoRawKeys(page);
  });

  test('F01-E50 @mobile the card fits a phone, with the longest tags', async ({ browser, baseURL, guard }) => {
    await api.patch(`/api/activities/${runs[first].id}`, { tags: ['abcdefghijklmnopqrstuvwx', '🏃'.repeat(24), 'long words keep going on'] });
    const page = await pages.open(browser, baseURL, guard, who, null);
    await page.setViewportSize({ width: 375, height: 812 });
    await openRun(page, runs[first]);
    await expect(chips(page)).toHaveCount(3);
    await expectNoHorizontalOverflow(page);
    const frame = await card(page).boundingBox();
    expect(frame && frame.x >= 0 && frame.x + frame.width <= 375, `card at ${JSON.stringify(frame)}`).toBe(true);
  });
});

test.describe('F01 the labels API', () => {
  test('F01-N3 the API takes the whole list of tags and a type, checks all of it before saving any, and refuses the rest', async ({ api: seeded }) => {
    const run = runs[third];
    const patch = (body: unknown) => api.patch(`/api/activities/${run.id}`, body);
    // Refused, and nothing changes.
    await patch({ runType: 'RACE', tags: ['kept'] });
    const refusals: Array<[unknown, number, string]> = [
      [{ runType: 'MARATHON' }, 400, 'INVALID_RUN_TYPE'],
      [{ runType: 'race' }, 400, 'INVALID_RUN_TYPE'],
      [{ runType: 5 }, 400, 'INVALID_RUN_TYPE'],
      [{ tags: 'hills' }, 400, 'INVALID_TAGS'],
      [{ tags: [1, 2] }, 400, 'INVALID_TAGS'],
      [{ tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }, 400, 'INVALID_TAGS'],
      [{ tags: ['x'.repeat(25)] }, 400, 'INVALID_TAGS'],
      [{ runType: 'WORKOUT', tags: 'bad' }, 400, 'INVALID_TAGS'],
      [{ perceivedExertion: 11, runType: 'WORKOUT' }, 400, 'INVALID_PERCEIVED_EXERTION'],
      [{ colour: 'red' }, 400, 'UNSUPPORTED_FIELD'],
      [{}, 400, 'NOTHING_TO_CHANGE'],
    ];
    for (const [body, status, code] of refusals) {
      const res = await patch(body);
      expect([res.status, res.json.code], JSON.stringify(body)).toEqual([status, code]);
    }
    expect(await labelsOf(run), 'a refused request changes nothing, not even its good parts').toMatchObject({ runType: 'RACE', tags: ['kept'] });

    // Taken: tidied, repeated words collapsed whatever their case, six at most.
    const tidied = await patch({ tags: ['  Hills  ', 'hills', 'HILLS', 'wet\u0007\n feet', 'ok'] });
    expect(tidied.status).toBe(200);
    expect(tidied.json.tags).toEqual(['Hills', 'wet feet', 'ok']);
    expect((await patch({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] })).status).toBe(200);
    // Null clears, and the rating can travel with them.
    const both = await patch({ runType: null, tags: null, perceivedExertion: 6 });
    expect(both.json).toMatchObject({ runType: null, tags: [], perceivedExertion: 6 });
    expect(await labelsOf(run)).toMatchObject({ runType: null, tags: [] });
    await patch({ perceivedExertion: null });

    // Not signed in, and not the owner.
    expect((await seeded.request('PATCH', `/api/activities/${run.id}`, { body: { runType: 'RACE' }, token: null })).status).toBe(401);
    expect((await seeded.request('GET', `/api/activities/${run.id}/labels`, { token: null })).status).toBe(401);
    expect((await seeded.patch(`/api/activities/${run.id}`, { runType: 'RACE' })).status, 'a run of another runner').toBe(404);
    expect((await seeded.get(`/api/activities/${run.id}/labels`)).status).toBe(404);
    expect((await patch({ runType: 'WORKOUT' })).status).toBe(200);
    const unknown = await api.patch('/api/activities/987654321', { runType: 'RACE' });
    expect(unknown.status).toBe(404);
  });
});
