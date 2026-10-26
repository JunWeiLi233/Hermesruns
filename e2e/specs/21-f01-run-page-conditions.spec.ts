// F01 again, under the conditions the happy path does not cover: failed and slow requests, an expired session,
// double clicks, two tabs, the keyboard, a phone, Chinese, a screen-reader scan, time zones, and deleting a run.
import type { Page } from '@playwright/test';
import { Api, newRunner } from '../fixtures/api.ts';
import { daysAgo, gpxRun, rollingHills } from '../fixtures/gpx.ts';
import { a11yViolations, contextFor, contextWith, expect, expectNoHorizontalOverflow, expectNoRawKeys, openRun, prepareContext, signedIn, test } from '../fixtures/test.ts';

test.use({ storageState: signedIn('a') });

const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

test.describe('F01 failed and slow requests', () => {
  test('F01-E11 a failing pace profile shows its own error and a Try again that works; the other cards are unaffected', async ({ page, seed, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    let failures = 1;
    await page.route('**/api/activities/*/pace-profile', (route) => {
      if (failures-- > 0) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' });
      return route.continue();
    });
    await page.goto(`/runs/${seed.ids.hills}`);
    const card = region(page, 'Pace analysis');
    await expect(card.getByRole('alert')).toHaveText('The pace analysis could not be loaded.');
    await expect(region(page, 'Effort')).toContainText('142');
    await expect(region(page, 'Best efforts').getByRole('table')).toBeVisible();
    await card.getByRole('button', { name: 'Try again' }).click();
    await expect(card.locator('dt:has-text("Fastest") + dd')).toHaveText('4:30 /km');
    await expect(card.getByRole('alert')).toHaveCount(0);
  });

  test('F01-E12 a failing effort request: the card says so, keeps its navigation anchor, and Try again recovers', async ({ page, seed, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    let failures = 1;
    await page.route('**/api/activities/*/training-metrics', (route) => {
      if (failures-- > 0) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' });
      return route.continue();
    });
    await page.goto(`/runs/${seed.ids.hills}`);
    const alert = page.getByRole('alert').filter({ hasText: 'Effort and heart-rate zones could not be loaded.' });
    await expect(alert).toBeVisible();
    await page.getByRole('navigation', { name: 'Run detail navigation' }).getByRole('link', { name: 'Effort and zones' }).click();
    await expect(page.locator('#run-detail-effort')).toBeInViewport();
    await alert.locator('xpath=..').getByRole('button', { name: 'Try again' }).click();
    await expect(region(page, 'Effort')).toContainText('142');
    await expect(region(page, 'Heart-rate zones')).toContainText('Zone 4 · Hard');
  });

  test('F01-E13 offline: best efforts and same-route runs fail separately, each with Try again', async ({ page, seed, guard }) => {
    guard.allow(/ERR_FAILED/);
    let offline = true;
    await page.route(/\/api\/activities\/\d+\/(best-efforts|matches)$/, (route) => (offline ? route.abort('failed') : route.continue()));
    await page.goto(`/runs/${seed.ids.loop3}`);
    await expect(region(page, 'Best efforts')).toContainText('The best efforts could not be loaded.');
    await expect(region(page, 'Same-route runs')).toContainText('The runs over the same route could not be loaded.');
    await expect(region(page, 'Pace analysis').locator('dt:has-text("Fastest") + dd')).toBeVisible();
    offline = false;
    await region(page, 'Best efforts').getByRole('button', { name: 'Try again' }).click();
    await expect(region(page, 'Best efforts').getByRole('table')).toBeVisible();
    await region(page, 'Same-route runs').getByRole('button', { name: 'Try again' }).click();
    await expect(region(page, 'Same-route runs')).toContainText('You have run this route 3 times');
  });

  test('F01-E14 slow network: the pace card says it is loading, the rest of the page is usable meanwhile', async ({ page, seed }) => {
    await page.route('**/api/activities/*/pace-profile', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });
    await page.goto(`/runs/${seed.ids.hills}`);
    await expect(region(page, 'Pace analysis')).toContainText('Loading pace analysis...');
    await expect(region(page, 'Effort')).toContainText('142');
    await expect(region(page, 'Pace analysis').locator('dt:has-text("Fastest") + dd')).toHaveText('4:30 /km', { timeout: 15_000 });
  });

  test('F01-E15 switching runs while the first run is still loading never shows the first run\'s numbers on the second', async ({ page, seed }) => {
    // loop3 (4:55 /km) is slow to answer; the runner moves on to loop2 (5:05 /km) through the same-route table.
    await page.route(new RegExp(`/api/activities/${seed.ids.loop3}/pace-profile$`), async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      await route.continue();
    });
    await page.goto(`/runs/${seed.ids.loop3}`);
    await expect(region(page, 'Same-route runs')).toContainText('You have run this route 3 times');
    await region(page, 'Same-route runs').getByRole('link', { name: /Sep \d+, \d{4}/ }).click();
    await expect(page).toHaveURL(new RegExp(`/runs/${seed.ids.loop2}$`));
    const fastest = region(page, 'Pace analysis').locator('dt:has-text("Fastest") + dd');
    await expect(fastest).toHaveText('5:05 /km');
    await page.waitForTimeout(5000); // the late answer for the first run arrives now
    await expect(fastest).toHaveText('5:05 /km');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E Park loop (middle)');
  });
});

