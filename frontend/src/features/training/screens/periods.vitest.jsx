import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../contexts/I18nContext';
import Periods from './S15';

const state = vi.hoisted(() => ({ current: [], previous: [], shared: [], calls: [], loading: false, error: null, athleteId: 'me' }));
vi.mock('../data/dates.mjs', () => ({ weekStart: () => '2026-10-12' }));
vi.mock('../ui/workspace', () => ({
  useWorkspace: () => ({ athleteId: state.athleteId, actor: 'me' }),
  useResource: (method, payload) => {
    state.calls.push({ method, payload });
    if (method === 'getRoster') return { data: { items: [
      { id: 'me', name: 'Lena Ho', access: 'owner' },
      { id: 'shared', name: 'Ava Lind', access: 'follow' },
      { id: 'private', name: 'Private Runner', access: 'none' },
    ] } };
    if (state.loading) return { loading: true };
    if (state.error && payload.from === '2026-10-05') return { error: state.error };
    return { data: { items: payload.from === '2026-10-12' ? state.current : payload.athleteId === 'shared' ? state.shared : state.previous } };
  },
}));
beforeEach(() => {
  localStorage.setItem('hermes_lang', 'en');
  Object.assign(state, {
    current: [{ minutes: 222.2, load: 568, unknown: 0 }],
    previous: [{ minutes: 196.7, load: 510, unknown: 0 }],
    shared: [{ minutes: 240, load: null, unknown: 2 }],
    calls: [], loading: false, error: null, athleteId: 'me',
  });
});
afterEach(cleanup);
async function mount() {
  let view;
  await act(async () => { view = render(<I18nProvider><Periods /></I18nProvider>); });
  return view;
}
it('renders the reference totals and deltas with inclusive adjacent week requests', async () => {
  const { container } = await mount();
  expect(screen.getByLabelText('Compare with')).toHaveValue('me');
  expect(screen.getByText('3h 42m')).toBeVisible();
  expect(screen.getByText('3h 17m')).toBeVisible();
  expect(screen.getByText('+26m')).toBeVisible();
  expect(screen.getByText('+58')).toBeVisible();
  expect(screen.getByText('Same')).toBeVisible();
  expect(screen.getByText('This week has 13% more training time than your own last week.')).toBeVisible();
  expect(container.querySelectorAll('.periods-metric')).toHaveLength(3);
  expect(container.querySelectorAll('.periods-track i')[4].style.width).toBe('0%');
  expect(state.calls).toContainEqual({ method: 'getActivityTotals', payload: { athleteId: 'me', from: '2026-10-12', through: '2026-10-18' } });
  expect(state.calls).toContainEqual({ method: 'getActivityTotals', payload: { athleteId: 'me', from: '2026-10-05', through: '2026-10-11' } });
});
it('switches only the prior-week athlete and keeps missing loads separate from known zero', async () => {
  const { container } = await mount();
  expect(screen.queryByRole('option', { name: 'Private Runner' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Compare with'), { target: { value: 'shared' } });
  expect(screen.getByText('This week has 7% less training time than Ava Lind’s last week.')).toBeVisible();
  expect(container.querySelector('.periods-card-0')).toHaveTextContent('Lena Ho (You)');
  expect(container.querySelector('.periods-card-1')).toHaveTextContent('Ava Lind');
  expect(container.querySelectorAll('.periods-metric')[1]).toHaveTextContent('Last week: 0');
  expect(container.querySelectorAll('.periods-metric')[2]).toHaveTextContent('Last week: 2');
  expect(state.calls.at(-1).payload.athleteId).toBe('shared');
});
it('aggregates all sports and shows no invented percentage for a zero baseline', async () => {
  state.current.push({ minutes: 60, load: 0, unknown: 1 });
  state.previous = [];
  await mount();
  expect(screen.getByText('4h 42m')).toBeVisible();
  expect(screen.getByText(/percentage comparison is unavailable/)).toBeVisible();
  expect(screen.queryByText(/Infinity|NaN/)).not.toBeInTheDocument();
});
it('leaves both empty weeks as zero with an explicit empty summary', async () => {
  state.current = []; state.previous = [];
  const { container } = await mount();
  expect(screen.getByText('No training time recorded in either week.')).toBeVisible();
  expect([...container.querySelectorAll('.periods-track i')].every(bar => bar.style.width === '0%')).toBe(true);
});
it('keeps the selector available during loading and hides incomplete results', async () => {
  state.loading = true;
  const { container } = await mount();
  expect(screen.getByRole('status')).toHaveTextContent('Loading period comparison');
  expect(screen.getByLabelText('Compare with')).toBeEnabled();
  expect(container.querySelector('.periods-metrics')).toBeNull();
});
it('shows access failure without stale metrics and lets the athlete be changed', async () => {
  state.error = { status: 403 };
  const { container } = await mount();
  expect(screen.getByRole('alert')).toHaveTextContent('current athlete access');
  expect(container.querySelector('.periods-summary')).toBeNull();
  expect(screen.getByLabelText('Compare with')).toBeEnabled();
});
it('resets the comparison when the selected workspace athlete changes', async () => {
  const view = await mount();
  state.athleteId = 'shared';
  await act(async () => view.rerender(<I18nProvider><Periods /></I18nProvider>));
  expect(screen.getByLabelText('Compare with')).toHaveValue('shared');
  expect(state.calls.at(-1).payload.athleteId).toBe('shared');
});
it('translates the comparison, dates and durations in Chinese', async () => {
  localStorage.setItem('hermes_lang', 'zh-CN');
  await mount();
  expect(await screen.findByLabelText('对比对象')).toHaveValue('me');
  expect(screen.getByText('3小时42分')).toBeVisible();
  expect(screen.getByText('本周训练时长比你自己上周多 13%。')).toBeVisible();
});
