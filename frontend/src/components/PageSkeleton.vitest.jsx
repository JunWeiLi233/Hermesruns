import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import App from '../App';
import PageSkeleton from './PageSkeleton';
import { I18nProvider } from '../contexts/I18nContext';

async function mount(variant, pathname) {
  let view;
  await act(async () => { view = render(<I18nProvider><PageSkeleton variant={variant} pathname={pathname} /></I18nProvider>); });
  return view;
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
  localStorage.clear();
});

it('renders local previews with the application theme and one loading announcement', async () => {
  localStorage.setItem('hermes_lang', 'en');
  localStorage.setItem('hermes_theme', 'midnight');
  window.history.replaceState({}, '', '/profile?skeleton-preview=profile');
  const { container } = render(<App />);
  await screen.findByRole('status');
  expect(container.querySelector('[data-loading-state="profile"]')).toBeInTheDocument();
  expect(document.body).toHaveClass('theme-midnight');
});

it('previews an allowlisted admin layout without an admin session', async () => {
  window.history.replaceState({}, '', '/?skeleton-preview=admin&skeleton-tab=users');
  const { container } = render(<App />);
  await screen.findByRole('status');
  expect(container.querySelector('[data-loading-state="admin-users"]')).toBeInTheDocument();
});

it.each(['profile', 'preferences', 'training', 'connections', 'notifications', 'activity', 'account'])('shows only the requested settings section: %s', async section => {
  window.history.replaceState({}, '', `/settings?section=${section}`);
  const { container } = await mount('settings');
  expect(container.querySelectorAll('[data-settings-section]')).toHaveLength(1);
  expect(container.querySelector('[data-settings-section]')).toHaveAttribute('data-settings-section', section);
  expect(container.querySelectorAll('.loading-design__settings-nav [aria-current="page"]')).toHaveLength(1);
});

it.each(['landing', 'auth', 'signup', 'forgot-password', 'legal', 'profile', 'runs', 'run-detail', 'analysis', 'analysis-load', 'analysis-intensity', 'analysis-injury', 'analysis-coach', 'analysis-insight', 'prediction', 'heatmap', 'weather', 'today-run', 'rewards', 'settings', 'import-data', 'shoes', 'add-shoes', 'shoe-catalog', 'races', 'race-detail', 'schedule', 'muscle-training', 'admin'])('keeps unknown data inert and exposes one live announcement for %s', async variant => {
  const { container } = await mount(variant);
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status').closest('[aria-busy="true"]')).toBeNull();
  expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  expect(container.querySelectorAll('input, select, textarea')).toHaveLength(0);
  expect(container.querySelector('.hr-sk')).toHaveAttribute('aria-hidden', 'true');
});
