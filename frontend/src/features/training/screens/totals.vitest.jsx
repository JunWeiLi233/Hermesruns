import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { I18nProvider } from '../../../contexts/I18nContext';
import Totals from './S14';
import Periods from './S15';
const state = vi.hoisted(() => ({ error: null, calls: [], items: null }));
vi.mock('../data/dates.mjs', () => ({ currentDate: () => '2026-10-18', weekStart: () => '2026-10-12' }));
vi.mock('../ui/workspace', () => ({
  useWorkspace: () => ({ athleteId: 'owner' }),
  useResource: (method, payload) => {
    state.calls.push({ method, payload });
    return method === 'getRoster' ? { data: { items: [{ id: 'owner', name: 'Runner', access: 'owner' }] } }
      : state.error ? { error: state.error } : { data: { complete: true, items: state.items || [
        { sport: 'Running', sessions: 250, minutes: 1000, load: 500, unknown: 2 },
        { sport: 'Other', sessions: 201, minutes: 201, load: 201, unknown: 0 },
      ] } };
  },
}));
beforeEach(() => localStorage.setItem('hermes_lang', 'en'));
afterEach(() => { cleanup(); state.error = null; state.calls = []; state.items = null; });
async function mount() { let view; await act(async () => { view = render(<MemoryRouter><I18nProvider><Totals /></I18nProvider></MemoryRouter>); }); return view; }
it('renders complete server aggregates including Other, and requests the edited window', async () => {
  await mount();
  expect(screen.getByText('451')).toBeVisible();
  expect(screen.getByText('20h 01m')).toBeVisible();
  expect(screen.getByText('701*')).toBeVisible();
  expect(screen.getByRole('list')).toHaveTextContent('Other');
  fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2024-01-01' } });
  expect(state.calls.at(-1)).toMatchObject({ method: 'getActivityTotals', payload: { from: '2024-01-01' } });
});
it('keeps dates editable after a failed or invalid-range request', async () => {
  state.error = new Error('INVALID_DATE_RANGE');
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
  expect(screen.getByLabelText('From')).toBeEnabled();
  expect(screen.getByRole('alert')).toHaveTextContent('INVALID_DATE_RANGE');
});
it('requests inclusive account-calendar presets and preserves their dates when choosing custom', async () => {
  await mount();
  expect(state.calls.at(-1).payload).toMatchObject({ from: '2026-10-01', through: '2026-10-18' });
  fireEvent.click(screen.getByRole('button', { name: '4 weeks' }));
  expect(state.calls.at(-1).payload).toMatchObject({ from: '2026-09-21', through: '2026-10-18' });
  fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
  expect(screen.getByLabelText('From')).toHaveValue('2026-09-21');
  fireEvent.click(screen.getByRole('button', { name: 'This year' }));
  expect(state.calls.at(-1).payload.from).toBe('2026-01-01');
  expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
});
it('shows time shares, hides idle sports, and keeps zero known load distinct from unknown', async () => {
  state.items = [
    { sport: 'Running', sessions: 1, minutes: 60, load: 0, unknown: 0 },
    { sport: 'Cycling', sessions: 1, minutes: 30, load: 0, unknown: 1 },
    { sport: 'Other', sessions: 0, minutes: 0, load: 0, unknown: 0 },
  ];
  await mount();
  expect(screen.getByText('1 session · 67%')).toBeVisible();
  expect(screen.getByText('1 session · 33%')).toBeVisible();
  expect(screen.getByText('Load 0')).toBeVisible();
  expect(screen.getByText('No load data · 1 unknown')).toBeVisible();
  expect(screen.getByText('No swimming or other activity in this period.')).toBeVisible();
  expect(screen.queryByText('Other', { exact: true })).not.toBeInTheDocument();
});
it('shows a useful empty range without a fabricated summary or bar', async () => {
  state.items = [];
  const { container } = await mount();
  expect(screen.getByText('No activities in this period')).toBeVisible();
  expect(container.querySelector('.sport-totals-bar')).toBeNull();
  expect(screen.getByRole('button', { name: 'This year' })).toBeEnabled();
});
it('keeps the last valid request while a custom date is empty or reversed', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
  fireEvent.input(screen.getByLabelText('From'), { target: { value: '2026-11-01' } });
  expect(screen.getByRole('alert')).toHaveTextContent('Choose valid dates');
  expect(state.calls.at(-1).payload.from).toBe('2026-10-01');
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '' } });
  expect(state.calls.at(-1).payload.from).toBe('2026-10-01');
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-01' } });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(state.calls.at(-1).payload.from).toBe('2026-09-01');
});
it('formats totals and controls in Chinese', async () => {
  localStorage.setItem('hermes_lang', 'zh-CN');
  await mount();
  expect(await screen.findByRole('button', { name: '近 4 周' })).toBeVisible();
  expect(screen.getByText('跑步')).toBeVisible();
  expect(screen.getByText('20小时 01分')).toBeVisible();
});
it('compares totals from explicit current and preceding week windows', async () => {
  render(<I18nProvider><Periods /></I18nProvider>);
  expect(await screen.findAllByText('20h 01m')).toHaveLength(2);
  expect(screen.getByText('Training time matches your own last week.')).toBeVisible();
  const windows = state.calls.filter(call => call.method === 'getActivityTotals').slice(-2);
  expect(new Set(windows.map(call => JSON.stringify(call.payload))).size).toBe(2);
  expect(windows[0].payload.from > windows[1].payload.through).toBe(true);
});
