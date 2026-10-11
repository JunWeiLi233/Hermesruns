import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import RunMatches from '../RunMatches';
import { aloneOnItsRoute, matchRun, matches } from './recordsFixtures';

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
  }),
}));

const URL = '/api/activities/9/matches';
let served;
const reads = () => apiJson.mock.calls.filter(([url]) => url === URL);
const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
const dots = (container) => [...container.querySelectorAll('.run-detail-v2__rm-dot')];

function renderCard(props = {}) {
  return render(<MemoryRouter><RunMatches runId={9} streamReady {...props} /></MemoryRouter>);
}

beforeEach(() => {
  state.lang = 'en';
  served = matches();
  apiJson.mockReset();
  apiJson.mockImplementation(async (url) => {
    if (url === URL) {
      if (served instanceof Error) throw served;
      return served;
    }
    return {};
  });
});
afterEach(() => cleanup());

describe('loading', () => {
  it('waits for the run page to have the stream before asking, and keeps the anchor for the run navigation', async () => {
    const { container, rerender } = renderCard({ streamReady: false });
    expect(container.querySelector('#run-detail-matches')).toBeInTheDocument();
    expect(screen.getByText(t('run_matches.loading'))).toBeInTheDocument();
    expect(reads()).toHaveLength(0);

    rerender(<MemoryRouter><RunMatches runId={9} streamReady /></MemoryRouter>);
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(reads()).toHaveLength(1);
  });

  it('says so, with a way to try again, when the runs cannot be loaded', async () => {
    served = new Error('down');
    renderCard();
    expect(await screen.findByRole('alert')).toHaveTextContent(t('run_matches.error'));

    served = matches();
    await userEvent.click(screen.getByRole('button', { name: t('run_matches.retry') }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('is a region named after its title', async () => {
    renderCard();
    expect(await screen.findByRole('region', { name: 'Same-route runs' })).toBeInTheDocument();
  });
});

describe('when there is nothing to compare with', () => {
  it('says this is the only run over its route', async () => {
    served = aloneOnItsRoute();
    const { container } = renderCard();
    expect(await screen.findByText(t('run_matches.only_run'))).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(container.querySelector('#run-detail-matches')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('does not make a comparison of one run, whatever the count says', async () => {
    served = matches({ runs: [matchRun({ date: '2026-09-20', current: true, fastest: true })] });
    renderCard();
    expect(await screen.findByText(t('run_matches.only_run'))).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says why a run has no route at all', async () => {
    served = aloneOnItsRoute({ groupId: null });
    renderCard();
    expect(await screen.findByText(t('run_matches.no_route'))).toBeInTheDocument();
    expect(screen.queryByText(t('run_matches.only_run'))).not.toBeInTheDocument();
  });

  it('warns that more runs may join while others are still being analysed', async () => {
    served = aloneOnItsRoute({ complete: false });
    renderCard();
    expect(await screen.findByText(t('run_matches.incomplete'))).toBeInTheDocument();
  });
});

describe('the runs of a route', () => {
  it('says how many times the route was run, which run was the fastest and how this one compares', async () => {
    renderCard();
    const summary = (await screen.findByText(/You have run this route 4 times/)).textContent;
    expect(summary).toContain('The fastest was on May 10, 2025, at 4:50 /km.');
    // 1860 s over 6 km is 5:10, 20 s per km slower than the fastest.
    expect(summary).toContain('This run was 0:20 /km slower than that.');
  });

  it('says so when this run is the fastest', async () => {
    served = matches({
      runs: [
        matchRun({ date: '2025-05-10', movingSeconds: 1800 }),
        matchRun({ date: '2026-09-20', movingSeconds: 1740, current: true, fastest: true }),
      ],
    });
    renderCard();
    const summary = (await screen.findByText(/You have run this route 2 times/)).textContent;
    expect(summary).toContain(t('run_matches.this_is_fastest'));
    expect(summary).not.toContain('slower than that');
  });

  it('lists the runs newest first, each with its distance, time and pace', async () => {
    renderCard();
    await screen.findByRole('table');
    const rows = bodyRows();
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('Sep 20, 2026');
    expect(rows[0]).toHaveTextContent('6.00 km');
    expect(rows[0]).toHaveTextContent('31:00');
    expect(rows[0]).toHaveTextContent('5:10 /km');
    expect(rows[3]).toHaveTextContent('May 10, 2025');
    expect(rows[3]).toHaveTextContent('29:00');
    expect(rows[3]).toHaveTextContent('4:50 /km');
  });

  it('compares every other run with this one, in seconds per kilometre', async () => {
    renderCard();
    await screen.findByRole('table');
    const rows = bodyRows();
    expect(rows[0].cells[4]).toHaveTextContent('–');
    expect(rows[1]).toHaveTextContent('−0:05 /km'); // 1830 s: 5:05, 5 s faster
    expect(rows[2]).toHaveTextContent('−0:10 /km'); // 1800 s: 5:00
    expect(rows[3]).toHaveTextContent('−0:20 /km'); // 1740 s: 4:50
  });

  it('marks this run and the fastest, links the others, and leaves this one as plain text', async () => {
    renderCard();
    await screen.findByRole('table');
    const rows = bodyRows();
    expect(rows[0]).toHaveTextContent(t('run_matches.tag_this'));
    expect(rows[0]).toHaveAttribute('aria-current', 'true');
    expect(within(rows[0]).queryByRole('link')).not.toBeInTheDocument();
    expect(rows[3]).toHaveTextContent(t('run_matches.tag_fastest'));
    expect(within(rows[3]).getByRole('link', { name: 'May 10, 2025' })).toHaveAttribute('href', '/runs/20250510');
    expect(within(rows[1]).getByRole('link', { name: 'Mar 15, 2026' })).toHaveAttribute('href', '/runs/20260315');
    expect(rows[1]).not.toHaveAttribute('aria-current');
  });

  it('marks the rows of this run and of the fastest for the styles, and no other', async () => {
    renderCard();
    await screen.findByRole('table');
    const rows = bodyRows();
    expect(rows.map((row) => row.classList.contains('is-current'))).toEqual([true, false, false, false]);
    expect(rows.map((row) => row.classList.contains('is-fastest'))).toEqual([false, false, false, true]);
  });

  it('labels the two ends of the chart with the first and the last day it draws', async () => {
    const { container } = renderCard();
    await screen.findByRole('table');
    expect([...container.querySelectorAll('.run-detail-v2__rm-axis')].map((node) => node.textContent)).toEqual(['May 10, 2025', 'Sep 20, 2026']);
  });

  it('shows each run name beside its date', async () => {
    renderCard();
    await screen.findByRole('table');
    expect(bodyRows()[1]).toHaveTextContent('Run on 2026-03-15');
  });

  it('draws a dot for every run, the current and the fastest picked out, and a trend line', async () => {
    const { container } = renderCard();
    await screen.findByRole('table');
    expect(dots(container)).toHaveLength(4);
    expect(container.querySelectorAll('.run-detail-v2__rm-dot.is-current')).toHaveLength(1);
    expect(container.querySelectorAll('.run-detail-v2__rm-dot.is-fastest')).toHaveLength(1);
    expect(container.querySelectorAll('.run-detail-v2__rm-dot.is-other')).toHaveLength(2);
    expect(container.querySelector('.run-detail-v2__rm-trend')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Pace of 4 runs over this route by date/ })).toBeInTheDocument();
  });

  it('gives a dot the date and pace of its run for a tooltip', async () => {
    const { container } = renderCard();
    await screen.findByRole('table');
    const titles = dots(container).map((dot) => dot.querySelector('title').textContent);
    expect(titles).toContain('May 10, 2025 · 4:50 /km');
    expect(titles).toContain('Sep 20, 2026 · 5:10 /km');
  });

  it('does not draw a trend through two runs', async () => {
    served = matches({ runs: [matchRun({ date: '2025-05-10', fastest: true }), matchRun({ date: '2026-09-20', movingSeconds: 1860, current: true })] });
    const { container } = renderCard();
    await screen.findByRole('table');
    expect(dots(container)).toHaveLength(2);
    expect(container.querySelector('.run-detail-v2__rm-trend')).not.toBeInTheDocument();
  });

  it('says what makes two runs the same route, and that stopped time is left out', async () => {
    renderCard();
    expect(await screen.findByText(t('run_matches.basis'))).toBeInTheDocument();
  });

  it('warns that more runs may join while others are still being analysed', async () => {
    served = matches({ complete: false });
    renderCard();
    expect(await screen.findByText(t('run_matches.incomplete'))).toBeInTheDocument();
  });
});

describe('the year filter', () => {
  it('offers every year the route was run, newest first, and all years selected to begin with', async () => {
    renderCard();
    const group = await screen.findByRole('group', { name: t('run_matches.year_group') });
    const buttons = within(group).getAllByRole('button').map((button) => button.textContent);
    expect(buttons).toEqual([t('run_matches.all_years'), '2026', '2025']);
    expect(within(group).getByRole('button', { name: t('run_matches.all_years') })).toHaveAttribute('aria-pressed', 'true');
  });

  it('narrows the table and the chart to one year, but still compares with this run, and widens again', async () => {
    const user = userEvent.setup();
    const { container } = renderCard();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: '2025' }));

    const rows = bodyRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Nov 2, 2025');
    expect(rows[1]).toHaveTextContent('May 10, 2025');
    expect(rows[0]).toHaveTextContent('−0:10 /km');
    expect(dots(container)).toHaveLength(2);
    expect(screen.getByRole('button', { name: '2025' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: /Pace of 2 runs/ })).toBeInTheDocument();
    // The summary is about the whole route, not the year on show.
    expect(screen.getByText(/You have run this route 4 times/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t('run_matches.all_years') }));
    expect(bodyRows()).toHaveLength(4);
  });

  it('puts in the key only what the chart shows, so a year without this run has no dot to match its swatch', async () => {
    const user = userEvent.setup();
    const { container } = renderCard();
    await screen.findByRole('table');
    const legend = () => [...container.querySelectorAll('.run-detail-v2__rm-legend li')].map((item) => item.textContent);
    expect(legend()).toEqual(['This run', 'Fastest', 'Other runs', 'Trend']);

    await user.click(screen.getByRole('button', { name: '2025' })); // the fastest, no this-run
    expect(legend()).toEqual(['Fastest', 'Other runs']);

    await user.click(screen.getByRole('button', { name: '2026' })); // this run, no fastest
    expect(legend()).toEqual(['This run', 'Other runs']);
  });

  it('has nothing but this run in the key for a year in which this run is all there is', async () => {
    const user = userEvent.setup();
    served = matches({
      runs: [
        matchRun({ date: '2025-05-10', movingSeconds: 1740, fastest: true }),
        matchRun({ date: '2025-11-02', movingSeconds: 1800 }),
        matchRun({ date: '2026-09-20', movingSeconds: 1860, current: true }),
      ],
    });
    const { container } = renderCard();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: '2026' }));
    expect([...container.querySelectorAll('.run-detail-v2__rm-legend li')].map((item) => item.textContent)).toEqual(['This run']);
  });

  it('does not show the fastest in the key when this run is the fastest', async () => {
    served = matches({
      runs: [
        matchRun({ date: '2025-05-10', movingSeconds: 1800 }),
        matchRun({ date: '2026-09-20', movingSeconds: 1740, current: true, fastest: true }),
      ],
    });
    const { container } = renderCard();
    await screen.findByRole('table');
    expect([...container.querySelectorAll('.run-detail-v2__rm-legend li')].map((item) => item.textContent)).toEqual(['This run', 'Other runs']);
  });

  it('has no filter when the route was run in one year only', async () => {
    served = matches({ runs: [matchRun({ date: '2026-05-10', fastest: true }), matchRun({ date: '2026-09-20', movingSeconds: 1860, current: true })] });
    renderCard();
    await screen.findByRole('table');
    expect(screen.queryByRole('group', { name: t('run_matches.year_group') })).not.toBeInTheDocument();
  });
});

describe('language', () => {
  it('speaks Chinese when the language is Chinese', async () => {
    state.lang = 'zh-CN';
    renderCard();
    expect(await screen.findByRole('region', { name: '相同路线的跑步' })).toBeInTheDocument();
    expect(screen.getByText(/你已经跑过这条路线 4 次/)).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['跑步', '距离', '用时', '配速', '与这次相比']);
  });
});
