import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { methodsDocUrl } from '../../../utils/methodsDoc';
import FitnessFormSection from '../FitnessFormSection';
import { noRuns, noRunsInWindow, series, tooYoung } from './trainingSeriesFixtures';

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
    formatList: (values) => new Intl.ListFormat(state.lang === 'zh-CN' ? 'zh-CN' : 'en-US', { style: 'long', type: 'conjunction' }).format(values),
  }),
}));

let served;
const reads = () => apiJson.mock.calls.filter(([url]) => String(url).startsWith('/api/training/series'));

function renderCard() {
  return render(<FitnessFormSection />);
}

/** Makes the plot report a box, so a pointer position means something (jsdom has no layout). */
function boxed(plot, width = 720) {
  plot.getBoundingClientRect = () => ({ left: 0, top: 0, right: width, bottom: 300, width, height: 300, x: 0, y: 0, toJSON() {} });
}

beforeEach(() => {
  state.lang = 'en';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 10, 12, 0, 0));
  served = series();
  apiJson.mockReset();
  apiJson.mockImplementation(async (url) => {
    if (String(url).startsWith('/api/training/series')) {
      if (served instanceof Error) throw served;
      return served;
    }
    return {};
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('loading and failing', () => {
  it('is a region named after its title, and says it is busy until the numbers are there', async () => {
    const { container } = renderCard();
    const card = screen.getByRole('region', { name: t('training_series.fitness_title') });
    expect(card).toHaveAttribute('aria-busy', 'true');
    expect(within(card).getByRole('status')).toHaveTextContent(t('training_series.loading'));
    expect(container.querySelector('.page-skeleton__block')).toBeInTheDocument();

    expect(await screen.findByRole('slider')).toBeInTheDocument();
    expect(card).not.toHaveAttribute('aria-busy');
    expect(container.querySelector('.page-skeleton__block')).not.toBeInTheDocument();
  });

  it('asks for six months ending today, and for a longer or shorter window when the range is changed', async () => {
    renderCard();
    await screen.findByRole('slider');
    expect(reads().map(([url]) => url)).toEqual(['/api/training/series?from=2026-04-12']);   // 182 days: 12 Apr to 10 Oct

    await userEvent.click(screen.getByRole('button', { name: t('training_series.range_6w') }));
    await waitFor(() => expect(reads().map(([url]) => url)).toContain('/api/training/series?from=2026-08-30'));
    expect(screen.getByRole('button', { name: t('training_series.range_6w') })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: t('training_series.range_6m') })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(screen.getByRole('button', { name: t('training_series.range_1y') }));
    await waitFor(() => expect(reads().map(([url]) => url)).toContain('/api/training/series?from=2025-10-11'));
  });

  it('says so, with a way to try again, when the numbers cannot be loaded', async () => {
    served = new Error('down');
    renderCard();
    expect(await screen.findByRole('alert')).toHaveTextContent(t('training_series.error'));
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();

    served = series();
    await userEvent.click(screen.getByRole('button', { name: t('training_series.retry') }));
    expect(await screen.findByRole('slider')).toBeInTheDocument();
  });

  it('shows the error, not the numbers of another window, when a different range cannot be loaded', async () => {
    renderCard();
    await screen.findByRole('slider');
    served = new Error('down');
    await userEvent.click(screen.getByRole('button', { name: t('training_series.range_3m') }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t('training_series.error'));
  });

  it('treats an answer without the parts it draws as a failed load, not a half-drawn chart', async () => {
    served = { status: 'ready' };
    renderCard();
    expect(await screen.findByRole('alert')).toHaveTextContent(t('training_series.error'));
  });
});

describe('what it says when there is little to show', () => {
  it('says that no run has an effort yet, and draws nothing', async () => {
    served = noRuns();
    renderCard();
    expect(await screen.findByText(t('training_series.empty_none'))).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByText(/Worked out from \d+ runs?:/)).not.toBeInTheDocument();
  });

  it('says how long the history is and how long it must be before fitness and form mean anything', async () => {
    served = tooYoung();
    renderCard();
    expect(await screen.findByText(t('training_series.building', { min: 14, days: 9 }))).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.getByText(/Worked out from 4 runs: 4 from heart-rate zones/)).toBeInTheDocument();
  });

  it('says there are no runs in a window with none, and suggests a longer one', async () => {
    served = noRunsInWindow();
    renderCard();
    expect(await screen.findByText(t('training_series.empty_window'))).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });
});

