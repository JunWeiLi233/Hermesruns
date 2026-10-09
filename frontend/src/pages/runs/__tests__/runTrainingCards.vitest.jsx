import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import { invalidateResourceCache } from '../../../api/resourceCache';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import RunTrainingCards from '../RunTrainingCards';

const state = vi.hoisted(() => ({ lang: 'en' }));
const t = (key, params = {}) => {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};

vi.mock('../../../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ invalidateResourceCache: vi.fn() }));
vi.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    lang: state.lang,
    t,
    formatNumber: (value) => new Intl.NumberFormat(state.lang === 'zh-CN' ? 'zh-CN' : 'en-US').format(value),
  }),
}));

function metrics({ effort = {}, heartRate = {} } = {}) {
  return {
    activityId: 7,
    localDate: '2026-10-01',
    effort: { score: 142.4, source: 'HR_ZONES', perceivedExertion: null, ...effort },
    heartRate: {
      hasStream: true,
      averageHeartRate: 154,
      maxHeartRate: 181,
      coveredSeconds: 3000,
      coveragePercent: 96,
      zones: [
        { zone: 1, fromBpm: null, toBpm: 113, seconds: 300, percent: 10 },
        { zone: 2, fromBpm: 114, toBpm: 132, seconds: 600, percent: 20 },
        { zone: 3, fromBpm: 133, toBpm: 151, seconds: 1200, percent: 40 },
        { zone: 4, fromBpm: 152, toBpm: 170, seconds: 840, percent: 28 },
        { zone: 5, fromBpm: 171, toBpm: null, seconds: 60, percent: 2 },
      ],
      maxHeartRateBpm: 190,
      maxHeartRateSource: 'DEFAULT',
      boundarySource: 'AUTO',
      ...heartRate,
    },
    computedAt: '2026-10-01T10:00:00',
  };
}

const noStream = metrics({
  effort: { score: 90, source: 'PACE_MODEL' },
  heartRate: {
    hasStream: false, coveredSeconds: 0, coveragePercent: null,
    zones: [1, 2, 3, 4, 5].map((zone) => ({ zone, fromBpm: zone === 1 ? null : 100 + zone, toBpm: zone === 5 ? null : 101 + zone, seconds: 0, percent: 0 })),
  },
});

let next;
const metricsCalls = () => apiJson.mock.calls.filter(([url]) => url === '/api/activities/7/training-metrics');
const patchCalls = () => apiJson.mock.calls.filter(([url, options]) => url === '/api/activities/7' && options?.method === 'PATCH');

function renderCards(runId = 7) {
  return render(<MemoryRouter><RunTrainingCards runId={runId} /></MemoryRouter>);
}

beforeEach(() => {
  state.lang = 'en';
  next = metrics();
  apiJson.mockReset();
  invalidateResourceCache.mockReset();
  apiJson.mockImplementation(async (url) => {
    if (url.endsWith('/training-metrics')) {
      if (next instanceof Error) throw next;
      return next;
    }
    return {};
  });
});
afterEach(() => cleanup());

describe('effort card', () => {
  it('shows the score, where it came from, and how it is made', async () => {
    renderCards();
    const card = await screen.findByRole('region', { name: 'Effort' });
    expect(within(card).getByText('142')).toBeInTheDocument();
    expect(within(card).getByText(t('run_detail.effort_source_hr_zones'))).toBeInTheDocument();
    expect(within(card).getByText(t('run_detail.effort_how_hr_zones'))).toBeInTheDocument();
    expect(within(card).getByText(new RegExp(t('run_detail.effort_scale_note').slice(0, 30)))).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: t('run_detail.effort_scale_link') })).toHaveAttribute('href', '/analysis/load-balance');
  });

  it('formats a big score for the language', async () => {
    next = metrics({ effort: { score: 1234.6 } });
    renderCards();
    expect(await screen.findByText('1,235')).toBeInTheDocument();
  });

  it.each([
    ['PERCEIVED', { score: 120, perceivedExertion: 7 }, 'run_detail.effort_source_perceived', 'From your rating of 7 out of 10'],
    ['HR_AVERAGE', { score: 80 }, 'run_detail.effort_source_hr_average', 'From your average heart rate'],
    ['PACE_MODEL', { score: 60 }, 'run_detail.effort_source_pace_model', 'Estimated from pace'],
    ['PACE_CALIBRATED', { score: 70 }, 'run_detail.effort_source_pace_calibrated', 'Estimated from pace, matched to your heart-rate runs'],
  ])('explains a %s score', async (source, effort, key, expected) => {
    next = metrics({ effort: { source, ...effort } });
    renderCards();
    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(t(key, { rating: effort.perceivedExertion })).toBe(expected);
  });

  it('says so when there is nothing to base a score on', async () => {
    next = metrics({ effort: { score: null, source: null } });
    renderCards();
    expect(await screen.findByText(t('run_detail.effort_none'))).toBeInTheDocument();
    expect(screen.getByText(t('run_detail.effort_how_none'))).toBeInTheDocument();
    expect(screen.getByText('–')).toBeInTheDocument();
  });
});

