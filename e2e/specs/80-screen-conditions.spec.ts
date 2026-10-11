// The conditions the happy-path specs do not stage on the other analysis screens: slow and failing requests, the keyboard, the back
// button and a refresh. Load balance and the Analysis page (F02), the prediction pages (F05) and the zones editor (F04).
// The run page and the Runs list (F01) have their own in 21-f01-run-page-conditions.spec.ts.
import type { BrowserContext, Page } from '@playwright/test';
import { Api, eventually, newRunner } from '../fixtures/api.ts';
import { SEED_RUNS } from '../fixtures/seed.ts';
import { a11yViolations, contextWith, expect, test } from '../fixtures/test.ts';

test.describe.configure({ mode: 'serial' });

let who: { api: Api; email: string; token: string };

test.beforeAll(async () => {
  const made = await newRunner('screens');
  who = { api: made.api, email: made.email, token: made.api.token as string };
  // Seven of the seed runs: enough for a load ratio, a prediction and zones.
  const ids: Record<string, number> = {};
  for (const run of SEED_RUNS.slice(0, 7)) ids[run.key] = await who.api.importRun(`${run.key}.gpx`, run.build());
  await eventually(async () => (await who.api.get(`/api/activities/${ids.hills}/training-metrics`)).json?.computedAt, 'the first run to be analysed');
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ratioShown = (page: Page) => page.getByText('acute : chronic workload ratio');
const fiveHundred = { status: 500, contentType: 'application/json', body: '{"error":"boom"}' };

async function signedInContext(browser: Parameters<typeof contextWith>[0], baseURL: string | undefined, guard: Parameters<typeof contextWith>[3]): Promise<BrowserContext> {
  return contextWith(browser, who, baseURL as string, guard);
}

test.describe('F02 Load balance and Analysis under bad conditions', () => {
  test('F02-E8 slow network: every answer takes 2.5 s, the ratio still arrives and nothing says it failed', async ({ browser, baseURL, guard }) => {
    const context = await signedInContext(browser, baseURL, guard);
    try {
      const page = await context.newPage();
      await page.route('**/api/**', async (route) => {
        await sleep(2500);
        await route.continue().catch(() => {});
      });
      await page.goto('/analysis/load-balance');
      await expect(ratioShown(page)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('body')).not.toContainText('Unable to load');
    } finally {
      await context.close();
    }
  });

  test('F02-E9 a failed profile request does not take the Load balance numbers away', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    const context = await signedInContext(browser, baseURL, guard);
    try {
      const page = await context.newPage();
      await page.route('**/api/profile/me', (route) => route.fulfill(fiveHundred));
      await page.goto('/analysis/load-balance');
      await expect(ratioShown(page)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('F02-E10 when the runs cannot be loaded, Load balance says so and offers Try again, which works', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    const context = await signedInContext(browser, baseURL, guard);
    try {
      const page = await context.newPage();
      let failures = 1;
      await page.route(/\/api\/activities$/, (route) => (failures-- > 0 ? route.fulfill(fiveHundred) : route.continue()));
      await page.goto('/analysis/load-balance');
      await expect(page.getByRole('alert')).toContainText('Unable to load analysis right now.');
      await page.getByRole('button', { name: 'Try again' }).click();
      await expect(ratioShown(page)).toBeVisible();
      await expect(page.getByRole('alert')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('F02-E11 keyboard only: the 4, 8 and 12 week buttons are reached with Tab and pressed with Enter or Space', async ({ browser, baseURL, guard }) => {
    const context = await signedInContext(browser, baseURL, guard);
    try {
      const page = await context.newPage();
      await page.goto('/analysis/load-balance');
      await expect(ratioShown(page)).toBeVisible();
      const four = page.getByRole('button', { name: '4 wk' });
      const eight = page.getByRole('button', { name: '8 wk' });
      const twelve = page.getByRole('button', { name: '12 wk' });
      await four.focus();
      await page.keyboard.press('Enter');
      await expect(four).toHaveAttribute('aria-pressed', 'true');
      await expect(eight).toHaveAttribute('aria-pressed', 'false');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Space');
      await expect(eight).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await expect(twelve).toHaveAttribute('aria-pressed', 'true');
    } finally {
      await context.close();
    }
  });

  test('F02-E12 the back button from Load balance returns to Analysis, and a refresh keeps the page and its ratio', async ({ browser, baseURL, guard }) => {
    const context = await signedInContext(browser, baseURL, guard);
    try {
      const page = await context.newPage();
      await page.goto('/analysis');
      await page.getByText('Load balance', { exact: true }).first().click();
      await expect(page).toHaveURL(/\/analysis\/load-balance$/);
      await expect(ratioShown(page)).toBeVisible();
      const header = (await page.locator('main').innerText()).match(/workload ratio\s+(\d\.\d\d)/)?.[1];
      expect(header, 'the ratio in the header').toBeTruthy();
      await page.reload();
      await expect(ratioShown(page)).toBeVisible();
      expect((await page.locator('main').innerText()).match(/workload ratio\s+(\d\.\d\d)/)?.[1]).toBe(header);
      await page.goBack();
      await expect(page).toHaveURL(/\/analysis$/);
      await expect(page.getByRole('heading', { name: /Fitness is/ })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('F02-E13 when the Analysis request fails the page says so and offers Try again, and does not tell a runner with runs to bring in a first batch', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    const context = await signedInContext(browser, baseURL, guard);
    try {
      const page = await context.newPage();
      let failures = 1;
      await page.route('**/api/activities/analysis', (route) => (failures-- > 0 ? route.fulfill(fiveHundred) : route.continue()));
      await page.goto('/analysis');
      await expect(page.getByRole('alert')).toContainText('Unable to load analysis right now.');
      await expect(page.locator('body')).not.toContainText('Bring in your first batch');
      await expect(page.locator('body')).not.toContainText('Reconnect Strava');
      await page.getByRole('button', { name: 'Try again' }).click();
      await expect(page.getByRole('heading', { name: /Fitness is/ })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('F02-E14 the Analysis page still opens when the profile request fails', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    const context = await signedInContext(browser, baseURL, guard);
    try {
      const page = await context.newPage();
      await page.route('**/api/profile/me', (route) => route.fulfill(fiveHundred));
      await page.goto('/analysis');
      await expect(page.getByRole('heading', { name: /Fitness is/ })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe('F05 prediction pages under bad conditions', () => {
  test('F05-E12 slow network: the prediction arrives after slow answers and nothing says it failed', async ({ browser, baseURL, guard }) => {
    const context = await signedInContext(browser, baseURL, guard);
    try {
      const page = await context.newPage();
      await page.route('**/api/**', async (route) => {
        await sleep(2500);
        await route.continue().catch(() => {});
      });
      await page.goto('/prediction/10k');
      await expect(page.getByRole('heading', { level: 1, name: 'Race Time Prediction' })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('main strong').filter({ hasText: /^\d+:\d\d(?::\d\d)?$/ }).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('body')).not.toContainText('Not enough data yet');
    } finally {
      await context.close();
    }
  });

  test('F05-E13 when the runs cannot be loaded the page says so and offers Try again, and does not say "not enough data" about a runner who has runs', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    const context = await signedInContext(browser, baseURL, guard);
    try {
      const page = await context.newPage();
      let failures = 1;
      await page.route(/\/api\/activities$/, (route) => (failures-- > 0 ? route.fulfill(fiveHundred) : route.continue()));
      await page.goto('/prediction/10k');
      await expect(page.getByRole('alert')).toContainText('Unable to load analysis right now.');
      await expect(page.locator('body')).not.toContainText('Not enough data yet');
      await page.getByRole('button', { name: 'Try again' }).click();
      await expect(page.locator('main strong').filter({ hasText: /^\d+:\d\d(?::\d\d)?$/ }).first()).toBeVisible();
      await expect(page.getByRole('alert')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('F05-E14 keyboard only: a distance button is pressed with Enter, a refresh keeps the distance and back returns to the last one', async ({ browser, baseURL, guard }) => {
    const context = await signedInContext(browser, baseURL, guard);
    try {
      const page = await context.newPage();
      await page.goto('/prediction/10k');
      await expect(page.getByRole('heading', { level: 1, name: 'Race Time Prediction' })).toBeVisible();
      const nav = page.getByRole('navigation', { name: 'Analysis sections' });
      await nav.getByRole('button', { name: 'Half Marathon', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/prediction\/half$/);
      await page.reload();
      await expect(page).toHaveURL(/\/prediction\/half$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Race Time Prediction' })).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(/\/prediction\/10k$/);
    } finally {
      await context.close();
    }
  });
});

test.describe('F04 zones editor under bad conditions', () => {
  const maxField = (page: Page) => page.getByRole('textbox', { name: 'Max heart rate (bpm)' });

  test('F04-E10 when the zones cannot be loaded the editor says so and Retry brings them back', async ({ browser, baseURL, guard }) => {
    guard.allow(/HTTP 500|status of 500/);
    const context = await signedInContext(browser, baseURL, guard);
    try {
      const page = await context.newPage();
      let failures = 1;
      await page.route('**/api/training/zones', (route) => (route.request().method() === 'GET' && failures-- > 0 ? route.fulfill(fiveHundred) : route.continue()));
      await page.goto('/settings?section=training');
      await page.getByRole('button', { name: 'Retry' }).click();
      await expect(maxField(page)).toBeVisible();
      await expect(maxField(page)).toHaveValue('190');
    } finally {
      await context.close();
    }
  });

  test('F04-E12 the zones editor has no serious accessibility violations', async ({ browser, baseURL, guard }) => {
    const context = await signedInContext(browser, baseURL, guard);
    try {
      const page = await context.newPage();
      await page.goto('/settings?section=training');
      await expect(maxField(page)).toBeVisible();
      expect(await a11yViolations(page)).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('F04-E12b the zones editor: text contrast of at least 4.5 to 1 in the light theme', async ({ browser, baseURL, guard }) => {
    const context = await signedInContext(browser, baseURL, guard);
    try {
      const page = await context.newPage();
      await page.goto('/settings?section=training');
      await expect(maxField(page)).toBeVisible();
      expect(await a11yViolations(page, { onlyRules: ['color-contrast'] })).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('F04-E12c Settings: text contrast of at least 4.5 to 1 in both themes, the footer links in midnight included (BUG-005)', async ({ browser, baseURL, guard }) => {
    for (const theme of ['light', 'midnight']) {
      const context = await signedInContext(browser, baseURL, guard);
      try {
        const page = await context.newPage();
        await page.addInitScript((value) => localStorage.setItem('hermes_theme', value), theme);
        for (const section of ['training', 'account']) {
          await page.goto(`/settings?section=${section}`);
          await expect(page.getByRole('link', { name: 'Terms' }).first()).toBeVisible();
          expect(await a11yViolations(page, { onlyRules: ['color-contrast'] }), `${theme}, ${section}`).toEqual([]);
        }
      } finally {
        await context.close();
      }
    }
  });

  test('F04-E11 a save that fails on the network says so, keeps what was typed, and the same Save works once the network is back', async ({ browser, baseURL, guard }) => {
    guard.allow(/ERR_FAILED/);
    const context = await signedInContext(browser, baseURL, guard);
    try {
      const page = await context.newPage();
      await page.goto('/settings?section=training');
      await expect(maxField(page)).toBeVisible();
      let offline = true;
      await page.route('**/api/training/zones', (route) => (route.request().method() === 'PUT' && offline ? route.abort('failed') : route.continue()));
      await maxField(page).fill('185');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Could not save your zones');
      await expect(maxField(page)).toHaveValue('185');
      offline = false;
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      // The error goes as soon as Save is pressed; the server has the value once the page says it was saved.
      await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
      await expect(page.getByRole('alert')).toHaveCount(0);
      expect((await who.api.get('/api/training/zones')).json.maxHeartRate.bpm).toBe(185);
    } finally {
      await who.api.put('/api/training/zones', { clearMaxHeartRate: true });
      await context.close();
    }
  });
});
