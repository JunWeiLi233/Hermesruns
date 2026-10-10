import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../api';
import en from '../../i18n/locales/en';
import zh from '../../i18n/locales/zh-CN';
import GoalsCard from './GoalsCard';
import { earlyGoal, goal, reachedGoal, response } from './goalFixtures';

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

let server;       // the goals the pretend server holds
let sent;         // every change the card sent: { method, url, body }
let failing;      // 'METHOD url' -> an error to throw

const fail = (status) => Object.assign(new Error(`failed ${status}`), { status });
const goalCalls = () => apiJson.mock.calls.filter(([url]) => String(url).startsWith('/api/goals'));

beforeEach(() => {
  state.lang = 'en';
  state.unit = 'km';
  server = [goal({ id: 1 })];
  sent = [];
  failing = new Map();
  apiJson.mockReset();
  apiJson.mockImplementation(async (url, options = {}) => {
    const method = options.method || 'GET';
    const key = `${method} ${url}`;
    if (failing.has(key)) throw failing.get(key);
    if (method === 'GET') return response(server);
    const body = options.body ? JSON.parse(options.body) : null;
    sent.push({ method, url, body });
    if (method === 'POST') {
      if (server.some((existing) => existing.period === body.period && existing.metric === body.metric)) throw fail(409);
      server = [...server, goal({ id: 100 + server.length, period: body.period, metric: body.metric, target: body.target })];
    } else if (method === 'PUT') {
      server = server.map((existing) => (existing.id === Number(url.split('/').pop()) ? { ...existing, target: body.target } : existing));
    } else if (method === 'DELETE') {
      server = server.filter((existing) => existing.id !== Number(url.split('/').pop()));
    }
    return response(server);
  });
});
afterEach(() => {
  cleanup();
  delete window.requestIdleCallback;
  delete window.cancelIdleCallback;
});

const renderCard = (props = {}) => render(<GoalsCard {...props} />);
const card = () => screen.findByRole('region', { name: t('goals.title') });
const rowOf = (title) => screen.getByRole('heading', { name: title }).closest('li');

describe('loading and failing', () => {
  it('is a region named after its title, busy with a skeleton until the goals arrive', async () => {
    const { container } = renderCard();

    expect(screen.getByRole('region', { name: t('goals.title') })).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('.goals-v2__skeleton')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getAllByRole('status').some((node) => node.textContent === t('goals.loading'))).toBe(true);
    expect(screen.queryByRole('button', { name: t('goals.add') })).not.toBeInTheDocument();

    expect(await screen.findByRole('button', { name: t('goals.add') })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: t('goals.title') })).not.toHaveAttribute('aria-busy');
    expect(goalCalls()).toHaveLength(1);
  });

  it('says so, with a way to try again, when the goals cannot be loaded', async () => {
    failing.set('GET /api/goals', fail(500));
    renderCard();

    expect(await screen.findByRole('alert')).toHaveTextContent(t('goals.error'));
    expect(screen.queryByRole('button', { name: t('goals.add') })).not.toBeInTheDocument();
    failing.clear();
    await userEvent.click(screen.getByRole('button', { name: t('goals.retry') }));

    expect(await screen.findByRole('button', { name: t('goals.add') })).toBeInTheDocument();
    expect(screen.queryByText(t('goals.error'))).not.toBeInTheDocument();
  });

  it('treats an answer without the parts it draws as a failed load', async () => {
    apiJson.mockImplementation(async () => ({ goals: 'none' }));
    renderCard();
    expect(await screen.findByRole('alert')).toHaveTextContent(t('goals.error'));
  });

  it('waits for the browser to be idle before asking, when it is told to', async () => {
    let idle;
    window.requestIdleCallback = (callback) => { idle = callback; return 7; };
    window.cancelIdleCallback = vi.fn();
    renderCard({ defer: true });

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(goalCalls()).toHaveLength(0);
    expect(screen.getByRole('region', { name: t('goals.title') })).toHaveAttribute('aria-busy', 'true');

    idle();
    expect(await screen.findByRole('button', { name: t('goals.add') })).toBeInTheDocument();
    expect(goalCalls()).toHaveLength(1);
  });
});