test.describe('F01 session and tabs', () => {
  test('F01-E16 an expired session sends you to the sign-in page and forgets the dead token', async ({ browser, baseURL, seed, guard }) => {
    guard.allow(/status of 401/);
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [{ origin: baseURL as string, localStorage: [{ name: 'hermes_jwt', value: 'expired-token' }, { name: 'hermes_email', value: seed.a.email }] }] },
    });
    await prepareContext(context, baseURL as string);
    guard.watch(context);
    try {
      const page = await context.newPage();
      await page.goto(`/runs/${seed.ids.hills}`);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('hermes_jwt'))).toBeNull();
      await expect(page.locator('body')).not.toContainText('E2E Hill intervals');
    } finally {
      await context.close();
    }
  });

  test('F01-E17 two tabs: a rating saved in one is what the other shows after a reload, and neither errors', async ({ context, seed, api }) => {
    const first = await context.newPage();
    const second = await context.newPage();
    try {
      await openRun(first, 'nohr');
      await openRun(second, 'nohr');
      await region(first, 'Effort').getByRole('button', { name: '3 out of 10' }).click();
      await expect(region(first, 'Effort').getByRole('status')).toContainText('Rating saved.');
      // The second tab still shows the old state; rating there overwrites the first tab's value.
      await region(second, 'Effort').getByRole('button', { name: '8 out of 10' }).click();
      await expect(region(second, 'Effort').getByRole('status')).toContainText('Rating saved.');
      await first.reload();
      await expect(region(first, 'Effort').getByRole('button', { name: '8 out of 10' })).toHaveAttribute('aria-pressed', 'true');
      await expect(region(first, 'Effort').getByRole('button', { name: '3 out of 10' })).toHaveAttribute('aria-pressed', 'false');
    } finally {
      await api.patch(`/api/activities/${seed.ids.nohr}`, { perceivedExertion: null });
    }
  });

  test('F01-E18 double click on a rating or on Save sends one request, not two', async ({ page, seed, api }) => {
    const patches: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'PATCH') patches.push(`${request.url().split('/api/')[1]} ${request.postData()}`);
    });
    await openRun(page, 'nohr');
    try {
      await region(page, 'Effort').getByRole('button', { name: '6 out of 10' }).dblclick();
      await expect(region(page, 'Effort').getByRole('status')).toContainText('Rating saved.');
      expect(patches.filter((entry) => entry.startsWith(`activities/${seed.ids.nohr} `)), 'PATCH requests for one double-clicked rating').toHaveLength(1);

      patches.length = 0;
      const efforts = region(page, 'Best efforts');
      await efforts.getByRole('button', { name: 'Edit the time for 1 km' }).click();
      await efforts.getByRole('textbox', { name: 'Time for 1 km' }).fill('7:00');
      await efforts.getByRole('button', { name: 'Save', exact: true }).dblclick();
      await expect(efforts.getByRole('status')).toContainText('Time saved.');
      expect(patches.filter((entry) => entry.includes('best-efforts')), 'PATCH requests for one double-clicked Save').toHaveLength(1);
    } finally {
      await api.patch(`/api/activities/${seed.ids.nohr}`, { perceivedExertion: null });
      await api.patch(`/api/activities/${seed.ids.nohr}/best-efforts/1km`, { elapsedSeconds: null });
    }
  });

  test('F01-E19 refresh in the middle of editing a chip time: the draft is gone, nothing was saved, the page is where it was', async ({ page, seed, api }) => {
    await openRun(page, 'flat');
    const efforts = region(page, 'Best efforts');
    await efforts.getByRole('button', { name: 'Edit the time for 1 km' }).click();
    await efforts.getByRole('textbox', { name: 'Time for 1 km' }).fill('4:10');
    await page.getByRole('navigation', { name: 'Run detail navigation' }).getByRole('link', { name: 'Best efforts' }).click();
    await page.reload();
    await expect(page).toHaveURL(/#run-detail-efforts$/);
    await expect(region(page, 'Best efforts').getByRole('table')).toBeVisible();
    await expect(region(page, 'Best efforts').getByRole('textbox')).toHaveCount(0);
    const one = (await api.get(`/api/activities/${seed.ids.flat}/best-efforts`)).json.efforts.find((effort: { distanceKey: string }) => effort.distanceKey === '1km');
    expect(one.edited).toBe(false);
  });

  test('F01-E20 back button from a run returns to the run list', async ({ page }) => {
    await page.goto('/runs');
    await page.getByRole('textbox', { name: 'Search runs by name...' }).fill('Flat steady');
    await page.getByRole('button', { name: /E2E Flat steady 6k/ }).first().click();
    await expect(page).toHaveURL(/\/runs\/\d+$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/runs$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Recent Runs' })).toBeVisible();
  });
});

