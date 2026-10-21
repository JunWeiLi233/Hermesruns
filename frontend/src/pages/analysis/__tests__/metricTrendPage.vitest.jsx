import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedApiJson } from '../../../api/resourceCache';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { methodsDocUrl } from '../../../utils/methodsDoc';
import MetricTrend from '../MetricTrend';
import { NOW, runs, runsWithoutHeartRate } from './metricTrendFixtures';

const state = vi.hoisted(() => ({ lang: 'en', unit: 'km' }));
const t = (key, params = {}) => {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};

vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    lang: state.lang,
    t,
    formatNumber: (value, options) => new Intl.NumberFormat(state.lang === 'zh-CN' ? 'zh-CN' : 'en-US', options).format(value),
  }),
}));
vi.mock('../../../contexts/UnitContext', () => ({
  useUnit: () => ({ unit: state.unit, isMile: state.unit === 'mile' }),
}));
vi.mock('../../../components/AuthenticatedPageChrome', () => ({
  default: ({ children, title, parentLabel, parentRoute, activeKey, bodyClassName }) => (
    <div data-testid="chrome" className={bodyClassName} data-title={title} data-parent-label={parentLabel} data-parent-route={parentRoute} data-active-key={activeKey}>
      {children}
    </div>
  ),
}));

let served;

function Search() {
  return <span data-testid="search">{useLocation().search}</span>;
}

function renderPage(path = '/analysis') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/analysis" element={<><MetricTrend /><Search /></>} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function ready() {
  await screen.findByRole('heading', { level: 2, name: t('trends.title') });
  await screen.findByRole('group', { name: t('trends.reads_label') });
}

/** The four readings as [name, value, hint] for each. */
function readings() {
  const group = screen.getByRole('group', { name: t('trends.reads_label') });
  return Array.from(group.children).map((tile) => [tile.querySelector('span').textContent, tile.querySelector('strong').textContent, tile.querySelector('small').textContent]);
}

const pressed = (name) => screen.getByRole('button', { name, pressed: true });
const slider = () => screen.getByRole('slider');
const search = () => screen.getByTestId('search').textContent;

