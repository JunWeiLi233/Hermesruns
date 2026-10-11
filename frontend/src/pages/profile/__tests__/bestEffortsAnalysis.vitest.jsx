import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { analysis, NO_EFFORTS_ANALYSIS } from '../../runs/__tests__/recordsFixtures';
import BestEffortsAnalysis from '../BestEffortsAnalysis';

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
    formatNumber: (value, options) => new Intl.NumberFormat(state.lang === 'zh-CN' ? 'zh-CN' : 'en-US', options).format(value),
  }),
}));
vi.mock('../../../contexts/UnitContext', () => ({
  useUnit: () => ({ unit: state.unit, isMile: state.unit === 'mile' }),
}));

let served;
const calls = () => apiJson.mock.calls.map(([url]) => url);

function renderSection() {
  return render(<MemoryRouter><BestEffortsAnalysis /></MemoryRouter>);
}

const openButton = () => screen.getByRole('button', { name: t('best_efforts.analysis_open') });

beforeEach(() => {
  state.lang = 'en';
  state.unit = 'km';
  served = (url) => {
    const query = new URLSearchParams(url.split('?')[1] ?? '');
    const distance = query.get('distance');
    const year = query.get('year');
    if (distance === '10km') {
      return analysis({
        key: '10km', meters: 10000, year: 2025, years: [2025],
        lifetime: [{ rank: 1, activityId: 201, name: '10 km race', date: '2025-04-12', effectiveSeconds: 2750, paceSecPerKm: 275, edited: false, estimated: false }],
        annual: [{ rank: 1, activityId: 201, name: '10 km race', date: '2025-04-12', effectiveSeconds: 2750, paceSecPerKm: 275, edited: false, estimated: false }],
        trend: [{ year: 2025, bestSeconds: 2750, count: 1 }],
      });
    }
    if (year === '2025') {
      return analysis({
        year: 2025,
        annual: [{ rank: 1, activityId: 301, name: 'Spring 5 km', date: '2025-05-10', effectiveSeconds: 1290, paceSecPerKm: 258, edited: false, estimated: false }],
      });
    }
    return analysis();
  };
  apiJson.mockReset();
  apiJson.mockImplementation(async (url) => {
    if (url.startsWith('/api/training/best-efforts')) {
      const answer = typeof served === 'function' ? served(url) : served;
      if (answer instanceof Error) throw answer;
      return answer;
    }
    return {};
  });
});
afterEach(() => cleanup());

describe('closed', () => {
  it('shows what it is and makes no request, so the first paint of the Profile page is what it was', async () => {
    const { container } = renderSection();
    expect(screen.getByRole('heading', { name: t('best_efforts.analysis_title') })).toBeInTheDocument();
    expect(screen.getByText(t('best_efforts.analysis_intro'))).toBeInTheDocument();
    expect(openButton()).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('#profile-best-efforts')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(apiJson).not.toHaveBeenCalled();
  });
});

