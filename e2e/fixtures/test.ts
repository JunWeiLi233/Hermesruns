// The `test` every spec imports: the stock Playwright one plus
//   - a guard that fails a test on any console error, uncaught page error or 5xx response (opt out per pattern),
//   - map tiles answered locally, so a run never depends on, or loads, a third-party tile server,
//   - the seeded ids and an `Api` client for the seeded runner.
import { expect, test as base, type Browser, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { Api, freshClientAddress } from './api.ts';

export { expect, freshClientAddress };

export interface Seed {
  baseUrl: string;
  ids: Record<string, number>;
  a: { email: string; token: string };
  b: { email: string; token: string };
  c: { email: string; token: string };
}

const authDir = path.resolve(import.meta.dirname, '..', '.auth');

export function readSeed(): Seed {
  return JSON.parse(fs.readFileSync(path.join(authDir, 'seed.json'), 'utf8')) as Seed;
}

/** Browser state files written by global-setup: the signed-in runner A, B or C. */
export const signedIn = (who: 'a' | 'b' | 'c'): string => path.join(authDir, `runner-${who}.json`);

// A 1x1 transparent PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

export interface Guard {
  /** Do not fail the test for problems whose text matches (a deliberate 401, an aborted request, ...). */
  allow(pattern: RegExp): void;
  /** Watch a context you made yourself, the same way the test's own context is watched. */
  watch(context: BrowserContext): void;
  /** Everything seen so far, for assertions of your own. */
  readonly problems: string[];
}

/** Own rate-limit address, no third-party map tiles. Applied to every context the suite makes. */
export async function prepareContext(context: BrowserContext, baseURL: string): Promise<void> {
  const host = new URL(baseURL).host;
  await context.setExtraHTTPHeaders({ 'X-Forwarded-For': freshClientAddress() });
  await context.route(
    (url) => url.host !== host,
    (route) => {
      if (route.request().resourceType() === 'image') return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
      return route.fulfill({ status: 204, body: '' });
    },
  );
}

export const test = base.extend<{ guard: Guard; seed: Seed; api: Api }>({
  context: async ({ context, baseURL }, use) => {
    await prepareContext(context, baseURL as string);
    await use(context);
  },

  guard: [
    async ({ context }, use) => {
      const problems: string[] = [];
      const allowed: RegExp[] = [];
      const watchPage = (page: Page): void => {
        page.on('console', (message) => {
          if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
        });
        page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
        page.on('response', (response) => {
          if (response.status() >= 500) problems.push(`HTTP ${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`);
        });
      };
      const watch = (watched: BrowserContext): void => {
        watched.on('page', watchPage);
        for (const page of watched.pages()) watchPage(page);
      };
      watch(context);
      await use({ allow: (pattern) => allowed.push(pattern), watch, problems });
      const unexpected = problems.filter((text) => !allowed.some((pattern) => pattern.test(text)));
      expect(unexpected, 'console errors, page errors or 5xx responses during the test').toEqual([]);
    },
    { auto: true },
  ],

  seed: async ({}, use) => {
    await use(readSeed());
  },

  api: async ({ seed }, use) => {
    await use(new Api(seed.baseUrl, seed.a.token));
  },
});

/** A second browser context signed in as runner `who`, set up and watched like the test's own. */
export async function contextFor(browser: Browser, who: 'a' | 'b' | 'c', baseURL: string, guard?: Guard): Promise<BrowserContext> {
  const context = await browser.newContext({ storageState: signedIn(who), baseURL });
  await prepareContext(context, baseURL);
  guard?.watch(context);
  return context;
}

/** A browser context signed in as any runner you hold a token for (one made with `newRunner`, say). */
export async function contextWith(browser: Browser, who: { token: string; email: string }, baseURL: string, guard?: Guard): Promise<BrowserContext> {
  const context = await browser.newContext({
    baseURL,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [
            { name: 'hermes_jwt', value: who.token },
            { name: 'hermes_email', value: who.email },
          ],
        },
      ],
    },
  });
  await prepareContext(context, baseURL);
  guard?.watch(context);
  return context;
}

/** Opens the seeded run and waits for the run page to draw its cards. */
export async function openRun(page: Page, key: string): Promise<number> {
  const id = readSeed().ids[key];
  if (!id) throw new Error(`no seeded run called ${key}`);
  await page.goto(`/runs/${id}`);
  await expect(page.getByRole('region', { name: 'Pace analysis' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Effort', exact: true })).toBeVisible();
  return id;
}

/**
 * Accessibility violations of impact serious or critical, one readable line each.
 * `ignoreRules` leaves out rules a test already tracks as a known bug; `onlyRules` checks just those.
 */
export async function a11yViolations(
  page: Page,
  options: { exclude?: string[]; ignoreRules?: string[]; onlyRules?: string[] } = {},
): Promise<string[]> {
  // Colour is measured mid-fade otherwise: wait for running animations and transitions to finish.
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'), undefined, { timeout: 5000 }).catch(() => undefined);
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  for (const selector of options.exclude ?? []) builder = builder.exclude(selector);
  if (options.onlyRules?.length) builder = builder.withRules(options.onlyRules);
  const { violations } = await builder.analyze();
  return violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .filter((violation) => !(options.ignoreRules ?? []).includes(violation.id))
    .map((violation) => {
      const nodes = violation.nodes.slice(0, 4).map((node) => {
        const data = node.any?.[0]?.data as { contrastRatio?: number; fgColor?: string; bgColor?: string; expectedContrastRatio?: string } | undefined;
        const contrast = data?.contrastRatio ? ` [${data.fgColor} on ${data.bgColor} = ${data.contrastRatio}, needs ${data.expectedContrastRatio}]` : '';
        return `${node.target.join(' ')}${contrast}`;
      });
      return `${violation.id} (${violation.impact}): ${violation.help} -> ${nodes.join(' | ')}`;
    });
}

/** No horizontal scrolling: the page is not wider than the window. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll, `page is ${widths.scroll}px wide in a ${widths.client}px window`).toBeLessThanOrEqual(widths.client + 1);
}

/** A raw translation key on screen ("run_detail.unit_pace") means a missing string. */
export async function expectNoRawKeys(page: Page): Promise<void> {
  const text = await page.locator('body').innerText();
  const raw = text.match(/\b(?:run_detail|runs|settings|analysis|profile|common|components|admin|auth|landing|prediction|pages)\.[a-z0-9_]+(?:\.[a-z0-9_]+)*\b/g) ?? [];
  expect([...new Set(raw)], 'raw translation keys visible on the page').toEqual([]);
}
