import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TodayRun from '../TodayRun';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { apiJson } from '../../../api';

const preferences = vi.hoisted(() => ({ unit: 'km', lang: 'en' }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'fictional@example.test' }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => preferences }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: preferences.lang, t: (key, values = {}) => {
  const dictionary = preferences.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
} }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T23:12:00Z'));
  preferences.lang = 'en';
  localStorage.clear();
  // Same synthetic history as the real RV03 import, no planner/helper mocks.
  const activities = [
    ['2025-11-02T06:05:00', 8], ['2025-11-02T05:55:00', 7],
    ['2026-03-08T07:05:00', 6], ['2026-03-08T06:55:00', 5],
    ['2026-10-04T04:05:00', 4], ['2026-10-04T03:55:00', 3],
    ['2026-10-05T04:05:00', 2], ['2026-10-05T03:55:00', 1],
    ...['10', '08', '06', '04'].map(day => [`2026-09-${day}T16:00:00`, 5]),
  ].map(([startTime, distanceKm], index) => ({ id: index + 1, startTime, distanceKm, movingTimeSeconds: distanceKm * 390 }));
  const payload = {
    profile: { timeZone: 'America/New_York' }, activities, races: [], shoes: [],
    coachPayload: {
      today: { scheduledDate: '2026-10-10', workoutType: 'RECOVERY', plannedDistanceKm: 3, plannedDurationMinutes: 23,
        reasonCode: 'high_load', intent: 'recovery', targetPaceMinSecondsPerKm: 440, targetPaceMaxSecondsPerKm: 485 },
      plan: { phase: 'absorb', reasonCodes: ['high_load', 'load_data'], targetWeeklyKm: 9 },
      state: { volumeKm7d: 10, volumeKm28d: 10, readinessAvailability: { trainingLoad: true }, readinessScore: 76, readinessLoad: 78 },
    },
  };
  apiJson.mockImplementation(async url => url === '/api/today/dashboard' ? payload : []);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it.each(['en', 'zh-CN'])('distinguishes the %s effort metric from high-load recovery advice', async lang => {
  preferences.lang = lang;
  const dictionary = lang === 'en' ? en : zh;
  const { container } = render(<MemoryRouter><TodayRun /></MemoryRouter>);
  await screen.findByRole('heading', { name: dictionary.today_run.v2_coach_briefing });
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(dictionary.profile.dashboard_workout_recovery);
  expect(container.querySelector('.tr-v2-purpose')).toHaveTextContent(dictionary.today_run.personalized_reason_high_load);
  const loadCard = container.querySelector('[class*="is-acwr-"]');
  expect(loadCard).toHaveTextContent(lang === 'en' ? 'Separate effort estimate' : '独立的运动负荷估算');
  expect(loadCard).not.toHaveTextContent(/room to push|controlled push|可以加压|可控加压/i);
  fireEvent.click(loadCard.querySelector('summary'));
  expect(loadCard.querySelector('details')).toHaveAttribute('open');
  expect(loadCard).toHaveTextContent(lang === 'en' ? 'not advice to add training' : '并不表示应增加训练');
});
