import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import { TestAuthContext } from '../../../contexts/AuthContext';
import { clearResourceCache } from '../../../api/resourceCache';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { readRunsCache, writeRunsCache } from '../runsCache';
import Runs from '../Runs';

const state = vi.hoisted(() => ({ lang: 'en', email: 'pagination@hermes.test' }));
const profile = { email: state.email, displayName: 'Pagination Runner', timeZone: 'UTC' };
const t = (key, values = {}) => {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) ?? key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};
vi.mock('../../../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), getBackendBaseUrl: () => 'http://localhost', subscribeWakeRetry: () => () => {} }));
vi.mock('../../../contexts/AuthContext', async () => {
  const { createContext, useContext } = await import('react');
  const TestAuthContext = createContext({ isAuthenticated: true, email: state.email });
  return { TestAuthContext, useAuth: () => useContext(TestAuthContext) };
});
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: state.lang, t, formatNumber: (value, options) => new Intl.NumberFormat(state.lang, options).format(value) }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'km' }) }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));
vi.mock('../../../utils/routePreload', () => ({ preloadRoute: vi.fn() }));

function run(id) {
  const date = new Date(Date.UTC(2026, 9, 21) - (id - 1) * 86400000).toISOString().slice(0, 10);
  return { id, name: `History run ${id}`, startDate: date, startTime: `${date}T08:00:00Z`, distanceKm: id, distanceMeters: id * 1000, movingTimeSeconds: 1000 + id, provider: 'GARMIN' };
}

