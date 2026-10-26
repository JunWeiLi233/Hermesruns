import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TodayRun, { buildMarathonPlan, sortRunsByMostRecent } from '../TodayRun';
import en from '../../../i18n/locales/en';
import { apiJson } from '../../../api';

const t = (key, vars = {}) => Object.entries(vars).reduce((copy, [k, v]) => copy.replaceAll(`{${k}}`, String(v)), key.split('.').reduce((v, k) => v?.[k], en) || key);
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'calendar@hermes.test' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: 'en', t }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'km' }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

let payload;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T22:10:00Z'));
  localStorage.clear();
  payload = {
    profile: { displayName: 'Calendar', timeZone: 'Asia/Tokyo' }, activities: [], shoes: [],
    races: [{ name: 'Fictional Marathon', eventDate: '2026-10-12', distanceKm: 42.195, registrationStatus: 'REGISTERED' }],
    coachPayload: { today: { scheduledDate: '2026-10-11', workoutType: 'EASY', plannedDistanceKm: 4, plannedDurationMinutes: 30 }, state: {} },
    weatherContext: null,
  };
  apiJson.mockImplementation(async url => url === '/api/today/dashboard' ? payload : []);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openPage() {
  const result = render(<MemoryRouter><TodayRun /></MemoryRouter>);
  await screen.findByRole('heading', { name: en.today_run.v2_coach_briefing });
  return result;
}

it('counts race calendar days from the Tokyo account day, not the browser day', async () => {
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-race')).toHaveTextContent('1 days');
});

it('keeps a same-day LA marathon upcoming when Tokyo has already reached tomorrow', async () => {
  payload.profile.timeZone = 'America/Los_Angeles';
  payload.coachPayload.today.scheduledDate = '2026-10-10';
  payload.races[0].eventDate = '2026-10-10';
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-race')).toHaveTextContent('0 days');
});

it('reloads the real dashboard contract and countdown after account midnight on focus', async () => {
  vi.setSystemTime(new Date('2026-10-10T14:59:30Z'));
  payload.coachPayload.today = { scheduledDate: '2026-10-10', workoutType: 'REST' };
  const { container } = await openPage();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.profile.dashboard_workout_rest);
  vi.setSystemTime(new Date('2026-10-10T15:01:00Z'));
  payload.coachPayload.today = { scheduledDate: '2026-10-11', workoutType: 'EASY', plannedDistanceKm: 4 };
  fireEvent(window, new Event('focus'));
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.profile.dashboard_workout_easy));
  expect(container.querySelector('.tr-v2-race')).toHaveTextContent('1 days');
});

it('discards a stale previous-day session returned during midnight reload', async () => {
  vi.setSystemTime(new Date('2026-10-10T14:59:30Z'));
  payload.coachPayload.today = { scheduledDate: '2026-10-10', workoutType: 'REST' };
  const { container } = await openPage();
  vi.setSystemTime(new Date('2026-10-10T15:01:00Z'));
  fireEvent(window, new Event('focus'));
  await waitFor(() => expect(container.querySelector('.tr-v2-reason-note')).toHaveTextContent('2026-10-10'));
  expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(en.profile.dashboard_workout_rest);
});

it('orders file activities by their explicit instants, not repeated fall-back wall clocks', () => {
  const runs = [
    { id: 1, startTime: '2025-11-02T01:55:00', activityInstant: '2025-11-02T05:55:00Z' },
    { id: 2, startTime: '2025-11-02T01:05:00', activityInstant: '2025-11-02T06:05:00Z' },
  ];
  expect(sortRunsByMostRecent(runs).map(run => run.id)).toEqual([2, 1]);
  expect(runs.map(run => run.id)).toEqual([1, 2]);
});

it('keeps only account-calendar activity days within the unchanged 16-week marathon block', () => {
  vi.setSystemTime(new Date('2026-10-10T22:10:00Z'));
  const runs = [
    { startTime: '2026-06-20T01:00:00', activityInstant: '2026-06-20T01:00:00Z', accountLocalDate: '2026-06-19', distanceKm: 30 },
    { startTime: '2026-06-20T07:00:00', activityInstant: '2026-06-20T07:00:00Z', accountLocalDate: '2026-06-20', distanceKm: 12 },
  ];
  const result = buildMarathonPlan(runs, [], { type: 'Easy' }, null, t, 'en', 'km', 'America/Los_Angeles', '2026-10-10');
  expect(result.longestRunKm).toBe(12);
  expect(result.longRunTargetKm).toBeNull();
  expect(result.longRunProgress).toBe(0);
});

it('retains legacy wall-time runs in calendar block progress without fabricating an instant', () => {
  const result = buildMarathonPlan([
    { startTime: '2026-10-09T06:30:00', accountLocalDate: '2026-10-09', accountLocalTime: '06:30', activityInstant: null, distanceKm: 18 },
  ], [], { type: 'Easy' }, null, t, 'en', 'km', 'Asia/Tokyo', '2026-10-11');
  expect(result.longestRunKm).toBe(18);
});

it.each([
  ['2026-03-08T06:55:00Z', '2026-03-08', '2026-03-09'],
  ['2026-03-08T07:05:00Z', '2026-03-08', '2026-03-09'],
  ['2025-11-02T05:55:00Z', '2025-11-02', '2025-11-03'],
  ['2025-11-02T06:05:00Z', '2025-11-02', '2025-11-03'],
])('keeps race calendar arithmetic stable across NY DST at %s', (instant, todayKey, raceKey) => {
  vi.setSystemTime(new Date(instant));
  const result = buildMarathonPlan([], [{ name: 'DST Marathon', eventDate: raceKey, distanceKm: 42.195 }], { type: 'Easy' }, null, t, 'en', 'km', 'America/New_York', todayKey);
  expect(result.countdown).toBe(t('today_run.marathon_countdown_days', { days: 1 }));
});
