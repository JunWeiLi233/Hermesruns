// The `test` every spec imports: the stock Playwright one plus
//   - a guard that fails a test on any console error, uncaught page error or 5xx response (opt out per pattern),
//   - map tiles answered locally, so a run never depends on, or loads, a third-party tile server,
//   - the seeded ids and an `Api` client for the seeded runner.
import { expect, test as base, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { Api, freshClientAddress } from './api.ts';
import { installSyntheticMapTiles } from './safety.mjs';

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
  // The same-origin proxy also reaches OSM; intercept it before it can leave the disposable app.
  await installSyntheticMapTiles(context);
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

/**
 * A browser context signed in as any runner you hold a token for (one made with `newRunner`, say). `options` are passed on to
 * Playwright: a context made here does not take the project's locale or time zone, so a test that depends on either asks for it.
 */
export async function contextWith(browser: Browser, who: { token: string; email: string }, baseURL: string, guard?: Guard, options: BrowserContextOptions = {}): Promise<BrowserContext> {
  const context = await browser.newContext({
    ...options,
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
 * `ignoreRules` leaves out rules a test already tracks as a known bug; `onlyRules` checks just those; `include` looks only inside
 * the given parts of the page, which is how a test holds a new card to a rule the rest of the page is known to break.
 */
export async function a11yViolations(
  page: Page,
  options: { exclude?: string[]; include?: string[]; ignoreRules?: string[]; onlyRules?: string[] } = {},
): Promise<string[]> {
  // Colour is measured mid-fade otherwise: wait for running animations and transitions to finish.
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'), undefined, { timeout: 5000 }).catch(() => undefined);
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  for (const selector of options.include ?? []) builder = builder.include(selector);
  for (const selector of options.exclude ?? []) builder = builder.exclude(selector);
  if (options.onlyRules?.length) builder = builder.withRules(options.onlyRules);
  const { violations } = await builder.analyze();
  return violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .filter((violation) => !(options.ignoreRules ?? []).includes(violation.id))
    .map((violation) => {
      const nodes = violation.nodes.slice(0, 8).map((node) => {
        const data = node.any?.[0]?.data as { contrastRatio?: number; fgColor?: string; bgColor?: string; expectedContrastRatio?: string } | undefined;
        const contrast = data?.contrastRatio ? ` [${data.fgColor} on ${data.bgColor} = ${data.contrastRatio}, needs ${data.expectedContrastRatio}]` : '';
        return `${node.target.join(' ')}${contrast}`;
      });
      return `${violation.id} (${violation.impact}): ${violation.help} -> ${nodes.join(' | ')}`;
    });
}

/**
 * Text that falls short of the WCAG contrast ratio (4.5 to 1; 3 to 1 for large text) inside the given parts of the page, one readable
 * line each.
 *
 * It exists because axe's colour-contrast rule gives up on a whole page when something behind the content is a pseudo-element: on the
 * Training log it puts all 886 pieces of text in "incomplete" and reports no violation at all, so a scan with axe finds nothing there
 * however dark or light the text is. This one reads the computed colour of each piece of text and lays the backgrounds of its
 * ancestors over each other (a pseudo-element is not one of them), the way a person would work it out. It looks at elements that
 * have text of their own and are really on the page (not clipped away for screen readers, not disabled).
 */
export async function contrastProblems(page: Page, options: { include: string[]; exclude?: string[] }): Promise<string[]> {
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'), undefined, { timeout: 5000 }).catch(() => undefined);
  return page.evaluate(({ include, exclude }) => {
    type Rgba = [number, number, number, number];
    const parse = (value: string): Rgba | null => {
      const legacy = /^rgba?\(([^)]+)\)$/.exec(value);
      if (legacy) {
        const parts = legacy[1].split(/[\s,/]+/).filter(Boolean).map(Number);
        return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
      }
      const modern = /^color\(srgb ([^)]+)\)$/.exec(value);
      if (modern) {
        const parts = modern[1].split(/[\s/]+/).filter(Boolean).map(Number);
        return [parts[0] * 255, parts[1] * 255, parts[2] * 255, parts.length > 3 ? parts[3] : 1];
      }
      return null;
    };
    const over = (top: Rgba, bottom: Rgba): Rgba => [
      top[0] * top[3] + bottom[0] * (1 - top[3]),
      top[1] * top[3] + bottom[1] * (1 - top[3]),
      top[2] * top[3] + bottom[2] * (1 - top[3]),
      1,
    ];
    const light = (c: number): number => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (c: Rgba): number => 0.2126 * light(c[0]) + 0.7152 * light(c[1]) + 0.0722 * light(c[2]);
    const hex = (c: Rgba): string => `#${[c[0], c[1], c[2]].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
    const dark = document.body.classList.contains('theme-midnight') || document.body.classList.contains('theme-high-contrast');
    const canvas: Rgba = dark ? [18, 18, 18, 1] : [255, 255, 255, 1];

    const roots = include.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    const skipped = exclude.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    const seen = new Set<Element>();
    const found = new Map<string, string>();
    const describe = (el: Element): string => {
      const text = (Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join(' ')).replace(/\s+/g, ' ').trim().slice(0, 28);
      const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)[0];
      return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''} "${text}"`;
    };

    for (const root of roots) {
      for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (skipped.some((part) => part === el || part.contains(el))) continue;
        const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '');
        if (!own) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        if (el.closest('.sr-only, [hidden], [inert], :disabled, [aria-disabled="true"]')) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') continue;

        // The backgrounds behind the text, from the nearest outwards until one is solid, laid over each other from the outside in.
        const layers: Rgba[] = [];
        let opacity = 1;
        let unknown = false;
        for (let node: Element | null = el; node; node = node.parentElement) {
          const cs = getComputedStyle(node);
          opacity *= Number(cs.opacity);
          if (cs.backgroundImage !== 'none' && cs.backgroundImage !== '') {
            // A gradient or a picture: its colour is not one colour. Stop looking further out and say so.
            if (node !== el || layers.length === 0) unknown = true;
          }
          const bg = parse(cs.backgroundColor);
          if (bg && bg[3] > 0) layers.push(bg);
          if (bg && bg[3] >= 1) break;
        }
        if (unknown) continue;
        let behind: Rgba = canvas;
        for (const layer of layers.reverse()) behind = over(layer, behind);
        const fg = parse(style.color);
        if (!fg) continue;
        const text = over([fg[0], fg[1], fg[2], fg[3] * opacity], behind);
        const [hi, lo] = [luminance(text), luminance(behind)].sort((a, b) => b - a);
        const ratio = (hi + 0.05) / (lo + 0.05);
        const size = parseFloat(style.fontSize);
        const bold = Number(style.fontWeight) >= 700;
        const needs = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
        if (ratio < needs) {
          const key = `${describe(el)} ${hex(text)} on ${hex(behind)}`;
          if (!found.has(key)) found.set(key, `${key} = ${ratio.toFixed(2)}, needs ${needs}:1`);
        }
      }
    }
    return Array.from(found.values()).slice(0, 25);
  }, { include: options.include, exclude: options.exclude ?? [] });
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
