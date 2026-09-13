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

it('renders local skeleton previews with the same language and theme providers as the app', async () => {
  localStorage.setItem('hermes_lang', 'en');
  localStorage.setItem('hermes_theme', 'midnight');
  window.history.replaceState({}, '', '/profile?skeleton-preview=profile');
  render(<App />);
  expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true');
  expect(document.body).toHaveClass('theme-midnight');
});

it('previews an allowlisted admin layout locally without accessing an admin route', async () => {
  window.history.replaceState({}, '', '/?skeleton-preview=admin&skeleton-tab=users');
  const { container } = render(<App />);
  await screen.findByRole('status');
  expect(container.querySelector('.page-skeleton__admin-users')).toBeInTheDocument();
});

it.each([['auth', 2], ['signup', 3], ['forgot-password', 1]])('matches the %s form field count', async (variant, count) => {
  const { container } = await mount(variant);
  const fieldClass = variant === 'forgot-password' ? '.page-skeleton__auth-field' : '.page-skeleton__account-field';
  expect(container.querySelectorAll(fieldClass)).toHaveLength(count);
  expect(container.querySelector('.page-skeleton__auth-slide-details')).not.toBeInTheDocument();
  expect(container.querySelector('.page-skeleton__auth-brand-actions')).not.toBeInTheDocument();
  if (variant !== 'auth') expect(container.querySelector('.page-skeleton__auth-social')).not.toBeInTheDocument();
});

it.each(['profile', 'runs', 'analysis', 'shoes', 'heatmap'])('reserves the four-item mobile navigation for %s', async (variant) => {
  const { container } = await mount(variant);
  expect(container.querySelector('.page-skeleton__mobile-nav')).toHaveAttribute('aria-hidden', 'true');
  expect(container.querySelectorAll('.page-skeleton__mobile-nav-item')).toHaveLength(4);
  expect(container.querySelectorAll('a, button, input')).toHaveLength(0);
});

it('does not insert the optional comeback promotion ahead of the Home workout', async () => {
  const { container } = await mount('profile');
  expect(container.querySelector('.page-skeleton__profile-comeback')).not.toBeInTheDocument();
  expect(container.querySelector('.page-skeleton__profile-editorial-hero').nextElementSibling).toHaveClass('page-skeleton__profile-today');
});

it('uses a small history sample instead of guessing dozens of unloaded activities', async () => {
  const { container } = await mount('runs');
  expect(container.querySelectorAll('.page-skeleton__runs-card')).toHaveLength(6);
});

it('matches the session-first Today Run composition', async () => {
  const { container } = await mount('today-run');
  expect(container.querySelector('.page-skeleton__session-hero')).toBeInTheDocument();
  expect(container.querySelector('.page-skeleton__session-timeline')).toBeInTheDocument();
  expect(container.querySelector('.page-skeleton__session-support').children).toHaveLength(4);
  expect(container.querySelector('.page-skeleton__today-coaching')).not.toBeInTheDocument();
});

it.each([['load-balance','analysis-load'],['intensity','analysis-intensity'],['injury-risk','analysis-injury'],['coach-insight','analysis-coach']])('keeps the %s composition during the data-loading phase', async (key, variant) => {
  const { container } = await mount('analysis-insight', `/analysis/${key}/`);
  expect(container.querySelector('.page-skeleton')).toHaveClass(`page-skeleton--${variant}`);
});
