import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import PageSkeleton from './PageSkeleton';
import { I18nProvider } from '../contexts/I18nContext';

async function mount(variant) {
  let view;
  await act(async () => { view = render(<I18nProvider><PageSkeleton variant={variant} /></I18nProvider>); });
  return view;
}

afterEach(cleanup);

it.each([['auth', 2], ['login', 2], ['signup', 3]])('matches the %s form and exposes only a loading status', async (variant, fieldCount) => {
  const { container } = await mount(variant);
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  expect(container.querySelectorAll('.page-skeleton__account-field')).toHaveLength(fieldCount);
  expect(container.querySelector('.page-skeleton__account-card .page-skeleton__account-legal')).toBeInTheDocument();
  expect(container.querySelectorAll('.page-skeleton__account-social > span')).toHaveLength(2);
  expect(container.querySelector('input, button, a, [tabindex]')).toBeNull();
  expect(container.querySelector('.page-skeleton__auth-strength, .page-skeleton__auth-stats, .page-skeleton__auth-slide-details')).toBeNull();
});

it.each([['forgot-password', 1], ['admin-login', 2]])('preserves the separate %s loading layout', async (variant, fieldCount) => {
  const { container } = await mount(variant);
  expect(container.querySelector('.page-skeleton--account')).toBeNull();
  expect(container.querySelectorAll('.page-skeleton__auth-field')).toHaveLength(fieldCount);
});