describe('opening it', () => {
  it('asks the server once, for the distance and year it picks, and shows the three lists', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(openButton());

    expect(await screen.findByText(t('best_efforts.analysis_lifetime'))).toBeInTheDocument();
    expect(calls()).toEqual(['/api/training/best-efforts']);
    expect(screen.getByRole('button', { name: t('best_efforts.analysis_close') })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText(t('best_efforts.analysis_intro'))).not.toBeInTheDocument();

    const lifetime = screen.getByRole('heading', { name: t('best_efforts.analysis_lifetime') }).closest('.hd-records-block');
    const rows = within(lifetime).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('PR');
    expect(rows[0]).toHaveTextContent('21:30');
    expect(rows[0]).toHaveTextContent('4:18 /km');
    expect(rows[0]).toHaveTextContent('May 10, 2025');
    expect(rows[1]).toHaveTextContent('2nd');
    expect(rows[1]).toHaveTextContent(t('best_efforts.tag_edited'));
    expect(rows[2]).toHaveTextContent('3rd');
    // Everything has been analysed, so there is nothing to warn about.
    expect(screen.queryByText(t('best_efforts.incomplete'))).not.toBeInTheDocument();

    const annual = screen.getByRole('heading', { name: 'Best of 2026' }).closest('.hd-records-block');
    const annualRows = within(annual).getAllByRole('listitem');
    expect(annualRows).toHaveLength(3);
    expect(annualRows[2]).toHaveTextContent(t('best_efforts.tag_estimated'));
  });

  it('links each effort to its run', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(openButton());
    const lifetime = (await screen.findByRole('heading', { name: t('best_efforts.analysis_lifetime') })).closest('.hd-records-block');
    expect(within(lifetime).getByRole('link', { name: 'May 10, 2025' })).toHaveAttribute('href', '/runs/101');
    expect(within(lifetime).getByRole('link', { name: 'Mar 15, 2026' })).toHaveAttribute('href', '/runs/102');
  });

  it('draws the best time of each year, and reads it out for those who cannot see the chart', async () => {
    const user = userEvent.setup();
    const { container } = renderSection();
    await user.click(openButton());
    const chart = await screen.findByRole('img', { name: 'Best 5 km time of each year, faster nearer the top' });
    expect(chart).toBeInTheDocument();
    expect(container.querySelectorAll('.hd-records-dot')).toHaveLength(3);
    expect(container.querySelector('.hd-records-line')).toBeInTheDocument();
    expect(container.querySelector('figcaption')).toHaveTextContent('2024: 22:10; 2025: 21:30; 2026: 21:55');
    expect([...container.querySelectorAll('.hd-records-year')].map((node) => node.textContent)).toEqual(['2024', '2025', '2026']);
  });

  it('offers the distances the runner has efforts for, and the years, with the ones the server picked selected', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(openButton());
    const distance = await screen.findByRole('combobox', { name: t('best_efforts.analysis_distance') });
    const year = screen.getByRole('combobox', { name: t('best_efforts.analysis_year') });

    expect(within(distance).getAllByRole('option').map((option) => option.textContent)).toEqual(['1 km', '5 km', '10 km']);
    expect(distance).toHaveValue('5km');
    expect(within(year).getAllByRole('option').map((option) => option.textContent)).toEqual(['2026', '2025', '2024']);
    expect(year).toHaveValue('2026');
  });

  it('asks again for another distance, forgetting the year, and keeps the selectors on screen meanwhile', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(openButton());
    const distance = await screen.findByRole('combobox', { name: t('best_efforts.analysis_distance') });

    let release;
    apiJson.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve(served('/api/training/best-efforts?distance=10km')); }));
    await user.selectOptions(distance, '10km');
    expect(screen.getByRole('combobox', { name: t('best_efforts.analysis_distance') })).toBeInTheDocument();
    expect(calls().at(-1)).toBe('/api/training/best-efforts?distance=10km');

    release();
    expect(await screen.findAllByText('10 km race', { selector: 'small' })).toHaveLength(2);
    expect(screen.getByRole('combobox', { name: t('best_efforts.analysis_distance') })).toHaveValue('10km');
    expect(screen.getByRole('combobox', { name: t('best_efforts.analysis_year') })).toHaveValue('2025');
  });

  it('forgets the year it was showing when another distance is chosen', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(openButton());
    await user.selectOptions(await screen.findByRole('combobox', { name: t('best_efforts.analysis_year') }), '2025');
    await waitFor(() => expect(calls().at(-1)).toBe('/api/training/best-efforts?year=2025'));
    await screen.findByRole('heading', { name: 'Best of 2025' });

    await user.selectOptions(screen.getByRole('combobox', { name: t('best_efforts.analysis_distance') }), '10km');
    await waitFor(() => expect(calls().at(-1)).toBe('/api/training/best-efforts?distance=10km'));
  });

  it('asks again for another year at the same distance', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(openButton());
    const year = await screen.findByRole('combobox', { name: t('best_efforts.analysis_year') });
    await user.selectOptions(year, '2025');

    await waitFor(() => expect(calls().at(-1)).toBe('/api/training/best-efforts?year=2025'));
    expect(await screen.findByRole('heading', { name: 'Best of 2025' })).toBeInTheDocument();
    expect(screen.getByText('Spring 5 km')).toBeInTheDocument();
  });

  it('keeps what was loaded when it is closed and opened again, without asking again', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(openButton());
    await screen.findByText(t('best_efforts.analysis_lifetime'));
    await user.click(screen.getByRole('button', { name: t('best_efforts.analysis_close') }));
    expect(screen.queryByText(t('best_efforts.analysis_lifetime'))).not.toBeInTheDocument();

    await user.click(openButton());
    expect(await screen.findByText(t('best_efforts.analysis_lifetime'))).toBeInTheDocument();
    expect(calls()).toHaveLength(1);
  });
});