test.describe('F01 keyboard and screen reader', () => {
  test('F01-E21 keyboard only: rate a run, edit a chip time with Enter and cancel it with Escape', async ({ page, seed, api }) => {
    await openRun(page, 'nohr');
    try {
      const five = region(page, 'Effort').getByRole('button', { name: '5 out of 10' });
      await five.focus();
      await page.keyboard.press('Enter');
      await expect(region(page, 'Effort').getByRole('status')).toContainText('Rating saved.');
      await expect(five).toHaveAttribute('aria-pressed', 'true');

      const efforts = region(page, 'Best efforts');
      const edit = efforts.getByRole('button', { name: 'Edit the time for 1 km' });
      await edit.focus();
      await page.keyboard.press('Enter');
      const box = efforts.getByRole('textbox', { name: 'Time for 1 km' });
      await expect(box).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(box).toHaveCount(0);
      await expect(efforts.getByRole('button', { name: 'Edit the time for 1 km' })).toBeFocused();

      await edit.focus();
      await page.keyboard.press('Enter');
      await box.fill('8:00');
      await page.keyboard.press('Enter');
      await expect(efforts.getByRole('status')).toContainText('Time saved.');
    } finally {
      await api.patch(`/api/activities/${seed.ids.nohr}`, { perceivedExertion: null });
      await api.patch(`/api/activities/${seed.ids.nohr}/best-efforts/1km`, { elapsedSeconds: null });
    }
  });

  test('F01-E22 keyboard only: the pace chart can be read with the arrow keys', async ({ page }) => {
    await openRun(page, 'hills');
    const chart = region(page, 'Pace analysis').getByRole('group', { name: /Pace along the run/ });
    await chart.focus();
    await page.keyboard.press('ArrowRight');
    const readout = chart.getByRole('status');
    await expect(readout).not.toHaveText('');
    const first = await readout.innerText();
    await page.keyboard.press('ArrowRight');
    await expect(readout).not.toHaveText(first);
  });

  test('F01-E23 the run page has no serious or critical accessibility violations', async ({ page }) => {
    await openRun(page, 'hills');
    await expect(region(page, 'Best efforts').getByRole('table')).toBeVisible();
    expect(await a11yViolations(page, { exclude: ['.leaflet-container'] })).toEqual([]);
  });

  test('F01-E23b the telemetry chart has a text alternative that says what it shows', async ({ page }) => {
    await openRun(page, 'hills');
    await expect(region(page, 'Best efforts').getByRole('table')).toBeVisible();
    expect(await a11yViolations(page, { exclude: ['.leaflet-container'], onlyRules: ['role-img-alt'] })).toEqual([]);
    await expect(page.locator('canvas[role="img"]').first()).toHaveAttribute('aria-label', /^Heart Rate along the run, from 150 bpm to 172 bpm$/);
  });

  test('F01-E23c the run page: text contrast of at least 4.5 to 1 in the light theme', async ({ page }) => {
    await openRun(page, 'hills');
    await expect(region(page, 'Best efforts').getByRole('table')).toBeVisible();
    expect(await a11yViolations(page, { exclude: ['.leaflet-container'], onlyRules: ['color-contrast'] })).toEqual([]);
  });

  test('F01-E24 the Runs list has no serious or critical accessibility violations', async ({ page }) => {
    await page.goto('/runs');
    await expect(page.getByRole('heading', { level: 1, name: 'Recent Runs' })).toBeVisible();
    expect(await a11yViolations(page)).toEqual([]);
  });
});

