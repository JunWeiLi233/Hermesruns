import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, apiJson } from '../../../api';
import en from '../../../i18n/locales/en';
import RunDetail from '../RunDetail';
import { paceProfile } from './paceFixtures';

const t = (key, params = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], en) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};

vi.mock('../../../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({
  cachedApiJson: vi.fn(async (url) => (url.startsWith('/api/activities') ? [] : {})),
  invalidateResourceCache: vi.fn(),
}));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    lang: 'en',
    t,
    formatNumber: (value, options) => new Intl.NumberFormat('en-US', options).format(value),
  }),
}));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));
vi.mock('../../../components/FooterNavLinks', () => ({ default: () => null }));
vi.mock('../../../components/RunnerShellTopNav', () => ({ default: () => null }));
vi.mock('../../../components/RunsSubpageNav', () => ({ default: () => null }));

/** A promise the test settles by hand, to decide which answer arrives first. */
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

let answers;
const requested = (suffix) => apiJson.mock.calls.filter(([url]) => url.endsWith(suffix)).map(([url]) => url);
const fetched = (suffix) => apiFetch.mock.calls.filter(([url]) => url.endsWith(suffix)).map(([url]) => url);
const paceRequests = () => requested('/pace-profile');

function respond(body) {
  return { ok: true, json: async () => body };
}

function Harness() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate('/runs/8')}>go to run 8</button>
      <Routes>
        <Route path="/runs/:id" element={<RunDetail />} />
      </Routes>
    </>
  );
}