describe('the list', () => {
  it('says what goals are for when there are none, and offers to set one', async () => {
    server = [];
    renderCard();

    expect(await screen.findByText(t('goals.empty_title'))).toBeInTheDocument();
    expect(screen.getByText(t('goals.empty_body'))).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: t('goals.list_label') })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('goals.add') })).toBeInTheDocument();
    expect(screen.queryByText(t('goals.basis'))).not.toBeInTheDocument();
  });

  it('lists the goals by period and then metric, each under a heading of its name', async () => {
    server = [
      goal({ id: 1, period: 'YEAR', metric: 'DISTANCE', target: 1000, progress: 400, percent: 40 }),
      goal({ id: 2, period: 'WEEK', metric: 'COUNT', unit: 'runs', target: 5, progress: 3, percent: 60 }),
      goal({ id: 3, period: 'WEEK', metric: 'DISTANCE' }),
    ];
    renderCard();
    await card();

    const list = screen.getByRole('list', { name: t('goals.list_label') });
    expect(within(list).getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['Weekly distance', 'Weekly runs', 'Yearly distance']);
    expect(screen.getByRole('heading', { level: 2, name: t('goals.title') })).toBeInTheDocument();
    expect(within(list).getAllByRole('heading').every((heading) => heading.tagName === 'H3')).toBe(true);
  });

  it('draws a goal as a bar with the numbers it is made of', async () => {
    renderCard();
    await card();

    const row = rowOf('Weekly distance');
    const bar = within(row).getByRole('progressbar');
    expect(bar).toHaveAccessibleName('Weekly distance: 23 km of 70 km');
    expect(bar).toHaveAttribute('aria-valuenow', '32');
    expect(bar).toHaveAttribute('aria-valuetext', '23 km / 70 km, 32%');
    expect(bar.querySelector('i').style.width).toBe(`${(23 / 70) * 100}%`);
    expect(within(row).getByText('23 km of 70 km this week')).toBeInTheDocument();
    expect(within(row).getByText('32%')).toBeInTheDocument();
    expect(within(row).getByText(t('goals.status_behind'))).toHaveClass('is-behind');
  });

  it('shows the working: where an even pace would be, what is left and how last week went', async () => {
    renderCard();
    await card();

    const row = rowOf('Weekly distance');
    expect(within(row).getByText('On an even pace you would have 20 km by the start of today. You had 15 km.')).toBeInTheDocument();
    expect(within(row).getByText('47 km to go in 5 days, about 9.4 km a day.')).toBeInTheDocument();
    expect(within(row).getByText('Last week: 63 km of 70 km, goal not reached.')).toBeInTheDocument();
  });

  it('says there is no full day to judge by yet on the first day, and leaves out last period when there was nothing', async () => {
    server = [earlyGoal()];
    renderCard();
    await card();

    const row = rowOf('Yearly climb');
    expect(within(row).getByText(t('goals.status_early'))).toHaveClass('is-early');
    expect(within(row).getByText('A new year has begun, so there is no full day to judge by yet.')).toBeInTheDocument();
    expect(within(row).queryByText(/Last year/)).not.toBeInTheDocument();
    expect(within(row).getByText('20,000 m to go in 365 days, about 55 m a day.')).toBeInTheDocument();
  });

  it('says a goal is reached, with nothing left to do and last month as it was', async () => {
    server = [reachedGoal()];
    renderCard();
    await card();

    const row = rowOf('Monthly runs');
    expect(within(row).getByText(t('goals.status_reached'))).toHaveClass('is-reached');
    expect(within(row).getByText('14 runs of 12 runs this month')).toBeInTheDocument();
    expect(within(row).getByText('116%')).toBeInTheDocument();
    expect(within(row).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(within(row).getByRole('progressbar').querySelector('i').style.width).toBe('100%');
    expect(within(row).queryByText(/to go/)).not.toBeInTheDocument();
    expect(within(row).queryByText(/even pace/)).not.toBeInTheDocument();
    expect(within(row).getByText('Last month: 13 runs of 12 runs, goal reached.')).toBeInTheDocument();
  });

  it('says what is left on the last day without a per-day figure, and for runs without one at all', async () => {
    server = [
      goal({ id: 1, daysLeft: 1, remaining: 12, neededPerDay: 12, progress: 58, percent: 82 }),
      goal({ id: 2, metric: 'COUNT', unit: 'runs', target: 5, progress: 3, percent: 60, remaining: 2, daysLeft: 5, neededPerDay: 0.4 }),
      goal({ id: 3, period: 'MONTH', metric: 'COUNT', unit: 'runs', target: 12, progress: 11, percent: 91, remaining: 1, daysLeft: 1, neededPerDay: 1 }),
    ];
    renderCard();
    await card();

    expect(within(rowOf('Weekly distance')).getByText('12 km to go, and today is the last day.')).toBeInTheDocument();
    expect(within(rowOf('Weekly runs')).getByText('2 runs to go in 5 days.')).toBeInTheDocument();
    expect(within(rowOf('Monthly runs')).getByText('1 run to go, and today is the last day.')).toBeInTheDocument();
  });

  it('writes the amounts in the miles and hours the runner counts in', async () => {
    state.unit = 'mile';
    server = [
      goal({ id: 1, target: 80.47, progress: 40.23, expectedByNow: 32.19, doneByNow: 30, remaining: 40.24, neededPerDay: 8.05, percent: 50 }),
      goal({ id: 2, metric: 'TIME', unit: 's', target: 21600, progress: 7200, remaining: 14400, neededPerDay: 2880, expectedByNow: 6171, doneByNow: 6000, percent: 33 }),
    ];
    renderCard();
    await card();

    expect(within(rowOf('Weekly distance')).getByText('25 mi of 50 mi this week')).toBeInTheDocument();
    expect(within(rowOf('Weekly time')).getByText('2 h 0 min of 6 h 0 min this week')).toBeInTheDocument();
    expect(within(rowOf('Weekly time')).getByText('4 h 0 min to go in 5 days, about 48 min a day.')).toBeInTheDocument();
  });

  it('says how the pace is judged, once, under the list', async () => {
    renderCard();
    await card();
    expect(screen.getAllByText(t('goals.basis'))).toHaveLength(1);
  });
});

