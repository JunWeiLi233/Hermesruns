import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, apiJson } from '../../../api';
import { clearResourceCache } from '../../../api/resourceCache';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { writeRunsCache } from '../runsCache';
import Runs from '../Runs';
import { historyPageFixture } from './historyPageFixture';

const state = vi.hoisted(() => ({ lang: 'en' }));
const email = 'f1-runner@hermes.test';
const profile = { email, displayName: 'F1 Runner' };

function t(key, values = {}) {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) ?? key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
}

vi.mock('../../../api', () => ({
  apiFetch: vi.fn(),
  apiJson: vi.fn(),
  getBackendBaseUrl: () => 'http://localhost',
  subscribeWakeRetry: () => () => {},
}));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'f1-runner@hermes.test' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: state.lang, t, formatNumber: (value, options) => new Intl.NumberFormat(state.lang === 'en' ? 'en-US' : state.lang, options).format(value) }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'km' }) }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));
vi.mock('../../../utils/routePreload', () => ({ preloadRoute: vi.fn() }));

function makeRun(id = 1) {
  return {
    id,
    name: id === 1 ? 'Beginner first run' : `History run ${id}`,
    startTime: '2026-10-09T12:00:00Z',
    startDate: '2026-10-09',
    distanceKm: 2,
    distanceMeters: 2000,
    movingTimeSeconds: 960,
    provider: 'GARMIN',
  };
}

