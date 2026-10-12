// F01 Edit a run (S09, M8). Recon path: pencil icon on the run -> the edit panel (title, notes, effort rating and "use it instead of heart
// rate", run type, tags, gear) -> Save. Not built, on purpose: privacy, hidden details, mute, media (the social side), sport and map type.
// In HermesRuns: an Edit button on the run page opens a drawer. Everything in it is a draft until Save; one request holds the fields that
// changed and the shoe has its own. A title the runner sets is theirs (a Strava re-sync leaves it alone: covered by a backend test, as
// the suite cannot reach Strava). Notes are private text under the title.
//
// A throwaway runner with two runs and two shoes. Every number checked against the API's answer and against the effort model written
// out again in this file.
import type { Locator, Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { daysAgo, gpxRun } from '../fixtures/gpx.ts';
import { pageOpener } from '../fixtures/pages.ts';
import { unzip } from '../fixtures/unzip.ts';
import { a11yViolations, contrastProblems, expect, expectNoHorizontalOverflow, expectNoRawKeys, test } from '../fixtures/test.ts';

test.describe.configure({ mode: 'serial' });

const ORIGINAL = 'E2E edit main';
let runner: { api: Api; email: string; token: string };
let mainId = 0;
let otherId = 0;
const shoes: { first: { id: number; name: string }; second: { id: number; name: string } } = {
  first: { id: 0, name: '' },
  second: { id: 0, name: '' },
};
const pages = pageOpener();
test.afterEach(() => pages.closeAll());

test.beforeAll(async () => {
  const made = await newRunner('editrun');
  runner = { api: made.api, email: made.email, token: made.api.token as string };
  mainId = await made.api.importRun('edit-main.gpx', gpxRun({ name: ORIGINAL, start: daysAgo(3), distanceM: 8000, pace: 330, hr: 150, shape: 'line' }));
  otherId = await made.api.importRun('edit-other.gpx', gpxRun({ name: 'E2E edit other', start: daysAgo(5), distanceM: 5000, pace: 340, hr: 145, shape: 'line' }));
  const first = await made.api.post('/api/shoes', { brand: 'Nike', model: 'Pegasus' });
  const second = await made.api.post('/api/shoes', { brand: 'Asics', model: 'Novablast', nickname: 'Blue' });
  expect(first.status, JSON.stringify(first.json)).toBeLessThan(300);
  expect(second.status, JSON.stringify(second.json)).toBeLessThan(300);
  shoes.first = { id: first.json.id, name: 'Nike Pegasus' };
  shoes.second = { id: second.json.id, name: 'Asics Novablast' };
});

/** Puts the main run back as it was imported, and the other run too: every test starts from the same two runs. */
test.beforeEach(async () => {
  for (const id of [mainId, otherId]) {
    const res = await runner.api.patch(`/api/activities/${id}`, { notes: null, perceivedExertion: null, useRatingForEffort: false, runType: null, tags: [] });
    expect(res.status).toBe(200);
    expect((await runner.api.patch(`/api/shoes/0/assign/${id}`)).status).toBe(200);
  }
  expect((await runner.api.patch(`/api/activities/${mainId}`, { name: ORIGINAL })).status).toBe(200);
});

// --- what the pages are made of -------------------------------------------------------------------------------------------------

const drawer = (page: Page): Locator => page.getByRole('dialog', { name: 'Edit run' });
const titleBox = (page: Page): Locator => drawer(page).getByRole('textbox', { name: 'Title' });
const notesBox = (page: Page): Locator => drawer(page).getByRole('textbox', { name: 'Notes' });
const rating = (page: Page, value: number): Locator => drawer(page).getByRole('radio', { name: `${value} out of 10`, exact: true });
const useRatingBox = (page: Page): Locator => drawer(page).getByRole('checkbox', { name: /Use my rating instead of heart rate/ });
const runTypeRadio = (page: Page, name: string): Locator => drawer(page).getByRole('radio', { name, exact: true });
const tagBox = (page: Page): Locator => drawer(page).getByRole('textbox', { name: 'Add a tag' });
const shoeSelect = (page: Page): Locator => drawer(page).getByRole('combobox', { name: 'Shoes' });
const saveButton = (page: Page): Locator => drawer(page).getByRole('button', { name: 'Save changes' });
const editButton = (page: Page): Locator => page.getByRole('button', { name: 'Edit', exact: true });
const heading = (page: Page): Locator => page.getByRole('heading', { level: 1 });
const notesBlock = (page: Page): Locator => page.getByRole('region', { name: 'Notes', exact: true });
const effortCard = (page: Page): Locator => page.getByRole('region', { name: 'Effort', exact: true });
const labelsCard = (page: Page): Locator => page.getByRole('region', { name: 'Type and tags' });
const SAVED = 'Run saved.';

async function openRun(page: Page, id = mainId): Promise<void> {
  await page.goto(`/runs/${id}`);
  await expect(heading(page)).toBeVisible();
  await expect(editButton(page)).toBeVisible();
}

async function openDrawer(page: Page): Promise<void> {
  await editButton(page).click();
  await expect(drawer(page)).toBeVisible();
  await expect(titleBox(page)).toBeVisible();
}

async function runOnServer(id = mainId): Promise<any> {
  return (await runner.api.get(`/api/activities?id=${id}`)).json;
}

async function editOnServer(id = mainId): Promise<any> {
  return (await runner.api.get(`/api/activities/${id}/edit`)).json;
}

async function metricsOnServer(id = mainId): Promise<any> {
  return (await runner.api.get(`/api/activities/${id}/training-metrics`)).json;
}

/** The effort model's weight for a rating, as the docs give it: 1 for a rating of 1 to 5 for a rating of 10, evenly between. */
const ratingScore = (movingSeconds: number, value: number): number => Math.round((movingSeconds / 60) * (1 + ((value - 1) * 4) / 9) * 10) / 10;

// --- happy path ---------------------------------------------------------------------------------------------------------------

test.describe('F01 edit a run: happy path', () => {
  test('F01-ED-H1 the Edit button opens a panel with the run as it is, and nothing to save yet', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    await openDrawer(page);
    await expect(titleBox(page)).toHaveValue(ORIGINAL);
    await expect(titleBox(page)).toBeFocused();
    await expect(drawer(page)).toContainText(`${ORIGINAL.length} of 120`);
    await expect(notesBox(page)).toHaveValue('');
    for (let value = 1; value <= 10; value += 1) await expect(rating(page, value)).not.toBeChecked();
    await expect(useRatingBox(page)).toBeDisabled();
    await expect(runTypeRadio(page, 'Just a run')).toBeChecked();
    await expect(drawer(page).getByRole('list', { name: 'Tags' })).toHaveCount(0);
    await expect(shoeSelect(page)).toHaveValue('');
    await expect(saveButton(page)).toBeDisabled();
    await expect(drawer(page).getByText('Only you can see your notes.')).toBeVisible();
    // The shoes offered are the runner's own.
    await expect(shoeSelect(page).locator('option')).toHaveCount(3);
    expect((await shoeSelect(page).locator('option').allTextContents()).sort()).toEqual(['No shoes', shoes.first.name, shoes.second.name].sort());
    await expect(shoeSelect(page).locator('option').first()).toHaveText('No shoes');
  });

  test('F01-ED-H2 a new title is saved, shown at once, and is what the run is called everywhere', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    await openDrawer(page);
    await titleBox(page).fill('  Windy   Sunday 8K ');
    await expect(saveButton(page)).toBeEnabled();
    await saveButton(page).click();

    await expect(drawer(page)).toHaveCount(0);
    await expect(heading(page)).toHaveText('Windy Sunday 8K');
    await expect(page.getByRole('status').filter({ hasText: SAVED })).toBeVisible();
    expect((await runOnServer()).name).toBe('Windy Sunday 8K');
    expect((await runner.api.get('/api/activities')).json.find((run: { id: number }) => run.id === mainId).name).toBe('Windy Sunday 8K');
    await expect(editButton(page)).toBeFocused();

    await page.goto('/runs');
    await expect(page.getByText('Windy Sunday 8K').first()).toBeVisible();
    await page.reload();
    await page.goto(`/runs/${mainId}`);
    await expect(heading(page)).toHaveText('Windy Sunday 8K');
  });

  test('F01-ED-H3 notes are saved, shown under the title with their lines, kept after a reload, and removed by clearing them', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    await expect(notesBlock(page)).toHaveCount(0);
    await openDrawer(page);
    const written = 'Windy on the bridge.\nLegs felt heavy after the hills.';
    await notesBox(page).fill(written);
    await expect(drawer(page)).toContainText(`${written.length} of 2000`);
    await saveButton(page).click();

    await expect(drawer(page)).toHaveCount(0);
    await expect(notesBlock(page)).toBeVisible();
    expect(await notesBlock(page).getByText(/Windy on the bridge/).evaluate((node) => node.textContent)).toBe('Windy on the bridge.\nLegs felt heavy after the hills.');
    expect((await editOnServer()).notes).toBe('Windy on the bridge.\nLegs felt heavy after the hills.');

    await page.reload();
    await expect(notesBlock(page)).toContainText('Legs felt heavy after the hills.');
    await openDrawer(page);
    await expect(notesBox(page)).toHaveValue('Windy on the bridge.\nLegs felt heavy after the hills.');
    await notesBox(page).fill('');
    await saveButton(page).click();
    await expect(drawer(page)).toHaveCount(0);
    await expect(notesBlock(page)).toHaveCount(0);
    expect((await editOnServer()).notes).toBeNull();
  });

  test('F01-ED-H3b long notes are folded until asked for, and short ones are not', async ({ browser, baseURL, guard }) => {
    const long = Array.from({ length: 8 }, (_, index) => `Line ${index + 1} of what I wrote about this run.`).join('\n');
    expect((await runner.api.patch(`/api/activities/${mainId}`, { notes: long })).status).toBe(200);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    const showAll = notesBlock(page).getByRole('button', { name: 'Show all' });
    await expect(showAll).toHaveAttribute('aria-expanded', 'false');
    const folded = await notesBlock(page).locator('p').evaluate((node) => node.getBoundingClientRect().height);
    await showAll.click();
    const full = await notesBlock(page).locator('p').evaluate((node) => node.getBoundingClientRect().height);
    expect(full).toBeGreaterThan(folded * 1.5);
    await expect(notesBlock(page).getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');

    expect((await runner.api.patch(`/api/activities/${mainId}`, { notes: 'Short note.' })).status).toBe(200);
    await page.reload();
    await expect(notesBlock(page)).toContainText('Short note.');
    await expect(notesBlock(page).getByRole('button')).toHaveCount(0);
  });

  test('F01-ED-H4 a rating used instead of the heart rate becomes the effort score, and un-ticking it takes the heart rate back', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    await expect(effortCard(page)).toContainText('From your heart-rate zones');
    const before = await metricsOnServer();
    expect(before.effort.source).toBe('HR_ZONES');
    const moving = (await runOnServer()).movingTimeSeconds as number;

    await openDrawer(page);
    await rating(page, 8).check();
    await expect(useRatingBox(page)).toBeEnabled();
    await expect(drawer(page)).toContainText('Rated 8 out of 10.');
    await useRatingBox(page).check();
    await saveButton(page).click();
    await expect(drawer(page)).toHaveCount(0);

    const expected = ratingScore(moving, 8);
    await expect(effortCard(page)).toContainText('From your rating of 8 out of 10, as you chose');
    await expect(effortCard(page)).toContainText(String(Math.round(expected)));
    await expect(effortCard(page)).toContainText('You chose to use this rating instead of the heart rate');
    const after = await metricsOnServer();
    expect(after.effort).toMatchObject({ source: 'PERCEIVED', perceivedExertion: 8, ratingPreferred: true });
    expect(after.effort.score).toBeCloseTo(expected, 1);
    expect((await editOnServer()).useRatingForEffort).toBe(true);

    await openDrawer(page);
    await expect(rating(page, 8)).toBeChecked();
    await expect(useRatingBox(page)).toBeChecked();
    await useRatingBox(page).uncheck();
    await saveButton(page).click();
    await expect(drawer(page)).toHaveCount(0);
    await expect(effortCard(page)).toContainText('From your heart-rate zones');
    const back = await metricsOnServer();
    expect(back.effort.source).toBe('HR_ZONES');
    expect(back.effort.score).toBeCloseTo(before.effort.score, 1);
    expect(back.effort).toMatchObject({ perceivedExertion: 8, ratingPreferred: false });
    await expect(effortCard(page)).toContainText('the effort score comes from this run');
    await expect(effortCard(page)).toContainText('Edit the run to use your rating instead');
  });

  test('F01-ED-H4b clearing the rating clears the choice to use it, and the rating cannot be used before it is given', async ({ browser, baseURL, guard }) => {
    expect((await runner.api.patch(`/api/activities/${mainId}`, { perceivedExertion: 6, useRatingForEffort: true })).status).toBe(200);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    await expect(effortCard(page)).toContainText('as you chose');
    await openDrawer(page);
    await drawer(page).getByRole('button', { name: 'Clear rating' }).click();
    await expect(useRatingBox(page)).toBeDisabled();
    await expect(useRatingBox(page)).not.toBeChecked();
    await expect(drawer(page).getByText('Rate the run first to use the rating for its effort.')).toBeVisible();
    await saveButton(page).click();
    await expect(drawer(page)).toHaveCount(0);

    const edit = await editOnServer();
    expect(edit.perceivedExertion).toBeNull();
    expect(edit.useRatingForEffort).toBe(false);
    await expect(effortCard(page)).toContainText('From your heart-rate zones');
    await expect(effortCard(page)).not.toContainText('as you chose');
  });

  test('F01-ED-H5 the run type and the tags are chosen in the panel, saved together, and the Type and tags card follows', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    await openDrawer(page);
    await runTypeRadio(page, 'Workout').check();
    await tagBox(page).fill('  Hill   repeats ');
    await tagBox(page).press('Enter');
    await tagBox(page).fill('windy');
    await drawer(page).getByRole('button', { name: 'Add tag', exact: true }).click();
    await expect(drawer(page).getByRole('list', { name: 'Tags' })).toContainText('Hill repeats');
    await expect(drawer(page)).toContainText('2 of 6');
    await expect(saveButton(page)).toBeEnabled();
    expect((await editOnServer()).tags).toEqual([]);
    await saveButton(page).click();
    await expect(drawer(page)).toHaveCount(0);

    const edit = await editOnServer();
    expect(edit.runType).toBe('WORKOUT');
    expect(edit.tags).toEqual(['Hill repeats', 'windy']);
    await expect(labelsCard(page).getByRole('radio', { name: 'Workout' })).toBeChecked();
    await expect(labelsCard(page).getByRole('list', { name: 'Tags' })).toContainText('Hill repeats');
    await expect(labelsCard(page).getByRole('list', { name: 'Tags' })).toContainText('windy');

    // The panel offers the tags the runner already uses, and removing one is a draft until Save.
    await openDrawer(page);
    await drawer(page).getByRole('button', { name: 'Remove tag windy' }).click();
    await drawer(page).getByRole('button', { name: 'Cancel' }).click();
    await drawer(page).getByRole('button', { name: 'Discard changes' }).click();
    expect((await editOnServer()).tags).toEqual(['Hill repeats', 'windy']);
    await page.goto(`/runs/${otherId}`);
    await openDrawer(page);
    await expect(drawer(page).getByRole('button', { name: 'Add tag Hill repeats' })).toBeVisible();
    await drawer(page).getByRole('button', { name: 'Add tag Hill repeats' }).click();
    await expect(drawer(page).getByRole('list', { name: 'Tags' })).toContainText('Hill repeats');
    await expect(drawer(page).getByRole('button', { name: 'Add tag Hill repeats' })).toHaveCount(0);
  });

  test('F01-ED-H6 a shoe is linked from the panel, shown on the gear card, changed, and unlinked', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    await openDrawer(page);
    await shoeSelect(page).selectOption({ label: shoes.first.name });
    await saveButton(page).click();
    await expect(drawer(page)).toHaveCount(0);
    await expect(page.getByText(shoes.first.name, { exact: true }).first()).toBeVisible();
    expect((await runOnServer()).shoeId).toBe(shoes.first.id);
    await expect(page.getByRole('button', { name: 'Unlink', exact: true })).toBeVisible();

    await openDrawer(page);
    await expect(shoeSelect(page)).toHaveValue(String(shoes.first.id));
    await shoeSelect(page).selectOption({ label: shoes.second.name });
    await saveButton(page).click();
    await expect(drawer(page)).toHaveCount(0);
    await expect(page.getByText(shoes.second.name, { exact: true }).first()).toBeVisible();
    expect((await runOnServer()).shoeId).toBe(shoes.second.id);

    await openDrawer(page);
    await shoeSelect(page).selectOption({ label: 'No shoes' });
    await saveButton(page).click();
    await expect(drawer(page)).toHaveCount(0);
    expect((await runOnServer()).shoeId).toBeNull();
    await expect(page.getByRole('button', { name: 'Unlink', exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Link Shoe', exact: true })).toBeVisible();
  });

  test('F01-ED-H7 everything can be changed at once: one request for the fields, one for the shoe', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    const sent: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'PATCH') sent.push(new URL(request.url()).pathname);
    });
    await openDrawer(page);
    await titleBox(page).fill('Track night');
    await notesBox(page).fill('6 x 800 with a 90 s jog');
    await rating(page, 9).check();
    await useRatingBox(page).check();
    await runTypeRadio(page, 'Workout').check();
    await tagBox(page).fill('track');
    await tagBox(page).press('Enter');
    await shoeSelect(page).selectOption({ label: shoes.second.name });
    await saveButton(page).click();
    await expect(drawer(page)).toHaveCount(0);

    expect(sent).toEqual([`/api/activities/${mainId}`, `/api/shoes/${shoes.second.id}/assign/${mainId}`]);
    const edit = await editOnServer();
    expect(edit).toMatchObject({ name: 'Track night', notes: '6 x 800 with a 90 s jog', perceivedExertion: 9, useRatingForEffort: true, runType: 'WORKOUT', tags: ['track'], shoeId: shoes.second.id });
    await expect(heading(page)).toHaveText('Track night');
    await expect(notesBlock(page)).toContainText('6 x 800 with a 90 s jog');
    await expect(effortCard(page)).toContainText('as you chose');
    await expect(labelsCard(page).getByRole('radio', { name: 'Workout' })).toBeChecked();
  });

  test('F01-ED-H8 leaving with unsaved changes asks first: keep editing, or discard, from Cancel, the close button and Escape', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);

    // Nothing changed: closes at once, with every way out.
    await openDrawer(page);
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toHaveCount(0);
    await expect(editButton(page)).toBeFocused();
    await openDrawer(page);
    await drawer(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(drawer(page)).toHaveCount(0);
    await openDrawer(page);
    await drawer(page).getByRole('button', { name: 'Close' }).click();
    await expect(drawer(page)).toHaveCount(0);

    // Something changed: asked.
    for (const way of ['Escape', 'Cancel', 'Close']) {
      await openDrawer(page);
      await notesBox(page).fill('half a thought');
      if (way === 'Escape') await page.keyboard.press('Escape');
      else await drawer(page).getByRole('button', { name: way }).click();
      await expect(drawer(page).getByRole('alertdialog')).toContainText('You have unsaved changes.');
      await drawer(page).getByRole('button', { name: 'Keep editing' }).click();
      await expect(notesBox(page)).toHaveValue('half a thought');
      await expect(saveButton(page)).toBeEnabled();
      if (way === 'Escape') await page.keyboard.press('Escape');
      else await drawer(page).getByRole('button', { name: way }).click();
      await drawer(page).getByRole('button', { name: 'Discard changes' }).click();
      await expect(drawer(page)).toHaveCount(0);
      expect((await editOnServer()).notes).toBeNull();
    }
    // A reopened drawer starts from the saved run, not from the thrown-away draft.
    await openDrawer(page);
    await expect(notesBox(page)).toHaveValue('');
  });

  test('F01-ED-H9 the panel shows what the server holds now, so a change made in another tab is not overwritten by a stale one', async ({ browser, baseURL, guard }) => {
    const first = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(first);
    const second = await pages.tab(first, `/runs/${mainId}`);
    await expect(editButton(second)).toBeVisible();

    await openDrawer(first);
    await titleBox(first).fill('Changed in the first tab');
    await saveButton(first).click();
    await expect(drawer(first)).toHaveCount(0);

    // The second tab still shows the old title. Its panel loads the run afresh, and saves only the notes.
    await expect(heading(second)).toHaveText(ORIGINAL);
    await openDrawer(second);
    await expect(titleBox(second)).toHaveValue('Changed in the first tab');
    await notesBox(second).fill('and notes from the second');
    await saveButton(second).click();
    await expect(drawer(second)).toHaveCount(0);

    const edit = await editOnServer();
    expect(edit.name).toBe('Changed in the first tab');
    expect(edit.notes).toBe('and notes from the second');
  });
});

