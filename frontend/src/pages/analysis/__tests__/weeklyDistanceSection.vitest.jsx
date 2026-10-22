import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../i18n/locales/en/pages';
import zh from '../../../i18n/locales/zh-CN/pages';
import { addDaysToKey } from '../../../utils/calendarDays';
import { methodsDocUrl } from '../../../utils/methodsDoc';
import WeeklyDistanceSection from '../WeeklyDistanceSection';

const state = vi.hoisted(() => ({ lang: 'en', unit: 'km' }));
const t = (key, params = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], state.lang === 'zh-CN' ? zh : en) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};
vi.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    lang: state.lang,
    t,
    formatNumber: (value, options) => new Intl.NumberFormat(state.lang === 'zh-CN' ? 'zh-CN' : 'en-US', options).format(value),
  }),
}));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: state.unit, isMile: state.unit === 'mile' }) }));

// 2026-10-14 is a Wednesday. Forty weeks of running, the oldest from the week of 2026-01-05: the week i from the oldest has 10 + 5 x (i mod 4) km in one run,
// and the week going (2026-10-12) has 12 km. So the weeks of 10, 15, 20 and 25 km come round and the average of four weeks is always 17.5.
const TODAY = '2026-10-14';
const THIS_MONDAY = '2026-10-12';
const WEEKS = 40;
const kmOf = (index) => 10 + 5 * (index % 4);
const mondayOfWeek = (index) => addDaysToKey(THIS_MONDAY, -7 * (WEEKS - index));
const runs = () => [
  ...Array.from({ length: WEEKS }, (_, index) => ({ id: index + 1, name: `Week ${index + 1}`, startTime: `${addDaysToKey(mondayOfWeek(index), 2)}T07:00:00`, distanceKm: kmOf(index), movingTimeSeconds: kmOf(index) * 330 })),
  { id: 100, name: 'This week', startTime: `${TODAY}T07:00:00`, distanceKm: 12, movingTimeSeconds: 12 * 330 },
];
const zhDate = (key) => shortDate(key, 'zh-CN');
const shortDate = (key, lang = 'en') => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)), 12).toLocaleDateString(lang, { month: 'short', day: 'numeric' });

beforeEach(() => {
  state.lang = 'en';
  state.unit = 'km';
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 14, 12, 0, 0));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const slider = () => screen.getByRole('slider');
const readout = (container) => container.querySelector('.analysis-wd-tooltip');
const bars = (container) => container.querySelectorAll('rect.analysis-fit-v2-bar.is-distance');
const readings = () => within(screen.getByRole('region', { name: t('weekly_distance.reads_label') }));
const chip = (key) => screen.getByRole('button', { name: t(`weekly_distance.range_${key}`) });
/** The slider's box: the picture is 720 units wide in a test, and a pointer at x is at x in it. */
const boxed = (element) => {
  element.getBoundingClientRect = () => ({ left: 0, top: 0, right: 720, bottom: 230, width: 720, height: 230, x: 0, y: 0, toJSON() {} });
};