describe('states', () => {
  it('says it is loading while it waits', async () => {
    served = () => new Promise(() => {});
    apiJson.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderSection();
    await user.click(openButton());
    expect(await screen.findByText(t('best_efforts.analysis_loading'))).toBeInTheDocument();
  });

  it('says so, with a way to try again, when it cannot be loaded', async () => {
    served = new Error('down');
    const user = userEvent.setup();
    renderSection();
    await user.click(openButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(t('best_efforts.analysis_error'));

    served = analysis();
    await user.click(screen.getByRole('button', { name: t('best_efforts.retry') }));
    expect(await screen.findByText(t('best_efforts.analysis_lifetime'))).toBeInTheDocument();
  });

  it('says there is nothing yet for a runner with no best efforts, and shows no selectors', async () => {
    served = NO_EFFORTS_ANALYSIS;
    const user = userEvent.setup();
    renderSection();
    await user.click(openButton());
    expect(await screen.findByText(t('best_efforts.analysis_empty'))).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('says none yet for a year with no efforts, instead of an empty list', async () => {
    served = analysis({ annual: [] });
    const user = userEvent.setup();
    renderSection();
    await user.click(openButton());
    expect(await screen.findByText(t('best_efforts.analysis_none_this_year'))).toBeInTheDocument();
  });

  it('warns that places may change while runs are still being analysed', async () => {
    served = analysis({ complete: false });
    const user = userEvent.setup();
    renderSection();
    await user.click(openButton());
    expect(await screen.findByText(t('best_efforts.incomplete'))).toBeInTheDocument();
  });

  it('keeps the earlier numbers and says the refresh failed when choosing another year fails', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(openButton());
    const year = await screen.findByRole('combobox', { name: t('best_efforts.analysis_year') });

    served = new Error('down');
    await user.selectOptions(year, '2025');
    expect(await screen.findByText(new RegExp(t('best_efforts.analysis_switch_failed').slice(0, 25)))).toBeInTheDocument();
    // The earlier numbers stay, and so does the earlier choice in the selector.
    expect(screen.getByText(t('best_efforts.analysis_lifetime'))).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t('best_efforts.analysis_year') })).toHaveValue('2026');

    served = (url) => (url.includes('year=2025') ? analysis({ year: 2025 }) : analysis());
    await user.click(screen.getByRole('button', { name: t('best_efforts.retry') }));
    expect(await screen.findByRole('heading', { name: 'Best of 2025' })).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(t('best_efforts.analysis_switch_failed').slice(0, 25)))).not.toBeInTheDocument();
  });
});

describe('units and language', () => {
  it('writes the pace per mile when the runner uses miles', async () => {
    state.unit = 'mile';
    const user = userEvent.setup();
    renderSection();
    await user.click(openButton());
    const lifetime = (await screen.findByRole('heading', { name: t('best_efforts.analysis_lifetime') })).closest('.hd-records-block');
    // 258 s per km is 415 s per mile.
    expect(within(lifetime).getAllByRole('listitem')[0]).toHaveTextContent('6:55 /mi');
  });

  it('speaks Chinese when the language is Chinese', async () => {
    state.lang = 'zh-CN';
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole('button', { name: t('best_efforts.analysis_open') }));
    expect(await screen.findByRole('heading', { name: '历史最好' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2026 年最好' })).toBeInTheDocument();
    const distance = screen.getByRole('combobox', { name: '距离' });
    expect(within(distance).getAllByRole('option').map((option) => option.textContent)).toEqual(['1 公里', '5 公里', '10 公里']);
  });
});