it('opens the weekly training log within the current Runs page', async () => {
  const normalApi = apiJson.getMockImplementation();
  apiJson.mockImplementation(async (url, options) => String(url).startsWith('/api/training/log') ? {
    today: '2026-10-09', timeZone: 'UTC', from: '2026-10-05', to: '2026-10-11', olderRuns: false, runTypes: [], tags: [],
    weeks: [{ start: '2026-10-05', end: '2026-10-11', runs: 1, distanceKm: 2, movingSeconds: 960, effort: 5, elevationGainM: 0,
      days: [{ date: '2026-10-09', runs: [{ id: 1, name: 'Beginner first run', startTime: '2026-10-09T12:00:00',
        distanceKm: 2, movingSeconds: 960, paceSecPerKm: 480, effort: 5, effortSource: 'PACE_MODEL', elevationGainM: 0, runType: null, tags: [] }] }],
    }],
  } : normalApi(url, options));
  const user = userEvent.setup();
  const { container } = openRuns();
  await waitFor(() => expectRecordedRun(container));
  const panel = container.querySelector('#training-log');
  expect(panel).toBeInTheDocument();
  await user.click(panel.querySelector('summary'));
  expect(await within(panel).findByRole('link', { name: 'Beginner first run' })).toHaveAttribute('href', '/runs/1');
  expect(container.querySelectorAll('#training-log')).toHaveLength(1);
  expect(container.querySelectorAll('.runner-shell-sidebar')).toHaveLength(1);
  expect(container.querySelectorAll('main')).toHaveLength(1);
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

let activities;
let stravaStatus;

it('refreshes cached run history after a shared recommendation source update', async () => {
  const { container } = openRuns();
  await waitFor(() => expectRecordedRun(container));
  activities = [makeRun(2), makeRun(1)];
  await act(async () => { window.dispatchEvent(new Event('hermes-recommendations-changed')); });
  await waitFor(() => expect(container).toHaveTextContent('History run 2'));
});

function openRuns() {
  return render(<MemoryRouter initialEntries={['/runs']}><Runs /></MemoryRouter>);
}

function seedCache(runs) {
  expect(writeRunsCache(localStorage, email, runs, profile, stravaStatus, Date.now())).toBe(true);
}

function expectRecordedRun(container) {
  const row = container.querySelector('[data-run-id="1"]');
  expect(row).toHaveTextContent('Beginner first run');
  expect(row).toHaveTextContent(state.lang === 'zh-CN' ? '2.0 公里' : '2.0 km');
  expect(row).toHaveTextContent('16:00');
}

function expectNoFalseBanner() {
  expect(screen.queryByText(t('runs.awaiting_status_disconnected'))).not.toBeInTheDocument();
}

beforeEach(() => {
  state.lang = 'en';
  localStorage.clear();
  localStorage.setItem('hermes_email', email);
  clearResourceCache();
  activities = [makeRun()];
  stravaStatus = { linked: false };
  apiFetch.mockReset();
  apiJson.mockReset();
  apiJson.mockImplementation(async (url) => {
    if (url.startsWith('/api/activities/page?')) return historyPageFixture(activities, new URL(url, 'http://localhost').searchParams);
    if (url === '/api/activities') return activities;
    if (url === '/api/profile/me') return profile;
    if (url === '/api/auth/strava/status') return stravaStatus;
    if (url.startsWith('/api/activities/route-previews?')) {
      const ids = new URL(url, 'http://localhost').searchParams.get('ids').split(',');
      return ids.map((id) => ({ activityId: Number(id), availability: 'NO_ROUTE', points: [], pointCount: 0 }));
    }
    throw new Error(`Unexpected API request: ${url}`);
  });
});

afterEach(() => {
  cleanup();
  clearResourceCache();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('Runs history status', () => {
  it.each([false, true])('keeps Recent mixed-source rows ordered by their displayed calendar with cached=%s', async (cached) => {
    activities = [
      { ...makeRun(1), name: 'Imported Friday evening', activityInstant: '2026-10-10T03:55:00Z', accountLocalDate: '2026-10-09', accountLocalTime: '23:55', accountTimeZone: 'America/New_York', timeRepresentation: 'UTC_INSTANT' },
      { ...makeRun(2), name: 'Legacy Saturday morning', startTime: '2026-10-10T00:05:00', activityInstant: null, accountLocalDate: '2026-10-10', accountLocalTime: '00:05', accountTimeZone: 'America/New_York', timeRepresentation: 'STRAVA_LOCAL_WALL_TIME' },
    ];
    if (cached) seedCache(activities);
    const { container } = openRuns();
    await waitFor(() => expect(container.querySelectorAll('[data-run-id]')).toHaveLength(2));
    expect([...container.querySelectorAll('[data-run-id]')].map(row => row.getAttribute('data-run-id'))).toEqual(['2', '1']);
    expect(activities[1].activityInstant).toBeNull();
  });

  it('retains true instant chronology for all-instant histories across a repeated DST hour', async () => {
    activities = [
      { ...makeRun(1), activityInstant: '2025-11-02T05:50:00Z', accountLocalDate: '2025-11-02', accountLocalTime: '01:50', accountTimeZone: 'America/New_York' },
      { ...makeRun(2), activityInstant: '2025-11-02T06:10:00Z', accountLocalDate: '2025-11-02', accountLocalTime: '01:10', accountTimeZone: 'America/New_York' },
    ];
    const { container } = openRuns();
    await waitFor(() => expect(container.querySelectorAll('[data-run-id]')).toHaveLength(2));
    expect([...container.querySelectorAll('[data-run-id]')].map(row => row.getAttribute('data-run-id'))).toEqual(['2', '1']);
  });
  it.each(['en', 'zh-CN'])('does not claim recorded activities are absent with Strava disconnected in %s', async (lang) => {
    state.lang = lang;
    const { container } = openRuns();
    await waitFor(() => expectRecordedRun(container));
    expect(container.querySelector('.runs-ledger-v2__figure')).toHaveTextContent('1');
    expectNoFalseBanner();
  });

  it('does not claim populated cached history is empty while its network refresh is pending', async () => {
    seedCache(activities);
    const pending = deferred();
    apiJson.mockImplementationOnce(() => pending.promise);
    let view;
    await act(async () => { view = openRuns(); });
    const { container } = view;
    expectRecordedRun(container);
    expectNoFalseBanner();
    await act(async () => { pending.resolve(historyPageFixture(activities)); });
  });

  it('removes the no-activity status when an empty cached snapshot refreshes with an imported run', async () => {
    seedCache([]);
    const pending = deferred();
    apiJson.mockImplementationOnce(() => pending.promise);
    const { container } = openRuns();
    expectNoFalseBanner();
    await act(async () => { pending.resolve(historyPageFixture(activities)); });
    expectRecordedRun(container);
    expectNoFalseBanner();
  });

  it.each([false, true])('preserves onboarding for genuinely empty history with linked=%s', async (linked) => {
    activities = [];
    stravaStatus = { linked };
    const { container } = openRuns();
    const title = t(linked ? 'runs.awaiting_title_linked' : 'runs.awaiting_title_disconnected');
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(container.querySelector('.runs-ledger-awaiting')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: t('runs.awaiting_import_files'), exact: true })).toHaveLength(1);
    expect(screen.getByRole('button', { name: t(linked ? 'runs.awaiting_retry_sync' : 'runs.awaiting_connect_strava'), exact: true })).toBeInTheDocument();
    if (!linked) expect(screen.getByText(t('runs.awaiting_status_disconnected'))).toBeInTheDocument();
  });

  it('refreshes empty history after a successful modal import invalidates cached activities', async () => {
    activities = [];
    const user = userEvent.setup();
    apiFetch.mockImplementation(async () => {
      activities = [makeRun()];
      return { ok: true, json: async () => ({ importedActivities: 1, skippedDuplicates: 0, skippedNonRuns: 0, rejectedFiles: [] }) };
    });
    const { container } = openRuns();
    await screen.findByRole('heading', { name: t('runs.awaiting_title_disconnected') });
    await user.click(screen.getByRole('button', { name: t('runs.awaiting_import_files'), exact: true }));
    await user.upload(screen.getByLabelText(/Drop FIT\/GPX files/), new File(['synthetic activity'], 'beginner-first.tcx', { type: 'application/xml' }));
    await user.click(screen.getByRole('button', { name: t('profile.upload_file_count', { count: 1 }), exact: true }));
    await waitFor(() => expectRecordedRun(container));
    expect(apiJson.mock.calls.filter(([url]) => url.startsWith('/api/activities/page?'))).toHaveLength(2);
    expectNoFalseBanner();
  });

  it.each(['search', 'day'])('keeps zero %s matches distinct from an empty account history', async (filter) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    activities[0].startTime = yesterday.toISOString();
    const user = userEvent.setup();
    const { container } = openRuns();
    await waitFor(() => expectRecordedRun(container));
    if (filter === 'search') await user.type(screen.getByRole('textbox', { name: t('runs.search_placeholder') }), 'no matching run');
    else await user.click(screen.getByRole('button', { name: t('runs.filter_day'), exact: true }));
    expect(screen.getByText(t('runs.empty'))).toBeInTheDocument();
    expect(container.querySelector('.runs-ledger-awaiting')).not.toBeInTheDocument();
    expectNoFalseBanner();
    if (filter === 'search') await user.click(screen.getByRole('button', { name: t('runs.clear_search') }));
    else await user.click(screen.getByRole('button', { name: t('runs.filter_all'), exact: true }));
    expectRecordedRun(container);
  });

  it.each([
    [{ active: true }, 'profile.strava_sync_processing'],
    [{ status: 'COMPLETED', processedActivities: 1 }, 'profile.strava_sync_completed'],
    [{ status: 'FAILED', error: 'Authorization expired; relink Strava' }, 'profile.strava_sync_relink_required'],
  ])('preserves the linked sync status %o', async (syncStatus, key) => {
    stravaStatus = { linked: true, syncStatus };
    const { container } = openRuns();
    await waitFor(() => expectRecordedRun(container));
    expect(container.querySelector('.runs-ledger-v2__status')).toHaveTextContent(t(key));
    expectNoFalseBanner();
  });

  it('preserves an explicit integration failure notice in populated history', async () => {
    apiFetch.mockRejectedValue(new Error('Connection unavailable'));
    const user = userEvent.setup();
    const { container } = openRuns();
    await waitFor(() => expectRecordedRun(container));
    await user.click(screen.getByRole('button', { name: t('runs.awaiting_connect_strava'), exact: true }));
    const status = container.querySelector('.runs-ledger-v2__status');
    await waitFor(() => expect(status).toHaveTextContent(t('profile.strava_sync_failed')));
    expect(status).toHaveClass('runs-ledger-v2__status--alert');
    expectRecordedRun(container);
  });

  it('does not interpret an activity-load failure as proof of no activity', async () => {
    apiJson.mockImplementationOnce(async () => { throw new Error('Activities unavailable'); });
    const { container } = openRuns();
    expect(await screen.findByText(t('runs.load_error'))).toBeInTheDocument();
    expect(container.querySelector('.runs-ledger-awaiting')).not.toBeInTheDocument();
    expectNoFalseBanner();
  });

  it('keeps the history count and load-more behavior when the disconnected banner is suppressed', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    activities = Array.from({ length: 61 }, (_, index) => makeRun(index + 1));
    const user = userEvent.setup();
    const { container } = openRuns();
    await waitFor(() => expect(container.querySelectorAll('[data-run-id]')).toHaveLength(60));
    expect(container.querySelector('.runs-ledger-v2__figure')).toHaveTextContent('61');
    await user.click(screen.getByRole('button', { name: t('runs.load_more'), exact: true }));
    expect(container.querySelectorAll('[data-run-id]')).toHaveLength(61);
    const history = screen.getByRole('region', { name: t('runs.full_history') });
    expect(within(history).queryByRole('button', { name: t('runs.load_more'), exact: true })).not.toBeInTheDocument();
    expectNoFalseBanner();
  });
});
