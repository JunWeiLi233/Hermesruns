import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { methodsDocUrl } from '../../../utils/methodsDoc';
import IntensitySection from '../IntensitySection';
import { intensity, noIntensityWeeks } from './intensityFixtures';

const state = vi.hoisted(() => ({ lang: 'en' }));
const t = (key, params = {}) => {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};

vi.mock('../../../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    lang: state.lang,
    t,
    formatNumber: (value, options) => new Intl.NumberFormat(state.lang === 'zh-CN' ? 'zh-CN' : 'en-US', options).format(value),
    formatList: (values) => values.join(', '),
  }),
}));

let served;
const reads = () => apiJson.mock.calls.filter(([url]) => String(url).startsWith('/api/training/intensity'));

function boxed(plot, width = 720) {
  plot.getBoundingClientRect = () => ({ left: 0, top: 0, right: width, bottom: 230, width, height: 230, x: 0, y: 0, toJSON() {} });
}

beforeEach(() => {
  state.lang = 'en';
  served = intensity();
  apiJson.mockReset();
  apiJson.mockImplementation(async (url) => {
    if (String(url).startsWith('/api/training/intensity')) {
      if (served instanceof Error) throw served;
      return served;
    }
    return {};
  });
});
afterEach(() => cleanup());

describe('loading and failing', () => {
  it('is a region named after its title, busy until the weeks are there, and asks for twelve weeks', async () => {
    const { container } = render(<IntensitySection />);
    const card = screen.getByRole('region', { name: t('training_intensity.title') });
    expect(card).toHaveAttribute('aria-busy', 'true');
    expect(within(card).getByRole('status')).toHaveTextContent(t('training_intensity.loading'));
    expect(container.querySelector('.page-skeleton__block')).toBeInTheDocument();

    expect(await screen.findByRole('slider')).toBeInTheDocument();
    expect(card).not.toHaveAttribute('aria-busy');
    expect(reads().map(([url]) => url)).toEqual(['/api/training/intensity?weeks=12']);
  });

  it('says so, with a way to try again, when the weeks cannot be loaded', async () => {
    served = new Error('down');
    render(<IntensitySection />);
    expect(await screen.findByRole('alert')).toHaveTextContent(t('training_intensity.error'));

    served = intensity();
    await userEvent.click(screen.getByRole('button', { name: t('training_series.retry') }));
    expect(await screen.findByRole('slider')).toBeInTheDocument();
  });

  it('treats an answer without the parts it draws as a failed load, not a half-drawn chart', async () => {
    served = { today: '2026-10-10', weeks: [] };
    render(<IntensitySection />);
    expect(await screen.findByRole('alert')).toHaveTextContent(t('training_intensity.error'));
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('says there is nothing to show for a runner with no analysed week', async () => {
    served = noIntensityWeeks();
    render(<IntensitySection />);
    expect(await screen.findByText(t('training_intensity.empty'))).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('says that heart-rate data is what is missing when no run of the weeks has any', async () => {
    served = intensity({ weekMinutes: Array.from({ length: 3 }, () => [0, 0, 0, 0, 0]), runsWithHeartRatePerWeek: 0 });
    render(<IntensitySection />);
    expect(await screen.findByText(t('training_intensity.empty_no_heart_rate'))).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });
});

describe('the chart', () => {
  it('draws a bar for each week with a piece for each zone, and marks the newest week as still going', async () => {
    const { container } = render(<IntensitySection />);
    const slider = await screen.findByRole('slider');

    const bars = [...container.querySelectorAll('.training-intensity-v2__bar')];
    expect(bars).toHaveLength(12);
    expect(container.querySelectorAll('.training-intensity-v2__segment')).toHaveLength(60);
    expect(bars[11]).toHaveClass('is-current', 'is-open');
    expect(bars[10]).not.toHaveClass('is-open');
    expect(slider).toHaveAccessibleName(/Time in each heart-rate zone, week by week, in hours/);
    expect(slider).toHaveAttribute('aria-valuenow', '11');
    expect(slider).toHaveAttribute('aria-valuetext', 'Week of Oct 5: 3:20:00 of heart-rate time, 80% in zones 1 to 3, 5% in zone 4, 15% in zone 5');
  });

  it('counts the axis in minutes for a light block', async () => {
    served = intensity({ weekMinutes: Array.from({ length: 4 }, () => [30, 20, 0, 0, 0]) });
    render(<IntensitySection />);
    expect(await screen.findByRole('slider')).toHaveAccessibleName(/in minutes/);
  });

  it('names the five zones in a key that the screen reader skips, because the readout and the table have them', async () => {
    const { container } = render(<IntensitySection />);
    await screen.findByRole('slider');
    const key = container.querySelector('.training-intensity-v2__legend');

    expect(key).toHaveTextContent('Zone 1Zone 2Zone 3Zone 4Zone 5Hours of heart-rate time a week');
    expect(key).toHaveAttribute('aria-hidden', 'true');
  });

  it('has the same figures in a table for a screen reader, newest last', async () => {
    const { container } = render(<IntensitySection />);
    await screen.findByRole('slider');
    const table = container.querySelector('table[data-analysis-history="intensity"]');
    const rows = within(table).getAllByRole('row').slice(1);

    expect(rows).toHaveLength(12);
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent))
      .toEqual([t('training_series.col_week'), t('training_series.col_runs'), 'Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5']);
    expect(rows[0]).toHaveTextContent('Jul 20');
    expect(rows[11]).toHaveTextContent('Oct 5');
    expect(rows[11]).toHaveTextContent('4 of 4');
    expect(rows[11]).toHaveTextContent('1:00:00');
    expect(rows[11]).toHaveTextContent('10:00');
    expect(rows[11]).toHaveTextContent('30:00');
  });
});

describe('the three bands', () => {
  it('shows how much of the time each held, with its time and the names of its zones', async () => {
    render(<IntensitySection />);
    await screen.findByRole('slider');
    const cards = within(screen.getByRole('region', { name: t('training_intensity.title') }))
      .getByLabelText(t('training_intensity.bands_label')).querySelectorAll('article');

    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent('Zones 1–3');
    expect(cards[0]).toHaveTextContent('80%');
    expect(cards[0]).toHaveTextContent('32:00:00');          // 12 weeks x 160 minutes
    expect(cards[0]).toHaveTextContent('Recovery · Easy · Steady');
    expect(cards[1]).toHaveTextContent('Zone 4');
    expect(cards[1]).toHaveTextContent('5%');
    expect(cards[1]).toHaveTextContent('Hard');
    expect(cards[2]).toHaveTextContent('Zone 5');
    expect(cards[2]).toHaveTextContent('15%');
    expect(cards[2]).toHaveTextContent('Maximum');
  });
});

describe('the name of the spread', () => {
  it.each([
    ['polarized', 'Polarized', /polarized spread/],
    ['pyramidal', 'Pyramidal', /pyramidal spread/],
    ['threshold', 'Threshold-heavy', /threshold-heavy spread/],
    ['high', 'Mostly zone 5', /Zone 5 holds more of it than any other band/],
    ['mixed', 'Mixed', /does not fit one of the usual patterns/],
  ])('says %s in a word and in a sentence', async (pattern, word, sentence) => {
    served = intensity({ pattern });
    const { container } = render(<IntensitySection />);
    await screen.findByRole('slider');

    expect(container.querySelector('.analysis-load-v2-chart-meta .analysis-load-v2-zone')).toHaveTextContent(word);
    expect(screen.getByText(sentence)).toBeInTheDocument();
  });

  it('says what it would take to name one when there is too little heart-rate time', async () => {
    served = intensity({ pattern: 'insufficient', weekMinutes: [[10, 5, 0, 0, 0], [0, 0, 0, 0, 0]] });
    const { container } = render(<IntensitySection />);
    await screen.findByRole('slider');

    expect(container.querySelector('.analysis-load-v2-chart-meta .analysis-load-v2-zone')).toHaveTextContent('Not enough yet');
    expect(screen.getByText(/needs at least 3 runs with a heart rate and 60 minutes of heart-rate time/)).toBeInTheDocument();
    expect(screen.queryByText(/Polarization index/)).not.toBeInTheDocument();
  });

  it('gives the index, and the share above zone 3 as a guideline and nothing more', async () => {
    render(<IntensitySection />);
    await screen.findByRole('slider');

    expect(screen.getByText(/Polarization index 2\.38: above 2/)).toBeInTheDocument();
    expect(screen.getByText(/20% of the time is above zone 3\. About 20% is a common rule of thumb \(80\/20\); it is a guideline, not a target/)).toBeInTheDocument();
  });

  it('says the index is not defined when there is more time in zone 5 than in zones 1 to 3', async () => {
    served = intensity({ pattern: 'high', index: null, weekMinutes: [[10, 10, 10, 10, 90]] });
    served.summary.polarizationIndex = null;
    render(<IntensitySection />);
    await screen.findByRole('slider');

    expect(screen.getByText(/Polarization index: not defined, because zone 5 holds more time than zones 1 to 3/)).toBeInTheDocument();
  });

  it('writes the time in hours and minutes in the sentence', async () => {
    render(<IntensitySection />);
    await screen.findByRole('slider');

    expect(screen.getByText(/These weeks hold 40 h 0 min of heart-rate time\. Runs with a heart rate: 48 of 48\./)).toBeInTheDocument();
  });
});

describe('what is left out or not yet counted', () => {
  it('says how many runs have no heart rate and add no time', async () => {
    served = intensity({ runsWithHeartRatePerWeek: 3 });
    render(<IntensitySection />);
    await screen.findByRole('slider');

    expect(screen.getByText('12 runs in these weeks have no heart-rate data and add no time.')).toBeInTheDocument();
  });

  it('says one run, not 1 runs', async () => {
    const answer = intensity();
    answer.summary.runs += 1;
    served = answer;
    render(<IntensitySection />);
    await screen.findByRole('slider');

    expect(screen.getByText('1 run in these weeks has no heart-rate data and adds no time.')).toBeInTheDocument();
  });

  it('says some runs are still being analysed, and loads again on request', async () => {
    served = intensity({ overrides: { pendingRuns: 2 } });
    render(<IntensitySection />);
    await screen.findByRole('slider');
    expect(screen.getByText(/2 of your runs are still being analysed or recalculated/)).toBeInTheDocument();

    served = intensity();
    await userEvent.click(screen.getByRole('button', { name: t('training_series.refresh') }));
    await waitFor(() => expect(screen.queryByText(/still being analysed/)).not.toBeInTheDocument());
    expect(reads().length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the numbers on screen and says they may be out of date when a reload fails', async () => {
    served = intensity({ overrides: { pendingRuns: 1 } });
    render(<IntensitySection />);
    await screen.findByRole('slider');

    served = new Error('down');
    await userEvent.click(screen.getByRole('button', { name: t('training_series.refresh') }));
    expect(await screen.findByText(t('training_series.stale'), { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });
});

describe('the rule', () => {
  it('names the time zone the weeks are counted in, and says UTC where the server says Z (BUG-041)', async () => {
    render(<IntensitySection />);
    expect(await screen.findByText(/Weeks run Monday to Sunday in your time zone \(America\/New_York\)\./)).toBeInTheDocument();
    cleanup();

    served = intensity({ overrides: { timeZone: 'Z' } });
    render(<IntensitySection />);
    expect(await screen.findByText(/Weeks run Monday to Sunday in your time zone \(UTC\)\./)).toBeInTheDocument();
    expect(screen.queryByText(/\(Z\)/)).not.toBeInTheDocument();
  });

  it('ends with how it is worked out and a link to the section that holds the rule', async () => {
    render(<IntensitySection />);
    await screen.findByRole('slider');

    expect(screen.getByText(/Each run's time in zones comes from its heart-rate stream and your zone edges/)).toBeInTheDocument();
    expect(screen.getByText(/America\/New_York/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('methods.link') }))
      .toHaveAttribute('href', methodsDocUrl('time-in-zones-and-the-intensity-distribution'));
  });
});

describe('looking at one week', () => {
  it('starts on this week when the chart gets the keyboard, and moves a week at a time', async () => {
    const { container } = render(<IntensitySection />);
    const slider = await screen.findByRole('slider');

    slider.focus();
    await waitFor(() => expect(slider).toHaveAttribute('aria-valuenow', '11'));
    const tooltip = () => container.querySelector('.analysis-fit-v2-tooltip');
    expect(tooltip().querySelector('time')).toHaveTextContent('Week of Oct 5');
    expect(tooltip()).toHaveTextContent('Zone 5 · Maximum30:00');
    expect(tooltip()).toHaveTextContent('Zone 1 · Recovery1:00:00');
    expect(tooltip()).toHaveTextContent('Heart-rate time3:20:00');
    expect(tooltip()).toHaveTextContent('Runs with a heart rate: 4 of 4');
    expect(container.querySelector('.training-intensity-v2__bar.is-selected')).toBeInTheDocument();

    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '10');
    expect(tooltip().querySelector('time')).toHaveTextContent('Week of Sep 28');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '11');
    fireEvent.keyDown(slider, { key: 'Escape' });
    expect(tooltip()).not.toBeInTheDocument();
  });

  it('follows the pointer to the nearest week', async () => {
    const { container } = render(<IntensitySection />);
    const slider = await screen.findByRole('slider');
    boxed(slider, 720);

    fireEvent.pointerMove(slider, { clientX: 50 });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    fireEvent.pointerMove(slider, { clientX: 700 });
    expect(slider).toHaveAttribute('aria-valuenow', '11');
    fireEvent.pointerLeave(slider);
    expect(container.querySelector('.analysis-fit-v2-tooltip')).not.toBeInTheDocument();
  });

  it('says that a week with no heart-rate time has none', async () => {
    served = intensity({ weekMinutes: [[60, 60, 40, 10, 30], [0, 0, 0, 0, 0], [60, 60, 40, 10, 30]] });
    render(<IntensitySection />);
    const slider = await screen.findByRole('slider');

    slider.focus();
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuetext', 'Week of Sep 28: no heart-rate time');
  });
});

describe('in Chinese', () => {
  it('speaks Chinese, with the band names, the word for the spread and the sentence', async () => {
    state.lang = 'zh-CN';
    const { container } = render(<IntensitySection />);
    const slider = await screen.findByRole('slider');

    expect(screen.getByRole('region', { name: '区间用时' })).toBeInTheDocument();
    expect(slider).toHaveAccessibleName(/按周统计在各个心率区间的用时，单位：小时/);
    expect(container.querySelector('.analysis-load-v2-chart-meta .analysis-load-v2-zone')).toHaveTextContent('两极化');
    expect(screen.getByText(/区间 1–3/)).toBeInTheDocument();
    expect(screen.getByText(/两极化分布/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '计算方式' })).toBeInTheDocument();
  });
});
