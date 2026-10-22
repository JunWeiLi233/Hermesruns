import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import { invalidateResourceCache } from '../../../api/resourceCache';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import RunBestEfforts from '../RunBestEfforts';
import { effort, runEfforts } from './recordsFixtures';

const state = vi.hoisted(() => ({ lang: 'en' }));
const t = (key, params = {}) => {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};

vi.mock('../../../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ invalidateResourceCache: vi.fn(), cachedApiJson: vi.fn() }));
vi.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    lang: state.lang,
    t,
    formatNumber: (value, options) => new Intl.NumberFormat(state.lang === 'zh-CN' ? 'zh-CN' : 'en-US', options).format(value),
  }),
}));

const URL = '/api/activities/9/best-efforts';
let served;
let patchResult;
const reads = () => apiJson.mock.calls.filter(([url, options]) => url === URL && !options?.method);
const patches = () => apiJson.mock.calls.filter(([, options]) => options?.method === 'PATCH');
const rowOf = (name) => screen.getByRole('row', { name: new RegExp(name) });

function renderCard(props = {}) {
  return render(<RunBestEfforts runId={9} streamReady {...props} />);
}

beforeEach(() => {
  state.lang = 'en';
  served = runEfforts();
  patchResult = null;
  apiJson.mockReset();
  invalidateResourceCache.mockReset();
  apiJson.mockImplementation(async (url, options = {}) => {
    if (options.method === 'PATCH') {
      if (patchResult instanceof Error) throw patchResult;
      patchResult?.();
      return {};
    }
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
    expect(container.querySelector('#run-detail-efforts')).toBeInTheDocument();
    expect(screen.getByText(t('best_efforts.loading'))).toBeInTheDocument();
    expect(reads()).toHaveLength(0);

    rerender(<RunBestEfforts runId={9} streamReady />);
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(reads()).toHaveLength(1);
    expect(screen.queryByText(t('best_efforts.loading'))).not.toBeInTheDocument();
  });

  it('says so, with a way to try again, when the efforts cannot be loaded', async () => {
    served = new Error('down');
    const { container } = renderCard();
    expect(await screen.findByRole('alert')).toHaveTextContent(t('best_efforts.error'));
    expect(container.querySelector('#run-detail-efforts')).toBeInTheDocument();

    served = runEfforts();
    await userEvent.click(screen.getByRole('button', { name: t('best_efforts.retry') }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('is a region named after its title', async () => {
    renderCard();
    expect(await screen.findByRole('region', { name: 'Best efforts' })).toBeInTheDocument();
  });
});

describe('the efforts', () => {
  it('lists them shortest first with their time, pace and place', async () => {
    renderCard();
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);

    expect(rows[0]).toHaveTextContent('400 m');
    expect(rows[0]).toHaveTextContent('1:24');
    expect(rows[0]).toHaveTextContent('3:30 /km');
    expect(rows[0]).toHaveTextContent('3rd');

    expect(rows[1]).toHaveTextContent('1 km');
    expect(rows[1]).toHaveTextContent('4:45');
    expect(rows[1]).toHaveTextContent('2nd');

    expect(rows[2]).toHaveTextContent('5 km');
    expect(rows[2]).toHaveTextContent('25:00');
    expect(rows[2]).toHaveTextContent('5:00 /km');
    expect(rows[2]).toHaveTextContent('PR');

    expect(rows[3]).toHaveTextContent('10 km');
    expect(rows[3]).toHaveTextContent('51:40');
    expect(rows[3]).toHaveTextContent('#12');
  });

  it('writes a time of an hour or more as h:mm:ss', async () => {
    served = runEfforts({ efforts: [effort({ distanceKey: 'half', distanceMeters: 21097.5, elapsedSeconds: 6350, effectiveSeconds: 6350, paceSecPerKm: 301, rank: 1 })] });
    renderCard();
    expect(await screen.findByRole('row', { name: /Half marathon/ })).toHaveTextContent('1:45:50');
  });

  it('says where in the run each effort starts, when it can', async () => {
    renderCard();
    await screen.findByRole('table');
    expect(rowOf('5 km')).toHaveTextContent(t('best_efforts.starts_at', { time: '2:00' }));
    expect(rowOf('1 km')).toHaveTextContent(t('best_efforts.starts_at', { time: '10:00' }));
    expect(rowOf('10 km')).not.toHaveTextContent(t('best_efforts.starts_at', { time: '' }).trim());
  });

  it('marks an estimate, explains it once, and does not when nothing is estimated', async () => {
    renderCard();
    await screen.findByRole('table');
    expect(rowOf('10 km')).toHaveTextContent(t('best_efforts.tag_estimated'));
    expect(rowOf('5 km')).not.toHaveTextContent(t('best_efforts.tag_estimated'));
    expect(screen.getAllByText(t('best_efforts.estimated_note'))).toHaveLength(1);

    cleanup();
    served = runEfforts({ efforts: [effort()] });
    renderCard();
    await screen.findByRole('table');
    expect(screen.queryByText(t('best_efforts.estimated_note'))).not.toBeInTheDocument();
  });

  it('shows a typed time as the time, marks it edited, and keeps what was measured in sight', async () => {
    served = runEfforts({ efforts: [effort({ elapsedSeconds: 1500, effectiveSeconds: 1450, edited: true, paceSecPerKm: 290 })] });
    renderCard();
    const row = await screen.findByRole('row', { name: /5 km/ });
    expect(row).toHaveTextContent('24:10');
    expect(row).toHaveTextContent(t('best_efforts.tag_edited'));
    expect(row).toHaveTextContent(t('best_efforts.measured', { time: '25:00' }));
    expect(row).toHaveTextContent('4:50 /km');
    expect(within(row).getByRole('button', { name: t('best_efforts.restore_aria', { distance: '5 km' }) })).toBeInTheDocument();
  });

  it('shows a hidden effort as hidden, with no place, and offers to show it', async () => {
    served = runEfforts({ efforts: [effort({ hidden: true, rank: null })] });
    renderCard();
    const row = await screen.findByRole('row', { name: /5 km/ });
    expect(row).toHaveTextContent(t('best_efforts.hidden'));
    expect(row).not.toHaveTextContent('PR');
    expect(within(row).getByRole('button', { name: t('best_efforts.show_aria', { distance: '5 km' }) })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: t('best_efforts.hide_aria', { distance: '5 km' }) })).not.toBeInTheDocument();
  });

  it('treats an effort the runner hid as hidden even if a place came with it', async () => {
    served = runEfforts({ efforts: [effort({ hidden: true, rank: 2 })] });
    renderCard();
    const row = await screen.findByRole('row', { name: /5 km/ });
    expect(row).toHaveTextContent(t('best_efforts.hidden'));
    expect(row).not.toHaveTextContent('2nd');
    expect(row).toHaveClass('is-hidden');
  });

  it('dims only the efforts that are hidden', async () => {
    served = runEfforts({ efforts: [effort({ distanceKey: '1km', distanceMeters: 1000, hidden: true, rank: null }), effort()] });
    renderCard();
    await screen.findByRole('table');
    expect(rowOf('1 km')).toHaveClass('is-hidden');
    expect(rowOf('5 km')).not.toHaveClass('is-hidden');
  });

  it('says there are none when the run has none, and still keeps the anchor', async () => {
    served = runEfforts({ efforts: [] });
    const { container } = renderCard();
    expect(await screen.findByText(t('best_efforts.empty'))).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(container.querySelector('#run-detail-efforts')).toBeInTheDocument();
  });

  it('warns that places may change while other runs are still being analysed', async () => {
    served = runEfforts({ complete: false });
    renderCard();
    expect(await screen.findByText(t('best_efforts.incomplete'))).toBeInTheDocument();

    cleanup();
    served = runEfforts({ complete: false, efforts: [] });
    renderCard();
    expect(await screen.findByText(t('best_efforts.empty'))).toBeInTheDocument();
    expect(screen.getByText(t('best_efforts.incomplete'))).toBeInTheDocument();
  });

  it('does not warn when everything has been analysed', async () => {
    renderCard();
    await screen.findByRole('table');
    expect(screen.queryByText(t('best_efforts.incomplete'))).not.toBeInTheDocument();
  });

  it('shows the Chinese names when the language is Chinese', async () => {
    state.lang = 'zh-CN';
    renderCard();
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[2]).toHaveTextContent('5 公里');
    expect(rows[2]).toHaveTextContent('PB');
    expect(rows[1]).toHaveTextContent('第 2 名');
    expect(rows[3]).toHaveTextContent(t('best_efforts.tag_estimated'));
  });
});

