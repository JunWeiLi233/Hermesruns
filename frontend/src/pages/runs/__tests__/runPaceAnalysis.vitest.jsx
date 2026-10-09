import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import { cachedApiJson } from '../../../api/resourceCache';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { paceZoneBands } from '../../../utils/paceAnalysis';
import { estimateCurrentVdot } from '../../../utils/vdot';
import RunPaceAnalysis from '../RunPaceAnalysis';
import { NO_STREAM, paceProfile, paceProfileWithoutElevation } from './paceFixtures';

const state = vi.hoisted(() => ({ lang: 'en' }));
const t = (key, params = {}) => {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};

vi.mock('../../../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ invalidateResourceCache: vi.fn(), cachedApiJson: vi.fn() }));
vi.mock('../../../utils/vdot', async (importOriginal) => ({ ...(await importOriginal()), estimateCurrentVdot: vi.fn() }));
vi.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    lang: state.lang,
    t,
    formatNumber: (value, options) => new Intl.NumberFormat(state.lang === 'zh-CN' ? 'zh-CN' : 'en-US', options).format(value),
  }),
}));

let profile;
const paceCalls = () => apiJson.mock.calls.filter(([url]) => url === '/api/activities/9/pace-profile');
const chart = () => screen.getByRole('group', { name: t('run_detail.pace_chart_label') });
const bars = (container) => [...container.querySelectorAll('.run-detail-v2__pa-bar')];

function renderCard(props = {}) {
  return render(<RunPaceAnalysis runId={9} streamReady {...props} />);
}

beforeEach(() => {
  state.lang = 'en';
  profile = paceProfile();
  apiJson.mockReset();
  apiJson.mockImplementation(async (url) => {
    if (url === '/api/activities/9/pace-profile') {
      if (profile instanceof Error) throw profile;
      return profile;
    }
    return {};
  });
  cachedApiJson.mockReset();
  cachedApiJson.mockResolvedValue([{ id: 1 }]);
  estimateCurrentVdot.mockReset();
  estimateCurrentVdot.mockReturnValue({ representativeVdot: 50 });
});
afterEach(() => cleanup());

describe('loading', () => {
  it('waits for the run page to have the stream before asking, and keeps the anchor for the run navigation', async () => {
    const { container, rerender } = renderCard({ streamReady: false });
    expect(container.querySelector('#run-detail-pace')).toBeInTheDocument();
    expect(screen.getByText(t('run_detail.pace_loading'))).toBeInTheDocument();
    expect(paceCalls()).toHaveLength(0);

    rerender(<RunPaceAnalysis runId={9} streamReady />);
    expect(await screen.findByRole('group', { name: t('run_detail.pace_view_group') })).toBeInTheDocument();
    expect(paceCalls()).toHaveLength(1);
    expect(screen.queryByText(t('run_detail.pace_loading'))).not.toBeInTheDocument();
  });

  it('says so when the run has no stream', async () => {
    profile = NO_STREAM;
    renderCard();
    expect(await screen.findByText(t('run_detail.pace_no_stream'))).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: t('run_detail.pace_chart_label') })).not.toBeInTheDocument();
    expect(cachedApiJson).not.toHaveBeenCalled();
  });

  it('shows an error with a retry, and draws the card once a retry works', async () => {
    profile = Object.assign(new Error('down'), { status: 500 });
    const user = userEvent.setup();
    renderCard();
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_detail.pace_error'));

    profile = paceProfile();
    await user.click(screen.getByRole('button', { name: t('run_detail.pace_retry') }));
    expect(await screen.findByRole('group', { name: t('run_detail.pace_view_group') })).toBeInTheDocument();
    expect(paceCalls()).toHaveLength(2);
  });

  it('says the numbers may be out of date when a refresh fails, and a retry brings them back', async () => {
    const user = userEvent.setup();
    const { rerender } = renderCard({ refreshToken: 0 });
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });
    expect(screen.queryByText(t('run_detail.numbers_stale'))).not.toBeInTheDocument();

    profile = Object.assign(new Error('down'), { status: 500 });
    rerender(<RunPaceAnalysis runId={9} streamReady refreshToken={1} />);
    expect(await screen.findByText(t('run_detail.numbers_stale'))).toBeInTheDocument();
    expect(screen.getByRole('group', { name: t('run_detail.pace_chart_label') })).toBeInTheDocument();

    profile = paceProfile();
    await user.click(screen.getByRole('button', { name: t('run_detail.pace_retry') }));
    await waitFor(() => expect(screen.queryByText(t('run_detail.numbers_stale'))).not.toBeInTheDocument());
    expect(paceCalls()).toHaveLength(3);
  });

  it('fetches again when something the profile depends on changed', async () => {
    const { rerender } = renderCard({ refreshToken: 0 });
    await screen.findByRole('group', { name: t('run_detail.pace_view_group') });
    rerender(<RunPaceAnalysis runId={9} streamReady refreshToken={1} />);
    await waitFor(() => expect(paceCalls()).toHaveLength(2));
    expect(screen.getByRole('group', { name: t('run_detail.pace_view_group') })).toBeInTheDocument();
  });
});

