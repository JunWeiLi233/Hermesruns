import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import WeeklyEffortSection from '../WeeklyEffortSection';
import { noWeeks, weekly } from './trainingSeriesFixtures';

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
const reads = () => apiJson.mock.calls.filter(([url]) => String(url).startsWith('/api/training/weekly-effort'));

function boxed(plot, width = 720) {
  plot.getBoundingClientRect = () => ({ left: 0, top: 0, right: width, bottom: 230, width, height: 230, x: 0, y: 0, toJSON() {} });
}

/** Twelve weeks that end with a week that has `lastTotal` so far, after three weeks of 300. */
const endingWith = (lastTotal) => weekly({ totals: [300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300, lastTotal] });

beforeEach(() => {
  state.lang = 'en';
  served = weekly();
  apiJson.mockReset();
  apiJson.mockImplementation(async (url) => {
    if (String(url).startsWith('/api/training/weekly-effort')) {
      if (served instanceof Error) throw served;
      return served;
    }
    return {};
  });
});
afterEach(() => cleanup());

describe('loading and failing', () => {
  it('is a region named after its title, busy until the weeks are there, and asks for twelve weeks', async () => {
    const { container } = render(<WeeklyEffortSection />);
    const card = screen.getByRole('region', { name: t('training_series.weekly_title') });
    expect(card).toHaveAttribute('aria-busy', 'true');
    expect(within(card).getByRole('status')).toHaveTextContent(t('training_series.weekly_loading'));
    expect(container.querySelector('.page-skeleton__block')).toBeInTheDocument();

    expect(await screen.findByRole('slider')).toBeInTheDocument();
    expect(card).not.toHaveAttribute('aria-busy');
    expect(reads().map(([url]) => url)).toEqual(['/api/training/weekly-effort?weeks=12']);
  });

  it('says so, with a way to try again, when the weeks cannot be loaded', async () => {
    served = new Error('down');
    render(<WeeklyEffortSection />);
    expect(await screen.findByRole('alert')).toHaveTextContent(t('training_series.weekly_error'));

    served = weekly();
    await userEvent.click(screen.getByRole('button', { name: t('training_series.retry') }));
    expect(await screen.findByRole('slider')).toBeInTheDocument();
  });

  it('treats an answer without weeks as a failed load', async () => {
    served = { today: '2026-10-10' };
    render(<WeeklyEffortSection />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('says there are no weeks to show for a runner with no run that has an effort', async () => {
    served = noWeeks();
    render(<WeeklyEffortSection />);
    expect(await screen.findByText(t('training_series.weekly_empty'))).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });
});

describe('the chart', () => {
  it('draws a bar for each week, with the range behind every week that has one, and the newest week marked as still going', async () => {
    const { container } = render(<WeeklyEffortSection />);
    const slider = await screen.findByRole('slider');

    expect(container.querySelectorAll('.analysis-fit-v2-bar')).toHaveLength(12);
    expect(container.querySelectorAll('.analysis-fit-v2-range')).toHaveLength(9);     // the first three weeks have none yet
    const bars = [...container.querySelectorAll('.analysis-fit-v2-bar')];
    expect(bars[11]).toHaveClass('is-current', 'is-open');
    expect(bars[10]).not.toHaveClass('is-open');
    expect(bars[0]).toHaveClass('is-none');
    expect(slider).toHaveAccessibleName(/Effort for each of the last 12 weeks/);
    expect(slider).toHaveAttribute('aria-valuenow', '11');
  });

  it('explains its colours in a key', async () => {
    const { container } = render(<WeeklyEffortSection />);
    await screen.findByRole('slider');
    const key = container.querySelector('.analysis-fit-v2-legend');
    expect(key).toHaveTextContent(`${t('training_series.legend_within')}${t('training_series.legend_above')}${t('training_series.legend_below')}${t('training_series.legend_range')}`);
    expect(key).toHaveAttribute('aria-hidden', 'true');
  });

  it('colours each bar by how the week compared with its range', async () => {
    served = weekly({ totals: [300, 300, 300, 300, 200, 300, 400, 300, 300, 300, 300, 300] });
    const { container } = render(<WeeklyEffortSection />);
    await screen.findByRole('slider');
    const bars = [...container.querySelectorAll('.analysis-fit-v2-bar')];

    expect(bars[3]).toHaveClass('is-within');
    expect(bars[4]).toHaveClass('is-below');
    expect(bars[6]).toHaveClass('is-above');
    expect(bars[11]).toHaveClass('is-within');
  });

  it('has the same figures in a table for a screen reader, newest last', async () => {
    const { container } = render(<WeeklyEffortSection />);
    await screen.findByRole('slider');
    const table = container.querySelector('table[data-analysis-history="weekly"]');
    const rows = within(table).getAllByRole('row').slice(1);

    expect(rows).toHaveLength(12);
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent))
      .toEqual([t('training_series.col_week'), t('training_series.col_effort'), t('training_series.col_runs'), t('training_series.col_range'), t('training_series.col_status')]);
    expect(rows[0]).toHaveTextContent('Jul 20');
    expect(rows[0]).toHaveTextContent('–');
    expect(rows[11]).toHaveTextContent('Oct 5');
    expect(rows[11]).toHaveTextContent('210');
    expect(rows[11]).toHaveTextContent(t('training_series.status_building'));
  });
});

describe('how this week stands', () => {
  it.each([
    [300, 'within', 'This week so far: 300. Your usual range is 240 to 360, so you are inside it.'],
    [400, 'above', 'This week so far: 400. Your usual range is 240 to 360, so you are already above it.'],
    [100, 'building', 'This week so far: 100. Your usual range is 240 to 360; the days left can still take you into it.'],
  ])('says so in a chip and a sentence for %i (%s)', async (lastTotal, status, sentence) => {
    served = endingWith(lastTotal);
    const { container } = render(<WeeklyEffortSection />);
    await screen.findByRole('slider');

    expect(screen.getByText(t(`training_series.status_${status}`), { selector: '.analysis-load-v2-zone' })).toBeInTheDocument();
    expect(screen.getByText(sentence)).toBeInTheDocument();
    expect(container.querySelector('.analysis-load-v2-zone')).toHaveClass(status === 'above' ? 'is-high' : status === 'building' ? 'is-unknown' : 'analysis-load-v2-zone');
  });

  it('says there is no usual range yet for a runner who has not run for three weeks before this one', async () => {
    served = weekly({ totals: [250, 280] });
    render(<WeeklyEffortSection />);
    await screen.findByRole('slider');

    expect(screen.getByText(t('training_series.status_none'), { selector: '.analysis-load-v2-zone' })).toBeInTheDocument();
    expect(screen.getByText('This week so far: 280. There is no usual range yet: it needs three weeks of running before this one.')).toBeInTheDocument();
  });

  it('says what the range is made of, with the band the server used', async () => {
    served = weekly({ overrides: { bandPercent: 25 } });
    render(<WeeklyEffortSection />);
    await screen.findByRole('slider');
    expect(screen.getByText(/plus or minus 25%/)).toBeInTheDocument();
    expect(screen.getByText(/A week still going is never called below/)).toBeInTheDocument();
  });
});

describe('looking at one week', () => {
  it('starts on this week when the chart gets the keyboard, and moves a week at a time', async () => {
    const { container } = render(<WeeklyEffortSection />);
    const slider = await screen.findByRole('slider');

    slider.focus();
    await waitFor(() => expect(slider).toHaveAttribute('aria-valuenow', '11'));
    expect(container.querySelector('.analysis-fit-v2-tooltip time')).toHaveTextContent('Week of Oct 5');
    expect(container.querySelector('.analysis-fit-v2-tooltip')).toHaveTextContent('210');
    expect(container.querySelector('.analysis-fit-v2-tooltip .is-status')).toHaveTextContent(t('training_series.status_building'));

    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '10');
    expect(container.querySelector('.analysis-fit-v2-tooltip time')).toHaveTextContent('Week of Sep 28');
    expect(container.querySelector('.analysis-fit-v2-tooltip')).toHaveTextContent('350');
    expect(container.querySelector('.analysis-fit-v2-tooltip')).toHaveTextContent('4 runs');
    expect(container.querySelector('.analysis-fit-v2-bar.is-selected')).toBeInTheDocument();

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    expect(container.querySelector('.analysis-fit-v2-tooltip')).not.toHaveTextContent(t('training_series.legend_range'));
    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '11');
    fireEvent.keyDown(slider, { key: 'Escape' });
    expect(container.querySelector('.analysis-fit-v2-tooltip')).not.toBeInTheDocument();
  });

  it('follows the pointer to the nearest week', async () => {
    const { container } = render(<WeeklyEffortSection />);
    const slider = await screen.findByRole('slider');
    boxed(slider, 720);

    fireEvent.pointerMove(slider, { clientX: 50 });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    fireEvent.pointerMove(slider, { clientX: 700 });
    expect(slider).toHaveAttribute('aria-valuenow', '11');
    fireEvent.pointerLeave(slider);
    expect(container.querySelector('.analysis-fit-v2-tooltip')).not.toBeInTheDocument();
  });

  it('keeps the week a finger touched after it lifts, and lets go of it when something else is touched', async () => {
    const { container } = render(<WeeklyEffortSection />);
    const slider = await screen.findByRole('slider');
    boxed(slider, 720);

    fireEvent.pointerDown(slider, { clientX: 300, pointerType: 'touch' });
    expect(container.querySelector('.analysis-fit-v2-tooltip')).toBeInTheDocument();
    fireEvent.pointerLeave(slider, { pointerType: 'touch' });
    expect(container.querySelector('.analysis-fit-v2-tooltip')).toBeInTheDocument();
    fireEvent.pointerDown(document.body, { pointerType: 'touch' });
    expect(container.querySelector('.analysis-fit-v2-tooltip')).not.toBeInTheDocument();
  });

  it('says one run, not 1 runs', async () => {
    served = weekly({ overrides: { weeks: weekly().weeks.map((week, i) => (i === 11 ? { ...week, runs: 1 } : week)) } });
    const { container } = render(<WeeklyEffortSection />);
    const slider = await screen.findByRole('slider');
    slider.focus();
    await waitFor(() => expect(container.querySelector('.analysis-fit-v2-tooltip')).toBeInTheDocument());
    expect(container.querySelector('.analysis-fit-v2-tooltip')).toHaveTextContent('1 run');
    expect(container.querySelector('.analysis-fit-v2-tooltip')).not.toHaveTextContent('1 runs');
  });
});