// --- negative cases -----------------------------------------------------------------------------------------------------------

test.describe('F01 edit a run: what is refused', () => {
  test('F01-ED-N1 a title that is empty or only spaces is refused with a message, the cursor goes there and nothing is sent', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    let sent = 0;
    page.on('request', (request) => {
      if (request.method() === 'PATCH') sent += 1;
    });
    await openDrawer(page);
    for (const text of ['', '    ']) {
      await titleBox(page).fill(text);
      await saveButton(page).click();
      await expect(drawer(page).getByRole('alert')).toContainText('A run needs a title.');
      await expect(titleBox(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(titleBox(page)).toBeFocused();
    }
    await titleBox(page).fill('Fixed');
    await expect(drawer(page).getByRole('alert')).toHaveCount(0);
    expect(sent).toBe(0);
    expect((await editOnServer()).name).toBe(ORIGINAL);
  });

  test('F01-ED-N2 notes with a control character are refused with a message, and the title typed beside them is not saved either', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    await openDrawer(page);
    await titleBox(page).fill('A fine title');
    await notesBox(page).fill('bell\u0007');
    await saveButton(page).click();
    await expect(drawer(page).getByRole('alert')).toContainText('Notes cannot contain control characters.');
    await expect(notesBox(page)).toHaveAttribute('aria-invalid', 'true');
    expect((await editOnServer()).name).toBe(ORIGINAL);
  });

  test('F01-ED-N3 the boxes stop at the limits: 120 characters for a title, 2000 for notes', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    await openDrawer(page);
    await titleBox(page).fill('t'.repeat(150));
    await expect(titleBox(page)).toHaveValue('t'.repeat(120));
    await expect(drawer(page)).toContainText('120 of 120');
    await notesBox(page).fill('n'.repeat(2300));
    await expect(notesBox(page)).toHaveValue('n'.repeat(2000));
    await expect(drawer(page)).toContainText('2000 of 2000');
    await saveButton(page).click();
    await expect(drawer(page)).toHaveCount(0);
    const edit = await editOnServer();
    expect(edit.name).toHaveLength(120);
    expect(edit.notes).toHaveLength(2000);
    await expect(heading(page)).toHaveText('t'.repeat(120));
    await expectNoHorizontalOverflow(page);
  });

  test('F01-ED-N4 the API refuses what is not a title, notes or a choice, with a reason, and saves none of the good values beside it', async () => {
    const cases: Array<[string, unknown, string, RegExp]> = [
      ['a title that is null', { name: null }, 'INVALID_NAME', /title/i],
      ['an empty title', { name: '' }, 'INVALID_NAME', /needs a title/],
      ['a title of only spaces', { name: '   \t ' }, 'INVALID_NAME', /needs a title/],
      ['a title that is a number', { name: 42 }, 'INVALID_NAME', /words/],
      ['a title of 121 characters', { name: 'x'.repeat(121) }, 'INVALID_NAME', /120/],
      ['a title with a control character', { name: 'bell\u0007' }, 'INVALID_NAME', /control/],
      ['notes that are a list', { notes: ['a'] }, 'INVALID_NOTES', /words/],
      ['notes of 2001 characters', { notes: 'n'.repeat(2001) }, 'INVALID_NOTES', /2000/],
      ['notes with a control character', { notes: 'bell\u0007' }, 'INVALID_NOTES', /control/],
      ['a choice to use the rating that is not true or false', { useRatingForEffort: 'yes' }, 'INVALID_USE_RATING_FOR_EFFORT', /true or false/],
      ['the rating used with no rating', { useRatingForEffort: true }, 'RATING_REQUIRED', /Rate how the run felt/],
      ['the rating used with the rating cleared', { perceivedExertion: null, useRatingForEffort: true }, 'RATING_REQUIRED', /Rate how the run felt/],
      ['a field that cannot be edited', { name: 'Fine', distanceKm: 99 }, 'UNSUPPORTED_FIELD', /distanceKm/],
      ['the shoe, which has a route of its own', { shoeId: 3 }, 'UNSUPPORTED_FIELD', /shoeId/],
    ];
    for (const [what, body, code, reason] of cases) {
      const res = await runner.api.patch(`/api/activities/${mainId}`, body);
      expect(res.status, what).toBe(400);
      expect(res.json.code, what).toBe(code);
      expect(res.json.error, what).toMatch(reason);
    }
    const mixed = await runner.api.patch(`/api/activities/${mainId}`, { name: 'Good title', notes: 'n'.repeat(2001), perceivedExertion: 7 });
    expect(mixed.status).toBe(400);
    const edit = await editOnServer();
    expect(edit).toMatchObject({ name: ORIGINAL, notes: null, perceivedExertion: null });
  });

  test('F01-ED-N5 another runner cannot read or change this run, and signed out nothing can be read or changed', async ({ seed }) => {
    const stranger = await newRunner('editrun-stranger');
    expect((await stranger.api.get(`/api/activities/${mainId}/edit`)).status).toBe(404);
    expect((await stranger.api.patch(`/api/activities/${mainId}`, { name: 'Not yours', notes: 'or yours' })).status).toBe(404);
    expect((await stranger.api.patch(`/api/shoes/${shoes.first.id}/assign/${mainId}`)).status).toBeGreaterThanOrEqual(400);
    const nobody = new Api(seed.baseUrl, null);
    expect((await nobody.get(`/api/activities/${mainId}/edit`)).status).toBe(401);
    expect((await nobody.patch(`/api/activities/${mainId}`, { name: 'x' })).status).toBe(401);
    expect((await editOnServer()).name).toBe(ORIGINAL);
  });

  test('F01-ED-N6 a save that fails on the network says so, keeps what was typed, and the same Save works once the network is back', async ({ browser, baseURL, guard }) => {
    guard.allow(/ERR_FAILED/);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    await openDrawer(page);
    let offline = true;
    await page.route(`**/api/activities/${mainId}`, (route) => (route.request().method() === 'PATCH' && offline ? route.abort('failed') : route.continue()));
    await titleBox(page).fill('Typed while offline');
    await saveButton(page).click();
    await expect(drawer(page).getByRole('alert')).toContainText('The run could not be saved, so nothing was changed. Try again.');
    await expect(titleBox(page)).toHaveValue('Typed while offline');
    await expect(drawer(page)).toBeVisible();
    expect((await editOnServer()).name).toBe(ORIGINAL);

    offline = false;
    await saveButton(page).click();
    await expect(drawer(page)).toHaveCount(0);
    expect((await editOnServer()).name).toBe('Typed while offline');
  });

  test('F01-ED-N7 a save the server refuses says so, and the shoe failing after the rest was saved says that too and can be tried again', async ({ browser, baseURL, guard }) => {
    guard.allow(/status of 400|status of 500|HTTP 500/);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    await openDrawer(page);
    let mode: 'refuse' | 'shoe-down' | 'working' = 'refuse';
    await page.route(`**/api/activities/${mainId}`, (route) =>
      route.request().method() === 'PATCH' && mode === 'refuse'
        ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'nope', code: 'INVALID_NAME' }) })
        : route.continue());
    await page.route(`**/api/shoes/*/assign/${mainId}`, (route) =>
      mode === 'shoe-down' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"down"}' }) : route.continue());

    await titleBox(page).fill('Refused once');
    await saveButton(page).click();
    await expect(drawer(page).getByRole('alert')).toContainText('That was not accepted. Check the title and the notes.');
    await expect(titleBox(page)).toHaveValue('Refused once');

    mode = 'shoe-down';
    await shoeSelect(page).selectOption({ label: shoes.first.name });
    await saveButton(page).click();
    await expect(drawer(page).getByRole('alert')).toContainText('Everything else was saved, but the shoes could not be changed.');
    expect((await editOnServer()).name).toBe('Refused once');
    await expect(heading(page)).toHaveText('Refused once');
    await expect(saveButton(page)).toBeEnabled();

    mode = 'working';
    await saveButton(page).click();
    await expect(drawer(page)).toHaveCount(0);
    expect((await runOnServer()).shoeId).toBe(shoes.first.id);
  });
});

