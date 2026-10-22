// Pages for runners you hold a token for (one made with `newRunner`, say), closed again when the test is over.
//
//   const pages = pageOpener();
//   test.afterEach(() => pages.closeAll());
//   const page = await pages.open(browser, baseURL, guard, runner, '/training-log');
import type { Browser, BrowserContext, BrowserContextOptions, Page } from '@playwright/test';
import { contextWith, type Guard } from './test.ts';

export interface Who {
  token: string;
  email: string;
}

export interface PageOpener {
  /**
   * A new context signed in as `who`, watched by the guard, with one page opened on `route` (null: a blank page, to set routes before the first
   * load). `options` replace the suite's locale (en-US) and time zone (America/New_York), for a case about another device.
   */
  open(browser: Browser, baseURL: string | undefined, guard: Guard, who: Who, route: string | null, options?: BrowserContextOptions): Promise<Page>;
  /** A second page in the same context as `page` (a second tab). */
  tab(page: Page, route: string): Promise<Page>;
  closeAll(): Promise<void>;
}

export function pageOpener(): PageOpener {
  const contexts: BrowserContext[] = [];
  return {
    async open(browser, baseURL, guard, who, route, options = {}) {
      // The locale and time zone the project's own pages have, so a date field and a calendar day read the way the suite expects.
      const context = await contextWith(browser, who, baseURL as string, guard, { locale: 'en-US', timezoneId: 'America/New_York', ...options });
      contexts.push(context);
      const page = await context.newPage();
      if (route !== null) await page.goto(route);
      return page;
    },
    async tab(page, route) {
      const other = await page.context().newPage();
      await other.goto(route);
      return other;
    },
    async closeAll() {
      for (const context of contexts.splice(0)) await context.close().catch(() => undefined);
    },
  };
}