describe('setting a goal', () => {
  // The runner starts with no goals unless a test says otherwise.
  async function open(existing = []) {
    server = existing;
    renderCard();
    await userEvent.click(await screen.findByRole('button', { name: t('goals.add') }));
    return screen.findByRole('dialog', { name: t('goals.form_add_title') });
  }

  it('opens a dialog with the periods, what to aim for and the target, starting on a weekly distance goal', async () => {
    const dialog = await open();

    expect(within(dialog).getByRole('group', { name: t('goals.form_period') })).toBeInTheDocument();
    expect(within(dialog).getAllByRole('radio').map((radio) => radio.closest('label').textContent))
      .toEqual(['Weekly', 'Monthly', 'Yearly', 'Distance', 'Time', 'Runs', 'Climb']);
    expect(within(dialog).getByRole('radio', { name: 'Weekly' })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'Distance' })).toBeChecked();
    expect(within(dialog).getByRole('textbox', { name: t('goals.form_target') })).toHaveFocus();
    expect(within(dialog).getByText('kilometres')).toBeInTheDocument();
  });

  it('sends the period, the metric and the target as typed, then closes and shows the new goal', async () => {
    const dialog = await open();

    await userEvent.click(within(dialog).getByRole('radio', { name: 'Monthly' }));
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Runs' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: t('goals.form_target') }), '12');
    await userEvent.click(within(dialog).getByRole('button', { name: t('goals.save') }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(sent).toEqual([{ method: 'POST', url: '/api/goals', body: { period: 'MONTH', metric: 'COUNT', target: 12 } }]);
    expect(await screen.findByRole('heading', { name: 'Monthly runs' })).toBeInTheDocument();
    expect(screen.getAllByRole('status').some((node) => node.textContent === t('goals.saved'))).toBe(true);
  });

  it('turns miles into kilometres and hours into seconds on the way out', async () => {
    state.unit = 'mile';
    const dialog = await open();
    expect(within(dialog).getByText('miles')).toBeInTheDocument();

    await userEvent.type(within(dialog).getByRole('textbox', { name: t('goals.form_target') }), '26,2');
    await userEvent.click(within(dialog).getByRole('button', { name: t('goals.save') }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].body).toEqual({ period: 'WEEK', metric: 'DISTANCE', target: 42.16 });
  });

  it('asks for hours for a time goal, with a word of help, and sends seconds', async () => {
    const dialog = await open();

    await userEvent.click(within(dialog).getByRole('radio', { name: 'Time' }));
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Yearly' }));
    expect(within(dialog).getByText('hours')).toBeInTheDocument();
    const box = within(dialog).getByRole('textbox', { name: t('goals.form_target') });
    expect(box.getAttribute('aria-describedby')).toContain(within(dialog).getByText(t('goals.form_hint_TIME')).id);
    await userEvent.type(box, '200.5');
    await userEvent.click(within(dialog).getByRole('button', { name: t('goals.save') }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].body).toEqual({ period: 'YEAR', metric: 'TIME', target: 721800 });
  });

  it.each([
    ['nothing', '', 'goals.error_empty'],
    ['spaces', '   ', 'goals.error_empty'],
    ['words', 'lots', 'goals.error_number'],
    ['zero', '0', 'goals.error_number'],
    ['a negative number', '-5', 'goals.error_number'],
    ['a number with a unit', '5 km', 'goals.error_number'],
  ])('refuses %s, says why next to the box and sends nothing', async (_name, text, key) => {
    const dialog = await open();
    const box = within(dialog).getByRole('textbox', { name: t('goals.form_target') });

    if (text) await userEvent.type(box, text);
    await userEvent.click(within(dialog).getByRole('button', { name: t('goals.save') }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(t(key));
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(sent).toEqual([]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('refuses a target above the most a goal can be, naming the most in the runner\'s unit', async () => {
    const dialog = await open();

    await userEvent.type(within(dialog).getByRole('textbox', { name: t('goals.form_target') }), '100001');
    await userEvent.click(within(dialog).getByRole('button', { name: t('goals.save') }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The most is 100,000 km.');
    expect(sent).toEqual([]);
  });

  it('clears the message as soon as the runner types again', async () => {
    const dialog = await open();
    const box = within(dialog).getByRole('textbox', { name: t('goals.form_target') });
    await userEvent.click(within(dialog).getByRole('button', { name: t('goals.save') }));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();

    await userEvent.type(box, '4');

    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(box).not.toHaveAttribute('aria-invalid');
  });

  it('starts on the first period and metric the runner has no goal for', async () => {
    const dialog = await open([goal({ id: 1 }), goal({ id: 2, metric: 'TIME', unit: 's' })]);

    expect(within(dialog).getByRole('radio', { name: 'Weekly' })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'Runs' })).toBeChecked();
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: t('goals.save') })).toBeEnabled();
  });

  it('says a goal for that period and metric exists already, before anything is sent, and cannot be saved', async () => {
    const dialog = await open([goal({ id: 1 })]);
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Distance' }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent('You already have a goal for Weekly distance. Change its target in the list instead.');
    expect(within(dialog).getByRole('button', { name: t('goals.save') })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Runs' }));
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: t('goals.save') })).toBeEnabled();
  });

  it('does not send a goal that exists even when the form is submitted some other way than the button', async () => {
    const dialog = await open([goal({ id: 1 })]);
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Distance' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: t('goals.form_target') }), '55');

    fireEvent.submit(dialog.querySelector('form'));

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sent).toEqual([]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('says so, and stays open with what was typed, when the server says the goal exists after all', async () => {
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Runs' }));
    server = [goal({ id: 9, metric: 'COUNT' })];     // set meanwhile, somewhere else
    await userEvent.type(within(dialog).getByRole('textbox', { name: t('goals.form_target') }), '4');

    await userEvent.click(within(dialog).getByRole('button', { name: t('goals.save') }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('You already have a goal for Weekly runs');
    expect(within(dialog).getByRole('textbox', { name: t('goals.form_target') })).toHaveValue('4');
  });

  it('says the goal could not be saved, and stays open, when the request fails', async () => {
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Runs' }));
    failing.set('POST /api/goals', fail(500));
    await userEvent.type(within(dialog).getByRole('textbox', { name: t('goals.form_target') }), '4');

    await userEvent.click(within(dialog).getByRole('button', { name: t('goals.save') }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(t('goals.save_failed'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: t('goals.save') })).toBeEnabled();
  });

  it('closes with Escape or Cancel, saves nothing and gives the keyboard back to the button that opened it', async () => {
    const dialog = await open();
    await userEvent.type(within(dialog).getByRole('textbox', { name: t('goals.form_target') }), '5');

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('goals.add') })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: t('goals.add') }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: t('goals.cancel') }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it('disables the button while it saves, so one press is one goal', async () => {
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Runs' }));
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const original = apiJson.getMockImplementation();
    apiJson.mockImplementation(async (url, options) => {
      if (options?.method === 'POST') await gate;
      return original(url, options);
    });
    await userEvent.type(within(dialog).getByRole('textbox', { name: t('goals.form_target') }), '4');

    await userEvent.click(within(dialog).getByRole('button', { name: t('goals.save') }));
    expect(within(dialog).getByRole('button', { name: t('goals.saving') })).toBeDisabled();
    release();

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(sent.filter((call) => call.method === 'POST')).toHaveLength(1);
  });
});

describe('changing a target', () => {
  it('opens with the current target and nothing else to change, and sends only the target', async () => {
    renderCard();
    await card();

    await userEvent.click(screen.getByRole('button', { name: 'Change the target of Weekly distance' }));

    const dialog = await screen.findByRole('dialog', { name: 'Change the target of Weekly distance' });
    expect(within(dialog).queryAllByRole('radio')).toHaveLength(0);
    const box = within(dialog).getByRole('textbox', { name: t('goals.form_target') });
    expect(box).toHaveValue('70');
    await userEvent.clear(box);
    await userEvent.type(box, '80');
    await userEvent.click(within(dialog).getByRole('button', { name: t('goals.save') }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(sent).toEqual([{ method: 'PUT', url: '/api/goals/1', body: { target: 80 } }]);
    expect(within(rowOf('Weekly distance')).getByText(/of 80 km this week/)).toBeInTheDocument();
  });

  it('shows the target in miles for a runner who counts in miles, and keeps it when it is not changed', async () => {
    state.unit = 'mile';
    server = [goal({ id: 1, target: 80.47 })];
    renderCard();
    await card();

    await userEvent.click(screen.getByRole('button', { name: 'Change the target of Weekly distance' }));

    expect(within(await screen.findByRole('dialog')).getByRole('textbox', { name: t('goals.form_target') })).toHaveValue('50');
  });

  it('refuses a target that is not a number and leaves the goal as it was', async () => {
    renderCard();
    await card();
    await userEvent.click(screen.getByRole('button', { name: 'Change the target of Weekly distance' }));
    const dialog = await screen.findByRole('dialog');
    const box = within(dialog).getByRole('textbox', { name: t('goals.form_target') });

    await userEvent.clear(box);
    await userEvent.type(box, 'many');
    await userEvent.click(within(dialog).getByRole('button', { name: t('goals.save') }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(t('goals.error_number'));
    expect(sent).toEqual([]);
  });
});

describe('deleting a goal', () => {
  it('asks once, in the row, and deletes only on a yes', async () => {
    renderCard();
    await card();

    await userEvent.click(screen.getByRole('button', { name: 'Delete Weekly distance' }));

    const row = rowOf('Weekly distance');
    expect(within(row).getByText(t('goals.delete_confirm'))).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /Change the target/ })).not.toBeInTheDocument();
    expect(sent).toEqual([]);

    await userEvent.click(within(row).getByRole('button', { name: t('goals.delete_keep') }));
    expect(within(rowOf('Weekly distance')).getByRole('button', { name: 'Delete Weekly distance' })).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it('deletes the goal, shows the list without it, and puts the keyboard on the button that sets another', async () => {
    server = [goal({ id: 1 }), goal({ id: 2, period: 'YEAR', metric: 'DISTANCE', target: 1000 })];
    renderCard();
    await card();
    await userEvent.click(screen.getByRole('button', { name: 'Delete Weekly distance' }));

    await userEvent.click(screen.getByRole('button', { name: t('goals.delete_yes') }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Weekly distance' })).not.toBeInTheDocument());
    expect(sent).toEqual([{ method: 'DELETE', url: '/api/goals/1', body: null }]);
    expect(screen.getByRole('heading', { name: 'Yearly distance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('goals.add') })).toHaveFocus();
    expect(screen.getAllByRole('status').some((node) => node.textContent === t('goals.deleted'))).toBe(true);
  });

  it('shows the empty state again when the last goal goes', async () => {
    renderCard();
    await card();
    await userEvent.click(screen.getByRole('button', { name: 'Delete Weekly distance' }));
    await userEvent.click(screen.getByRole('button', { name: t('goals.delete_yes') }));

    expect(await screen.findByText(t('goals.empty_title'))).toBeInTheDocument();
  });

  it('says it could not delete, and leaves the goal in place, when the request fails', async () => {
    renderCard();
    await card();
    failing.set('DELETE /api/goals/1', fail(500));
    await userEvent.click(screen.getByRole('button', { name: 'Delete Weekly distance' }));

    await userEvent.click(screen.getByRole('button', { name: t('goals.delete_yes') }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t('goals.delete_failed'));
    expect(screen.getByRole('heading', { name: 'Weekly distance' })).toBeInTheDocument();
    expect(within(rowOf('Weekly distance')).getByRole('button', { name: 'Delete Weekly distance' })).toBeInTheDocument();
  });
});

describe('in Chinese', () => {
  it('speaks Chinese everywhere, in the dialog too', async () => {
    state.lang = 'zh-CN';
    server = [goal({ id: 1 })];
    renderCard();
    await screen.findByRole('region', { name: '目标' });

    const row = screen.getByRole('heading', { name: '每周距离' }).closest('li');
    expect(within(row).getByText('进度落后')).toBeInTheDocument();
    expect(within(row).getByText('本周已完成 23 公里，目标 70 公里')).toBeInTheDocument();
    expect(within(row).getByText('按均匀的进度，到今天开始时你应已完成 20 公里，实际完成 15 公里。')).toBeInTheDocument();
    expect(within(row).getByText('上周：70 公里 中的 63 公里，未达成。')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '设定目标' }));
    const dialog = await screen.findByRole('dialog', { name: '设定目标' });
    expect(within(dialog).getByRole('radio', { name: '每月' })).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: '爬升' })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('radio', { name: '距离' }));
    expect(within(dialog).getByText('公里')).toBeInTheDocument();
  });
});