describe('the splits view', () => {
  it('draws one bar per split, the fastest and slowest marked, a partial split dimmer, and a faster split taller', async () => {
    const { container } = renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });

    const drawn = bars(container);
    expect(drawn).toHaveLength(4);
    expect(drawn.map((bar) => bar.dataset.split)).toEqual(['1', '2', '3', '4']);
    expect(drawn[1]).toHaveClass('is-fastest');
    expect(drawn[0]).toHaveClass('is-slowest');
    expect(drawn[3]).toHaveClass('is-partial');
    const heights = drawn.map((bar) => Number(bar.getAttribute('height')));
    const widths = drawn.map((bar) => Number(bar.getAttribute('width')));
    expect(heights[1]).toBeGreaterThan(heights[2]); // 5:00 is faster than 5:15
    expect(heights[2]).toBeGreaterThan(heights[0]); // 5:15 is faster than 5:30
    expect(widths[3]).toBeLessThan(widths[0] * 0.4); // 350 m next to 1000 m
    expect(container.querySelectorAll('.run-detail-v2__pa-elevation')).toHaveLength(1);
    expect(container.querySelectorAll('.run-detail-v2__pa-line')).toHaveLength(0);
  });

  it('labels the pace axis and the kilometres', async () => {
    const { container } = renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });

    const labels = [...container.querySelectorAll('.run-detail-v2__pa-svg text')].map((node) => node.textContent);
    expect(labels).toEqual(expect.arrayContaining(['km', '1', '2', '3']));
    expect(labels.some((label) => /^\d:\d\d$/.test(label))).toBe(true);
  });

  it('lists the fastest, slowest and average on pace', async () => {
    const { container } = renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });

    const markers = container.querySelector('.run-detail-v2__pa-markers');
    expect(within(markers).getByText(t('run_detail.pace_marker_fastest')).closest('div')).toHaveTextContent('km 2');
    expect(within(markers).getByText(t('run_detail.pace_marker_fastest')).closest('div')).toHaveTextContent('5:00 /km');
    expect(within(markers).getByText(t('run_detail.pace_marker_slowest')).closest('div')).toHaveTextContent('km 1');
    expect(within(markers).getByText(t('run_detail.pace_marker_slowest')).closest('div')).toHaveTextContent('5:30 /km');
    expect(within(markers).getByText(t('run_detail.pace_marker_average')).closest('div')).toHaveTextContent('5:09 /km');
  });

  it('says how much time was spent standing still only when there was some', async () => {
    const { rerender } = renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });
    expect(screen.getByText(new RegExp(t('run_detail.pace_basis_moving')))).toBeInTheDocument();
    expect(screen.queryByText(/Standing still: /)).not.toBeInTheDocument();

    profile = paceProfile({ summary: { ...paceProfile().summary, stoppedSeconds: 75.0 } });
    rerender(<RunPaceAnalysis runId={9} streamReady refreshToken={1} />);
    expect(await screen.findByText(/Standing still: 1:15\./)).toBeInTheDocument();
  });
});