describe('heart-rate zones card', () => {
  it('lists the zones highest first with their ranges, times and shares', async () => {
    renderCards();
    const card = await screen.findByRole('region', { name: 'Heart-rate zones' });
    const rows = within(card).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent('Zone 5 · Maximum');
    expect(rows[0]).toHaveTextContent('171 bpm and up');
    expect(rows[0]).toHaveTextContent('1:00');
    expect(rows[0]).toHaveTextContent('2%');
    expect(rows[2]).toHaveTextContent('Zone 3 · Steady');
    expect(rows[2]).toHaveTextContent('133–151 bpm');
    expect(rows[2]).toHaveTextContent('20:00');
    expect(rows[2]).toHaveTextContent('40%');
    expect(rows[4]).toHaveTextContent('Zone 1 · Recovery');
    expect(rows[4]).toHaveTextContent('under 114 bpm');
    expect(rows[4]).toHaveTextContent('5:00');
    // Bars are drawn to scale with the share of the run.
    expect(rows[2].querySelector('.run-detail-v2__zone-track i')).toHaveStyle({ width: '40%' });
  });

  it('shows a dash for a zone with no time and "<1%" for a brief visit', async () => {
    next = metrics({
      heartRate: {
        zones: [
          { zone: 1, fromBpm: null, toBpm: 113, seconds: 0, percent: 0 },
          { zone: 2, fromBpm: 114, toBpm: 132, seconds: 3, percent: 0.1 },
          { zone: 3, fromBpm: 133, toBpm: 151, seconds: 2997, percent: 99.9 },
          { zone: 4, fromBpm: 152, toBpm: 170, seconds: 0, percent: 0 },
          { zone: 5, fromBpm: 171, toBpm: null, seconds: 0, percent: 0 },
        ],
      },
    });
    renderCards();
    const rows = within(await screen.findByRole('region', { name: 'Heart-rate zones' })).getAllByRole('listitem');
    expect(rows[4]).toHaveTextContent('–');
    expect(rows[3]).toHaveTextContent('<1%');
    expect(rows[3].querySelector('.run-detail-v2__zone-track i')).toHaveStyle({ width: '1%' });
    expect(rows[4].querySelector('.run-detail-v2__zone-track i')).toHaveStyle({ width: '0%' });
  });

  it('says where the zones come from and links to where they are set', async () => {
    renderCards();
    const card = await screen.findByRole('region', { name: 'Heart-rate zones' });
    expect(within(card).getByText(t('run_detail.zones_basis_default', { max: 190 }))).toBeInTheDocument();
    expect(within(card).getByText(t('run_detail.zones_coverage', { percent: 96 }))).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: t('run_detail.zones_edit') })).toHaveAttribute('href', '/settings?section=training');
  });

  it.each([
    [{ maxHeartRateSource: 'PROFILE', boundarySource: 'AUTO', maxHeartRateBpm: 186 }, 'run_detail.zones_basis_profile', { max: 186 }],
    [{ maxHeartRateSource: 'PROFILE', boundarySource: 'MANUAL' }, 'run_detail.zones_basis_manual', {}],
    [{ maxHeartRateSource: 'DEFAULT', boundarySource: 'MANUAL' }, 'run_detail.zones_basis_manual', {}],
  ])('describes the zone basis for %o', async (heartRate, key, params) => {
    next = metrics({ heartRate });
    renderCards();
    expect(await screen.findByText(t(key, params))).toBeInTheDocument();
  });

  it('says there is no stream when the run has none, and still shows the averages it knows', async () => {
    next = noStream;
    renderCards();
    const card = await screen.findByRole('region', { name: 'Heart-rate zones' });
    expect(within(card).getByText(t('run_detail.zones_no_stream'))).toBeInTheDocument();
    expect(within(card).queryAllByRole('listitem')).toHaveLength(0);
    expect(within(card).getByText('154 bpm')).toBeInTheDocument();
    expect(within(card).getByText('181 bpm')).toBeInTheDocument();
  });

  it('shows the Chinese names when the language is Chinese', async () => {
    state.lang = 'zh-CN';
    renderCards();
    const card = await screen.findByRole('region', { name: '心率区间' });
    const rows = within(card).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('区间 5 · 极限');
    expect(rows[0]).toHaveTextContent('171 bpm 及以上');
  });
});