describe('the card', () => {
  it('grows the phone chart to contain a measured readout taller than its initial height', () => {
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(390);
    const original = HTMLElement.prototype.getBoundingClientRect;
    const measurement = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      return this.matches('.analysis-wd-tooltip')
        ? { x: 0, y: 0, left: 0, top: 0, right: 300, bottom: 240, width: 300, height: 240, toJSON() {} }
        : original.call(this);
    });
    try {
      const { container } = render(<WeeklyDistanceSection runs={runs()} />);
      act(() => slider().focus());
      fireEvent.keyDown(slider(), { key: 'Home' });
      expect(readout(container)).toHaveTextContent('4-week average');
      const height = Number(container.querySelector('svg.analysis-fit-v2-svg').getAttribute('height'));
      expect(height).toBeGreaterThanOrEqual(248);
      expect(parseFloat(readout(container).style.top) + 240).toBeLessThanOrEqual(height - 4);
    } finally {
      width.mockRestore();
      measurement.mockRestore();
    }
  });

  it('has the weeks of the range as bars, the week still going lighter, and a line through the averages', () => {
    const { container } = render(<WeeklyDistanceSection runs={runs()} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Weekly distance' })).toBeInTheDocument();
    expect(chip('26w')).toHaveAttribute('aria-pressed', 'true');
    expect(bars(container)).toHaveLength(26);
    expect(container.querySelectorAll('rect.is-open')).toHaveLength(1);
    expect(container.querySelector('path.analysis-wd-average')).toBeInTheDocument();
    // The line has a point for each of the weeks that are over and have an average: all the 25 but none of the week going.
    expect(container.querySelectorAll('circle.analysis-wd-average-dot')).toHaveLength(25);
  });

  it('says this week so far, the average of the last four weeks and the highest week, with their dates', () => {
    render(<WeeklyDistanceSection runs={runs()} />);

    const last = WEEKS - 1;
    const lastMonday = mondayOfWeek(last);
    expect(readings().getByText('This week so far').closest('article')).toHaveTextContent('12.0 km');
    expect(readings().getByText('This week so far').closest('article')).toHaveTextContent('1 run');
    expect(readings().getByText('Last 4 weeks').closest('article')).toHaveTextContent('17.5 km');
    expect(readings().getByText('Last 4 weeks').closest('article')).toHaveTextContent(`a week on average, to the week of ${shortDate(lastMonday)}`);
    expect(readings().getByText('Highest week').closest('article')).toHaveTextContent('25.0 km');
    // The latest of the weeks that have 25 km: the week index 39 is 10 + 5 x 3 = 25.
    expect(readings().getByText('Highest week').closest('article')).toHaveTextContent(`Week of ${shortDate(lastMonday)}`);
  });

  it('is a slider that starts on the week going, and moves a week at a time with the arrows, Home, End and Escape', () => {
    const { container } = render(<WeeklyDistanceSection runs={runs()} />);

    expect(slider()).toHaveAttribute('aria-valuemin', '0');
    expect(slider()).toHaveAttribute('aria-valuemax', '25');
    expect(slider()).toHaveAttribute('aria-valuenow', '25');
    expect(slider()).toHaveAttribute('aria-valuetext', `Week of ${shortDate(THIS_MONDAY)}, still going: 12.0 km, 1 run`);
    expect(readout(container)).not.toBeInTheDocument();

    act(() => slider().focus());
    expect(readout(container).querySelector('time')).toHaveTextContent(`Week of ${shortDate(THIS_MONDAY)}`);
    expect(readout(container)).toHaveTextContent('12.0 km');
    expect(readout(container)).toHaveTextContent('still going');
    expect(readout(container)).not.toHaveTextContent('4-week average');

    fireEvent.keyDown(slider(), { key: 'ArrowLeft' });
    const lastMonday = mondayOfWeek(WEEKS - 1);
    expect(slider()).toHaveAttribute('aria-valuenow', '24');
    expect(slider()).toHaveAttribute('aria-valuetext', `Week of ${shortDate(lastMonday)}: 25.0 km, 1 run, 4-week average 17.5 km`);
    expect(readout(container)).toHaveTextContent('4-week average');
    expect(readout(container)).toHaveTextContent('17.5 km');
    expect(readout(container)).not.toHaveTextContent('still going');
    expect(container.querySelectorAll('rect.is-selected')).toHaveLength(1);

    fireEvent.keyDown(slider(), { key: 'Home' });
    expect(slider()).toHaveAttribute('aria-valuenow', '0');
    fireEvent.keyDown(slider(), { key: 'ArrowLeft' });
    expect(slider()).toHaveAttribute('aria-valuenow', '0');
    fireEvent.keyDown(slider(), { key: 'End' });
    expect(slider()).toHaveAttribute('aria-valuenow', '25');

    fireEvent.keyDown(slider(), { key: 'Escape' });
    expect(readout(container)).not.toBeInTheDocument();
  });

  it('follows the pointer to the nearest week, and a finger keeps the week it touched until something else is touched', () => {
    const { container } = render(<WeeklyDistanceSection runs={runs()} />);
    boxed(slider());

    fireEvent.pointerMove(slider(), { clientX: 40 });
    expect(slider()).toHaveAttribute('aria-valuenow', '0');
    fireEvent.pointerMove(slider(), { clientX: 700 });
    expect(slider()).toHaveAttribute('aria-valuenow', '25');
    fireEvent.pointerLeave(slider());
    expect(readout(container)).not.toBeInTheDocument();

    fireEvent.pointerDown(slider(), { clientX: 300, pointerType: 'touch' });
    const touched = slider().getAttribute('aria-valuenow');
    fireEvent.pointerLeave(slider(), { pointerType: 'touch' });
    expect(readout(container)).toBeInTheDocument();
    expect(slider()).toHaveAttribute('aria-valuenow', touched);
    fireEvent.pointerDown(document.body, { pointerType: 'touch' });
    expect(readout(container)).not.toBeInTheDocument();
  });

  it('looks over 12 weeks, 26 or 52 (as far back as there are weeks), and forgets the week it was on', async () => {
    const { container } = render(<WeeklyDistanceSection runs={runs()} />);

    await userEvent.click(chip('12w'));
    expect(chip('12w')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('26w')).toHaveAttribute('aria-pressed', 'false');
    expect(bars(container)).toHaveLength(12);
    expect(slider()).toHaveAttribute('aria-valuemax', '11');
    expect(slider().getAttribute('aria-label')).toContain('last 12 weeks');

    // Forty weeks and the one going are all there is: a year has no more than that.
    await userEvent.click(chip('52w'));
    expect(bars(container)).toHaveLength(WEEKS + 1);

    act(() => slider().focus());
    expect(readout(container)).toBeInTheDocument();
    await userEvent.click(chip('26w'));
    expect(readout(container)).not.toBeInTheDocument();
  });

  it('has every week as a row of a table for a screen reader, with a dash where there is no average', () => {
    render(<WeeklyDistanceSection runs={runs()} />);

    const table = document.querySelector('table[data-analysis-history="distance"]');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(26);
    expect(within(rows[0]).getByRole('rowheader')).toHaveTextContent(`Week of ${shortDate(mondayOfWeek(WEEKS - 25))}`);
    expect(within(rows[24]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['25.0 km', '1', '17.5 km']);
    expect(within(rows[25]).getByRole('rowheader')).toHaveTextContent('still going');
    expect(within(rows[25]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['12.0 km', '1', '–']);
  });

  it('counts in miles when the runner does: the readings, the words of the slider and the scale', () => {
    state.unit = 'mile';
    render(<WeeklyDistanceSection runs={runs()} />);

    expect(readings().getByText('This week so far').closest('article')).toHaveTextContent('7.5 mi');
    expect(readings().getByText('Last 4 weeks').closest('article')).toHaveTextContent('10.9 mi');
    expect(slider()).toHaveAttribute('aria-valuetext', expect.stringContaining('7.5 mi'));
    const labels = [...document.querySelectorAll('svg text')].map((node) => node.textContent).filter((text) => /^\d+$/.test(text));
    expect(labels.slice(0, 5).map(Number)).toEqual([0, 5, 10, 15, 20]);
  });

  it('says the one week there is in the label of the chart, not "the last 1 weeks" (BUG-051)', () => {
    render(<WeeklyDistanceSection runs={[{ id: 1, startTime: `${TODAY}T07:00:00`, distanceKm: 5 }]} />);

    expect(slider().getAttribute('aria-label')).toBe(t('weekly_distance.chart_label_one'));
    expect(slider().getAttribute('aria-label')).not.toContain('1 weeks');
    expect(slider()).toHaveAttribute('aria-valuemax', '0');
  });

  it('links to the rule that says how it is worked out, and says it judges nothing', () => {
    render(<WeeklyDistanceSection runs={runs()} />);

    expect(screen.getAllByRole('link', { name: t('methods.link') }).map((link) => link.getAttribute('href'))).toContain(methodsDocUrl('weekly-distance-and-its-moving-average'));
    expect(screen.getByText(/it does not say what you should run/)).toBeInTheDocument();
  });

  it('says there is nothing yet for a runner with no run that has a distance, and has no chips', () => {
    render(<WeeklyDistanceSection runs={[{ id: 1, startTime: '2026-10-01T07:00:00', distanceKm: 0 }]} />);

    expect(screen.getByText(t('weekly_distance.empty'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('weekly_distance.range_12w') })).not.toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('says that four weeks are needed when there are fewer, and has no highest week while every finished week was a rest', () => {
    render(<WeeklyDistanceSection runs={[{ id: 1, startTime: `${addDaysToKey(THIS_MONDAY, -14)}T07:00:00`, distanceKm: 9 }]} />);

    expect(readings().getByText('Last 4 weeks').closest('article')).toHaveTextContent('Needs four weeks of running');
    expect(readings().getByText('Highest week').closest('article')).toHaveTextContent('9.0 km');
    expect(readings().getByText('This week so far').closest('article')).toHaveTextContent('No run');
  });

  it('reads in Chinese, with the same numbers', () => {
    state.lang = 'zh-CN';
    render(<WeeklyDistanceSection runs={runs()} />);

    expect(screen.getByRole('heading', { level: 2, name: '每周距离' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '近 12 周' })).toBeInTheDocument();
    expect(readings().getByText('本周至今').closest('article')).toHaveTextContent('12.0 公里');
    expect(readings().getByText('最近 4 周').closest('article')).toHaveTextContent('17.5 公里');
    expect(slider().getAttribute('aria-label')).toContain('用方向键');
    expect(slider().getAttribute('aria-valuetext')).toContain('进行中');
    // The sentence of a week is Chinese all through, with its own punctuation (BUG-052).
    expect(slider().getAttribute('aria-valuetext')).toBe(`${zhDate(THIS_MONDAY)} 起的一周，进行中：12.0 公里，1 次跑步`);
    act(() => slider().focus());
    fireEvent.keyDown(slider(), { key: 'ArrowLeft' });
    expect(slider().getAttribute('aria-valuetext')).toBe(`${zhDate(mondayOfWeek(WEEKS - 1))} 起的一周：25.0 公里，1 次跑步，4 周平均 17.5 公里`);
    expect(slider().getAttribute('aria-valuetext')).not.toMatch(/[,:] /);
  });
});