describe('the chart and the numbers', () => {
  it('draws fitness, fatigue and form for today, with the day under the key and the three cards under the chart', async () => {
    renderCard();
    const slider = await screen.findByRole('slider');
    const today = served.current;

    expect(slider).toHaveAccessibleName(/Fitness, fatigue and form for 40 days, from Sep 1 to Oct 10/);
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '53');                  // 40 days and 14 of rest
    expect(slider).toHaveAttribute('aria-valuenow', '39');
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('Oct 10'));

    const key = screen.getByRole('group', { name: t('training_series.lines_group') });
    expect(within(key).getByRole('button', { name: /Fitness/ })).toHaveTextContent(today.fitness.toFixed(1));
    expect(within(key).getByRole('button', { name: /Fatigue/ })).toHaveTextContent(today.fatigue.toFixed(1));
    expect(within(key).getByRole('button', { name: /Form/ })).toHaveTextContent(today.form > 0 ? `+${today.form.toFixed(1)}` : today.form.toFixed(1).replace('-', '−'));
    expect(screen.getByText(t('training_series.today'), { selector: 'span' })).toBeInTheDocument();

    const cards = screen.getByRole('region', { name: t('training_series.fitness_title') }).querySelectorAll('.analysis-fit-v2-metrics article');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent(today.fitness.toFixed(1));
    const percent = Math.round((today.fitnessChange7d / (today.fitness - today.fitnessChange7d)) * 100);
    expect(cards[0]).toHaveTextContent(`${today.fitnessChange7d > 0 ? '+' : '−'}${Math.abs(today.fitnessChange7d).toFixed(1)} (${percent > 0 ? '+' : percent < 0 ? '−' : ''}${Math.abs(percent)}%) in the last 7 days`);
    // Fatigue says how many points it moved, not a share: it swings too much for a share to mean much.
    expect(cards[1]).toHaveTextContent(/in the last 7 days/);
    expect(cards[1]).not.toHaveTextContent('%');
    expect(cards[1]).toHaveTextContent(today.fatigue.toFixed(1));
    // The card's own basis line ends with the link to the rule.
    expect(screen.getByRole('link', { name: t('methods.link') })).toHaveAttribute('href', methodsDocUrl('fitness-fatigue-and-form'));
  });

  it('says in a word how fresh the runner is: fresh after rest, tired after a hard block', async () => {
    renderCard();
    await screen.findByRole('slider');
    expect(screen.getByText(t('training_series.form_fresh'))).toBeInTheDocument();
    cleanup();

    served = series({ loadOf: (i) => (i > 28 ? 220 : 60) });
    const { container } = renderCard();
    await screen.findByRole('slider');
    expect(screen.getByText(t('training_series.form_tired'))).toBeInTheDocument();
    expect(container.querySelectorAll('.analysis-fit-v2-metrics article.is-watch')).toHaveLength(1);
  });

  it('draws the lines, the form area on both sides of zero, and the dotted days of rest after today', async () => {
    const { container } = renderCard();
    await screen.findByRole('slider');

    expect(container.querySelector('.analysis-fit-v2-line.is-fitness:not(.is-projected)')).toBeInTheDocument();
    expect(container.querySelector('.analysis-fit-v2-line.is-fatigue:not(.is-projected)')).toBeInTheDocument();
    expect(container.querySelector('.analysis-fit-v2-line.is-fitness.is-projected')).toBeInTheDocument();
    expect(container.querySelector('.analysis-fit-v2-form-area.is-fresh')).toBeInTheDocument();
    expect(container.querySelector('.analysis-fit-v2-form-area.is-tired')).toBeInTheDocument();
    expect(container.querySelector('.analysis-fit-v2-zero')).toBeInTheDocument();
    expect(screen.getByText(t('training_series.projection_note', { days: 14 }))).toBeInTheDocument();
    // The picture is for the eyes: the same figures are in a list for a screen reader.
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('[data-analysis-history="fitness"] li')).toHaveLength(54);
  });

  it('says how many days of rest it would take for form to reach zero when the runner is tired', async () => {
    served = series({ loadOf: (i) => (i > 28 ? 220 : 60) });
    renderCard();
    await screen.findByRole('slider');
    const { fitness, fatigue } = served.current;
    const days = Math.ceil(8.4 * Math.log(fatigue / fitness));
    const date = served.projection[days - 1].date;

    expect(days).toBeGreaterThan(1);
    expect(screen.getByText(`If you did not run, your form would reach zero in ${days} days, around Oct ${Number(date.slice(-2))}.`)).toBeInTheDocument();
  });

  it('says nothing about rest while form is above zero', async () => {
    renderCard();
    await screen.findByRole('slider');

    expect(screen.queryByText(/your form would reach zero/)).not.toBeInTheDocument();
    expect(screen.queryByText(/still be below zero/)).not.toBeInTheDocument();
  });

  it('says it takes more rest than the dotted stretch shows when a day of hard effort has left form far below zero', async () => {
    served = series({ loadOf: (i) => (i === 39 ? 400 : 0) });
    renderCard();
    await screen.findByRole('slider');

    expect(screen.getByText(t('training_series.rest_zero_later', { days: 14 }))).toBeInTheDocument();
    expect(screen.queryByText(/would reach zero/)).not.toBeInTheDocument();
  });

  it('reads in Chinese too', async () => {
    state.lang = 'zh-CN';
    served = series({ loadOf: (i) => (i > 28 ? 220 : 60) });
    renderCard();
    await screen.findByRole('slider');

    expect(screen.getByText(/如果不跑步，状态大约在 \d+ 天后回到零（10月\d+日）。/)).toBeInTheDocument();
  });

  it('leaves out the dotted stretch when the window does not end today', async () => {
    served = series({ overrides: { projection: [] } });
    const { container } = renderCard();
    await screen.findByRole('slider');
    expect(container.querySelector('.analysis-fit-v2-line.is-projected')).not.toBeInTheDocument();
    expect(screen.queryByText(/Dotted/)).not.toBeInTheDocument();
    expect(screen.queryByText(/would reach zero/)).not.toBeInTheDocument();
  });

  it('switches a line off and back on, and never lets the last one go', async () => {
    const { container } = renderCard();
    await screen.findByRole('slider');
    const fitness = screen.getByRole('button', { name: /Fitness/ });
    const fatigue = screen.getByRole('button', { name: /Fatigue/ });
    const form = screen.getByRole('button', { name: /Form/ });
    expect(fitness).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(fatigue);
    expect(fatigue).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelector('.analysis-fit-v2-line.is-fatigue')).not.toBeInTheDocument();

    await userEvent.click(form);
    expect(container.querySelector('.analysis-fit-v2-form-area')).not.toBeInTheDocument();

    await userEvent.click(fitness);      // the only line left
    expect(fitness).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.analysis-fit-v2-line.is-fitness')).toBeInTheDocument();

    await userEvent.click(fatigue);
    expect(container.querySelector('.analysis-fit-v2-line.is-fatigue')).toBeInTheDocument();
  });
});