describe('typing a chip time', () => {
  async function openEditor(name = '5 km') {
    const user = userEvent.setup();
    renderCard();
    await screen.findByRole('table');
    await user.click(within(rowOf(name)).getByRole('button', { name: t('best_efforts.edit_aria', { distance: name }) }));
    return { user, input: screen.getByRole('textbox', { name: t('best_efforts.edit_label', { distance: name }) }) };
  }

  it('opens an editor on the time that is on screen, with focus in it and a hint', async () => {
    const { input } = await openEditor();
    expect(input).toHaveValue('25:00');
    expect(input).toHaveFocus();
    expect(input).toHaveAccessibleDescription(t('best_efforts.edit_hint'));
    expect(screen.getByRole('button', { name: t('best_efforts.save') })).toBeInTheDocument();
  });

  it('saves a valid time, asks the server for it, refreshes the page and the profile, and says so', async () => {
    const { user, input } = await openEditor();
    patchResult = () => {
      served = runEfforts({ efforts: [effort({ effectiveSeconds: 1450, edited: true, paceSecPerKm: 290 })] });
    };
    await user.clear(input);
    await user.type(input, '24:10');
    await user.click(screen.getByRole('button', { name: t('best_efforts.save') }));

    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0][0]).toBe('/api/activities/9/best-efforts/5km');
    expect(patches()[0][1]).toMatchObject({ method: 'PATCH', headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(patches()[0][1].body)).toEqual({ elapsedSeconds: 1450 });
    expect(invalidateResourceCache).toHaveBeenCalledWith('/api/profile/dashboard');

    const row = await screen.findByRole('row', { name: /24:10/ });
    expect(row).toHaveTextContent(t('best_efforts.tag_edited'));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(t('best_efforts.saved'))).toBeInTheDocument();
    expect(reads().length).toBeGreaterThanOrEqual(2);
    // Focus goes back to where the editor was opened.
    expect(within(row).getByRole('button', { name: t('best_efforts.edit_aria', { distance: '5 km' }) })).toHaveFocus();
  });

  it('submits with Enter', async () => {
    const { user, input } = await openEditor();
    await user.clear(input);
    await user.type(input, '24:10{Enter}');
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(JSON.parse(patches()[0][1].body)).toEqual({ elapsedSeconds: 1450 });
  });

  it('takes an hour or more as h:mm:ss', async () => {
    const user = userEvent.setup();
    served = runEfforts({ efforts: [effort({ distanceKey: 'half', distanceMeters: 21097.5, elapsedSeconds: 6350, effectiveSeconds: 6350, paceSecPerKm: 301, rank: 1 })] });
    renderCard();
    await user.click(await screen.findByRole('button', { name: t('best_efforts.edit_aria', { distance: 'Half marathon' }) }));
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('1:45:50');
    await user.clear(input);
    await user.type(input, '1:44:05{Enter}');
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0][0]).toBe('/api/activities/9/best-efforts/half');
    expect(JSON.parse(patches()[0][1].body)).toEqual({ elapsedSeconds: 6245 });
  });

  it.each(['25', '1500', 'fast', '25:75', ''])('refuses %j without asking the server, and keeps the editor open', async (typed) => {
    const { user, input } = await openEditor();
    await user.clear(input);
    if (typed) await user.type(input, typed);
    await user.click(screen.getByRole('button', { name: t('best_efforts.save') }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t('best_efforts.edit_format'));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(patches()).toHaveLength(0);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it.each(['1:00', '3:00:00'])('refuses %s as a time no runner could run over this distance', async (typed) => {
    const { user, input } = await openEditor();
    await user.clear(input);
    await user.type(input, typed);
    await user.click(screen.getByRole('button', { name: t('best_efforts.save') }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t('best_efforts.edit_implausible'));
    expect(patches()).toHaveLength(0);
  });

  it('tells the runner when the server refuses a time, and when it cannot be reached', async () => {
    const { user, input } = await openEditor();
    await user.clear(input);
    await user.type(input, '24:10');

    patchResult = Object.assign(new Error('That time is not one a runner could run over this distance.'), { status: 400 });
    await user.click(screen.getByRole('button', { name: t('best_efforts.save') }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t('best_efforts.edit_refused'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();

    patchResult = new Error('down');
    await user.click(screen.getByRole('button', { name: t('best_efforts.save') }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(t('best_efforts.edit_failed')));
    expect(screen.getByRole('textbox')).toHaveValue('24:10');
    expect(patches()).toHaveLength(2);
  });

  it('closes on Escape or Cancel without asking the server, and puts focus back on the button', async () => {
    const { user, input } = await openEditor();
    await user.type(input, '9');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(patches()).toHaveLength(0);
    expect(screen.getByRole('button', { name: t('best_efforts.edit_aria', { distance: '5 km' }) })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: t('best_efforts.edit_aria', { distance: '5 km' }) }));
    await user.click(screen.getByRole('button', { name: t('best_efforts.cancel') }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(patches()).toHaveLength(0);
  });

  it('opens the editor on the time that counts, not on the measured one, for an edited effort', async () => {
    const user = userEvent.setup();
    served = runEfforts({ efforts: [effort({ elapsedSeconds: 1500, effectiveSeconds: 1450, edited: true })] });
    renderCard();
    await user.click(await screen.findByRole('button', { name: t('best_efforts.edit_aria', { distance: '5 km' }) }));
    expect(screen.getByRole('textbox')).toHaveValue('24:10');
  });

  it('forgets the old mistake when the editor is opened again', async () => {
    const { user, input } = await openEditor();
    await user.clear(input);
    await user.type(input, 'x');
    await user.click(screen.getByRole('button', { name: t('best_efforts.save') }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t('best_efforts.cancel') }));
    await user.click(screen.getByRole('button', { name: t('best_efforts.edit_aria', { distance: '5 km' }) }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('25:00');
  });
});

describe('taking a chip time back and hiding', () => {
  it('asks the server to use the measured time again', async () => {
    const user = userEvent.setup();
    served = runEfforts({ efforts: [effort({ effectiveSeconds: 1450, edited: true })] });
    renderCard();
    patchResult = () => { served = runEfforts({ efforts: [effort()] }); };
    await user.click(await screen.findByRole('button', { name: t('best_efforts.restore_aria', { distance: '5 km' }) }));

    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0][0]).toBe('/api/activities/9/best-efforts/5km');
    expect(JSON.parse(patches()[0][1].body)).toEqual({ elapsedSeconds: null });
    expect(await screen.findByText(t('best_efforts.restored'))).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('row', { name: /5 km/ })).toHaveTextContent('25:00'));
    expect(screen.queryByRole('button', { name: t('best_efforts.restore_aria', { distance: '5 km' }) })).not.toBeInTheDocument();
  });

  it('hides an effort, and shows it again', async () => {
    const user = userEvent.setup();
    renderCard();
    patchResult = () => { served = runEfforts({ efforts: [effort({ hidden: true, rank: null })] }); };
    await user.click(await screen.findByRole('button', { name: t('best_efforts.hide_aria', { distance: '5 km' }) }));

    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(JSON.parse(patches()[0][1].body)).toEqual({ hidden: true });
    expect(await screen.findByRole('button', { name: t('best_efforts.show_aria', { distance: '5 km' }) })).toBeInTheDocument();
    expect(screen.getByText(t('best_efforts.hidden_done'))).toBeInTheDocument();

    patchResult = () => { served = runEfforts({ efforts: [effort()] }); };
    await user.click(screen.getByRole('button', { name: t('best_efforts.show_aria', { distance: '5 km' }) }));
    await waitFor(() => expect(patches()).toHaveLength(2));
    expect(JSON.parse(patches()[1][1].body)).toEqual({ hidden: false });
    expect(await screen.findByText(t('best_efforts.shown'))).toBeInTheDocument();
  });

  it('says so when hiding fails, and leaves the effort as it was', async () => {
    const user = userEvent.setup();
    renderCard();
    patchResult = new Error('down');
    await user.click(await screen.findByRole('button', { name: t('best_efforts.hide_aria', { distance: '5 km' }) }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t('best_efforts.edit_failed'));
    expect(rowOf('5 km')).toHaveTextContent('PR');
  });

  it('shows every action as unavailable while a change is on its way, and opens no editor', async () => {
    const user = userEvent.setup();
    served = runEfforts({ efforts: [effort({ distanceKey: '1km', distanceMeters: 1000, rank: 2, edited: true, effectiveSeconds: 280 }), effort()] });
    renderCard();
    let release;
    apiJson.mockImplementation(async (url, options = {}) => {
      if (options.method === 'PATCH') {
        await new Promise((resolve) => { release = resolve; });
        return {};
      }
      return served;
    });
    await user.click(await screen.findByRole('button', { name: t('best_efforts.hide_aria', { distance: '5 km' }) }));

    for (const name of [
      t('best_efforts.hide_aria', { distance: '1 km' }), t('best_efforts.edit_aria', { distance: '1 km' }),
      t('best_efforts.restore_aria', { distance: '1 km' }),
      t('best_efforts.hide_aria', { distance: '5 km' }), t('best_efforts.edit_aria', { distance: '5 km' }),
    ]) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-disabled', 'true');
    }
    await user.click(screen.getByRole('button', { name: t('best_efforts.edit_aria', { distance: '1 km' }) }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    release();
    await waitFor(() => expect(screen.getByRole('button', { name: t('best_efforts.hide_aria', { distance: '1 km' }) })).not.toHaveAttribute('aria-disabled'));
    await user.click(screen.getByRole('button', { name: t('best_efforts.edit_aria', { distance: '1 km' }) }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('cannot be saved while the change of another effort is on its way, and cancelling it is still possible', async () => {
    const user = userEvent.setup();
    served = runEfforts({ efforts: [effort({ distanceKey: '1km', distanceMeters: 1000, rank: 2 }), effort()] });
    renderCard();
    await user.click(await screen.findByRole('button', { name: t('best_efforts.edit_aria', { distance: '5 km' }) }));
    let release;
    apiJson.mockImplementation(async (url, options = {}) => {
      if (options.method === 'PATCH') {
        await new Promise((resolve) => { release = resolve; });
        return {};
      }
      return served;
    });
    await user.click(screen.getByRole('button', { name: t('best_efforts.hide_aria', { distance: '1 km' }) }));

    const save = screen.getByRole('button', { name: t('best_efforts.save') });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    await user.click(save);
    expect(patches()).toHaveLength(1);
    expect(screen.getByRole('button', { name: t('best_efforts.cancel') })).not.toHaveAttribute('aria-disabled');

    release();
    await waitFor(() => expect(screen.getByRole('button', { name: t('best_efforts.save') })).not.toHaveAttribute('aria-disabled'));
  });

  it('keeps the editor open when it is cancelled while its own save is on its way, and closes it when the answer comes', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(await screen.findByRole('button', { name: t('best_efforts.edit_aria', { distance: '5 km' }) }));
    const input = screen.getByRole('textbox');
    let release;
    apiJson.mockImplementation(async (url, options = {}) => {
      if (options.method === 'PATCH') {
        await new Promise((resolve) => { release = resolve; });
        return {};
      }
      return served;
    });
    await user.clear(input);
    await user.type(input, '24:10{Enter}');
    expect(await screen.findByRole('button', { name: t('best_efforts.saving') })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: t('best_efforts.cancel') })).toHaveAttribute('aria-disabled', 'true');

    await user.click(screen.getByRole('button', { name: t('best_efforts.cancel') }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('textbox')).toBeInTheDocument();

    release();
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  });

  it('does not let a second change start while one is on its way', async () => {
    const user = userEvent.setup();
    renderCard();
    let release;
    apiJson.mockImplementation(async (url, options = {}) => {
      if (options.method === 'PATCH') {
        await new Promise((resolve) => { release = resolve; });
        return {};
      }
      return served;
    });
    await user.click(await screen.findByRole('button', { name: t('best_efforts.hide_aria', { distance: '5 km' }) }));
    await user.click(screen.getByRole('button', { name: t('best_efforts.hide_aria', { distance: '1 km' }) }));
    expect(patches()).toHaveLength(1);
    release();
    await waitFor(() => expect(reads().length).toBeGreaterThanOrEqual(2));
  });
});

describe('numbers that may be out of date', () => {
  it('keeps the earlier numbers and says the refresh failed when a reload cannot be done', async () => {
    const user = userEvent.setup();
    renderCard();
    patchResult = () => { served = new Error('down'); };
    await user.click(await screen.findByRole('button', { name: t('best_efforts.hide_aria', { distance: '5 km' }) }));

    expect(await screen.findByText(new RegExp(t('run_detail.numbers_stale').slice(0, 25)))).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