describe('runs not yet counted', () => {
  it('says some runs are still being analysed, and loads again on request', async () => {
    served = weekly({ overrides: { pendingRuns: 2 } });
    render(<WeeklyEffortSection />);
    await screen.findByRole('slider');
    expect(screen.getByText(/2 of your runs are still being analysed or recalculated/)).toBeInTheDocument();

    served = weekly();
    await userEvent.click(screen.getByRole('button', { name: t('training_series.refresh') }));
    await waitFor(() => expect(screen.queryByText(/still being analysed/)).not.toBeInTheDocument());
    expect(reads().length).toBeGreaterThanOrEqual(2);
  });
});

describe('in Chinese', () => {
  it('speaks Chinese, with the status word and the sentence', async () => {
    state.lang = 'zh-CN';
    served = endingWith(300);
    render(<WeeklyEffortSection />);
    const slider = await screen.findByRole('slider');

    expect(screen.getByRole('region', { name: '每周强度' })).toBeInTheDocument();
    expect(slider).toHaveAccessibleName(/最近 12 周每周的强度/);
    expect(screen.getByText('在你的常规范围内', { selector: '.analysis-load-v2-zone' })).toBeInTheDocument();
    expect(screen.getByText('本周至今：300。你的常规范围是 240 到 360，目前在范围之内。')).toBeInTheDocument();
  });
});