// --- edge cases ---------------------------------------------------------------------------------------------------------------

test.describe('F01 edit a run: edges', () => {
  test('F01-ED-E1 a double click on Save sends one request', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    await openDrawer(page);
    await titleBox(page).fill('Once only');
    let sent = 0;
    page.on('request', (request) => {
      if (request.method() === 'PATCH') sent += 1;
    });
    await saveButton(page).dblclick();
    await expect(drawer(page)).toHaveCount(0);
    expect(sent).toBe(1);
  });

  test('F01-ED-E2 in Chinese the panel, the notes and the effort words are translated and show no raw key', async ({ browser, baseURL, guard }) => {
    expect((await runner.api.patch(`/api/activities/${mainId}`, { notes: '今天风很大。', perceivedExertion: 7, useRatingForEffort: true })).status).toBe(200);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(`/runs/${mainId}`);
    await expect(page.getByRole('region', { name: '备注', exact: true })).toContainText('今天风很大。');
    await expect(page.getByText('按你的选择，根据你给出的 7/10 自觉强度计算')).toBeVisible();
    await page.getByRole('button', { name: '编辑', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '编辑跑步' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: '标题' })).toHaveValue(ORIGINAL);
    await expect(dialog.getByRole('textbox', { name: '备注' })).toHaveValue('今天风很大。');
    await expect(dialog.getByRole('radio', { name: '7 分（满分 10）' })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: '这次跑步的强度用我的评分，不用心率' })).toBeChecked();
    await expect(dialog.getByRole('combobox', { name: '跑鞋' })).toBeVisible();
    await dialog.getByRole('textbox', { name: '标题' }).fill('');
    await dialog.getByRole('button', { name: '保存修改' }).click();
    await expect(dialog.getByRole('alert')).toContainText('跑步需要一个标题。');
    await dialog.getByRole('textbox', { name: '备注' }).fill('x');
    await dialog.getByRole('button', { name: '取消' }).click();
    await expect(dialog.getByRole('alertdialog')).toContainText('你有尚未保存的修改。');
    await expectNoRawKeys(page);
  });

  test('F01-ED-E3 the panel and the notes have no serious accessibility violations and their text reaches 4.5 to 1, in both themes', async ({ browser, baseURL, guard }) => {
    expect((await runner.api.patch(`/api/activities/${mainId}`, { notes: 'Windy on the bridge.\nLegs heavy.', perceivedExertion: 6, runType: 'WORKOUT', tags: ['hills', 'windy'] })).status).toBe(200);
    for (const theme of ['light', 'midnight']) {
      const page = await pages.open(browser, baseURL, guard, runner, null);
      await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
      await openRun(page);
      expect(await contrastProblems(page, { include: ['.run-detail-v2__notes'] }), `${theme}, notes, contrast`).toEqual([]);

      await openDrawer(page);
      await page.waitForTimeout(400); // the slide-in
      expect(await a11yViolations(page, { include: ['[role="dialog"]'] }), `${theme}, drawer`).toEqual([]);
      expect(await contrastProblems(page, { include: ['[role="dialog"]'] }), `${theme}, drawer, contrast`).toEqual([]);

      await titleBox(page).fill('');
      await saveButton(page).click();
      await expect(drawer(page).getByRole('alert')).toBeVisible();
      expect(await a11yViolations(page, { include: ['[role="dialog"]'] }), `${theme}, drawer with a problem`).toEqual([]);
      expect(await contrastProblems(page, { include: ['[role="dialog"]'] }), `${theme}, drawer with a problem, contrast`).toEqual([]);

      await titleBox(page).fill('Something else');
      await drawer(page).getByRole('button', { name: 'Cancel' }).click();
      await expect(drawer(page).getByRole('alertdialog')).toBeVisible();
      expect(await a11yViolations(page, { include: ['[role="dialog"]'] }), `${theme}, drawer asking`).toEqual([]);
      expect(await contrastProblems(page, { include: ['[role="dialog"]'] }), `${theme}, drawer asking, contrast`).toEqual([]);
    }
  });

  test('F01-ED-E4 on a phone the panel fills the screen, fits it, can be used with a thumb, and Escape and the keyboard still work', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await page.setViewportSize({ width: 375, height: 812 });
    await openRun(page);
    await openDrawer(page);
    await page.waitForTimeout(400);
    const box = await drawer(page).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(374);
    await expectNoHorizontalOverflow(page);
    for (const control of [titleBox(page), notesBox(page), rating(page, 5), runTypeRadio(page, 'Race'), tagBox(page), shoeSelect(page), saveButton(page)]) {
      await control.scrollIntoViewIfNeeded();
      const size = await control.boundingBox();
      expect(size?.height ?? 0, 'touch target height').toBeGreaterThanOrEqual(38);
      expect(size?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((size?.x ?? 0) + (size?.width ?? 0)).toBeLessThanOrEqual(376);
    }
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toHaveCount(0);
  });

  test('F01-ED-E5 keyboard only: Tab goes round inside the panel, Enter in the tag box adds a tag instead of saving, and focus comes back to Edit', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    await editButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(titleBox(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(notesBox(page)).toBeFocused();
    await page.keyboard.type('typed with the keyboard');

    // Round the whole panel with Tab: focus never leaves it.
    const seen = new Set<string>();
    for (let step = 0; step < 60; step += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
      expect(inside, `focus after ${step + 1} tabs is inside the panel`).toBe(true);
      seen.add(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim() ?? ''));
    }
    expect([...seen].some((name) => /Save changes/.test(name))).toBe(true);
    expect([...seen].some((name) => /Cancel/.test(name))).toBe(true);

    await tagBox(page).focus();
    await page.keyboard.type('windy');
    await page.keyboard.press('Enter');
    await expect(drawer(page).getByRole('list', { name: 'Tags' })).toContainText('windy');
    expect((await editOnServer()).tags).toEqual([]);
    await expect(drawer(page)).toBeVisible();

    await saveButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(drawer(page)).toHaveCount(0);
    await expect(editButton(page)).toBeFocused();
    expect(await editOnServer()).toMatchObject({ notes: 'typed with the keyboard', tags: ['windy'] });
  });

  test('F01-ED-E6 an emoji, accents and Chinese in a title and in notes are saved and shown whole', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    await openDrawer(page);
    await titleBox(page).fill('晨跑 10 公里 🏃‍♀️ Café');
    await notesBox(page).fill('Muy bien – “sin dolor”.\n腿很轻 🙂');
    await saveButton(page).click();
    await expect(drawer(page)).toHaveCount(0);
    await expect(heading(page)).toHaveText('晨跑 10 公里 🏃‍♀️ Café');
    await expect(notesBlock(page)).toContainText('腿很轻 🙂');
    expect(await editOnServer()).toMatchObject({ name: '晨跑 10 公里 🏃‍♀️ Café', notes: 'Muy bien – “sin dolor”.\n腿很轻 🙂' });
  });

  test('F01-ED-E7 notes belong to their run alone: another run shows none, and no list carries them', async ({ browser, baseURL, guard }) => {
    expect((await runner.api.patch(`/api/activities/${mainId}`, { notes: 'only on the main run' })).status).toBe(200);
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page, otherId);
    await expect(notesBlock(page)).toHaveCount(0);
    await expect(page.getByText('only on the main run')).toHaveCount(0);
    expect((await runOnServer(otherId)).notes).toBeNull();
    for (const route of ['/api/activities', '/api/activities/analysis']) {
      expect(JSON.stringify((await runner.api.get(route)).json), route).not.toContain('only on the main run');
    }
    expect((await runner.api.get('/api/training/log')).ok).toBe(true);
    expect(JSON.stringify((await runner.api.get('/api/training/log')).json)).not.toContain('only on the main run');
  });

  test('F01-ED-E8 the data export holds the title, the notes, the rating and the choice to use it, with notes quoted', async ({ seed }) => {
    expect((await runner.api.patch(`/api/activities/${mainId}`, { notes: 'Windy, "cold" hands.\nSecond line.', perceivedExertion: 7, useRatingForEffort: true, name: 'Export, "quoted" title' })).status).toBe(200);
    const res = await fetch(`${seed.baseUrl}/api/account/export`, { headers: { Authorization: `Bearer ${runner.token}`, 'X-Forwarded-For': runner.api.clientIp ?? '' } });
    expect(res.status).toBe(200);
    const files = unzip(Buffer.from(await res.arrayBuffer()));
    const csv = files.get('runs.csv')?.toString('utf8') ?? '';
    expect(csv.split(/\r?\n/)[0]).toMatch(/,run_type,tags,perceived_exertion,use_rating_for_effort,notes$/);
    expect(csv).toContain('"Export, ""quoted"" title"');
    expect(csv).toContain(',7,true,"Windy, ""cold"" hands.\nSecond line."');
    expect(files.get('README.txt')?.toString('utf8')).toContain('notes is what you wrote about the run');
  });

  test('F01-ED-E9 a run that was edited elsewhere is not shown stale: the page asks again for the cards drawn from the edit', async ({ browser, baseURL, guard }) => {
    const page = await pages.open(browser, baseURL, guard, runner, null);
    await openRun(page);
    await expect(effortCard(page)).toContainText('From your heart-rate zones');
    await openDrawer(page);
    await rating(page, 4).check();
    await runTypeRadio(page, 'Long run').check();
    await saveButton(page).click();
    await expect(drawer(page)).toHaveCount(0);
    // Without a reload: the rating is on the Effort card's scale, and the Type and tags card shows the new type.
    await expect(effortCard(page).getByRole('button', { name: '4 out of 10' })).toHaveAttribute('aria-pressed', 'true');
    await expect(labelsCard(page).getByRole('radio', { name: 'Long run' })).toBeChecked();
  });

  test('F01-ED-E10 saves from several tabs at the same moment all land: a field one of them did not name is never undone, and a tag they share does not fail', async () => {
    // Four requests at once, each naming other fields, two of them the same tag: the run's row is taken in turn, so none of them
    // writes back what it read before the others finished. Five rounds, on whichever database the stack runs on.
    for (let round = 0; round < 5; round += 1) {
      const title = `Tabs round ${round}`;
      const notes = `Notes from round ${round}`;
      const answers = await Promise.all([
        runner.api.patch(`/api/activities/${mainId}`, { name: title }),
        runner.api.patch(`/api/activities/${mainId}`, { notes }),
        runner.api.patch(`/api/activities/${mainId}`, { perceivedExertion: 6, useRatingForEffort: true }),
        runner.api.patch(`/api/activities/${mainId}`, { runType: 'WORKOUT', tags: [`Shared ${round}`, 'track'] }),
        runner.api.patch(`/api/activities/${mainId}`, { tags: [`shared ${round}`, 'hills'] }),
      ]);
      expect(answers.map((answer) => answer.status), JSON.stringify(answers.map((answer) => answer.json))).toEqual([200, 200, 200, 200, 200]);
      const run = await runOnServer();
      expect(run.name).toBe(title);
      expect(run.notes).toBe(notes);
      const edit = await editOnServer();
      expect(edit.perceivedExertion).toBe(6);
      expect(edit.useRatingForEffort).toBe(true);
      expect(edit.runType).toBe('WORKOUT');
      // One request's whole set, never a mix of the two and never the same word twice.
      expect([...edit.tags].map((tag: string) => tag.toLowerCase()).sort()).toEqual(
        edit.tags.includes('track') ? [`shared ${round}`, 'track'].sort() : [`shared ${round}`, 'hills'].sort(),
      );
    }
  });
});
