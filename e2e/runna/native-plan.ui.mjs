import { expect } from '@playwright/test';

export async function openPlanManagement(page) {
  const disclosure = page.locator('details.schedule-plan-management');
  await expect(disclosure).toBeVisible();
  if (await disclosure.getAttribute('open') === null) {
    await disclosure.locator(':scope > summary').click();
  }
  await expect(disclosure).toHaveAttribute('open', '');
  return disclosure;
}

export async function expectNativeCalendar(page, title) {
  await expect(page).toHaveURL(/\/schedule(?:\?|$)/);
  await expect(page.getByRole('region', { name: 'Weekly training calendar', exact: true })).toBeVisible();
  if (title) await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
}

export function previewVersionId(page) {
  const url = new URL(page.url());
  expect(url.pathname).toBe('/schedule');
  expect(url.searchParams.get('planView')).toBe('preview');
  const versionId = url.searchParams.get('versionId');
  expect(versionId).toBeTruthy();
  return versionId;
}

export async function openFullPlan(page) {
  const management = await openPlanManagement(page);
  await management.getByText('Your plans', { exact: true }).click();
  await management.getByRole('button', { name: 'Review full plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your whole plan, before you begin.', exact: true })).toBeVisible();
}

export async function expectSavedWorkoutRun(page) {
  await expect(page.getByRole('status').filter({ hasText: 'Run saved; workout link needs review.' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review / retry this save', exact: true })).toBeVisible();
}