beforeEach(() => {
  sessionStorage.clear();
  answers = {};
  apiJson.mockReset();
  apiFetch.mockReset();
  apiJson.mockImplementation(async (url) => {
    if (url.startsWith('/api/activities?id=')) {
      const id = Number(url.split('=')[1]);
      return { id, name: `Run ${id}`, distanceKm: 5, movingTimeSeconds: 1500, startTime: '2026-10-01T10:00:00' };
    }
    if (url.endsWith('/pace-profile')) {
      const run = url.match(/activities\/(\d+)\//)[1];
      return answers[`pace-${run}`] ? answers[`pace-${run}`].promise : paceProfile();
    }
    if (url.endsWith('/training-metrics')) return {};
    if (url === '/api/shoes') return [];
    return {};
  });
  apiFetch.mockImplementation(async (url) => {
    const run = (url.match(/activities\/(\d+)\//) || [])[1];
    if (url.endsWith('/points')) {
      if (answers[`points-${run}`]) await answers[`points-${run}`].promise;
      return respond([]);
    }
    if (url.endsWith('/analytics') || url.endsWith('/telemetry') || url.endsWith('/status')) return respond({});
    return respond({});
  });
});
afterEach(() => cleanup());

function renderPage(path = '/runs/7') {
  return render(<MemoryRouter initialEntries={[path]}><Harness /></MemoryRouter>);
}

describe('the pace analysis on the run page', () => {
  it('asks for the pace profile only once the run page has finished asking for the stream', async () => {
    answers['points-7'] = deferred();
    renderPage();
    await screen.findByRole('heading', { name: 'Pace analysis' });

    await waitFor(() => expect(fetched('/points')).toHaveLength(1));
    expect(paceRequests()).toHaveLength(0);
    expect(screen.getByText(t('run_detail.pace_loading'))).toBeInTheDocument();

    await act(async () => { answers['points-7'].resolve(); });
    await waitFor(() => expect(paceRequests()).toEqual(['/api/activities/7/pace-profile']));
    expect(await screen.findByRole('group', { name: t('run_detail.pace_view_group') })).toBeInTheDocument();
  });

  it('asks even when the stream request fails, so the card says what it can instead of loading forever', async () => {
    apiFetch.mockImplementation(async (url) => {
      if (url.endsWith('/points')) throw new Error('down');
      return respond({});
    });
    renderPage();

    await waitFor(() => expect(paceRequests()).toEqual(['/api/activities/7/pace-profile']));
  });

  it('is not left loading by a slow answer for the run the reader has already left', async () => {
    // Run 7's stream is slow; the reader moves on to run 8, whose stream and pace profile are in flight when run 7's
    // answer finally arrives.
    answers['points-7'] = deferred();
    answers['pace-8'] = deferred();
    renderPage('/runs/7');
    await screen.findByRole('heading', { name: 'Pace analysis' });
    await waitFor(() => expect(fetched('/points')).toEqual(['/api/activities/7/points']));

    act(() => { screen.getByRole('button', { name: 'go to run 8' }).click(); });
    await waitFor(() => expect(paceRequests()).toEqual(['/api/activities/8/pace-profile']));

    await act(async () => { answers['points-7'].resolve(); });
    await act(async () => { answers['pace-8'].resolve(paceProfile()); });

    expect(await screen.findByRole('group', { name: t('run_detail.pace_view_group') })).toBeInTheDocument();
    expect(screen.queryByText(t('run_detail.pace_loading'))).not.toBeInTheDocument();
    expect(paceRequests()).toEqual(['/api/activities/8/pace-profile']);
  });

  it('asks for the pace profile again after the elevation is recalibrated, because grade-adjusted pace depends on it', async () => {
    const fallback = apiFetch.getMockImplementation();
    apiFetch.mockImplementation(async (url, options) => {
      if (url.endsWith('/elevation/status')) return respond({ flagged: true, canRecalibrate: true });
      if (url.endsWith('/elevation/recalibrate')) return respond({});
      return fallback(url, options);
    });
    renderPage();
    await screen.findByRole('group', { name: t('run_detail.pace_view_group') });
    expect(paceRequests()).toHaveLength(1);

    await act(async () => { (await screen.findByRole('button', { name: t('run_detail.recalibrate') })).click(); });

    await waitFor(() => expect(paceRequests()).toHaveLength(2));
    expect(fetched('/elevation/recalibrate')).toHaveLength(1);
  });

  it('ignores the answers of a recalibration started on a run the reader has since left', async () => {
    const recalibration = deferred();
    const fallback = apiFetch.getMockImplementation();
    apiFetch.mockImplementation(async (url, options) => {
      if (url.endsWith('/elevation/status')) return respond({ flagged: true, canRecalibrate: true });
      if (url.endsWith('/elevation/recalibrate')) {
        await recalibration.promise;
        return respond({});
      }
      return fallback(url, options);
    });
    renderPage('/runs/7');
    await screen.findByRole('group', { name: t('run_detail.pace_view_group') });
    await act(async () => { (await screen.findByRole('button', { name: t('run_detail.recalibrate') })).click(); });
    await waitFor(() => expect(fetched('/elevation/recalibrate')).toEqual(['/api/activities/7/elevation/recalibrate']));

    act(() => { screen.getByRole('button', { name: 'go to run 8' }).click(); });
    await waitFor(() => expect(paceRequests()).toEqual(['/api/activities/7/pace-profile', '/api/activities/8/pace-profile']));
    expect(await screen.findByRole('group', { name: t('run_detail.pace_view_group') })).toBeInTheDocument();

    await act(async () => { recalibration.resolve(); });
    await act(async () => { await new Promise((done) => setTimeout(done, 30)); });

    // Run 7's late answer neither fetched run 7's numbers again nor made run 8's pace card ask a second time.
    expect(fetched('/analytics')).toEqual(['/api/activities/7/analytics', '/api/activities/8/analytics']);
    expect(paceRequests()).toEqual(['/api/activities/7/pace-profile', '/api/activities/8/pace-profile']);
  });

  describe('when the reader leaves run 7 while the numbers a recalibration asked for are still on their way', () => {
    const LATE = {
      analytics: { debrief: { readinessScore: 77, interpretation: 'late interpretation from run 7', nextDayGuidance: 'late guidance' } },
      telemetry: { trainingEffect: { available: true, aerobic: 4.7, anaerobic: 3.2 } },
      status: { flagged: true, canRecalibrate: false },
    };
    const refused = { ok: false, json: async () => ({}) };

    it.each(['analytics', 'telemetry', 'status', 'nothing usable'])('ignores them whether the one that arrives is: %s', async (arrives) => {
      const gate = deferred();
      const calls = {};
      const nth = (key) => {
        calls[key] = (calls[key] || 0) + 1;
        return calls[key];
      };
      const fallback = apiFetch.getMockImplementation();
      apiFetch.mockImplementation(async (url, options) => {
        if (url.endsWith('/elevation/recalibrate')) return respond({});
        if (url.endsWith('/elevation/status')) {
          if (url.includes('/activities/7/') && nth('status') > 1) {
            await gate.promise;
            return arrives === 'status' ? respond(LATE.status) : refused;
          }
          return respond({ flagged: true, canRecalibrate: true });
        }
        if (url === '/api/activities/7/analytics' && nth('analytics') > 1) {
          await gate.promise;
          return arrives === 'analytics' ? respond(LATE.analytics) : refused;
        }
        if (url === '/api/activities/7/telemetry' && nth('telemetry') > 1) {
          await gate.promise;
          return arrives === 'telemetry' ? respond(LATE.telemetry) : refused;
        }
        return fallback(url, options);
      });
      renderPage('/runs/7');
      await screen.findByRole('group', { name: t('run_detail.pace_view_group') });
      await act(async () => { (await screen.findByRole('button', { name: t('run_detail.recalibrate') })).click(); });
      await waitFor(() => expect(calls.status).toBe(2));

      act(() => { screen.getByRole('button', { name: 'go to run 8' }).click(); });
      await waitFor(() => expect(paceRequests()).toEqual(['/api/activities/7/pace-profile', '/api/activities/8/pace-profile']));

      await act(async () => { gate.resolve(); });
      await act(async () => { await new Promise((done) => setTimeout(done, 30)); });

      expect(screen.queryByText(LATE.analytics.debrief.interpretation)).not.toBeInTheDocument();
      expect(screen.queryByText('4.7')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: t('run_detail.recalibrate') })).toBeInTheDocument();
      expect(paceRequests()).toEqual(['/api/activities/7/pace-profile', '/api/activities/8/pace-profile']);
    });
  });

  it('does not ask again when the recalibration itself fails, nothing changed', async () => {
    const fallback = apiFetch.getMockImplementation();
    apiFetch.mockImplementation(async (url, options) => {
      if (url.endsWith('/elevation/status')) return respond({ flagged: true, canRecalibrate: true });
      if (url.endsWith('/elevation/recalibrate')) return { ok: false, json: async () => ({}) };
      return fallback(url, options);
    });
    renderPage();
    await screen.findByRole('group', { name: t('run_detail.pace_view_group') });

    await act(async () => { (await screen.findByRole('button', { name: t('run_detail.recalibrate') })).click(); });

    await waitFor(() => expect(fetched('/elevation/recalibrate')).toHaveLength(1));
    expect(paceRequests()).toHaveLength(1);
  });
});