describe('races on the chart', () => {
  it('flags the days the runner raced, says what the flag means and names the day when it is looked at', async () => {
    served = series({ overrides: { raceDays: ['2026-09-20', '2026-10-05'] } });
    const { container } = renderCard();
    const slider = await screen.findByRole('slider');

    expect(container.querySelectorAll('.analysis-fit-v2-race')).toHaveLength(2);
    expect(container.querySelectorAll('.analysis-fit-v2-race-flag')).toHaveLength(2);
    expect(screen.getByText(t('training_series.race_key'))).toBeInTheDocument();
    expect(screen.queryByText(t('training_series.race_hint'))).not.toBeInTheDocument();
    // The picture is for the eyes: the list for a screen reader says it in words, on those days only.
    const listed = [...container.querySelectorAll('[data-analysis-history="fitness"] li')].filter((item) => item.textContent.includes(t('training_series.race_day')));
    expect(listed.map((item) => item.querySelector('span').textContent)).toEqual(['Sep 20', 'Oct 5']);

    slider.focus();
    await waitFor(() => expect(slider).toHaveAttribute('aria-valuenow', '39'));
    expect(slider.getAttribute('aria-valuetext')).not.toContain(t('training_series.race_day'));
    expect(container.querySelector('.analysis-fit-v2-tooltip .is-race')).not.toBeInTheDocument();

    for (let step = 0; step < 5; step += 1) fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(container.querySelector('.analysis-fit-v2-tooltip time')).toHaveTextContent('Oct 5');
    expect(slider.getAttribute('aria-valuetext')).toContain(t('training_series.race_day'));
    expect(container.querySelector('.analysis-fit-v2-tooltip .is-race')).toHaveTextContent(t('training_series.race_day'));
  });

  it('tells a runner with no races how to get one on the chart, and draws no flag', async () => {
    const { container } = renderCard();
    await screen.findByRole('slider');

    expect(container.querySelector('.analysis-fit-v2-race')).not.toBeInTheDocument();
    expect(screen.getByText(t('training_series.race_hint'))).toBeInTheDocument();
    expect(screen.queryByText(t('training_series.race_key'))).not.toBeInTheDocument();
  });

  it('copes with an answer from a server that does not send race days yet', async () => {
    const { raceDays, ...older } = series();
    expect(raceDays).toEqual([]);
    served = older;
    const { container } = renderCard();
    await screen.findByRole('slider');

    expect(container.querySelector('.analysis-fit-v2-race')).not.toBeInTheDocument();
    expect(screen.getByText(t('training_series.race_hint'))).toBeInTheDocument();
  });

  it('is worded in Chinese too', () => {
    for (const key of ['race_day', 'race_key', 'race_hint']) {
      expect(zh.training_series[key]).toBeTruthy();
      expect(zh.training_series[key]).not.toBe(en.training_series[key]);
    }
  });
});