test.describe('F01 languages and phones', () => {
  test.use({ locale: 'zh-CN' });

  test('F01-E25 in Chinese every card has its Chinese title and no raw translation key shows', async ({ page, seed }) => {
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(`/runs/${seed.ids.hills}`);
    await expect(page.getByRole('region', { name: '配速分析' })).toBeVisible();
    await expect(page.getByRole('region', { name: '强度', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: '心率区间' })).toBeVisible();
    await expectNoRawKeys(page);
    await page.goto(`/runs/${seed.ids.scrap}`);
    await expect(page.getByRole('region', { name: '配速分析' })).toBeVisible();
    await expectNoRawKeys(page);
  });

  test('F01-E25b in Chinese the sentence that compares the run with the recent ones is Chinese all through (BUG-033)', async ({ page, seed }) => {
    await page.addInitScript(() => localStorage.setItem('hermes_lang', 'zh-CN'));
    await page.goto(`/runs/${seed.ids.hills}`);
    const note = page.locator('#run-detail-comparison');
    await expect(note).toBeVisible();
    const sentence = (await note.locator('strong').first().innerText()).trim();
    expect(sentence, 'the window is "5 次跑步", not an English "5-run"').toMatch(/最近 \d+ 次跑步平均配速/);
    expect(sentence).not.toMatch(/-run|[A-Za-z]{3,}/);
  });
});

