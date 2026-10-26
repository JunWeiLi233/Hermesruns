import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Schedule from '../Schedule';
import { buildWeekBars } from '../../profile/ProfileDashboard';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { apiJson } from '../../../api';
import { cachedApiJson } from '../../../api/resourceCache';

const preferences = vi.hoisted(() => ({ unit: 'km', lang: 'en' }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'fictional@example.test' }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => preferences }));
vi.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: preferences.lang, t: (key, values = {}) => {
  const dictionary = preferences.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
} }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

// Twelve actual synthetic RV03 timestamps/distances, before-dev-boundary.json.
const runs = [
  ['2025-11-02T06:05:00', 8], ['2025-11-02T05:55:00', 7],
  ['2026-03-08T07:05:00', 6], ['2026-03-08T06:55:00', 5],
  ['2026-10-04T04:05:00', 4], ['2026-10-04T03:55:00', 3],
  ['2026-10-05T04:05:00', 2], ['2026-10-05T03:55:00', 1],
  ['2026-09-10T16:00:00', 5], ['2026-09-08T16:00:00', 5],
  ['2026-09-06T16:00:00', 5], ['2026-09-04T16:00:00', 5],
].map(([startTime, distanceKm], index) => ({ id: index + 1, startTime, distanceKm, movingTimeSeconds: distanceKm * 390, durationSeconds: distanceKm * 390 }));
const state = { volumeKm7d: 10, volumeKm28d: 10, readinessAvailability: { trainingLoad: true }, readinessScore: 76, readinessLoad: 78 };
let today;
let plan;
let weekSchedule;
let schedule;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T23:12:00Z'));
  preferences.lang = 'en';
  localStorage.clear();
  today = { scheduledDate: '2026-10-10', workoutType: 'RECOVERY', plannedDistanceKm: 3, intent: 'recovery', reasonCode: 'high_load', phase: 'absorb' };
  plan = { phase: 'absorb', reasonCodes: ['high_load', 'load_data'], targetWeeklyKm: 9 };
  weekSchedule = [];
  schedule = undefined;
  cachedApiJson.mockImplementation(async url => url === '/api/activities' ? [...runs] : url === '/api/profile/me' ? { timeZone: 'America/New_York' } : []);
  apiJson.mockImplementation(async url => {
    if (url === '/api/coach/state') return state;
    if (url === '/api/coach/today') return { today, plan, state, weekSchedule, schedule };
    if (url === '/api/coach/schedule?days=14') return [today];
    return [];
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it.each(['en', 'zh-CN'])('grounds the visible %s weekly verdict in the high-load planner', async lang => {
  preferences.lang = lang;
  const dictionary = lang === 'en' ? en : zh;
  const { container } = render(<MemoryRouter><Schedule /></MemoryRouter>);
  await screen.findByRole('heading', { level: 1, name: dictionary.schedule.hero_title });
  const verdict = container.querySelector('.schedule-plan-weekly-summary');
  expect(verdict).toHaveTextContent(dictionary.today_run.personalized_plan_reason_high_load);
  expect(verdict).not.toHaveTextContent(/room to build|Light \(|负荷偏轻|轻负荷/i);
  expect(verdict).not.toHaveTextContent('0.66');
  expect(container.querySelector('.schedule-plan-next-card')).toHaveTextContent(dictionary.today_run.personalized_reason_high_load);
});

it('keeps today rest separate from the high-load weekly plan', async () => {
  today = { ...today, workoutType: 'REST', plannedDistanceKm: null, intent: 'rest', reasonCode: 'scheduled_rest' };
  const { container } = render(<MemoryRouter><Schedule /></MemoryRouter>);
  await screen.findByRole('heading', { level: 1, name: en.schedule.hero_title });
  expect(container.querySelector('.schedule-plan-next-card')).toHaveTextContent(en.today_run.personalized_reason_scheduled_rest);
  expect(container.querySelector('.schedule-plan-weekly-summary')).toHaveTextContent(en.today_run.personalized_plan_reason_high_load);
});

it('shows the shared historical targets and the current rest prescription in the same calendar', async () => {
  today = { ...today, workoutType: 'REST', plannedDistanceKm: null, intent: 'rest', reasonCode: 'weekly_budget_exhausted' };
  weekSchedule = [
    { scheduledDate: '2026-10-05', workoutType: 'EASY', plannedDistanceKm: 5.2 },
    { scheduledDate: '2026-10-10', workoutType: 'LONG_RUN', plannedDistanceKm: 10.4 },
  ];
  schedule = [{ ...today, workoutType: 'RECOVERY', plannedDistanceKm: 2 }];
  render(<MemoryRouter><Schedule /></MemoryRouter>);
  await screen.findByRole('heading', { level: 1, name: en.schedule.hero_title });
  expect(screen.getByRole('button', { name: /MON/ })).toHaveTextContent('5.2 km');
  const saturday = screen.getByRole('button', { name: /SAT/ });
  expect(saturday).toHaveTextContent(en.profile.dashboard_workout_rest);
  expect(saturday).not.toHaveTextContent('10.4 km');
  expect(saturday).not.toHaveTextContent('2.0 km');
});

it('matches the chart distance and workout type on every day of the current account week', async () => {
  vi.setSystemTime(new Date('2026-10-17T16:00:00Z'));
  const targets = [0, 5.2, 5.1, 5.1, 0, 0, 0];
  weekSchedule = targets.map((km, index) => ({ scheduledDate: `2026-10-${12 + index}`,
    workoutType: km > 0 ? 'EASY' : 'REST', plannedDistanceKm: km || null }));
  today = { ...weekSchedule[5], reasonCode: 'weekly_budget_exhausted', originalDistanceKm: 10.4 };
  schedule = [today, weekSchedule[6]];
  plan = { ...plan, targetWeeklyKm: 25.8 };
  const bars = buildWeekBars([], 'en', 'America/New_York', '2026-10-17', { weekSchedule, schedule, today });
  const { container } = render(<MemoryRouter><Schedule /></MemoryRouter>);
  await screen.findByRole('heading', { level: 1, name: en.schedule.hero_title });
  const days = container.querySelectorAll('.schedule-plan-day');
  expect(days).toHaveLength(7);
  bars.forEach((bar, index) => {
    expect(bar.projected).toBe(targets[index]);
    expect(days[index].querySelector('.schedule-plan-day-distance')).toHaveTextContent(bar.projected ? `${bar.projected.toFixed(1)} km` : '—');
    expect(days[index].querySelector('.schedule-plan-day-title')).toHaveTextContent(bar.projected ? en.profile.dashboard_workout_easy : en.profile.dashboard_workout_rest);
  });
  expect(bars.reduce((sum, bar) => sum + bar.projected, 0)).toBeCloseTo(15.4, 5);
});
