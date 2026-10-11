import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../api';
import en from '../../i18n/locales/en';
import zh from '../../i18n/locales/zh-CN';
import RunGoalsCard from './RunGoalsCard';
import { goal, reachedGoal, response } from './goalFixtures';

const state = vi.hoisted(() => ({ lang: 'en' }));
const t = (key, params = {}) => {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};

vi.mock('../../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({
    lang: state.lang,
    t,
    formatNumber: (value, options) => new Intl.NumberFormat(state.lang === 'zh-CN' ? 'zh-CN' : 'en-US', options).format(value),
  }),
}));
vi.mock('../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'km', isMile: false }) }));

let served;
const renderCard = (runId = 42) => render(<MemoryRouter><RunGoalsCard runId={runId} /></MemoryRouter>);

beforeEach(() => {
  state.lang = 'en';
  served = response([goal({ id: 1, thisRun: 12.4 }), reachedGoal({ id: 2, thisRun: 1 })]);
  apiJson.mockReset();
  apiJson.mockImplementation(async () => {
    if (served instanceof Error) throw served;
    return served;
  });
});
afterEach(() => cleanup());

describe('the card on the run page', () => {
  it('asks for the goals with the run named, and for nothing else', async () => {
    renderCard(42);
    await screen.findByRole('region', { name: t('goals.title') });

    expect(apiJson.mock.calls.map(([url]) => url)).toEqual(['/api/goals?runId=42']);
  });

  it('is a region named after its title, busy with a skeleton until the goals arrive', async () => {
    const { container } = renderCard();

    expect(screen.getByRole('region', { name: t('goals.title') })).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('.goals-v2__skeleton')).toHaveAttribute('aria-hidden', 'true');
    await screen.findAllByRole('progressbar');
    expect(screen.getByRole('region', { name: t('goals.title') })).not.toHaveAttribute('aria-busy');
  });

  it('shows each goal as a bar with its numbers and what this run adds to it, and nothing to change', async () => {
    renderCard();
    await screen.findAllByRole('progressbar');

    const week = screen.getByRole('heading', { name: 'Weekly distance' }).closest('li');
    expect(within(week).getByText('23 km of 70 km this week')).toBeInTheDocument();
    expect(within(week).getByText('This run adds 12.4 km.')).toBeInTheDocument();
    const month = screen.getByRole('heading', { name: 'Monthly runs' }).closest('li');
    expect(within(month).getByText('This run adds 1 run.')).toBeInTheDocument();
    expect(within(month).getByText(t('goals.status_reached'))).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 3, name: t('goals.title') })).toBeInTheDocument();
  });

  it('leaves the working to the full card: no pace sentences and no last period', async () => {
    renderCard();
    await screen.findAllByRole('progressbar');

    expect(screen.queryByText(/even pace/)).not.toBeInTheDocument();
    expect(screen.queryByText(/to go/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Last week/)).not.toBeInTheDocument();
  });

  it('says nothing about this run for a goal it does not add to', async () => {
    served = response([goal({ id: 1, thisRun: null })]);
    renderCard();
    await screen.findAllByRole('progressbar');

    expect(screen.queryByText(/This run adds/)).not.toBeInTheDocument();
  });

  it('links to where goals are managed', async () => {
    renderCard();
    await screen.findAllByRole('progressbar');

    expect(screen.getByRole('link', { name: t('goals.manage') })).toHaveAttribute('href', '/training-log');
  });

  it('invites a runner with no goals to set one, without a bar', async () => {
    served = response([]);
    renderCard();

    expect(await screen.findByText(t('goals.empty_body'))).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('goals.add') })).toHaveAttribute('href', '/training-log');
  });

  it('says so, with a way to try again, when the goals cannot be loaded', async () => {
    served = new Error('boom');
    renderCard();

    expect(await screen.findByRole('alert')).toHaveTextContent(t('goals.error'));
    served = response([goal({ id: 1 })]);
    await userEvent.click(screen.getByRole('button', { name: t('goals.retry') }));

    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
  });

  it('speaks Chinese', async () => {
    state.lang = 'zh-CN';
    renderCard();

    const week = (await screen.findByRole('heading', { name: '每周距离' })).closest('li');
    expect(within(week).getByText('这次跑步贡献了 12.4 公里。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '管理你的目标' })).toBeInTheDocument();
  });
});
