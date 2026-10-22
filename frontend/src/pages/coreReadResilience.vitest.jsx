import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, apiJson } from '../api';
import { clearResourceCache } from '../api/resourceCache';
import en from '../i18n/locales/en';
import zh from '../i18n/locales/zh-CN';
import Runs from './runs/Runs';
import Shoes from './shoes/Shoes';
import Analysis from './analysis/Analysis';
import { historyPageFixture } from './runs/__tests__/historyPageFixture';

const state = vi.hoisted(() => ({ lang: 'en' }));
const dictionary = () => state.lang === 'en' ? en : zh;
const t = (key, params = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary()) ?? key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};
vi.mock('../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), getBackendBaseUrl: () => '', subscribeWakeRetry: () => () => {} }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'resilience@example.test' }) }));
vi.mock('../contexts/I18nContext', () => ({ useI18n: () => ({ lang: state.lang, t, formatNumber: (value, options) => new Intl.NumberFormat(state.lang, options).format(value) }) }));
vi.mock('../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'km' }) }));
vi.mock('../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../components/TopbarNotifications', () => ({ default: () => null }));
vi.mock('./analysis/MeasuredHrZoneBlock', () => ({ default: () => null }));
vi.mock('../utils/routePreload', () => ({ preloadRoute: vi.fn() }));
vi.mock('../features/training/integrated/AthleteTools', () => ({ RunsTrainingTools: () => null, AnalysisTrainingTools: () => null }));

const pages = [
  { name: 'Runs', Component: Runs, path: '/runs', endpoint: '/api/activities/page?', error: 'runs.load_error', empty: 'runs.awaiting_title_disconnected' },
  { name: 'Shoes', Component: Shoes, path: '/shoes', endpoint: '/api/shoes?includeRetired=true', error: 'shoes.load_error', empty: 'shoes.stitch_inventory_empty' },
  { name: 'Analysis', Component: Analysis, path: '/analysis', endpoint: '/api/activities/analysis', error: 'analysis.stitch_load_error', empty: 'analysis.stitch_empty_title' },
];
let served;
let critical;
const callsFor = endpoint => apiJson.mock.calls.filter(([url]) => endpoint.endsWith('?') ? url.startsWith(endpoint) : url === endpoint);
function open(page) {
  critical = page.endpoint;
  return render(<MemoryRouter initialEntries={[page.path]}><page.Component /></MemoryRouter>);
}

beforeEach(() => {
  state.lang = 'en';
  served = [];
  localStorage.clear();
  localStorage.setItem('hermes_email', 'resilience@example.test');
  localStorage.setItem('hermes_jwt', 'resilience-session');
  clearResourceCache();
  apiJson.mockReset();
  apiJson.mockImplementation(async url => {
    if (url === critical || critical?.endsWith('?') && url.startsWith(critical)) {
      if (served instanceof Error) throw served;
      if (critical.endsWith('?')) return served instanceof Promise ? served.then(historyPageFixture) : historyPageFixture(served);
      return served;
    }
    if (url === '/api/profile/me') return { displayName: 'Runner', timeZone: 'UTC' };
    if (url === '/api/auth/strava/status') return { linked: false };
    if (url === '/api/activities') return [];
    if (url === '/api/shoes/scan-available') return { available: false };
    return null;
  });
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({ clusters: [] }) });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  clearResourceCache();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe.each(pages)('$name critical reads', page => {
  it.each(['en', 'zh-CN'])('shows a localized error and retries a failed request in %s', async lang => {
    state.lang = lang;
    served = new TypeError('offline');
    open(page);
    expect(await screen.findByRole('alert')).toHaveTextContent(t(page.error));
    expect(screen.queryByText(t(page.empty))).not.toBeInTheDocument();
    served = [];
    fireEvent.click(screen.getByRole('button', { name: t('analysis.stitch_load_retry') }));
    expect(await screen.findByText(t(page.empty))).toBeVisible();
    expect(screen.queryByText(t(page.error))).not.toBeInTheDocument();
    expect(callsFor(page.endpoint)).toHaveLength(2);
  });

  it.each([{ payload: null }, { payload: { items: [] } }, { payload: [null] }, { payload: [[]] }])('rejects a malformed successful response and recovers on retry: %o', async ({ payload }) => {
    served = payload;
    open(page);
    expect(await screen.findByRole('alert')).toHaveTextContent(t(page.error));
    expect(screen.queryByText(t(page.empty))).not.toBeInTheDocument();
    served = [];
    fireEvent.click(screen.getByRole('button', { name: t('analysis.stitch_load_retry') }));
    expect(await screen.findByText(t(page.empty))).toBeVisible();
    expect(callsFor(page.endpoint)).toHaveLength(2);
  });

  it('bounds a hanging read, aborts it, and ignores its late response after retry succeeds', async () => {
    vi.useFakeTimers();
    let resolve;
    served = new Promise(done => { resolve = done; });
    const view = open(page);
    expect(view.container.querySelector('[data-loading-state]')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
    expect(screen.getByRole('alert')).toHaveTextContent(t(page.error));
    expect(callsFor(page.endpoint)[0][1].signal.aborted).toBe(true);
    served = [];
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: t('analysis.stitch_load_retry') })); });
    expect(screen.getByText(t(page.empty))).toBeVisible();
    await act(async () => resolve([{ id: 999, name: 'Abandoned response', distanceKm: 8, movingTimeSeconds: 2400 }]));
    expect(screen.getByText(t(page.empty))).toBeVisible();
    expect(screen.queryByText('Abandoned response')).not.toBeInTheDocument();
    expect(callsFor(page.endpoint)).toHaveLength(2);
  });

  it('cancels a pending read on unmount so remounting can start a fresh request', async () => {
    served = new Promise(() => {});
    const view = open(page);
    const signal = callsFor(page.endpoint)[0]?.[1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
    served = [];
    open(page);
    expect(await screen.findByText(t(page.empty))).toBeVisible();
    expect(callsFor(page.endpoint)).toHaveLength(2);
  });
});

it('loads shoe inventory once on initial success', async () => {
  const page = pages[1];
  open(page);
  await screen.findByText(t(page.empty));
  await act(async () => {});
  expect(callsFor(page.endpoint)).toHaveLength(1);
});

it('does not let a hanging optional duplicate lookup block the owned shoe inventory', async () => {
  apiFetch.mockImplementation(url => url === '/api/shoes/duplicate-clusters' ? new Promise(() => {}) : Promise.resolve({ ok: true }));
  const page = pages[1];
  open(page);
  await waitFor(() => expect(screen.getByText(t(page.empty))).toBeVisible());
});