describe('looking at one day', () => {
  it('starts on today when the chart gets the keyboard, and moves a day at a time with the arrow keys', async () => {
    const { container } = renderCard();
    const slider = await screen.findByRole('slider');

    slider.focus();
    await waitFor(() => expect(slider).toHaveAttribute('aria-valuenow', '39'));
    expect(container.querySelector('.analysis-fit-v2-tooltip')).toBeInTheDocument();
    expect(container.querySelector('.analysis-fit-v2-tooltip time')).toHaveTextContent('Oct 10');

    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '38');
    expect(container.querySelector('.analysis-fit-v2-tooltip time')).toHaveTextContent('Oct 9');
    expect(container.querySelector('.analysis-fit-v2-tooltip .is-effort strong')).toHaveTextContent(String(Math.round(served.points[38].load)));

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');

    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '39');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '40');
    expect(container.querySelector('.analysis-fit-v2-tooltip time')).toHaveTextContent(`Oct 11 · ${t('training_series.if_rest')}`);
    expect(container.querySelector('.analysis-fit-v2-tooltip .is-effort')).not.toBeInTheDocument();

    fireEvent.keyDown(slider, { key: 'Escape' });
    expect(container.querySelector('.analysis-fit-v2-tooltip')).not.toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-valuenow', '39');
  });

  it('follows the pointer to the nearest day and shows that day in the key as well', async () => {
    const { container } = renderCard();
    const slider = await screen.findByRole('slider');
    boxed(slider, 720);

    fireEvent.pointerMove(slider, { clientX: 40 });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    const first = served.points[0];
    expect(screen.getByRole('button', { name: /Fitness/ })).toHaveTextContent(first.fitness.toFixed(1));
    expect(screen.getByText('Sep 1', { selector: '.analysis-load-v2-chart-meta > span' })).toBeInTheDocument();

    fireEvent.pointerMove(slider, { clientX: 706 });
    expect(slider).toHaveAttribute('aria-valuenow', '53');
    expect(container.querySelector('.analysis-fit-v2-tooltip time')).toHaveTextContent(`Oct 24 · ${t('training_series.if_rest')}`);

    fireEvent.pointerLeave(slider);
    expect(container.querySelector('.analysis-fit-v2-tooltip')).not.toBeInTheDocument();
    expect(screen.getByText(t('training_series.today'), { selector: '.analysis-load-v2-chart-meta > span' })).toBeInTheDocument();
  });

  it('keeps the day a finger touched after the finger lifts, and lets go of it when something else is touched', async () => {
    const { container } = renderCard();
    const slider = await screen.findByRole('slider');
    boxed(slider, 720);

    fireEvent.pointerDown(slider, { clientX: 300, pointerType: 'touch' });
    expect(container.querySelector('.analysis-fit-v2-tooltip')).toBeInTheDocument();
    const touched = slider.getAttribute('aria-valuenow');

    fireEvent.pointerLeave(slider, { pointerType: 'touch' });
    expect(container.querySelector('.analysis-fit-v2-tooltip')).toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-valuenow', touched);

    fireEvent.pointerDown(document.body, { pointerType: 'touch' });
    expect(container.querySelector('.analysis-fit-v2-tooltip')).not.toBeInTheDocument();
  });

  it('does not let go of a day the pointer is on because something inside the chart was pressed', async () => {
    const { container } = renderCard();
    const slider = await screen.findByRole('slider');
    boxed(slider, 720);

    fireEvent.pointerMove(slider, { clientX: 300, pointerType: 'mouse' });
    fireEvent.pointerDown(container.querySelector('.analysis-fit-v2-svg'), { clientX: 320, pointerType: 'mouse' });
    expect(container.querySelector('.analysis-fit-v2-tooltip')).toBeInTheDocument();
  });

  it('forgets the day when the range changes', async () => {
    const { container } = renderCard();
    const slider = await screen.findByRole('slider');
    slider.focus();
    await waitFor(() => expect(container.querySelector('.analysis-fit-v2-tooltip')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: t('training_series.range_3m') }));
    await waitFor(() => expect(container.querySelector('.analysis-fit-v2-tooltip')).not.toBeInTheDocument());
  });
});

