import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../api';
import en from '../../i18n/locales/en';
import zh from '../../i18n/locales/zh-CN';
import GoalsCard from './GoalsCard';
import { goal, response } from './goalFixtures';

const state = vi.hoisted(() => ({ lang: 'en', unit: 'km' }));
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
vi.mock('../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: state.unit, isMile: state.unit === 'mile' }) }));

const weekly = { period: 'WEEK', metric: 'DISTANCE', unit: 'km', target: 35, basis: { kind: 'weekly-average', span: 8, usual: 30, stretchPercent: 10 } };
const runsPerWeek = { period: 'WEEK', metric: 'COUNT', unit: 'runs', target: 3, basis: { kind: 'weekly-average', span: 8, usual: 3.2, stretchPercent: 0 } };
const monthly = { period: 'MONTH', metric: 'DISTANCE', unit: 'km', target: 140, basis: { kind: 'monthly-average', span: 3, usual: 126, stretchPercent: 10 } };
const yearly = { period: 'YEAR', metric: 'DISTANCE', unit: 'km', target: 1650, basis: { kind: 'yearly-total', span: 365, usual: 1570, stretchPercent: 5 } };

let server;       // the goals the pretend server holds
let suggestions;  // what the pretend server suggests: { enough, suggestions }
let sent;         // every change the card sent: { method, url, body }
let failing;      // 'METHOD url' -> an error to throw

const fail = (status) => Object.assign(new Error(`failed ${status}`), { status });

beforeEach(() => {
  state.lang = 'en';
  state.unit = 'km';
  server = [];
  suggestions = { enough: true, suggestions: [] };
  sent = [];
  failing = new Map();
  apiJson.mockReset();
  apiJson.mockImplementation(async (url, options = {}) => {
    const method = options.method || 'GET';
    if (failing.has(`${method} ${url}`)) throw failing.get(`${method} ${url}`);
    if (method === 'GET' && String(url) === '/api/goals/suggestions') {
      // A goal the runner has is not suggested, as on the server.
      return {
        today: '2026-10-07',
        timeZone: 'Z',
        enough: suggestions.enough,
        suggestions: suggestions.suggestions.filter((s) => !server.some((g) => g.period === s.period && g.metric === s.metric)),
      };
    }
    if (method === 'GET') return response(server);
    const body = options.body ? JSON.parse(options.body) : null;
    sent.push({ method, url, body });
    if (method === 'POST') {
      server = [...server, goal({ id: 100 + server.length, period: body.period, metric: body.metric, target: body.target })];
    }
    return response(server);
  });
});
afterEach(() => cleanup());

const suggested = () => screen.findByRole('region', { name: t('goals.suggest_title') });

describe('suggested goals', () => {
  it("offers goals from the runner's own running, each with the working behind it", async () => {
    suggestions = { enough: true, suggestions: [weekly, runsPerWeek, monthly] };
    render(<GoalsCard />);

    const block = await suggested();
    expect(within(block).getByRole('heading', { name: t('goals.suggest_title') })).toBeInTheDocument();
    const items = within(block).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Weekly distance: 35 km');
    expect(items[0]).toHaveTextContent('Your usual week over the 8 weeks you ran lately: 30 km. This is 10% more.');
    expect(items[1]).toHaveTextContent('Weekly runs: 3 runs');
    expect(items[1]).toHaveTextContent('Your usual week over the 8 weeks you ran lately: 3.2 runs. This keeps it up.');
    expect(items[2]).toHaveTextContent('Monthly distance: 140 km');
    expect(items[2]).toHaveTextContent('Your usual month over the last 3 months: 126 km. This is 10% more.');
  });

  it('shows three at a time', async () => {
    suggestions = { enough: true, suggestions: [weekly, runsPerWeek, monthly, yearly] };
    render(<GoalsCard />);

    expect(within(await suggested()).getAllByRole('listitem')).toHaveLength(3);
  });

  it('sets a suggestion as it is, says so, and takes it off the list', async () => {
    suggestions = { enough: true, suggestions: [weekly, runsPerWeek] };
    render(<GoalsCard />);
    const block = await suggested();

    await userEvent.click(within(block).getByRole('button', { name: 'Set the goal Weekly distance: 35 km' }));

    await waitFor(() => expect(sent).toEqual([{ method: 'POST', url: '/api/goals', body: { period: 'WEEK', metric: 'DISTANCE', target: 35 } }]));
    expect(await screen.findByRole('heading', { name: 'Weekly distance' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('region', { name: t('goals.suggest_title') })).not.toHaveTextContent('Weekly distance: 35 km'));
    expect(screen.getAllByRole('status').some((node) => node.textContent === t('goals.saved'))).toBe(true);
  });

  it('opens the dialog with the suggestion filled in for adjusting, and saves what is typed', async () => {
    suggestions = { enough: true, suggestions: [weekly] };
    render(<GoalsCard />);
    const block = await suggested();

    await userEvent.click(within(block).getByRole('button', { name: 'Adjust the suggested goal Weekly distance before setting it' }));

    const dialog = await screen.findByRole('dialog', { name: t('goals.form_add_title') });
    expect(within(dialog).getByRole('radio', { name: 'Weekly' })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'Distance' })).toBeChecked();
    expect(within(dialog).getByLabelText(t('goals.form_target'))).toHaveValue('35');
    await userEvent.clear(within(dialog).getByLabelText(t('goals.form_target')));
    await userEvent.type(within(dialog).getByLabelText(t('goals.form_target')), '32');
    await userEvent.click(within(dialog).getByRole('button', { name: t('goals.save') }));

    await waitFor(() => expect(sent).toEqual([{ method: 'POST', url: '/api/goals', body: { period: 'WEEK', metric: 'DISTANCE', target: 32 } }]));
  });

  it('writes the target and the working in miles for a runner who counts in miles', async () => {
    state.unit = 'mile';
    suggestions = { enough: true, suggestions: [weekly] };
    render(<GoalsCard />);
    const block = await suggested();

    expect(block).toHaveTextContent('Weekly distance: 21.7 mi');
    expect(block).toHaveTextContent('Your usual week over the 8 weeks you ran lately: 18.6 mi.');
    await userEvent.click(within(block).getByRole('button', { name: /Adjust the suggested goal/ }));
    expect(within(await screen.findByRole('dialog')).getByLabelText(t('goals.form_target'))).toHaveValue('21.75');
  });

  it('says what it takes when there is not enough running to go on, and offers nothing', async () => {
    suggestions = { enough: false, suggestions: [] };
    render(<GoalsCard />);

    expect(await screen.findByText(t('goals.suggest_need_history'))).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t('goals.suggest_title') })).not.toBeInTheDocument();
  });

  it('says nothing when every suggestion is already a goal', async () => {
    server = [goal({ id: 1 })];
    suggestions = { enough: true, suggestions: [weekly] };
    render(<GoalsCard />);
    await screen.findByRole('region', { name: t('goals.title') });
    await screen.findByRole('heading', { name: 'Weekly distance' });

    expect(screen.queryByRole('region', { name: t('goals.suggest_title') })).not.toBeInTheDocument();
    expect(screen.queryByText(t('goals.suggest_need_history'))).not.toBeInTheDocument();
  });

  it('says nothing, and no error, when the suggestions cannot be loaded; the goals still show', async () => {
    server = [goal({ id: 1 })];
    failing.set('GET /api/goals/suggestions', fail(500));
    render(<GoalsCard />);

    expect(await screen.findByRole('heading', { name: 'Weekly distance' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t('goals.suggest_title') })).not.toBeInTheDocument();
  });

  it('says so when the goal exists by the time it is set (another tab)', async () => {
    suggestions = { enough: true, suggestions: [weekly] };
    render(<GoalsCard />);
    const block = await suggested();
    failing.set('POST /api/goals', fail(409));

    await userEvent.click(within(block).getByRole('button', { name: /Set the goal Weekly distance/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t('goals.suggest_taken'));
  });

  it('speaks Chinese', async () => {
    state.lang = 'zh-CN';
    suggestions = { enough: true, suggestions: [weekly, yearly] };
    render(<GoalsCard />);

    const block = await screen.findByRole('region', { name: '为你推荐' });
    expect(block).toHaveTextContent('每周距离：35 公里');
    expect(block).toHaveTextContent('你最近跑了 8 周，平常一周是 30 公里。这个目标多 10%。');
    expect(block).toHaveTextContent('每年距离：1,650 公里');
    expect(block).toHaveTextContent('你最近 12 个月跑了 1,570 公里。这个目标多 5%。');
    expect(within(block).getAllByRole('button', { name: /采用建议目标/ })).toHaveLength(2);
    // The card's own button for setting a goal is still the only one with that name.
    expect(screen.getAllByRole('button', { name: '设定目标', exact: true })).toHaveLength(1);
  });
});
