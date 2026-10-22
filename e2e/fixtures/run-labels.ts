import type { Locator, Page } from '@playwright/test';
import { expect } from './test.ts';

/** Open the compact editor through its visible disclosure, including after a reload or external edit. */
export async function expandRunLabels(
  page: Page,
  section: Locator = page.getByRole('region', { name: 'Labels', exact: true }),
): Promise<void> {
  await expect(section).toBeVisible();
  const disclosure = section.locator('details.run-labels__compact');
  await expect(disclosure).toBeVisible();
  if (await disclosure.getAttribute('open') === null) await disclosure.locator(':scope > summary').click();
  await expect(disclosure).toHaveAttribute('open', '');
}