describe('what it tells the runner about the numbers', () => {
  it('says how many runs the numbers come from, by where each effort came from, most common first', async () => {
    renderCard();
    await screen.findByRole('slider');
    expect(screen.getByText('Worked out from 28 runs: 24 from heart-rate zones, 3 from your rating, and 1 from pace.')).toBeInTheDocument();
  });

  it('says it in the singular for one run, and names a source it does not know as another source', async () => {
    served = series({ overrides: { sources: { SOMETHING_NEW: 1 }, runs: 1 } });
    renderCard();
    await screen.findByRole('slider');
    expect(screen.getByText('Worked out from 1 run: 1 from another source.')).toBeInTheDocument();
  });

  it('says some runs are still being analysed, and reloads on request', async () => {
    served = series({ overrides: { pendingRuns: 3 } });
    renderCard();
    await screen.findByRole('slider');
    expect(screen.getByText(/3 of your runs are still being analysed or recalculated/)).toBeInTheDocument();

    served = series({ overrides: { pendingRuns: 0 } });
    await userEvent.click(screen.getByRole('button', { name: t('training_series.refresh') }));
    await waitFor(() => expect(screen.queryByText(/still being analysed/)).not.toBeInTheDocument());
    expect(reads().length).toBeGreaterThanOrEqual(2);
  });

  it('says which scale it is on, and that it is not the load of the chart above it', async () => {
    renderCard();
    await screen.findByRole('slider');
    expect(screen.getByText(/exponentially weighted averages of the Effort scores of each day \(42 and 7 days\)/)).toBeInTheDocument();
    expect(screen.getByText(/not the load on the chart above/)).toBeInTheDocument();
  });
});