describe('the smoothed view', () => {
  it('draws the pace as a line that breaks where the runner stood still, instead of bars', async () => {
    const user = userEvent.setup();
    const { container } = renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });

    await user.click(screen.getByRole('button', { name: t('run_detail.pace_view_smoothed') }));

    expect(screen.getByRole('button', { name: t('run_detail.pace_view_smoothed') })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: t('run_detail.pace_view_splits') })).toHaveAttribute('aria-pressed', 'false');
    expect(bars(container)).toHaveLength(0);
    const lines = container.querySelectorAll('.run-detail-v2__pa-line');
    expect(lines).toHaveLength(1);
    expect(lines[0].getAttribute('d').match(/M/g)).toHaveLength(2);
    expect(container.querySelectorAll('.run-detail-v2__pa-elevation')).toHaveLength(1);
  });
});

describe('grade-adjusted pace', () => {
  it('adds a tick per split at its grade-adjusted pace and moves the markers to the grade-adjusted fastest and slowest', async () => {
    const user = userEvent.setup();
    const { container } = renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });
    expect(container.querySelectorAll('[data-gap-split]')).toHaveLength(0);
    expect(screen.queryByText(t('run_detail.pace_gap_note'))).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: t('run_detail.pace_gap_toggle') }));

    expect(screen.getByRole('switch', { name: t('run_detail.pace_gap_toggle') })).toBeChecked();
    expect(container.querySelectorAll('[data-gap-split]')).toHaveLength(4);
    expect(screen.getByText(t('run_detail.pace_gap_note'))).toBeInTheDocument();
    const drawn = bars(container);
    expect(drawn[0]).toHaveClass('is-fastest');
    expect(drawn[1]).toHaveClass('is-slowest');
    const markers = container.querySelector('.run-detail-v2__pa-markers');
    expect(within(markers).getByText(t('run_detail.pace_marker_fastest')).closest('div')).toHaveTextContent('km 1');
    expect(within(markers).getByText(t('run_detail.pace_marker_fastest')).closest('div')).toHaveTextContent('4:40 /km');
    expect(within(markers).getByText(t('run_detail.pace_marker_average')).closest('div')).toHaveTextContent('5:04 /km');
  });

  it('draws a second, dashed line in the smoothed view', async () => {
    const user = userEvent.setup();
    const { container } = renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });
    await user.click(screen.getByRole('button', { name: t('run_detail.pace_view_smoothed') }));
    await user.click(screen.getByRole('switch', { name: t('run_detail.pace_gap_toggle') }));

    expect(container.querySelectorAll('.run-detail-v2__pa-line')).toHaveLength(2);
    expect(container.querySelectorAll('.run-detail-v2__pa-line.is-gap')).toHaveLength(1);
  });

  it('is switched off, with the reason, for a run with no elevation, and nothing is invented', async () => {
    profile = paceProfileWithoutElevation();
    const user = userEvent.setup();
    const { container } = renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });

    expect(screen.getByRole('switch', { name: t('run_detail.pace_gap_toggle') })).toBeDisabled();
    expect(screen.getByText(t('run_detail.pace_gap_unavailable'))).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: t('run_detail.pace_gap_toggle') }));
    expect(container.querySelectorAll('[data-gap-split]')).toHaveLength(0);
    expect(container.querySelectorAll('.run-detail-v2__pa-elevation')).toHaveLength(0);
    expect(container.querySelector('.run-detail-v2__pa-legend .is-elevation')).toBeNull();
  });
});

describe('the size of the chart', () => {
  afterEach(() => {
    delete HTMLElement.prototype.clientWidth;
  });

  it('is drawn at the width of the space it has, read before the first paint', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 640 });
    const { container } = renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });

    const svg = container.querySelector('.run-detail-v2__pa-svg');
    expect(svg.getAttribute('width')).toBe('640');
    expect(svg.getAttribute('viewBox')).toBe('0 0 640 260');
  });

  it('is shorter on a phone, and falls back to a default width where nothing can be measured', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 340 });
    const phone = renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });
    expect(phone.container.querySelector('.run-detail-v2__pa-svg').getAttribute('height')).toBe('210');
    phone.unmount();

    delete HTMLElement.prototype.clientWidth;
    const unmeasured = renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });
    expect(unmeasured.container.querySelector('.run-detail-v2__pa-svg').getAttribute('width')).toBe('720');
  });
});

