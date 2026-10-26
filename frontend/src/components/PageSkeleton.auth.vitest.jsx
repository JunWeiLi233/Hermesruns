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

it.each([['auth', 2], ['login', 2], ['signup', 3], ['forgot-password', 1], ['admin-login', 2]])('reserves the %s fields without exposing a fake form', async (variant, fieldCount) => {
  const { container } = await mount(variant);
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(container.querySelectorAll('.loading-design__field')).toHaveLength(fieldCount);
  expect(container.querySelector('input, button, [tabindex]')).toBeNull();
  expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
});
