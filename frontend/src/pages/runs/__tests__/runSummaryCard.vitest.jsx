import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { ALL_KEY, HIDDEN_KEY, forgetMemory, writeEnabled, writeHidden } from '../../../utils/runSummaryPreference';
import RunSummaryCard from '../RunSummaryCard';
import * as fx from './runSummaryFixtures';

const state = vi.hoisted(() => ({ lang: 'en', unit: 'km' }));
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
    formatNumber: (value) => new Intl.NumberFormat(state.lang === 'zh-CN' ? 'zh-CN' : 'en-US').format(value),
  }),
}));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: state.unit, isMile: state.unit === 'mile' }) }));

let respond;
const summaryCalls = () => apiJson.mock.calls.map(([url]) => String(url)).filter((url) => url.endsWith('/summary'));
const card = () => screen.getByRole('region', { name: t('run_summary.title') });
const items = () => within(screen.getByRole('list', { name: t('run_summary.lines_label') })).getAllByRole('listitem');
const toggleOf = (item) => within(item).getByRole('button', { name: t('run_summary.working') });

async function ready() {
  await screen.findByRole('list', { name: t('run_summary.lines_label') });
}

beforeEach(() => {
  state.lang = 'en';
  state.unit = 'km';
  localStorage.clear();
  forgetMemory();
  apiJson.mockReset();
  respond = () => fx.fullSummary();
  apiJson.mockImplementation(async (url, options) => {
    const result = await respond(String(url), options);
    if (result instanceof Error) throw result;
    return result;
  });
});
afterEach(() => cleanup());