describe('reading the chart', () => {
  it('reads out a split with the arrow keys, and clears with Escape', async () => {
    const user = userEvent.setup();
    const { container } = renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });

    chart().focus();
    await user.keyboard('{ArrowRight}');
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toHaveTextContent('km 1');
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toHaveTextContent('5:30 /km');
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toHaveTextContent('+20 m');
    expect(bars(container)[0]).toHaveClass('is-active');

    await user.keyboard('{ArrowRight}');
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toHaveTextContent('km 2');
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toHaveTextContent('-20 m');

    await user.keyboard('{End}');
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toHaveTextContent('Last 0.35 km');
    await user.keyboard('{ArrowRight}');
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toHaveTextContent('Last 0.35 km');
    await user.keyboard('{Home}');
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toHaveTextContent('km 1');

    await user.keyboard('{Escape}');
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toBeNull();
  });

  it('announces the same readout for screen readers', async () => {
    const user = userEvent.setup();
    renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });
    chart().focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByText('km 1. Pace 5:30 /km. Elevation change +20 m')).toBeInTheDocument();
  });

  it('shows the grade-adjusted pace in the readout only when it is switched on', async () => {
    const user = userEvent.setup();
    const { container } = renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });
    chart().focus();
    await user.keyboard('{ArrowRight}');
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).not.toHaveTextContent(t('run_detail.pace_gap_toggle'));

    await user.click(screen.getByRole('switch', { name: t('run_detail.pace_gap_toggle') }));
    chart().focus();
    await user.keyboard('{ArrowRight}');
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toHaveTextContent(`${t('run_detail.pace_gap_toggle')}4:40 /km`);
  });

  it('reads out a moment of the smoothed line, and says when the runner was standing still', async () => {
    const user = userEvent.setup();
    const { container } = renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });
    await user.click(screen.getByRole('button', { name: t('run_detail.pace_view_smoothed') }));

    chart().focus();
    await user.keyboard('{ArrowRight}');
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toHaveTextContent('0.00 km');
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toHaveTextContent('6:20 /km');
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toHaveTextContent('100 m');
    expect(container.querySelector('.run-detail-v2__pa-cursor')).toBeInTheDocument();

    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toHaveTextContent('1.20 km');
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toHaveTextContent(t('run_detail.pace_hover_stopped'));
  });

  it('follows the pointer, picking the split under it', async () => {
    const { container } = renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });
    const hit = container.querySelector('.run-detail-v2__pa-hit');
    hit.getBoundingClientRect = () => ({ left: 100, width: 660, top: 0, height: 100, right: 760, bottom: 100 });

    // 3.35 km across 660 px: x = 100 + 660 * (1.5 / 3.35) is the middle of the second kilometre.
    fireEvent.pointerMove(hit, { clientX: 100 + 660 * (1.5 / 3.35) });
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toHaveTextContent('km 2');

    fireEvent.pointerMove(hit, { clientX: 100 + 660 * (3.2 / 3.35) });
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toHaveTextContent('Last 0.35 km');

    fireEvent.pointerLeave(hit);
    expect(container.querySelector('.run-detail-v2__pa-tooltip')).toBeNull();
  });
});