function page(items, { total = 601, cursor = 'page-2', more = true, count = total, years = [2026, 2025], months = { 2026: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 2025: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } } = {}) {
  return {
    items, hasMore: more, nextCursor: more ? cursor : null, totalCount: total,
    summary: { count, distanceKm: 180901, movingTimeSeconds: 781901, activeDays: count, longestRun: run(601), fastestRun: run(601) },
    years, monthsByYear: months,
    monthSummaries: [{ month: '2026-10', count: 21, distanceKm: 231, movingTimeSeconds: 21231 }],
    weeklyDistance: Array.from({ length: 12 }, (_, i) => ({ weekStart: new Date(Date.UTC(2026, 7, 3 + i * 7)).toISOString().slice(0, 10), distanceKm: i + 1 })),
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const content = () => <TestAuthContext.Provider value={{ isAuthenticated: true, email: state.email }}><MemoryRouter initialEntries={['/runs']}><Runs /></MemoryRouter></TestAuthContext.Provider>;
const open = () => render(content());
const requests = () => apiJson.mock.calls.filter(([url]) => String(url).startsWith('/api/activities/page?'));
let respond;

beforeEach(() => {
  state.lang = 'en';
  state.email = profile.email;
  localStorage.clear();
  clearResourceCache();
  vi.stubGlobal('IntersectionObserver', undefined);
  respond = async () => page(Array.from({ length: 60 }, (_, i) => run(i + 1)));
  apiJson.mockReset();
  apiJson.mockImplementation(async (url, options) => {
    if (url.startsWith('/api/activities/page?')) return respond(new URL(url, 'http://localhost').searchParams, options);
    if (url === '/api/profile/me') return profile;
    if (url === '/api/auth/strava/status') return { linked: true };
    if (url.startsWith('/api/activities/route-previews?')) return [];
    throw new Error(`Unexpected request ${url}`);
  });
});
afterEach(() => { cleanup(); clearResourceCache(); localStorage.clear(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Runs server pagination', () => {
  it('bounds a pasted search before it reaches the server while retaining graceful empty results', async () => {
    respond = async params => params.has('search') ? page([], { total: 601, count: 0, more: false }) : page([run(1)]);
    const user = userEvent.setup();
    open();
    const input = await screen.findByRole('textbox', { name: t('runs.search_placeholder') });
    await user.click(input);
    await user.paste('x'.repeat(5000));
    expect(input).toHaveAttribute('maxlength', '256');
    expect(input).toHaveValue('x'.repeat(256));
    await screen.findByText(t('runs.empty'));
    expect(new URL(requests().at(-1)[0], 'http://localhost').searchParams.get('search')).toBe('x'.repeat(256));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('requests one bounded page while displaying complete totals and facets for more than 500 runs', async () => {
    const { container } = open();
    await waitFor(() => expect(container.querySelectorAll('[data-run-id]')).toHaveLength(60));
    expect(requests()).toHaveLength(1);
    const query = new URL(requests()[0][0], 'http://localhost').searchParams;
    expect(query.get('limit')).toBe('60');
    expect(query.get('sort')).toBe('date');
    expect(container.querySelector('.runs-ledger-v2__figure strong')).toHaveTextContent('601');
    expect(screen.getByText(t('runs.pagination_count', { shown: 60, total: 601 }))).toBeInTheDocument();
    expect(readRunsCache(localStorage, profile.email, Date.now())).toBeNull();
  });

  it('continues past 500 rows with advancing cursors and caches only the completed history', async () => {
    respond = async (params) => {
      const offset = Number(params.get('cursor') || 0);
      const items = Array.from({ length: Math.min(60, 601 - offset) }, (_, i) => run(offset + i + 1));
      return page(items, { cursor: String(offset + 60), more: offset + 60 < 601 });
    };
    const { container } = open();
    await waitFor(() => expect(container.querySelectorAll('[data-run-id]')).toHaveLength(60));
    for (let i = 1; i <= 10; i += 1) {
      await act(async () => { fireEvent.click(container.querySelector('.recent-runs-load-more')); });
      await waitFor(() => expect(container.querySelectorAll('[data-run-id]')).toHaveLength(Math.min((i + 1) * 60, 601)));
      if (i < 10) expect(readRunsCache(localStorage, profile.email, Date.now())).toBeNull();
    }
    expect(new Set([...container.querySelectorAll('[data-run-id]')].map(row => row.dataset.runId)).size).toBe(601);
    expect(requests().map(([url]) => new URL(url, 'http://localhost').searchParams.get('cursor'))).toEqual([null, '60', '120', '180', '240', '300', '360', '420', '480', '540', '600']);
    expect(screen.getByText(t('runs.history_end'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('runs.load_more'), exact: true })).not.toBeInTheDocument();
    await waitFor(() => expect(readRunsCache(localStorage, profile.email, Date.now())?.sourceCount).toBe(601));
  }, 30000);

  it.each(['en', 'zh-CN'])('disables duplicate requests while loading and deduplicates overlapping rows in %s', async (lang) => {
    state.lang = lang;
    const pending = deferred();
    respond = async (params) => params.has('cursor') ? pending.promise : page([run(1), run(2)], { total: 3 });
    const user = userEvent.setup();
    const { container } = open();
    await screen.findByRole('button', { name: t('runs.load_more'), exact: true });
    await user.dblClick(screen.getByRole('button', { name: t('runs.load_more'), exact: true }));
    expect(screen.getByRole('button', { name: t('runs.loading_more') })).toBeDisabled();
    expect(requests()).toHaveLength(2);
    await act(async () => { pending.resolve(page([run(2), run(3)], { total: 3, more: false })); });
    expect(container.querySelectorAll('[data-run-id]')).toHaveLength(3);
    expect(screen.getByText(t('runs.history_end'))).toBeInTheDocument();
  });

  it('keeps loaded rows after a failed continuation and retries the same cursor', async () => {
    let attempts = 0;
    respond = async params => {
      if (!params.has('cursor')) return page([run(1)], { total: 2 });
      attempts += 1;
      if (attempts === 1) throw new Error('Network unavailable');
      return page([run(2)], { total: 2, more: false });
    };
    const user = userEvent.setup();
    const { container } = open();
    await user.click(await screen.findByRole('button', { name: t('runs.load_more'), exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t('runs.load_more_error'));
    expect(container.querySelector('[data-run-id="1"]')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('runs.retry_load_more') }));
    expect(await screen.findByText(t('runs.history_end'))).toBeInTheDocument();
    expect(requests().slice(1).map(([url]) => new URL(url, 'http://localhost').searchParams.get('cursor'))).toEqual(['page-2', 'page-2']);
  });

  it('uses server year, month, search and sort results outside the loaded page', async () => {
    respond = async params => {
      if (params.get('search')) return page([run(601)], { count: 1, more: false });
      if (params.get('sort') === 'distance') return page([run(601), run(600)], { count: 601 });
      if (params.get('year') === '2025') return page([run(400)], { count: 30, cursor: '2025-2' });
      return page([run(1)]);
    };
    const user = userEvent.setup();
    const { container } = open();
    await screen.findAllByText('History run 1');
    await user.click(screen.getByRole('button', { name: t('runs.filter_year'), exact: true }));
    await user.click(screen.getByRole('button', { name: '2025', exact: true }));
    await screen.findAllByText('History run 400');
    expect(container.querySelector('.runs-ledger-v2__figure strong')).toHaveTextContent('30');
    expect(new URL(requests().at(-1)[0], 'http://localhost').searchParams.get('year')).toBe('2025');
    await user.click(screen.getByRole('button', { name: t('runs.filter_month'), exact: true }));
    await user.click(screen.getByRole('button', { name: '2025', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Jan', exact: true }));
    const monthQuery = new URL(requests().at(-1)[0], 'http://localhost').searchParams;
    expect(monthQuery.get('month')).toBe('1');
    expect(monthQuery.get('year')).toBe('2025');
    expect(monthQuery.has('cursor')).toBe(false);
    await user.click(screen.getByRole('button', { name: t('runs.filter_all'), exact: true }));
    await user.click(screen.getByRole('button', { name: t('runs.sort_distance'), exact: true }));
    await screen.findAllByText('History run 601');
    expect(container.querySelector('[data-run-id]')).toHaveAttribute('data-run-id', '601');
    await user.type(screen.getByRole('textbox', { name: t('runs.search_placeholder') }), 'old run');
    await waitFor(() => expect(container.querySelectorAll('[data-run-id]')).toHaveLength(1));
    const searchQuery = new URL(requests().at(-1)[0], 'http://localhost').searchParams;
    expect(searchQuery.get('search')).toBe('old run');
    expect(searchQuery.get('sort')).toBe('distance');
    expect(searchQuery.get('defaultName')).toBe('Run');
    expect(searchQuery.has('cursor')).toBe(false);
    expect(readRunsCache(localStorage, profile.email, Date.now())).toBeNull();
  });

  it('keeps an empty filtered result distinct from an empty account and retains global facets', async () => {
    respond = async params => params.has('year') ? page([], { count: 0, more: false }) : page([run(1)]);
    const user = userEvent.setup();
    const { container } = open();
    await screen.findAllByText('History run 1');
    await user.click(screen.getByRole('button', { name: t('runs.filter_year'), exact: true }));
    expect(await screen.findByText(t('runs.empty'))).toBeInTheDocument();
    expect(container.querySelector('.runs-ledger-awaiting')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2025', exact: true })).toBeInTheDocument();
    expect(container.querySelector('.runs-ledger-v2__figure strong')).toHaveTextContent('0');
  });

  it('aborts a pending continuation when the filter changes and ignores its eventual stale result', async () => {
    const pending = deferred();
    let continuationSignal;
    respond = async (params, options) => {
      if (params.has('cursor')) { continuationSignal = options.signal; return pending.promise; }
      if (params.has('year')) return page([run(400)], { count: 1, more: false });
      return page([run(1)]);
    };
    const user = userEvent.setup();
    const { container } = open();
    await user.click(await screen.findByRole('button', { name: t('runs.load_more'), exact: true }));
    await user.click(screen.getByRole('button', { name: t('runs.filter_year'), exact: true }));
    await screen.findAllByText('History run 400');
    expect(continuationSignal.aborted).toBe(true);
    await act(async () => { pending.resolve(page([run(2)], { total: 2, more: false })); });
    expect(container.querySelector('[data-run-id="2"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-run-id="400"]')).toBeInTheDocument();
  });

  it('aborts on unmount and does not cache a late response', async () => {
    const pending = deferred();
    let signal;
    respond = async (_params, options) => { signal = options.signal; return pending.promise; };
    const view = open();
    await waitFor(() => expect(requests()).toHaveLength(1));
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { pending.resolve(page([run(1)], { total: 1, more: false })); });
    expect(readRunsCache(localStorage, profile.email, Date.now())).toBeNull();
  });

  it('retains the previous complete cache while refreshing with a partial first page', async () => {
    const complete = Array.from({ length: 601 }, (_, index) => run(index + 1));
    expect(writeRunsCache(localStorage, profile.email, complete, profile, { linked: true }, Date.now())).toBe(true);
    const { container } = open();
    await waitFor(() => expect(requests()).toHaveLength(1));
    await waitFor(() => expect(container.querySelector('.runs-ledger-v2__figure strong')).toHaveTextContent('601'));
    expect(readRunsCache(localStorage, profile.email, Date.now())?.sourceCount).toBe(601);
    expect(container.querySelectorAll('[data-run-id]')).toHaveLength(60);
  });

  it('caches the completed history when optional profile metadata arrives after the final page', async () => {
    const metadata = deferred();
    respond = async params => params.has('cursor') ? page([run(2)], { total: 2, more: false }) : page([run(1)], { total: 2 });
    const normal = apiJson.getMockImplementation();
    apiJson.mockImplementation((url, options) => url === '/api/profile/me' ? metadata.promise : normal(url, options));
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: t('runs.load_more'), exact: true }));
    await screen.findByText(t('runs.history_end'));
    expect(readRunsCache(localStorage, profile.email, Date.now())).toBeNull();
    await act(async () => { metadata.resolve(profile); });
    expect(readRunsCache(localStorage, profile.email, Date.now())?.sourceCount).toBe(2);
  });

  it('offers a first-page refresh when the server invalidates a history cursor', async () => {
    let revision = 1;
    respond = async params => {
      if (params.has('cursor')) { revision = 2; throw Object.assign(new Error('History changed'), { status: 409 }); }
      return page([run(revision)], { total: 2 });
    };
    const user = userEvent.setup();
    const { container } = open();
    await user.click(await screen.findByRole('button', { name: t('runs.load_more'), exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t('runs.history_changed'));
    await user.click(screen.getByRole('button', { name: t('runs.refresh_history') }));
    await screen.findAllByText('History run 2');
    expect(container.querySelector('[data-run-id="1"]')).not.toBeInTheDocument();
    expect(new URL(requests().at(-1)[0], 'http://localhost').searchParams.has('cursor')).toBe(false);
  });

  it('does not fetch another page when an intersection observer is available', async () => {
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback) { this.callback = callback; }
      observe() { this.callback([{ isIntersecting: true }]); }
      disconnect() {}
    });
    const { container } = open();
    await waitFor(() => expect(container.querySelectorAll('[data-run-id]')).toHaveLength(60));
    await act(async () => {});
    expect(requests()).toHaveLength(1);
    expect(screen.getByRole('button', { name: t('runs.load_more'), exact: true })).toBeEnabled();
  });

  it('bounds a hanging continuation, retains its rows, and ignores the late response after retry', async () => {
    const pending = deferred();
    let attempts = 0;
    let signal;
    respond = async (params, options) => {
      if (!params.has('cursor')) return page([run(1)], { total: 2 });
      attempts += 1;
      signal = options.signal;
      return attempts === 1 ? pending.promise : page([run(2)], { total: 2, more: false });
    };
    const { container } = open();
    await screen.findByRole('button', { name: t('runs.load_more'), exact: true });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await act(async () => { fireEvent.click(container.querySelector('.recent-runs-load-more')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
    expect(signal.aborted).toBe(true);
    expect(screen.getByRole('alert')).toHaveTextContent(t('runs.load_more_error'));
    expect(container.querySelector('[data-run-id="1"]')).toBeInTheDocument();
    await act(async () => { fireEvent.click(container.querySelector('.recent-runs-load-more')); });
    expect(screen.getByText(t('runs.history_end'))).toBeInTheDocument();
    await act(async () => { pending.resolve(page([run(999)], { total: 2, more: false })); });
    expect(container.querySelector('[data-run-id="999"]')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-run-id]')).toHaveLength(2);
  });

  it('drops previous-account rows and ignores that account’s late first page', async () => {
    const pending = deferred();
    let oldSignal;
    respond = async (_params, options) => {
      if (state.email === profile.email) { oldSignal = options.signal; return pending.promise; }
      return page([run(400)], { total: 1, count: 1, more: false });
    };
    const view = open();
    await waitFor(() => expect(requests()).toHaveLength(1));
    state.email = 'other@hermes.test';
    view.rerender(content());
    await screen.findAllByText('History run 400');
    expect(oldSignal.aborted).toBe(true);
    await act(async () => { pending.resolve(page([run(1)], { total: 1, count: 1, more: false })); });
    expect(view.container.querySelector('[data-run-id="1"]')).not.toBeInTheDocument();
    expect(readRunsCache(localStorage, profile.email, Date.now())).toBeNull();
  });

  it('refreshes complete metadata after deletion without collapsing the loaded list or reusing its cursor', async () => {
    let deleted = false;
    respond = async () => deleted ? page([run(2), run(3)], { total: 2, count: 2, more: false }) : page([run(1), run(2)], { total: 3, count: 3 });
    const normal = apiJson.getMockImplementation();
    apiJson.mockImplementation(async (url, options) => {
      if (options?.method === 'DELETE') { deleted = true; return {}; }
      return normal(url, options);
    });
    const user = userEvent.setup();
    const { container } = open();
    await screen.findAllByText('History run 1');
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    await user.click(container.querySelector('[data-run-id="1"]').parentElement.querySelector('.runs-ledger-row__delete'));
    await user.click(screen.getByRole('button', { name: t('runs.delete_confirm_button'), exact: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(container.querySelector('[data-run-id="1"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-run-id="2"]')).toBeInTheDocument();
    expect(container.querySelector('.runs-ledger-v2__figure strong')).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: t('runs.refresh_history') })).toBeInTheDocument();
    expect(new URL(requests().at(-1)[0], 'http://localhost').searchParams.has('cursor')).toBe(false);
    expect(readRunsCache(localStorage, profile.email, Date.now())).toBeNull();
    scroll.mockRestore();
  });

  it.each([
    ['distance', 'list'], ['distance', 'grid'], ['pace', 'list'], ['pace', 'grid'],
  ])('preserves cross-month global %s ordering across pages in the %s layout', async (sort, layout) => {
    const ordered = [
      { ...run(1), startDate: '2026-01-20', startTime: '2026-01-20T08:00:00Z', distanceKm: 10, movingTimeSeconds: 3000 },
      { ...run(2), startDate: '2026-02-20', startTime: '2026-02-20T08:00:00Z', distanceKm: 9, movingTimeSeconds: 2880 },
      { ...run(3), startDate: '2026-01-10', startTime: '2026-01-10T08:00:00Z', distanceKm: 8, movingTimeSeconds: 2720 },
    ];
    respond = async params => params.has('cursor') ? page([ordered[2]], { total: 3, more: false }) : page(ordered.slice(0, 2), { total: 3 });
    localStorage.setItem('hermes_runs_view', layout);
    const user = userEvent.setup();
    const { container } = open();
    await screen.findByRole('button', { name: t('runs.load_more'), exact: true });
    await user.click(screen.getByRole('button', { name: t(sort === 'distance' ? 'runs.sort_distance' : 'runs.sort_pace'), exact: true }));
    await user.click(await screen.findByRole('button', { name: t('runs.load_more'), exact: true }));
    await screen.findByText(t('runs.history_end'));
    expect([...container.querySelectorAll('[data-run-id]')].map(row => row.dataset.runId)).toEqual(['1', '2', '3']);
    expect(container.querySelectorAll('.recent-runs-month-group')).toHaveLength(1);
  });

  it.each(['sort', 'year', 'search'])('loads a changed %s criterion only once after a recommendation revision and preserves the complete cache', async criterion => {
    const complete = [run(1), run(2), run(3)];
    respond = async () => page(complete, { total: 3, more: false });
    const user = userEvent.setup();
    open();
    await waitFor(() => expect(readRunsCache(localStorage, profile.email, Date.now())?.sourceCount).toBe(3));
    await act(async () => { window.dispatchEvent(new Event('hermes-recommendations-changed')); });
    await waitFor(() => expect(requests()).toHaveLength(2));
    await waitFor(() => expect(readRunsCache(localStorage, profile.email, Date.now())?.sourceCount).toBe(3));
    const pending = deferred();
    respond = async () => pending.promise;
    if (criterion === 'sort') await user.click(screen.getByRole('button', { name: t('runs.sort_distance'), exact: true }));
    else if (criterion === 'year') await user.click(screen.getByRole('button', { name: t('runs.filter_year'), exact: true }));
    else await user.type(screen.getByRole('textbox', { name: t('runs.search_placeholder') }), 'x');
    expect(requests()).toHaveLength(3);
    expect(readRunsCache(localStorage, profile.email, Date.now())?.sourceCount).toBe(3);
    await act(async () => { pending.resolve(page(complete, { total: 3, more: false })); });
  });

  it('never carries the previous account’s timezone or linked status into a new account when optional metadata fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-21T00:30:00Z'));
    respond = async () => page([run(state.email === profile.email ? 1 : 400)], { total: 1, more: false });
    const normal = apiJson.getMockImplementation();
    apiJson.mockImplementation(async (url, options) => {
      if (url === '/api/profile/me') {
        if (state.email !== profile.email) throw new Error('Profile unavailable');
        return { ...profile, displayName: 'Previous Runner', timeZone: 'America/Los_Angeles' };
      }
      if (url === '/api/auth/strava/status') {
        if (state.email !== profile.email) throw new Error('Strava unavailable');
        return { linked: true };
      }
      return normal(url, options);
    });
    const user = userEvent.setup();
    const view = open();
    await screen.findByRole('button', { name: t('runs.awaiting_retry_sync'), exact: true });
    await user.click(screen.getByRole('button', { name: t('runs.filter_day'), exact: true }));
    await waitFor(() => expect(new URL(requests().at(-1)[0], 'http://localhost').searchParams.get('day')).toBe('2026-10-20'));
    const previousRequests = requests().length;
    clearResourceCache();
    state.email = 'new-account@hermes.test';
    view.rerender(content());
    await screen.findAllByText('History run 400');
    await screen.findByRole('button', { name: t('runs.awaiting_connect_strava'), exact: true });
    expect(requests().slice(previousRequests).map(([url]) => new URL(url, 'http://localhost').searchParams.get('day'))).toEqual(['2026-10-21']);
    expect(view.container).not.toHaveTextContent('Previous Runner');
    expect(readRunsCache(localStorage, state.email, Date.now())).toBeNull();
  });

  it('keeps refresh recovery reachable after deleting the last loaded row while more history remains', async () => {
    let deleted = false;
    respond = async () => deleted ? page([run(2), run(3)], { total: 2, more: false }) : page([run(1)], { total: 3 });
    const normal = apiJson.getMockImplementation();
    apiJson.mockImplementation(async (url, options) => {
      if (options?.method === 'DELETE') { deleted = true; return {}; }
      return normal(url, options);
    });
    const user = userEvent.setup();
    const { container } = open();
    await screen.findAllByText('History run 1');
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    await user.click(container.querySelector('[data-run-id="1"]').parentElement.querySelector('.runs-ledger-row__delete'));
    await user.click(screen.getByRole('button', { name: t('runs.delete_confirm_button'), exact: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(container.querySelectorAll('[data-run-id]')).toHaveLength(0);
    expect(screen.queryByText(t('runs.empty'))).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('runs.refresh_history'), exact: true }));
    await waitFor(() => expect(container.querySelectorAll('[data-run-id]')).toHaveLength(2));
    expect(screen.getByText(t('runs.history_end'))).toBeInTheDocument();
    expect(new URL(requests().at(-1)[0], 'http://localhost').searchParams.has('cursor')).toBe(false);
    scroll.mockRestore();
  });
});
