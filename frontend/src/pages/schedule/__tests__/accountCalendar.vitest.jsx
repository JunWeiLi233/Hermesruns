import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Schedule from '../Schedule';
import Runs from '../../runs/Runs';
import en from '../../../i18n/locales/en';
import { apiJson } from '../../../api';
import { cachedApiJson } from '../../../api/resourceCache';
import { historyPageFixture } from '../../runs/__tests__/historyPageFixture';

const t = (key, vars = {}) => Object.entries(vars).reduce((copy, [k, v]) => copy.replaceAll(`{${k}}`, String(v)), key.split('.').reduce((v, k) => v?.[k], en) || key);
vi.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'calendar@hermes.test' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: 'en', t }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'km' }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), getBackendBaseUrl: () => 'http://localhost', subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn(), invalidateResourceCache: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));
vi.mock('../../../utils/routePreload', () => ({ preloadRoute: vi.fn() }));

let zone, today, activities;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T22:10:00Z'));
  localStorage.clear();
  zone = 'Asia/Tokyo';
  today = { scheduledDate: '2026-10-11', workoutType: 'EASY', plannedDistanceKm: 4, reasonCode: 'onboarding' };
  activities = [];
  const read = async url => {
    if (url === '/api/profile/me') return { timeZone: zone, displayName: 'Calendar' };
    if (url === '/api/activities') return activities;
    if (url.startsWith('/api/activities/page?')) return historyPageFixture(activities, new URL(url, 'http://localhost').searchParams, zone);
    if (url === '/api/coach/today') return { today };
    if (url === '/api/coach/schedule?days=14') return [today];
    if (url.startsWith('/api/activities/route-previews?')) return [];
    return [];
  };
  apiJson.mockImplementation(read);
  cachedApiJson.mockImplementation(read);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it.each(['Asia/Tokyo', 'America/Los_Angeles'])('highlights the account session and weekday in %s', async accountZone => {
  zone = accountZone;
  if (zone === 'America/Los_Angeles') today = { scheduledDate: '2026-10-10', workoutType: 'REST', reasonCode: 'scheduled_rest' };
  const { container } = render(<MemoryRouter><Schedule /></MemoryRouter>);
  await screen.findByRole('heading', { name: en.schedule.hero_title });
  const highlighted = container.querySelector('.schedule-plan-day.is-today');
  expect(highlighted).toHaveTextContent(zone === 'Asia/Tokyo' ? 'SUN' : 'SAT');
  expect(highlighted).toHaveTextContent(zone === 'Asia/Tokyo' ? en.profile.dashboard_workout_easy : en.profile.dashboard_workout_rest);
});

it('counts only 2km in the NY Oct5 account week, retaining the Oct4 activity', async () => {
  zone = 'America/New_York';
  today = { scheduledDate: '2026-10-10', workoutType: 'REST' };
  activities = [
    { id: 1, startTime: '2026-10-05T03:55:00', activityInstant: '2026-10-05T03:55:00Z', accountLocalDate: '2026-10-04', accountLocalTime: '23:55:00', distanceKm: 1 },
    { id: 2, startTime: '2026-10-05T04:05:00', activityInstant: '2026-10-05T04:05:00Z', accountLocalDate: '2026-10-05', accountLocalTime: '00:05:00', distanceKm: 2 },
  ];
  const { container } = render(<MemoryRouter><Schedule /></MemoryRouter>);
  await screen.findByRole('heading', { name: en.schedule.hero_title });
  expect(container.querySelector('.schedule-plan-hero')).toHaveTextContent(/2\.0\s*km/);
  expect(container.querySelector('.schedule-plan-hero')).not.toHaveTextContent(/3\.0\s*km/);
});

it('renders account date and spring/fall clocks from explicit activity times', async () => {
  zone = 'America/New_York';
  activities = [
    ['2026-10-05T03:55:00', '2026-10-04', '23:55:00', 1],
    ['2026-03-08T06:55:00', '2026-03-08', '01:55:00', 2],
    ['2026-03-08T07:05:00', '2026-03-08', '03:05:00', 3],
    ['2025-11-02T05:55:00', '2025-11-02', '01:55:00', 4],
    ['2025-11-02T06:05:00', '2025-11-02', '01:05:00', 5],
  ].map(([startTime, accountLocalDate, accountLocalTime, id]) => ({ id, name: `Boundary ${id}`, startTime, activityInstant: startTime + 'Z', accountLocalDate, accountLocalTime, distanceKm: id, movingTimeSeconds: 360 }));
  const { container } = render(<MemoryRouter><Runs /></MemoryRouter>);
  await waitFor(() => expect(container.querySelector('[data-run-id="1"]')).toHaveTextContent('Boundary 1'));
  expect(container.querySelector('[data-run-id="1"] .runs-ledger-row__date strong')).toHaveTextContent('04');
  expect(container.querySelector('[data-run-id="1"]')).toHaveTextContent('11:55 PM');
  for (const [id, clock] of [[2, '1:55 AM'], [3, '3:05 AM'], [4, '1:55 AM'], [5, '1:05 AM']]) expect(container.querySelector(`[data-run-id="${id}"]`)).toHaveTextContent(clock);
});

it('refreshes Today after the account midnight when the page regains focus', async () => {
  vi.setSystemTime(new Date('2026-10-10T14:59:30Z'));
  today = { scheduledDate: '2026-10-10', workoutType: 'REST' };
  const { container } = render(<MemoryRouter><Schedule /></MemoryRouter>);
  await screen.findByRole('heading', { name: en.schedule.hero_title });
  expect(container.querySelector('.schedule-plan-day.is-today')).toHaveTextContent('SAT');
  vi.setSystemTime(new Date('2026-10-10T15:01:00Z'));
  today = { scheduledDate: '2026-10-11', workoutType: 'EASY', plannedDistanceKm: 4 };
  fireEvent(window, new Event('focus'));
  await waitFor(() => expect(container.querySelector('.schedule-plan-day.is-today')).toHaveTextContent('SUN'));
  expect(container.querySelector('.schedule-plan-day.is-today')).toHaveTextContent(en.profile.dashboard_workout_easy);
});