test.describe('F01 phone width', () => {
  test('F01-E26 @mobile the run page fits a 375 px phone, and the ratings can be tapped', async ({ page, seed }) => {
    await page.goto(`/runs/${seed.ids.hills}`);
    await expect(region(page, 'Pace analysis')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    for (const name of ['Pace analysis', 'Effort', 'Heart-rate zones', 'Best efforts', 'Same-route runs']) {
      await region(page, name).scrollIntoViewIfNeeded();
      await expectNoHorizontalOverflow(page);
    }
    // Touch targets of at least 24 x 24 px (WCAG 2.2, 2.5.8).
    await region(page, 'Effort').scrollIntoViewIfNeeded();
    for (const rating of await region(page, 'Effort').getByRole('button', { name: /out of 10/ }).all()) {
      const box = await rating.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(24);
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
  });

  test('F01-E27 @mobile the Runs list fits a phone', async ({ page }) => {
    await page.goto('/runs');
    await expect(page.getByRole('heading', { level: 1, name: 'Recent Runs' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('F01 dates and deleting', () => {
  test.describe.configure({ mode: 'serial' });

  test('F01-E28 a run recorded in the evening New York time shows that evening on the run page and in the list, not the next morning in UTC', async ({ browser, baseURL, guard }) => {
    // A runner of their own, with a time zone on the profile: the backend counts this run on the evening before
    // (ActivityLocalDates), so the run page and the list have to say the same thing (BUG-003).
    const made = await newRunner('lateevening');
    expect((await made.api.patch('/api/profile/me/time-zone', { timeZone: 'America/New_York' })).status).toBe(200);
    // 03:30 UTC two days ago is the evening before in New York (23:30 in summer time, 22:30 in winter time).
    const start = daysAgo(2);
    start.setUTCHours(3, 30, 0, 0);
    const name = `E2E Late evening ${Date.now().toString(36)}`;
    const id = await made.api.importRun('late.gpx', gpxRun({ name, start, distanceM: 3000, pace: 330, elevation: rollingHills(5, 1500) }));
    const context = await contextWith(browser, { token: made.api.token as string, email: made.email }, baseURL as string, guard);
    try {
      const page = await context.newPage();
      await page.goto(`/runs/${id}`);
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
      const dayAndTime = start.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
      const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
      await expect(page.locator('.run-detail-v2__meta')).toContainText(dayAndTime);
      // The list says the same: the evening's day and the clock, not the morning after.
      await page.goto('/runs');
      const row = page.locator('.runs-ledger-row').filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row).toContainText(start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }));
      await expect(row).toContainText(time);
    } finally {
      await context.close();
    }
  });

  test('F01-E29 delete a run from the list: it goes, and the records and same-route group forget it', async ({ page, browser, baseURL, seed, guard }) => {
    // Runner C owns this scenario so the seeded runner's route groups keep their size.
    const c = new Api(seed.baseUrl, seed.c.token);
    guard.allow(/status of 404/);
    const names = ['E2E C loop one', 'E2E C loop two', 'E2E C loop three'];
    const ids: number[] = [];
    const existing = (await c.get('/api/activities')).json as Array<{ id: number; name: string }>;
    for (const [index, name] of names.entries()) {
      const found = existing.find((run) => run.name === name);
      ids.push(found ? found.id : await c.importRun(`c-loop-${index}.gpx`, gpxRun({ name, start: daysAgo(40 - index * 10), distanceM: 4000, pace: 330 - index * 10, hr: 150 })));
    }
    const context = await contextFor(browser, 'c', baseURL as string, guard);
    try {
      const cPage = await context.newPage();
      await cPage.goto(`/runs/${ids[2]}`);
      await expect(region(cPage, 'Same-route runs')).toContainText('You have run this route 3 times');
      await cPage.goto('/runs');
      await cPage.getByRole('textbox', { name: 'Search runs by name...' }).fill('E2E C loop two');
      const row = cPage.getByRole('button', { name: /E2E C loop two/ }).first();
      await expect(row).toBeVisible();
      await cPage.getByRole('button', { name: 'Delete run' }).first().click();
      const confirm = cPage.getByRole('dialog');
      await expect(confirm).toBeVisible();
      await confirm.getByRole('button', { name: /delete/i }).last().click();
      await expect(cPage.getByRole('button', { name: /E2E C loop two/ })).toHaveCount(0);
      expect((await c.get(`/api/activities/${ids[1]}/best-efforts`)).status).toBe(404);
      await cPage.goto(`/runs/${ids[2]}`);
      await expect(region(cPage, 'Same-route runs')).toContainText('You have run this route 2 times');
    } finally {
      await context.close();
    }
  });
});