describe('rating a run', () => {
  const group = () => screen.getByRole('group', { name: t('run_detail.rating_group') });

  it('offers 1 to 10 with none chosen and the hint about heart-rate data', async () => {
    renderCards();
    await screen.findByRole('region', { name: 'Effort' });
    const buttons = within(group()).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect(buttons.every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(within(group()).getByRole('button', { name: '7 out of 10' })).toBeInTheDocument();
    expect(screen.getByText(t('run_detail.rating_hint_idle'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('run_detail.rating_clear') })).not.toBeInTheDocument();
  });

  it('saves a rating, refreshes the score and tells the page cache the run changed', async () => {
    next = noStream;
    const user = userEvent.setup();
    renderCards();
    await screen.findByRole('region', { name: 'Effort' });
    expect(metricsCalls()).toHaveLength(1);

    next = metrics({ effort: { score: 105, source: 'PERCEIVED', perceivedExertion: 7 }, heartRate: noStream.heartRate });
    await user.click(within(group()).getByRole('button', { name: '7 out of 10' }));

    await waitFor(() => expect(metricsCalls()).toHaveLength(2));
    expect(patchCalls()).toHaveLength(1);
    expect(patchCalls()[0][1]).toEqual(expect.objectContaining({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ perceivedExertion: 7 }),
    }));
    expect(invalidateResourceCache).toHaveBeenCalledWith('/api/activities');
    expect(await screen.findByText('105')).toBeInTheDocument();
    expect(screen.getByText('From your rating of 7 out of 10')).toBeInTheDocument();
    expect(within(group()).getByRole('button', { name: '7 out of 10' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(t('run_detail.rating_saved'))).toBeInTheDocument();
    expect(screen.getByText(t('run_detail.rating_hint_used'))).toBeInTheDocument();
  });

  it('says the rating does not change a score that comes from heart-rate data', async () => {
    next = metrics({ effort: { perceivedExertion: 4 } });
    renderCards();
    await screen.findByRole('region', { name: 'Effort' });
    expect(within(group()).getByRole('button', { name: '4 out of 10' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(t('run_detail.rating_hint_unused'))).toBeInTheDocument();
  });

  it('does nothing when the chosen rating is clicked again, and clears it with the clear button', async () => {
    next = metrics({ effort: { score: 105, source: 'PERCEIVED', perceivedExertion: 7 }, heartRate: noStream.heartRate });
    const user = userEvent.setup();
    renderCards();
    await screen.findByRole('region', { name: 'Effort' });

    await user.click(within(group()).getByRole('button', { name: '7 out of 10' }));
    expect(patchCalls()).toHaveLength(0);

    next = noStream;
    await user.click(screen.getByRole('button', { name: t('run_detail.rating_clear') }));
    await waitFor(() => expect(patchCalls()).toHaveLength(1));
    expect(patchCalls()[0][1].body).toBe(JSON.stringify({ perceivedExertion: null }));
    await waitFor(() => expect(screen.queryByRole('button', { name: t('run_detail.rating_clear') })).not.toBeInTheDocument());
    expect(screen.getByText(t('run_detail.rating_cleared'))).toBeInTheDocument();
    expect(within(group()).getAllByRole('button').every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('keeps the old rating and says so when saving fails', async () => {
    next = metrics({ effort: { perceivedExertion: 4 } });
    apiJson.mockImplementation(async (url, options) => {
      if (url.endsWith('/training-metrics')) return next;
      if (options?.method === 'PATCH') throw Object.assign(new Error('Request failed'), { status: 500 });
      return {};
    });
    const user = userEvent.setup();
    renderCards();
    await screen.findByRole('region', { name: 'Effort' });

    await user.click(within(group()).getByRole('button', { name: '9 out of 10' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_detail.rating_failed'));
    expect(within(group()).getByRole('button', { name: '4 out of 10' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group()).getByRole('button', { name: '9 out of 10' })).toHaveAttribute('aria-pressed', 'false');
    expect(metricsCalls()).toHaveLength(1);
    expect(invalidateResourceCache).not.toHaveBeenCalled();
  });
});

describe('loading and failing', () => {
  it('shows a loading note first, and keeps the section anchor for the run navigation', async () => {
    let release;
    apiJson.mockImplementation(() => new Promise((resolve) => { release = () => resolve(next); }));
    const { container } = renderCards();
    expect(container.querySelector('#run-detail-effort')).toBeInTheDocument();
    expect(screen.getByText(t('run_detail.training_loading'))).toBeInTheDocument();
    release();
    expect(await screen.findByRole('region', { name: 'Effort' })).toBeInTheDocument();
    expect(screen.queryByText(t('run_detail.training_loading'))).not.toBeInTheDocument();
  });

  it('shows an error with a retry when the numbers cannot be loaded', async () => {
    next = Object.assign(new Error('Request failed'), { status: 500 });
    const user = userEvent.setup();
    const { container } = renderCards();
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_detail.training_error'));
    expect(container.querySelector('#run-detail-effort')).toBeInTheDocument();

    next = metrics();
    await user.click(screen.getByRole('button', { name: t('run_detail.training_retry') }));
    expect(await screen.findByRole('region', { name: 'Effort' })).toBeInTheDocument();
    expect(metricsCalls()).toHaveLength(2);
  });

  it('treats an empty or half-formed answer as a failure, not as numbers', async () => {
    next = {};
    renderCards();
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_detail.training_error'));
    expect(screen.queryByRole('region', { name: 'Effort' })).not.toBeInTheDocument();
  });

  it('says the numbers may be out of date after a rating whose refresh failed, and a retry brings them back', async () => {
    const user = userEvent.setup();
    renderCards();
    await screen.findByRole('region', { name: 'Effort' });

    next = Object.assign(new Error('Request failed'), { status: 500 });
    await user.click(screen.getByRole('button', { name: '6 out of 10' }));
    expect(await screen.findByText(t('run_detail.numbers_stale'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '6 out of 10' })).toHaveAttribute('aria-pressed', 'true');

    next = metrics({ effort: { perceivedExertion: 6 } });
    await user.click(screen.getByRole('button', { name: t('run_detail.training_retry') }));
    await waitFor(() => expect(screen.queryByText(t('run_detail.numbers_stale'))).not.toBeInTheDocument());
  });

  it('keeps showing the numbers when a refresh fails', async () => {
    const user = userEvent.setup();
    renderCards();
    await screen.findByRole('region', { name: 'Effort' });
    next = Object.assign(new Error('Request failed'), { status: 500 });
    await user.click(screen.getByRole('button', { name: '5 out of 10' }));
    await waitFor(() => expect(metricsCalls()).toHaveLength(2));
    expect(screen.getByRole('region', { name: 'Effort' })).toBeInTheDocument();
    expect(screen.getByText('142')).toBeInTheDocument();
    expect(screen.queryByText(t('run_detail.training_error'))).not.toBeInTheDocument();
  });

  it('never shows one run\'s numbers under another run', async () => {
    const { rerender } = render(<MemoryRouter><RunTrainingCards key={7} runId={7} /></MemoryRouter>);
    expect(await screen.findByText('142')).toBeInTheDocument();

    let release;
    apiJson.mockImplementation(() => new Promise((resolve) => { release = () => resolve(metrics({ effort: { score: 55 } })); }));
    rerender(<MemoryRouter><RunTrainingCards key={8} runId={8} /></MemoryRouter>);
    expect(screen.queryByText('142')).not.toBeInTheDocument();
    expect(screen.getByText(t('run_detail.training_loading'))).toBeInTheDocument();
    release();
    expect(await screen.findByText('55')).toBeInTheDocument();
  });
});