describe('the daily effort bars', () => {
  const effortLabel = () => t('training_series.tooltip_effort');
  const keyOf = () => screen.getByRole('group', { name: t('training_series.lines_group') });
  const heightOf = (container) => Number(container.querySelector('.analysis-fit-v2-svg').getAttribute('height'));
  const stepBack = (slider, steps) => { for (let step = 0; step < steps; step += 1) fireEvent.keyDown(slider, { key: 'ArrowLeft' }); };

  it('draws a bar for each day with effort in a strip of its own, with a caption, a scale and a switch', async () => {
    const { container } = renderCard();
    await screen.findByRole('slider');
    const loads = served.points.map((point) => point.load);

    const bars = container.querySelector('.analysis-fit-v2-effort-bars');
    expect(bars.getAttribute('d').split('M').length - 1).toBe(loads.filter((load) => load > 0).length);
    expect(container.querySelector('.analysis-fit-v2-effort-caption')).toHaveTextContent(t('training_series.line_effort'));
    // A scale of its own: 140 is the most in a day, so the strip runs from 0 to 150.
    const scale = [...container.querySelectorAll('.analysis-fit-v2-effort text')].map((node) => node.textContent);
    expect(scale).toEqual([t('training_series.line_effort'), '0', '150']);
    const effort = within(keyOf()).getByRole('button', { name: /Daily effort/ });
    expect(effort).toHaveAttribute('aria-pressed', 'true');
    expect(effort).toHaveTextContent(String(Math.round(loads.at(-1))));
  });

  it('can be switched off, which takes the strip away and leaves the lines, and switched back on', async () => {
    const { container } = renderCard();
    await screen.findByRole('slider');
    const effort = screen.getByRole('button', { name: /Daily effort/ });
    const tall = heightOf(container);

    await userEvent.click(effort);
    expect(effort).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelector('.analysis-fit-v2-effort')).not.toBeInTheDocument();
    expect(heightOf(container)).toBeLessThan(tall);
    expect(container.querySelector('.analysis-fit-v2-line.is-fitness')).toBeInTheDocument();
    expect(container.querySelector('.analysis-fit-v2-form-area')).toBeInTheDocument();

    await userEvent.click(effort);
    expect(effort).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.analysis-fit-v2-effort-bars')).toBeInTheDocument();
    expect(heightOf(container)).toBe(tall);
  });

  it('is not a line: the last line still cannot be switched off, and the bars do not count as one', async () => {
    const { container } = renderCard();
    await screen.findByRole('slider');
    const [fitness, fatigue, form] = ['Fitness', 'Fatigue', 'Form'].map((name) => screen.getByRole('button', { name: new RegExp(name) }));

    await userEvent.click(fatigue);
    await userEvent.click(form);
    await userEvent.click(fitness);              // the last line, with the bars still showing
    expect(fitness).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.analysis-fit-v2-effort-bars')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Daily effort/ }));
    await userEvent.click(fitness);              // still the last line, now with nothing else on
    expect(fitness).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.analysis-fit-v2-line.is-fitness')).toBeInTheDocument();
  });

  it('shows the effort of the day being looked at, marks its bar, and says it in words for a screen reader', async () => {
    const { container } = renderCard();
    const slider = await screen.findByRole('slider');
    const effort = screen.getByRole('button', { name: /Daily effort/ });

    slider.focus();
    await waitFor(() => expect(slider).toHaveAttribute('aria-valuenow', '39'));
    expect(container.querySelector('.analysis-fit-v2-effort-selected')).not.toBeInTheDocument();      // today was a day off
    expect(slider.getAttribute('aria-valuetext')).toContain(`${effortLabel()} 0`);

    stepBack(slider, 6);                                           // 4 Oct: 70
    expect(container.querySelector('.analysis-fit-v2-tooltip time')).toHaveTextContent('Oct 4');
    expect(effort).toHaveTextContent('70');
    expect(slider.getAttribute('aria-valuetext')).toContain(`${effortLabel()} 70`);
    const marked = container.querySelector('.analysis-fit-v2-effort-selected');
    expect(marked).toBeInTheDocument();
    expect(Number(marked.getAttribute('height'))).toBeGreaterThan(0);

    fireEvent.keyDown(slider, { key: 'ArrowRight' });              // 5 Oct: a day off
    expect(container.querySelector('.analysis-fit-v2-tooltip time')).toHaveTextContent('Oct 5');
    expect(effort).toHaveTextContent(/Daily effort\s*0$/);
    expect(container.querySelector('.analysis-fit-v2-effort-selected')).not.toBeInTheDocument();
  });

  it('draws no bar for the days after today, and has no effort to show for them', async () => {
    const { container } = renderCard();
    const slider = await screen.findByRole('slider');
    const bars = container.querySelector('.analysis-fit-v2-effort-bars').getAttribute('d').split('M').length - 1;
    expect(bars).toBe(served.points.filter((point) => point.load > 0).length);       // none of the 14 days of rest adds one

    slider.focus();
    await waitFor(() => expect(slider).toHaveAttribute('aria-valuenow', '39'));
    for (let step = 0; step < 6; step += 1) fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(container.querySelector('.analysis-fit-v2-tooltip time')).toHaveTextContent(t('training_series.if_rest'));
    expect(screen.getByRole('button', { name: /Daily effort/ })).toHaveTextContent('–');
    expect(slider.getAttribute('aria-valuetext')).not.toContain(effortLabel());
    expect(container.querySelector('.analysis-fit-v2-effort-selected')).not.toBeInTheDocument();
  });

  it('puts the effort of each real day in the list a screen reader reads, and none for the days of rest', async () => {
    const { container } = renderCard();
    await screen.findByRole('slider');
    const items = [...container.querySelectorAll('[data-analysis-history="fitness"] li')];
    const withEffort = items.filter((item) => item.textContent.includes(`${effortLabel()}:`));

    expect(items).toHaveLength(54);
    expect(withEffort).toHaveLength(40);
    expect(withEffort[33].textContent).toContain(`${effortLabel()}: 70`);
    expect(items.slice(40).every((item) => !item.textContent.includes(effortLabel()))).toBe(true);
  });
});

