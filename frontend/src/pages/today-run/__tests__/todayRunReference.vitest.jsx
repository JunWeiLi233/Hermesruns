import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TodayRun from '../TodayRun';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { apiJson } from '../../../api';
import { cachedApiJson } from '../../../api/resourceCache';

const preferences = vi.hoisted(() => ({ unit: 'km', lang: 'en' }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'runner@example.test' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: preferences.lang, t: (key, values = {}) => {
  const dictionary = preferences.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
} }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => preferences }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

let payload;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-07T16:00:00Z'));
  localStorage.clear();
  preferences.unit = 'km';
  preferences.lang = 'en';
  payload = {
    profile: { displayName: 'Runner' },
    activities: Array.from({ length: 35 }, (_, index) => {
      const date = new Date('2026-10-06T12:00:00Z');
      date.setUTCDate(date.getUTCDate() - index);
      return { id: index + 1, startTime: date.toISOString(), distanceKm: 8, movingTimeSeconds: 2400, averageHeartRate: 140, shoeId: 1 };
    }),
    coachPayload: {
      today: { workoutType: 'TEMPO', plannedDistanceKm: 10, plannedDurationMinutes: 50, targetPaceMinSecondsPerKm: 288, targetPaceMaxSecondsPerKm: 290, reasonCode: 'build_consistency' },
      state: { currentReadinessScore: 78, readinessVerdict: 'GO', readinessSleep: 82, readinessHrv: 74, readinessRhr: 66, readinessStress: 80, readinessLoad: 78,
        readinessAvailability: { sleep: true, hrv: true, restingHeartRate: true, stress: true, trainingLoad: true }, lastHrvStatus: 'BALANCED' },
    },
    weatherContext: { available: true, pacePenaltySecPerKm: 15 },
    races: [{ name: 'Chicago', distanceKm: 42.195, eventDate: '2026-10-11' }],
    shoes: [{ id: 1, brand: 'Saucony', model: 'Endorphin Speed 4', currentDistanceKm: 312, maxDistanceKm: 500, status: 'ACTIVE' }],
  };
  apiJson.mockImplementation(async (url) => url === '/api/today/dashboard' ? payload : []);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openPage() {
  const result = render(<MemoryRouter initialEntries={['/today-run']}><Routes>
    <Route path="/today-run" element={<TodayRun />} />
    <Route path="/schedule" element={<h1>Schedule destination</h1>} />
    <Route path="/shoes" element={<h1>Shoes destination</h1>} />
    <Route path="/races" element={<h1>Races destination</h1>} />
    <Route path="/runs" element={<h1>Runs destination</h1>} />
  </Routes></MemoryRouter>);
  await screen.findByRole('heading', { name: preferences.lang === 'zh-CN' ? zh.today_run.v2_coach_briefing : en.today_run.v2_coach_briefing });
  return result;
}

it('keeps the shell and actual data, and resets the entire easier session', async () => {
  const { container } = await openPage();
  expect(container.querySelector('.runner-shell-topbar')).toBeInTheDocument();
  expect(container.querySelector('.runner-shell-sidebar')).toBeInTheDocument();
  expect(container.querySelector('.tr-v2-gate-score')).toHaveTextContent('78/100');
  expect(container.querySelector('.tr-v2-race')).toHaveTextContent('4 days');
  expect(screen.getAllByRole('meter')).toHaveLength(4);
  expect(screen.getByRole('meter', { name: en.today_run.readiness_signal_sleep })).toHaveAttribute('aria-valuenow', '82');
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('10.0km');
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('50 min');
  const bars = container.querySelectorAll('.tr-v2-structure-bar > span');
  expect(bars).toHaveLength(3);
  [...bars].forEach((bar, index) => expect(Number(bar.style.flexGrow)).toBeCloseTo([11, 29, 10][index]));
  expect(container.querySelectorAll('.tr-v2-structure-steps li')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: /Not feeling 100/ }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Recovery');
  expect(container.querySelector('.tr-v2-targets')).not.toHaveTextContent('10.0km');
  expect(container.querySelector('.tr-v2-targets')).not.toHaveTextContent('50 min');
  expect(screen.getByRole('button', { name: /Reset/ })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('10.0km');
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('50 min');
});

it.each([
  ['.tr-v2-primary', 'Schedule destination'],
  ['.tr-v2-link', 'Schedule destination'],
  ['.tr-v2-shoe', 'Shoes destination'],
  ['.tr-v2-race', 'Races destination'],
])('preserves navigation from %s', async (selector, destination) => {
  const { container } = await openPage();
  fireEvent.click(container.querySelector(selector));
  expect(screen.getByRole('heading', { name: destination })).toBeInTheDocument();
});

it('keeps weather dismissal and expanded coaching context', async () => {
  const { container } = await openPage();
  const weather = container.querySelector('.tr-v2-weather');
  expect(weather).toHaveTextContent('+15');
  fireEvent.click(within(weather).getByRole('button'));
  expect(container.querySelector('.tr-v2-weather')).not.toBeInTheDocument();
  fireEvent.click(container.querySelector('.tr-v2-coach summary'));
  expect(container.querySelector('.tr-v2-coach details')).toHaveAttribute('open');
  expect(container.querySelector('.tr-v2-context dl')).toHaveTextContent(en.today_run.coach_polarization);
});

it('does not invent readiness or a load marker for a new runner', async () => {
  payload.activities = [];
  payload.coachPayload = null;
  payload.shoes = [];
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-gate-score')).toHaveTextContent('—');
  expect(screen.queryAllByRole('meter')).toHaveLength(0);
  expect(container.querySelector('.tr-v2-gate-verdict')).not.toBeInTheDocument();
  expect(container.querySelector('.tr-v2-acwr-scale i')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(en.today_run.new_runner_title);
});

it('keeps a rest day free of a stale run distance', async () => {
  payload.coachPayload.today.workoutType = 'REST';
  const { container } = await openPage();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Rest');
  expect(container.querySelector('.tr-v2-targets')).not.toHaveTextContent('10.0km');
  expect(container.querySelectorAll('.tr-v2-structure-steps li')).toHaveLength(1);
});

it('uses miles for the distance and retains the batch endpoint fallback', async () => {
  preferences.unit = 'mile';
  apiJson.mockImplementation(async (url) => {
    if (url === '/api/today/dashboard') throw new Error('Unavailable');
    if (url === '/api/coach/today') return payload.coachPayload;
    if (url === '/api/v1/weather/context') return payload.weatherContext;
    if (url === '/api/races') return payload.races;
    if (url === '/api/shoes') return payload.shoes;
  });
  cachedApiJson.mockImplementation(async (url) => url === '/api/activities' ? payload.activities : payload.profile);
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('6.2mi');
  expect(cachedApiJson).toHaveBeenCalledWith('/api/activities');
});

it('renders the new labels and numeric stage weights in Chinese', async () => {
  preferences.lang = 'zh-CN';
  const { container } = await openPage();
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('距离');
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('50 分钟');
  expect(Number(container.querySelectorAll('.tr-v2-structure-bar > span')[1].style.flexGrow)).toBeCloseTo(29);
});