beforeEach(() => {
  state.lang = 'en';
  state.unit = 'km';
  served = runs();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  cachedApiJson.mockReset();
  cachedApiJson.mockImplementation(async () => {
    if (served instanceof Error) throw served;
    return served;
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('loading and failing', () => {
  it('is busy with a skeleton until the runs are there, asks for the runs Analysis uses, and sits under Analysis', async () => {
    const { container } = renderPage();
    expect(container.querySelector('.metric-trend-v2')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(t('trends.loading'));
    expect(container.querySelector('.page-skeleton__block')).toBeInTheDocument();

    await ready();
    expect(container.querySelector('.metric-trend-v2')).not.toHaveAttribute('aria-busy');
    expect(cachedApiJson).toHaveBeenCalledTimes(1);
    expect(cachedApiJson.mock.calls[0][0]).toBe('/api/activities/analysis');
    expect(screen.queryByTestId('chrome')).not.toBeInTheDocument();
    expect(container.querySelector('h1')).not.toBeInTheDocument();
  });

  it('says so when the runs cannot be loaded, offers another try, and the try works', async () => {
    served = new Error('network');
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t('trends.error'));
    served = runs();
    await userEvent.click(screen.getByRole('button', { name: t('trends.retry') }));
    await ready();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('takes an answer that is not a list for a failed load', async () => {
    served = { runs: [] };
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(t('trends.error'));
  });
});

describe('the first view: pace of all runs over 6 months, with a straight line', () => {
  it('has the defaults chosen and an address with nothing in it', async () => {
    renderPage();
    await ready();
    expect(pressed('Pace')).toBeInTheDocument();
    expect(pressed('All runs')).toBeInTheDocument();
    expect(pressed('6 months')).toBeInTheDocument();
    expect(pressed('Straight line')).toBeInTheDocument();
    expect(search()).toBe('');
    expect(screen.getByText(t('trends.metric_hint_pace'))).toBeInTheDocument();
  });

  it('reads out the runs, their middle, their usual range and the change on the 6 months before, worked out by hand', async () => {
    renderPage();
    await ready();
    // 36 runs from 19 April to 11 October, paces 352 down to 282 a kilometre: the middle is 317 (5:17), the 10th and 90th percentiles 289 and 345.
    // The 6 months before hold 4 runs, 360 to 354: their middle is 357 (5:57), so 40 seconds a kilometre quicker.
    const [runsTile, middle, spread, compare] = readings();
    expect(runsTile).toEqual(['Runs', '36', 'From Apr 19, 2026 to Oct 11, 2026']);
    expect(middle).toEqual(['Middle', '5:17 /km', 'Half the runs are on each side of it.']);
    expect(spread[0]).toBe('Usual range');
    expect(spread[1]).toBe('4:49 /km to 5:45 /km');
    expect(spread[2]).toMatch(/10th to the 90th percentile/);
    expect(compare[0]).toBe('Against the 6 months before');
    expect(compare[1]).toBe('0:40 /km quicker');
    expect(compare[2]).toBe('Their middle was 5:57 /km over 4 runs, Oct 15, 2025 to Apr 14, 2026.');
  });

  it('says what the line and the stretch before found, in sentences', async () => {
    renderPage();
    await ready();
    // 2 s/km a run, a run every 5 days: 0.4 a day, 12 for a month, and 70 over the 175 days from the first run to the last, along a perfect line.
    expect(screen.getByText('A straight line through the runs goes 0:12 /km quicker each month, 1:10 /km quicker over the period. It accounts for 100% of the differences between the runs: a clear trend.')).toBeInTheDocument();
    expect(screen.getByText('The middle of this period is 5:17 /km, 0:40 /km quicker than the middle of the 6 months before it (5:57 /km).')).toBeInTheDocument();
    expect(screen.queryByText(/are left out/)).not.toBeInTheDocument();
  });

  it('names the picture and the list for a screen reader, gives the formula and links to it', async () => {
    renderPage();
    await ready();
    expect(slider()).toHaveAttribute('aria-label', '36 runs from Apr 19, 2026 to Oct 11, 2026, pace from 4:42 /km to 5:52 /km. Use the arrow keys to move from run to run. The list below has every run.');
    const list = screen.getByRole('list', { name: t('trends.list_label') });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(36);
    expect(items[0]).toHaveTextContent('Apr 19, 2026: 5:52 /km, Morning run 4');
    expect(items[35]).toHaveTextContent('Oct 11, 2026: 4:42 /km, Morning run 39');
    const link = screen.getByRole('link', { name: t('methods.link') });
    expect(link).toHaveAttribute('href', methodsDocUrl('trends'));
    expect(screen.getByText(/Each dot is one run\./)).toBeInTheDocument();
  });
});

describe('choosing', () => {
  it('follows another thing, in the address, with its own unit and its own hint, and counts the runs that have none', async () => {
    renderPage();
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Heart rate' }));
    expect(pressed('Heart rate')).toBeInTheDocument();
    expect(search()).toBe('?metric=heartRate');
    expect(screen.getByText(t('trends.metric_hint_heartRate'))).toBeInTheDocument();
    // 31 of the 36 runs carry a heart rate (c = 10, 17, 24, 31 and 38 do not): the middle is 142 beats and the usual range 140 to 144.
    const [runsTile, middle, spread] = readings();
    expect(runsTile[1]).toBe('31');
    expect(middle[1]).toBe('142 bpm');
    expect(spread[1]).toBe('140 bpm to 144 bpm');
    expect(screen.getByText('Runs with no heart rate are left out: 5.')).toBeInTheDocument();
  });

  it('keeps each of the four choices in the address, drops one that is back to its default, and keeps the others', async () => {
    renderPage();
    await ready();
    const user = userEvent;
    await user.click(screen.getByRole('button', { name: 'Distance' }));
    await user.click(screen.getByRole('button', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: '3 months' }));
    await user.click(screen.getByRole('button', { name: 'Average of 10 runs' }));
    expect(new URLSearchParams(search()).toString()).toBe('metric=distance&runs=workout&range=3m&line=average');
    await user.click(screen.getByRole('button', { name: 'Pace' }));
    await user.click(screen.getByRole('button', { name: '6 months' }));
    expect(new URLSearchParams(search()).toString()).toBe('runs=workout&line=average');
  });

  it('opens on what the address says, and takes a value that is none of the choices for the default', async () => {
    renderPage('/analysis?metric=cadence&runs=ordinary&range=1y&line=average');
    await ready();
    expect(pressed('Cadence')).toBeInTheDocument();
    expect(pressed('Ordinary runs')).toBeInTheDocument();
    expect(pressed('1 year')).toBeInTheDocument();
    expect(pressed('Average of 10 runs')).toBeInTheDocument();
    cleanup();
    renderPage('/analysis?metric=nonsense&runs=&range=forever&line=curvy');
    await ready();
    expect(pressed('Pace')).toBeInTheDocument();
    expect(pressed('All runs')).toBeInTheDocument();
    expect(pressed('6 months')).toBeInTheDocument();
    expect(pressed('Straight line')).toBeInTheDocument();
  });

  it('looks at one set of runs: the workouts are four, too few for a straight line or a comparison', async () => {
    renderPage('/analysis?runs=workout');
    await ready();
    expect(readings()[0][1]).toBe('4');
    // The workout before the period is c = 0 (30 March): the stretch before has the one.
    expect(screen.getByText('A straight line needs at least 5 runs in the period, and the period has 4.')).toBeInTheDocument();
    expect(screen.getByText('Too few runs to compare with the 6 months before: it needs 3 in each, and that stretch has 1.')).toBeInTheDocument();
    expect(screen.getByText(t('trends.set_hint'))).toBeInTheDocument();
    // With under 10 runs the usual range is the lowest to the highest: 288 (c = 36) to 342 (c = 9).
    expect(readings()[2][1]).toBe('4:48 /km to 5:42 /km');
    expect(readings()[2][2]).toMatch(/Lowest to highest/);
  });

  it('counts the ordinary runs as those with none of the three types set', async () => {
    renderPage('/analysis?runs=ordinary');
    await ready();
    expect(readings()[0][1]).toBe('29');
  });

  it('compares 3 months with the 3 months before, and has no stretch before for all time, which shows the latest run instead', async () => {
    renderPage('/analysis?range=3m');
    await ready();
    expect(readings()[0][1]).toBe('18');
    expect(readings()[3][0]).toBe('Against the 3 months before');
    cleanup();
    renderPage('/analysis?range=all');
    await ready();
    expect(readings()[0][1]).toBe('40');
    expect(readings()[3]).toEqual(['Latest run', '4:42 /km', 'Oct 11, 2026']);
    expect(screen.queryByText(/before it/)).not.toBeInTheDocument();
  });

  it('draws the average of the latest ten runs when it is the line asked for', async () => {
    const { container } = renderPage('/analysis?line=average');
    await ready();
    expect(container.querySelector('path.metric-trend-v2__trend.is-average')).toBeInTheDocument();
    expect(container.querySelector('line.metric-trend-v2__trend')).not.toBeInTheDocument();
    expect(screen.getByText(/^The average of the latest 10 runs went from .* to .*: .* quicker\.$/)).toBeInTheDocument();
  });
});

describe('looking at one run', () => {
  it('gives the newest run when the chart takes the focus, and moves with the arrow keys, Home and End', async () => {
    const { container } = renderPage();
    await ready();
    expect(slider()).toHaveAttribute('aria-valuetext', 'Oct 11, 2026: 4:42 /km, Morning run 39');
    expect(container.querySelector('.metric-trend-v2__tooltip')).not.toBeInTheDocument();

    act(() => slider().focus());
    const tooltip = container.querySelector('.metric-trend-v2__tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveAttribute('aria-hidden', 'true');
    expect(tooltip).toHaveTextContent('Oct 11, 2026');
    expect(tooltip).toHaveTextContent('4:42 /km');
    expect(tooltip).toHaveTextContent('Morning run 39');

    fireEvent.keyDown(slider(), { key: 'ArrowLeft' });
    expect(slider()).toHaveAttribute('aria-valuenow', '34');
    expect(slider()).toHaveAttribute('aria-valuetext', 'Oct 6, 2026: 4:44 /km, Morning run 38');
    fireEvent.keyDown(slider(), { key: 'Home' });
    expect(slider()).toHaveAttribute('aria-valuenow', '0');
    expect(slider()).toHaveAttribute('aria-valuetext', 'Apr 19, 2026: 5:52 /km, Morning run 4');
    fireEvent.keyDown(slider(), { key: 'End' });
    expect(slider()).toHaveAttribute('aria-valuenow', '35');
    fireEvent.keyDown(slider(), { key: 'Escape' });
    expect(container.querySelector('.metric-trend-v2__tooltip')).not.toBeInTheDocument();
  });

  it('names the type of a run that has one, in the readout and in the list', async () => {
    const { container } = renderPage();
    await ready();
    // c = 36 is a Workout: the fourth run from the newest (offset 19, 26 September), pace 360 - 72 = 288 a kilometre.
    act(() => slider().focus());
    for (let step = 0; step < 3; step += 1) fireEvent.keyDown(slider(), { key: 'ArrowLeft' });
    expect(slider()).toHaveAttribute('aria-valuetext', 'Sep 26, 2026: 4:48 /km, Morning run 36, Workout');
    expect(container.querySelector('.metric-trend-v2__tooltip')).toHaveTextContent('Workout');
    const items = within(screen.getByRole('list', { name: t('trends.list_label') })).getAllByRole('listitem');
    expect(items[32]).toHaveTextContent('Sep 26, 2026: 4:48 /km, Morning run 36, Workout');
  });

  it('says "a run with no name" for a run with none', async () => {
    served = runs().map((run) => ({ ...run, name: '' }));
    renderPage();
    await ready();
    expect(slider()).toHaveAttribute('aria-valuetext', 'Oct 11, 2026: 4:42 /km, a run with no name');
  });
});

describe('with nothing to show', () => {
  it('says what the choice has none of, offers the runs, and says how many were left out', async () => {
    renderPage('/analysis?metric=heartRate&runs=race');
    expect(await screen.findByRole('heading', { name: t('trends.empty_title') })).toBeInTheDocument();
    // The three races carry no heart rate: the two of the period are left out of the figures and counted.
    expect(screen.getByText(/has a heart rate\. Try a longer period or another set of runs\./)).toBeInTheDocument();
    expect(screen.getByText('Runs with no heart rate are left out: 2.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('trends.empty_action') })).toHaveAttribute('href', '/runs');
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    // The choices are still there to change.
    expect(screen.getByRole('button', { name: 'Pace' })).toBeInTheDocument();
  });

  it('is the same for a runner with no run at all', async () => {
    served = [];
    renderPage();
    expect(await screen.findByRole('heading', { name: t('trends.empty_title') })).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('is the same when no run of the period has a heart rate for the efficiency', async () => {
    served = runsWithoutHeartRate();
    renderPage('/analysis?metric=efficiency');
    expect(await screen.findByRole('heading', { name: t('trends.empty_title') })).toBeInTheDocument();
    expect(screen.getByText('Runs with no heart rate are left out: 36.')).toBeInTheDocument();
  });
});

describe('miles', () => {
  it('writes a pace and a distance in the runner\'s unit', async () => {
    state.unit = 'mile';
    renderPage();
    await ready();
    // 317 s/km is 510 s a mile: 8:30; the newest run, 282 s/km, is 454 s a mile: 7:34.
    expect(readings()[1][1]).toBe('8:30 /mi');
    expect(slider().getAttribute('aria-valuetext')).toBe('Oct 11, 2026: 7:34 /mi, Morning run 39');
    cleanup();
    renderPage('/analysis?metric=distance');
    await ready();
    expect(readings()[1][1]).toBe('5.0 mi');
  });
});

describe('in Chinese', () => {
  it('is translated all through, and no key shows', async () => {
    state.lang = 'zh-CN';
    const { container } = renderPage();
    await screen.findByRole('heading', { level: 2, name: '趋势' });
    await screen.findByRole('group', { name: t('trends.reads_label') });
    expect(container.textContent).not.toMatch(/trends\.|run_labels\./);
    expect(screen.getByRole('button', { name: '配速', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全部跑步', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '6 个月', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '直线', pressed: true })).toBeInTheDocument();
    expect(readings()[1][1]).toBe('5:17 /公里');
    // The direction comes before the amount in Chinese, as it does in the sentences.
    expect(readings()[3][1]).toBe('更快 0:40 /公里');
    expect(screen.getByText('穿过这些跑步的直线每个月更快 0:12 /公里，整个时间段共更快 1:10 /公里。它解释了跑步之间 100% 的差异：趋势明显。')).toBeInTheDocument();
  });

  it('names the type of a run in Chinese, with Chinese punctuation in the sentence', async () => {
    state.lang = 'zh-CN';
    renderPage();
    await screen.findByRole('group', { name: t('trends.reads_label') });
    act(() => slider().focus());
    for (let step = 0; step < 3; step += 1) fireEvent.keyDown(slider(), { key: 'ArrowLeft' });
    const text = slider().getAttribute('aria-valuetext');
    expect(text).toMatch(/，训练课$/);
    expect(text.replace(/\d+:\d+/g, '')).not.toMatch(/[,:]/);
  });
});