describe('time at each pace', () => {
  const rows = (container) => [...container.querySelectorAll('[data-pace-zone]')];

  it('lists the zones fastest first with their pace ranges, times and shares', async () => {
    const { container } = renderCard();
    await screen.findByRole('group', { name: t('run_detail.pace_chart_label') });
    await waitFor(() => expect(rows(container)).toHaveLength(6));

    const shown = rows(container);
    expect(shown.map((row) => row.dataset.paceZone)).toEqual(['repetition', 'interval', 'threshold', 'marathon', 'easy', 'recovery']);
    const bands = paceZoneBands(50);
    expect(shown[0]).toHaveTextContent('Repetition');
    expect(shown[1]).toHaveTextContent('Interval');
    expect(shown[2]).toHaveTextContent('Threshold');
    expect(shown[3]).toHaveTextContent('Marathon');
    expect(shown[5]).toHaveTextContent('Recovery');
    expect(shown[0]).toHaveTextContent('faster than 3:41 /km');
    expect(shown[4]).toHaveTextContent('Easy');
    expect(shown[4]).toHaveTextContent('4:50–5:52 /km');
    expect(shown[5]).toHaveTextContent('slower than 5:52 /km');
    expect(bands).toHaveLength(6);
    // The samples are 100 s apart: one in recovery, four easy, two marathon, one each threshold, interval, repetition.
    expect(shown[5]).toHaveTextContent('1:40');
    expect(shown[4]).toHaveTextContent('6:40');
    expect(shown[3]).toHaveTextContent('3:20');
    expect(shown[2]).toHaveTextContent('1:40');
    expect(shown[1]).toHaveTextContent('1:40');
    expect(shown[0]).toHaveTextContent('1:40');
    // Of 1000 s moving: 10%, 40%, 20%, 10%, 10%, 10%. The 100 s standing still is not part of the shares.
    expect(shown[4]).toHaveTextContent('40%');
    expect(shown[3]).toHaveTextContent('20%');
    expect(shown[5]).toHaveTextContent('10%');
    expect(shown[4].querySelector('.run-detail-v2__zone-track i')).toHaveStyle({ width: '40%' });
    expect(screen.getByText(t('run_detail.pace_zones_basis', { vdot: 50 }))).toBeInTheDocument();
    expect(screen.getByText(t('run_detail.pace_zones_basis_pace'))).toBeInTheDocument();
    expect(cachedApiJson).toHaveBeenCalledWith('/api/activities/analysis');
  });

  it('counts on the grade-adjusted pace when that is switched on', async () => {
    const user = userEvent.setup();
    const { container } = renderCard();
    await waitFor(() => expect(rows(container)).toHaveLength(6));

    await user.click(screen.getByRole('switch', { name: t('run_detail.pace_gap_toggle') }));

    const shown = rows(container);
    expect(shown[5]).toHaveTextContent('–'); // nothing in recovery any more
    expect(shown[4]).toHaveTextContent('6:40');
    expect(shown[3]).toHaveTextContent('1:40');
    expect(shown[2]).toHaveTextContent('3:20');
    expect(shown[0]).toHaveTextContent('3:20');
    expect(screen.getByText(t('run_detail.pace_zones_basis_gap'))).toBeInTheDocument();
  });

  it('says what it needs when there are too few recent runs for a VDOT', async () => {
    estimateCurrentVdot.mockReturnValue({ representativeVdot: null });
    const { container } = renderCard();
    expect(await screen.findByText(t('run_detail.pace_zones_unavailable'))).toBeInTheDocument();
    expect(rows(container)).toHaveLength(0);
  });

  it('says so when the run list cannot be loaded, without losing the chart', async () => {
    cachedApiJson.mockRejectedValue(new Error('down'));
    renderCard();
    expect(await screen.findByText(t('run_detail.pace_zones_error'))).toBeInTheDocument();
    expect(screen.getByRole('group', { name: t('run_detail.pace_chart_label') })).toBeInTheDocument();
  });

  it('does not ask for the run list until the profile has arrived with a stream', async () => {
    renderCard({ streamReady: false });
    expect(cachedApiJson).not.toHaveBeenCalled();
  });
});

describe('language', () => {
  it('is written in Chinese when the language is Chinese', async () => {
    state.lang = 'zh-CN';
    const { container } = renderCard();
    expect(await screen.findByRole('heading', { name: '配速分析' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '分段' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '坡度修正' })).toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll('[data-pace-zone]')).toHaveLength(6));
    const names = [...container.querySelectorAll('[data-pace-zone] .run-detail-v2__zone-name strong')].map((node) => node.textContent);
    expect(names).toEqual(['重复', '间歇', '乳酸阈', '马拉松配速', '轻松', '恢复']);
    expect(container.querySelector('[data-pace-zone="repetition"]')).toHaveTextContent('重复');
    expect(container.querySelector('[data-pace-zone="repetition"]')).toHaveTextContent('快于 3:41');
  });
});
