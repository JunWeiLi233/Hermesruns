import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import ProfileDashboard from '../ProfileDashboard';
import en from '../../../i18n/locales/en';
import { cachedApiJson } from '../../../api/resourceCache';

function translate(key, values = {}) {
  const copy = key.split('.').reduce((value, part) => value?.[part], en) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
}
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'runner@example.test' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: 'en', t: translate }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'km' }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(async () => null), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn(), invalidateResourceCache: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

afterEach(() => { localStorage.clear(); vi.useRealTimers(); });

it('renders real dashboard activity values with the matching API weekly budget and actual recent sessions', async () => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T16:00:00Z'));
  const activities = [10, 10.2, 5.145, 10].map((distanceKm, index) => ({
    id: index + 1, name: `Account run ${index + 1}`, startTime: `2026-10-${12 + index}T12:00:00Z`,
    distanceKm, movingTimeSeconds: 3000, averageHeartRate: 145,
  }));
  cachedApiJson.mockResolvedValue({
    profile: { email: 'runner@example.test', displayName: 'Runner', timeZone: 'UTC' },
    activities, shoes: [], races: [],
    coachToday: {
      today: { scheduledDate: '2026-10-16', workoutType: 'REST', reasonCode: 'weekly_budget_exhausted' },
      schedule: [{ scheduledDate: '2026-10-17', workoutType: 'REST' }],
      weekSchedule: [
        { scheduledDate: '2026-10-12', workoutType: 'RECOVERY', plannedDistanceKm: 5.7 },
        { scheduledDate: '2026-10-13', workoutType: 'RECOVERY', plannedDistanceKm: 5.7 },
        { scheduledDate: '2026-10-14', workoutType: 'REST' },
        { scheduledDate: '2026-10-15', workoutType: 'RECOVERY', plannedDistanceKm: 5.7 },
        { scheduledDate: '2026-10-16', workoutType: 'REST' },
        { scheduledDate: '2026-10-17', workoutType: 'EASY', plannedDistanceKm: 7.8 },
        { scheduledDate: '2026-10-18', workoutType: 'REST' },
      ],
      plan: { targetWeeklyKm: 30, timeZone: 'UTC', weeklyBudgets: [
        { start: '2026-10-05', budgetKm: 60, completedKm: 60 },
        { start: '2026-10-12', budgetKm: 24.9, completedKm: 35.345 },
      ] },
    },
  });
  render(<MemoryRouter><ProfileDashboard /></MemoryRouter>);
  const card = await screen.findByRole('article', { name: 'This week' });
  expect(within(card).getByText('35.3 km')).toBeInTheDocument();
  expect(within(card).getByText('/ 17.1 km planned')).toBeInTheDocument();
  expect(within(card).getByText('Weekly budget 24.9 km')).toBeInTheDocument();
  expect(within(card).getByRole('button', { name: 'Mon: Actual 10.0 km; Planned 5.7 km' })).toBeInTheDocument();
  expect(within(card).getByRole('button', { name: 'Thu: Actual 10.0 km; Planned 5.7 km' })).toBeInTheDocument();
  const dailyPlannedKm = within(card).getAllByRole('button').reduce((sum, button) =>
    sum + Number(button.getAttribute('aria-label').match(/Planned ([\d.]+) km/)[1]), 0);
  expect(dailyPlannedKm).toBeCloseTo(17.1, 5);
  expect(within(card).getByRole('button', { name: 'Sat: Actual 0.0 km; Planned 0.0 km' })).toBeInTheDocument();
  expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  expect(within(card).getByRole('status')).toHaveTextContent('Today: Rest · Weekly budget reached');
  expect(screen.getByRole('button', { name: /Account run 4/ })).toHaveTextContent('145 BPM');
  expect(cachedApiJson).toHaveBeenCalledWith('/api/profile/dashboard', expect.objectContaining({ signal: expect.any(AbortSignal) }));
});