describe('where the numbers are heading', () => {
  const fixed = (value) => `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}`;
  const cardsOf = () => screen.getByRole('region', { name: t('training_series.fitness_title') }).querySelectorAll('.analysis-fit-v2-metrics article');
  const arrowsOf = (card) => [...card.querySelectorAll('.analysis-fit-v2-arrow')].map((node) => node.textContent);

  it('writes the change over 14 days under each number, worked out from the two numbers on the chart', async () => {
    renderCard();
    await screen.findByRole('slider');
    const now = served.points.at(-1);
    const back = served.points.at(-15);
    const cards = cardsOf();

    const percent = Math.round(((now.fitness - back.fitness) / back.fitness) * 100);
    expect(cards[0]).toHaveTextContent(`${fixed(now.fitness - back.fitness)} (${percent > 0 ? '+' : '−'}${Math.abs(percent)}%) in the last 14 days`);
    expect(cards[1]).toHaveTextContent(`${fixed(now.fatigue - back.fatigue)} in the last 14 days`);
    expect(cards[1]).not.toHaveTextContent('%');
    expect(cards[2]).toHaveTextContent(`${fixed(now.form - back.form)} in the last 14 days`);
    expect(cards[2]).toHaveTextContent(/in the last 7 days/);
  });

  it('puts an arrow before each change, for the eye only: the words and the sign say the same', async () => {
    renderCard();
    await screen.findByRole('slider');

    expect(arrowsOf(cardsOf()[0])).toHaveLength(2);
    expect(arrowsOf(cardsOf()[1])).toHaveLength(2);
    expect(arrowsOf(cardsOf()[2])).toHaveLength(2);
    for (const arrow of document.querySelectorAll('.analysis-fit-v2-arrow')) {
      expect(arrow).toHaveAttribute('aria-hidden', 'true');
      expect(['↑', '↓', '→']).toContain(arrow.textContent);
    }
  });

  it('points the way the number went, and level when it moved by less than a thirtieth', async () => {
    served = series({ count: 40, loadOf: () => 60 });           // steady: fatigue has settled and fitness is still climbing
    renderCard();
    await screen.findByRole('slider');

    expect(arrowsOf(cardsOf()[0])).toEqual(['↑', '↑']);
    expect(arrowsOf(cardsOf()[1])).toEqual(['→', '→']);
    expect(arrowsOf(cardsOf()[2])).toEqual(['↑', '↑']);
  });

  it('points down for a fall', async () => {
    served = series({ count: 40, loadOf: (i) => (i < 20 ? 100 : 0) });
    renderCard();
    await screen.findByRole('slider');

    expect(arrowsOf(cardsOf()[1])).toEqual(['↓', '↓']);
  });

  it('leaves the 14 days out when the chart does not reach back that far, and keeps the 7', async () => {
    served = series({ count: 14 });
    renderCard();
    await screen.findByRole('slider');

    expect(screen.queryByText(/in the last 14 days/)).not.toBeInTheDocument();
    expect(cardsOf()[0]).toHaveTextContent(/in the last 7 days/);
    expect(arrowsOf(cardsOf()[0])).toHaveLength(1);
  });

  it('reads in Chinese too', async () => {
    state.lang = 'zh-CN';
    renderCard();
    await screen.findByRole('slider');

    expect(cardsOf()[0]).toHaveTextContent(/近 14 天 [+−]\d+\.\d（[+−]\d+%）/);
    expect(cardsOf()[1]).toHaveTextContent(/近 14 天 [+−]\d+\.\d/);
    expect(screen.getByRole('button', { name: /每日强度/ })).toBeInTheDocument();
  });
});

describe('in Chinese', () => {
  beforeEach(() => { state.lang = 'zh-CN'; });

  it('speaks Chinese everywhere, with the figures and the dates in the same places', async () => {
    renderCard();
    const slider = await screen.findByRole('slider');

    expect(screen.getByRole('region', { name: '体能、疲劳与状态' })).toBeInTheDocument();
    expect(slider).toHaveAccessibleName(/共 40 天的体能、疲劳与状态/);
    expect(screen.getByRole('button', { name: /体能/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '6 个月' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/根据 28 次跑步计算：/)).toBeInTheDocument();
    expect(screen.getByText(t('training_series.form_fresh'))).toBeInTheDocument();
  });
});
