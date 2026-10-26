import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PageSkeleton from './PageSkeleton';
import { I18nProvider } from '../contexts/I18nContext';
import { ensureLocaleMessages } from '../i18n/translationRuntime';

const wake = vi.hoisted(() => ({ listeners: new Set() }));
vi.mock('../api', () => ({
  subscribeWakeRetry(listener) {
    wake.listeners.add(listener);
    return () => wake.listeners.delete(listener);
  },
}));

async function mount(props = {}) {
  let view;
  await act(async () => { view = render(<I18nProvider><PageSkeleton {...props} /></I18nProvider>); });
  return view;
}

beforeEach(() => {
  localStorage.setItem('hermes_lang', 'en');
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
  wake.listeners.clear();
});

it('keeps the page title and real navigation available while run data loads', async () => {
  await mount({ variant: 'runs' });
  expect(screen.getByRole('heading', { name: 'Recent runs' })).toBeInTheDocument();
  const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
  expect(within(navigation).getByRole('link', { name: 'Runs' })).toHaveAttribute('href', '/runs');
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status')).toHaveTextContent('Loading your runs…');
});

it('preserves the requested settings section as a real heading and active link', async () => {
  await mount({ variant: 'settings', search: '?section=preferences' });
  expect(screen.getByRole('heading', { name: 'Preferences' })).toBeInTheDocument();
  const navigation = screen.getByRole('navigation', { name: 'Settings' });
  expect(within(navigation).getByRole('link', { name: 'Preferences' })).toHaveAttribute('aria-current', 'page');
  expect(document.querySelector('[data-loading-state]')).toHaveAttribute('data-loading-state', 'settings-preferences');
});

it('keeps admin tab selection and canonical route spelling', async () => {
  await mount({ variant: 'admin', activeTab: 'courseMaps' });
  expect(screen.getByRole('heading', { name: 'Course maps' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Course maps' })).toHaveAttribute('href', '/dashboard/course-maps');
  expect(document.querySelector('[data-loading-state]')).toHaveAttribute('data-loading-state', 'admin-courseMaps');
});

it.each([
  [{ variant: 'analysis-insight', pathname: '/analysis/injury-risk/' }, 'analysis-injury'],
  [{ variant: 'legal', pathname: '/privacy/' }, 'privacy'],
  [{ variant: 'auth' }, 'login'],
  [{ variant: 'runner' }, 'runner-fallback'],
  [{ variant: 'garmin' }, 'legacy-garmin'],
  [{ variant: 'admin-login' }, 'legacy-admin-login'],
  [{ variant: 'settings', search: '?section=unknown' }, 'settings-profile'],
])('keeps existing skeleton route aliases: %j', async (props, id) => {
  await mount(props);
  expect(document.querySelector('[data-loading-state]')).toHaveAttribute('data-loading-state', id);
});

describe('loading announcements', () => {
  it('announces a long wait without inventing a server wake', async () => {
    vi.useFakeTimers();
    await mount({ variant: 'runs' });
    await act(async () => { vi.advanceTimersByTime(4000); });
    expect(screen.getByRole('status')).toHaveTextContent('Still loading your runs…');
    await act(async () => { vi.advanceTimersByTime(10000); });
    expect(screen.getByRole('status')).not.toHaveTextContent('Waking the server');
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('uses the actual wake signal and releases its subscription on unmount', async () => {
    vi.useFakeTimers();
    const view = await mount({ variant: 'runs' });
    await act(async () => { wake.listeners.forEach(listener => listener(true)); });
    expect(screen.getByRole('status')).toHaveTextContent('Waking the server…');
    view.unmount();
    expect(wake.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('localizes the loading announcement and static page heading', async () => {
    await ensureLocaleMessages('zh-CN');
    localStorage.setItem('hermes_lang', 'zh-CN');
    await mount({ variant: 'runs' });
    expect(screen.getByRole('status')).toHaveTextContent(/加载/);
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('Recent runs');
  });
});