describe('loading and failing', () => {
  it('shows a skeleton, announced and busy, until the summary arrives', async () => {
    let release;
    respond = () => new Promise((resolve) => { release = () => resolve(fx.fullSummary()); });
    const { container } = render(<RunSummaryCard runId={7} />);

    expect(card()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(t('run_summary.loading'));
    expect(container.querySelector('.run-summary__skeleton')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    release();
    await ready();
    expect(card()).not.toHaveAttribute('aria-busy');
    expect(container.querySelector('.run-summary__skeleton')).not.toBeInTheDocument();
  });

  it('says so, with a way to try again, when the summary cannot be loaded', async () => {
    respond = () => new Error('boom');
    render(<RunSummaryCard runId={7} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_summary.error'));
    respond = () => fx.fullSummary();
    await userEvent.click(screen.getByRole('button', { name: t('run_summary.retry') }));

    await ready();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['no findings', { state: 'ready' }],
    ['a state it does not know', { state: 'maybe', findings: [] }],
    ['findings with no facts', { state: 'ready', findings: [{ id: 'character', variant: 'easy' }] }],
  ])('treats an answer with %s as a failed load, not a half-drawn card', async (_name, answer) => {
    respond = () => answer;
    render(<RunSummaryCard runId={7} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_summary.error'));
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('keeps the numbers of the run before out of the card of the next, which loads on its own', async () => {
    const { rerender } = render(<RunSummaryCard key="a" runId={7} />);
    await ready();
    let release;
    respond = () => new Promise((resolve) => { release = () => resolve(fx.summary([fx.race])); });

    rerender(<RunSummaryCard key="b" runId={8} />);

    expect(screen.queryByText(/zones 1 and 2/u)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    release();
    expect(await screen.findByText(/marked this run as a race/u)).toBeInTheDocument();
    expect(summaryCalls()).toEqual(['/api/activities/7/summary', '/api/activities/8/summary']);
  });
});

describe('the summary', () => {
  it('has a title, says it is worked out by rules and not generated, and lists the headline first', async () => {
    render(<RunSummaryCard runId={7} />);
    await ready();

    expect(screen.getByRole('heading', { level: 2, name: t('run_summary.title') })).toBeInTheDocument();
    expect(screen.getByText(t('run_summary.subtitle'))).toBeInTheDocument();
    const lines = items();
    expect(lines).toHaveLength(5);
    expect(within(lines[0]).getByText('An easy run: 90% of your time with heart rate was in zones 1 and 2.')).toBeInTheDocument();
    expect(lines[0]).toHaveClass('is-headline');
    expect(lines[1]).not.toHaveClass('is-headline');
    expect(within(lines[1]).getByText(/Your longest run in 28 days/u)).toBeInTheDocument();
    expect(within(lines[2]).getByText(/The hardest of your last 10 runs/u)).toBeInTheDocument();
    expect(within(lines[3]).getByText(/You sped up/u)).toBeInTheDocument();
    expect(within(lines[4]).getByText(/Faster than your recent runs/u)).toBeInTheDocument();
  });

  it('marks each line by its tone for the colour, and says nothing about it in words', async () => {
    render(<RunSummaryCard runId={7} />);
    await ready();

    const lines = items();
    expect(lines[0]).toHaveClass('is-neutral');
    expect(lines[1]).toHaveClass('is-positive');
    expect(lines[4]).toHaveClass('is-positive');
  });

  it('asks the server for this run once, and nothing else', async () => {
    render(<RunSummaryCard runId={7} />);
    await ready();

    expect(summaryCalls()).toEqual(['/api/activities/7/summary']);
    expect(apiJson).toHaveBeenCalledTimes(1);
  });

  it('says a run too short for anything is too short, with no list and no buttons to hide it', async () => {
    respond = () => fx.tooShort();
    render(<RunSummaryCard runId={7} />);

    expect(await screen.findByText(t('run_summary.none_too_short'))).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('run_summary.hide_here') })).not.toBeInTheDocument();
  });

  it('writes distances and paces in miles for a runner who counts in miles', async () => {
    state.unit = 'mile';
    render(<RunSummaryCard runId={7} />);
    await ready();

    expect(within(items()[1]).getByText('Your longest run in 28 days: 7.5 mi, against 6.2 mi for the longest before it.')).toBeInTheDocument();
    expect(within(items()[4]).getByText(/7:15 \/mi, against 8:03 \/mi/u)).toBeInTheDocument();
  });

  it('speaks Chinese, headline and lines', async () => {
    state.lang = 'zh-CN';
    render(<RunSummaryCard runId={7} />);
    await screen.findByRole('list', { name: '这次跑步的要点' });

    expect(screen.getByRole('heading', { level: 2, name: '跑步小结' })).toBeInTheDocument();
    const lines = items();
    expect(within(lines[0]).getByText('轻松的一次跑：在有心率的时间里，90% 处于 1、2 区。')).toBeInTheDocument();
    expect(within(lines[0]).getByRole('button', { name: '这是怎么得出的' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '这次跑步不显示' })).toBeInTheDocument();
  });
});

describe('showing its working', () => {
  it('keeps the numbers and the rule folded until a line is opened, and folds them again', async () => {
    const { container } = render(<RunSummaryCard runId={7} />);
    await ready();
    const line = items()[3];
    const toggle = toggleOf(line);
    const panel = container.querySelector(`#${CSS.escape(toggle.getAttribute('aria-controls'))}`);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(panel).toHaveAttribute('hidden');
    expect(panel).not.toBeVisible();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(panel).not.toHaveAttribute('hidden');
    expect(panel).toBeVisible();
    expect(within(panel).getByText(t('run_summary.numbers_label'))).toBeVisible();
    expect(within(panel).getByText('Pace, first half').nextSibling).toHaveTextContent('5:00 /km');
    expect(within(panel).getByText('Pace, second half').nextSibling).toHaveTextContent('4:53 /km');
    expect(within(panel).getByText(t('run_summary.rule_label')).nextSibling).toHaveTextContent(/2% or more apart counts/u);

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(panel).toHaveAttribute('hidden');
  });

  it('opens one line without opening the others', async () => {
    render(<RunSummaryCard runId={7} />);
    await ready();

    await userEvent.click(toggleOf(items()[0]));

    expect(toggleOf(items()[0])).toHaveAttribute('aria-expanded', 'true');
    for (const line of items().slice(1)) expect(toggleOf(line)).toHaveAttribute('aria-expanded', 'false');
  });

  it('can be opened and closed from the keyboard', async () => {
    render(<RunSummaryCard runId={7} />);
    await ready();
    const toggle = toggleOf(items()[2]);

    toggle.focus();
    await userEvent.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the zone shares of the headline and the rule that decided it', async () => {
    render(<RunSummaryCard runId={7} />);
    await ready();

    await userEvent.click(toggleOf(items()[0]));

    expect(within(items()[0]).getByText('Zone 2').nextSibling).toHaveTextContent('60%');
    expect(within(items()[0]).getByText('Time with heart rate').nextSibling).toHaveTextContent('33 min');
    expect(within(items()[0]).getByText(t('run_summary.rule_label')).nextSibling).toHaveTextContent('Hard when zones 4 and 5 hold 30% or more');
  });
});

describe('waiting for the stream', () => {
  it('asks nothing until the run page has finished asking for the stream', async () => {
    const { rerender } = render(<RunSummaryCard runId={7} streamReady={false} />);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(summaryCalls()).toEqual([]);
    expect(screen.getByRole('status')).toBeInTheDocument();

    rerender(<RunSummaryCard runId={7} streamReady />);
    await ready();
    expect(summaryCalls()).toEqual(['/api/activities/7/summary']);
  });

  it('asks again when the elevation has been recalibrated, since the grade-adjusted paces change', async () => {
    const { rerender } = render(<RunSummaryCard runId={7} refreshToken={0} />);
    await ready();

    rerender(<RunSummaryCard runId={7} refreshToken={1} />);

    await waitFor(() => expect(summaryCalls()).toHaveLength(2));
    await ready();
  });
});

describe('hiding it on one run', () => {
  it('folds into one line with a way back, asks for nothing more, and moves the keyboard to the way back', async () => {
    render(<RunSummaryCard runId={7} />);
    await ready();

    await userEvent.click(screen.getByRole('button', { name: t('run_summary.hide_here') }));

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText(t('run_summary.hidden_here'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('run_summary.show_here') })).toHaveFocus();
    expect(JSON.parse(localStorage.getItem(HIDDEN_KEY))).toEqual([7]);
    expect(summaryCalls()).toHaveLength(1);
  });

  it('shows it again, asks again and puts the keyboard on the title', async () => {
    render(<RunSummaryCard runId={7} />);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: t('run_summary.hide_here') }));

    await userEvent.click(screen.getByRole('button', { name: t('run_summary.show_here') }));

    await ready();
    expect(screen.getByRole('heading', { level: 2, name: t('run_summary.title') })).toHaveFocus();
    expect(localStorage.getItem(HIDDEN_KEY)).toBeNull();
    expect(summaryCalls()).toHaveLength(2);
  });

  it('asks the server for nothing at all on a run it was hidden on before', async () => {
    writeHidden(7, true);
    render(<RunSummaryCard runId={7} />);

    expect(screen.getByText(t('run_summary.hidden_here'))).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(apiJson).not.toHaveBeenCalled();
  });

  it('is hidden on that run only', async () => {
    writeHidden(7, true);
    render(<RunSummaryCard runId={8} />);

    await ready();
    expect(screen.queryByText(t('run_summary.hidden_here'))).not.toBeInTheDocument();
    expect(summaryCalls()).toEqual(['/api/activities/8/summary']);
  });
});

describe('turning it off for every run', () => {
  it('takes the card away at once, remembers it and says where to turn it back on', async () => {
    const { container } = render(<RunSummaryCard runId={7} />);
    await ready();
    expect(screen.getByText(t('run_summary.off_hint'))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: t('run_summary.turn_off') }));

    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem(ALL_KEY)).toBe('off');
  });

  it('shows nothing and asks nothing while it is off, and comes back when it is turned on', async () => {
    writeEnabled(false);
    const { container } = render(<RunSummaryCard runId={7} />);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(container).toBeEmptyDOMElement();
    expect(apiJson).not.toHaveBeenCalled();

    writeEnabled(true);
    await ready();
    expect(summaryCalls()).toEqual(['/api/activities/7/summary']);
  });

  it('is off on a run it was hidden on, whichever way it is turned on again', async () => {
    writeHidden(7, true);
    writeEnabled(false);
    const { container } = render(<RunSummaryCard runId={7} />);
    expect(container).toBeEmptyDOMElement();

    writeEnabled(true);
    await waitFor(() => expect(screen.getByText(t('run_summary.hidden_here'))).toBeInTheDocument());
  });
});
