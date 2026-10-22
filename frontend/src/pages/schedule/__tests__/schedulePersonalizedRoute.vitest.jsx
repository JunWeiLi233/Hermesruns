import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Schedule from '../Schedule';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { apiFetch, apiJson } from '../../../api';
import { cachedApiJson } from '../../../api/resourceCache';

const preferences = vi.hoisted(() => ({ unit: 'km', lang: 'en' }));
const mapEvidence = vi.hoisted(() => ({ lines: [] }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'personalized-route@example.test' }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => preferences }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: preferences.lang, t: (key, values = {}) => {
  const dictionary = preferences.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
} }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn(), invalidateResourceCache: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));
vi.mock('../../training-plan/VersionedPlanRoute', () => ({ default: ({ children }) => children, useVersionedPlan: () => ({ allowLegacy: true }) }));
vi.mock('../../training-plan/TrainingPlan', () => ({ SchedulePlanTools: () => null, usePublishedCalendar: () => ({ data: null }), planWorkoutUrl: () => '/today-run' }));
const emptyAuthored = { events: [], loading: false };
vi.mock('../../../features/training/integrated/PageTools', () => ({ ScheduleAuthoringTools: () => null, useAuthoredCalendar: () => emptyAuthored, AuthoredWeekProvider: ({ children }) => children, AuthoredDayEntries: () => null }));
vi.mock('leaflet', () => ({
  map: () => ({ fitBounds: vi.fn(), remove: vi.fn() }),
  tileLayer: () => ({ addTo: vi.fn() }),
  circleMarker: () => ({ addTo: vi.fn() }),
  polyline: (coordinates) => {
    mapEvidence.lines.push(coordinates);
    const line = { addTo: () => line, getBounds: () => coordinates };
    return line;
  },
}));

const HOTSPOT = { lat: 40.75, lng: -73.85 };
const LATEST_RUN_START = { lat: 40.7, lng: -74.01 };
const loopAt = ({ lat, lng }) => [
  { lat, lng }, { lat: lat + 0.0108, lng },
  { lat: lat + 0.0108, lng: lng + 0.0143 }, { lat, lng: lng + 0.0143 },
  { lat, lng },
];

function measuredDistanceKm(points) {
  const radians = (degrees) => degrees * Math.PI / 180;
  return points.slice(1).reduce((distance, point, index) => {
    const previous = points[index];
    const dLat = radians(point.lat - previous.lat);
    const dLng = radians(point.lng - previous.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(previous.lat)) * Math.cos(radians(point.lat)) * Math.sin(dLng / 2) ** 2;
    return distance + 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, 0);
}

function plannedRoute(anchor = HOTSPOT, overrides = {}) {
  const waypoints = loopAt(anchor);
  return {
    id: 'daily-route', waypoints, actualDistanceKm: measuredDistanceKm(waypoints),
    targetDistanceKm: 4.5, streetGraphBacked: true,
    elevationPreference: 'flat', anchorSource: 'heatmap-hotspot',
    startLat: anchor.lat, startLng: anchor.lng, createdAt: '2026-10-10T20:00:00Z',
    ...overrides,
  };
}

let today, calendar, activities, anchor, savedRoutes, historyRoute, generatedRoute;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T23:12:00Z'));
  localStorage.clear();
  preferences.lang = 'en';
  mapEvidence.lines = [];
  today = { scheduledDate: '2026-10-10', workoutType: 'RECOVERY', plannedDistanceKm: 4.5, reasonCode: 'readiness_protect' };
  calendar = [
    { ...today, workoutType: 'EASY', plannedDistanceKm: 8 },
    { scheduledDate: '2026-10-11', workoutType: 'LONG_RUN', plannedDistanceKm: 12, reasonCode: 'aerobic_progression' },
  ];
  activities = [{ id: 42, startTime: '2026-10-09T12:00:00Z', distanceKm: 4.8, movingTimeSeconds: 1800, routePreview: { path: 'M 0 0 L 100 100' } }];
  anchor = { startLat: HOTSPOT.lat, startLng: HOTSPOT.lng, source: 'heatmap-hotspot', activityCount: 8, pointCount: 1200 };
  savedRoutes = [];
  historyRoute = null;
  generatedRoute = plannedRoute();
  const read = async (url) => {
    if (url === '/api/profile/me') return { timeZone: 'America/New_York' };
    if (url === '/api/activities') return [...activities];
    if (url === '/api/coach/state') return { activeBlock: { currentLongRunKm: 18, weekIndex: 3 }, readinessScore: 58 };
    if (url === '/api/coach/today') return { today, routeRecommendation: historyRoute };
    if (url === '/api/coach/schedule?days=14') return calendar;
    if (url === '/api/route/plan/anchor') return anchor;
    if (url === '/api/route/plan/recent') return savedRoutes;
    if (url === '/api/activities/42/points') return loopAt(LATEST_RUN_START).map(({ lat, lng }) => ({ latitude: lat, longitude: lng }));
    return [];
  };
  apiJson.mockImplementation(read);
  cachedApiJson.mockImplementation(read);
  apiFetch.mockImplementation(async () => ({ ok: true, json: async () => generatedRoute }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openSchedule() {
  const view = render(<MemoryRouter><Schedule /></MemoryRouter>);
  await screen.findByRole('heading', { level: 1 });
  // Drain the loading and route effects before making negative request assertions.
  await act(async () => {});
  return view;
}

function postedPlans() {
  return apiFetch.mock.calls.filter(([url, options]) => url === '/api/route/plan' && options?.method === 'POST');
}

it('plans around the GPS heatmap hotspot using today\'s readiness-adjusted distance', async () => {
  await openSchedule();
  await waitFor(() => expect(postedPlans()).toHaveLength(1));
  expect(apiJson).toHaveBeenCalledWith('/api/route/plan/anchor');
  expect(JSON.parse(postedPlans()[0][1].body)).toMatchObject({ startLat: HOTSPOT.lat, startLng: HOTSPOT.lng, targetDistanceKm: 4.5 });
  expect(apiJson).not.toHaveBeenCalledWith('/api/activities/42/points');
});

it('does not invent a daily running distance for non-running, unknown, duration-only or stale prescriptions', async () => {
  const validToday = { ...today };
  for (const changes of [
    { workoutType: 'REST', plannedDistanceKm: 4.5 },
    { workoutType: 'CROSS_TRAIN', plannedDistanceKm: 4.5 },
    { workoutType: 'NEW_UNKNOWN_TYPE', plannedDistanceKm: 4.5 },
    { workoutType: 'EASY', plannedDistanceKm: null, plannedDurationMinutes: 30 },
    { scheduledDate: '2026-10-09', workoutType: 'EASY', plannedDistanceKm: 4.5 },
  ]) {
    apiFetch.mockClear();
    today = { ...validToday, ...changes };
    const view = await openSchedule();
    expect(postedPlans(), JSON.stringify(changes)).toHaveLength(0);
    view.unmount();
  }
});

it('does not create a personalized daily run without running history', async () => {
  activities = [];
  await openSchedule();
  expect(postedPlans()).toHaveLength(0);
});

it.each(['en', 'zh-CN'])('clears the historical map and watch action on a rest day in %s', async (lang) => {
  preferences.lang = lang;
  today = { ...today, workoutType: 'REST', plannedDistanceKm: 0 };
  historyRoute = { ...plannedRoute(), source: 'history', targetDistanceKm: 4.5 };
  const { container } = await openSchedule();
  expect(mapEvidence.lines).toHaveLength(0);
  expect(container.querySelector('.schedule-plan-route-card button')).toBeDisabled();
  expect(container.querySelector('.schedule-plan-route-card')).toHaveTextContent(lang === 'zh-CN' ? '当前计划安排休息' : 'Your current plan calls for rest');
  expect(container.querySelector('.schedule-plan-route-card')).not.toHaveTextContent(/4\.5\s*(km|公里)/);
});

it('keeps the workout panel on today when a background recovery update changes today to rest', async () => {
  calendar[0] = { ...today };
  const { container } = await openSchedule();
  expect(container.querySelector('#schedule-featured-session')).toHaveTextContent(/4\.5\s*km/);
  today = { ...today, workoutType: 'REST', plannedDistanceKm: null };
  calendar = [today, { ...calendar[1], workoutType: 'RECOVERY', plannedDistanceKm: 1.3 }];

  await act(async () => { window.dispatchEvent(new Event('hermes-recommendations-changed')); });
  await waitFor(() => expect(container.querySelector('.schedule-plan-route-card')).toHaveTextContent('Your current plan calls for rest'));

  expect(container.querySelector('#schedule-featured-session')).toHaveTextContent('Rest');
  expect(container.querySelector('#schedule-featured-session')).not.toHaveTextContent(/1\.3\s*km/);
  expect(container.querySelector('.schedule-plan-day.is-today .schedule-plan-day-select')).toHaveAttribute('aria-pressed', 'true');
});

it('still opens the next planned run when today was already a rest day on first load', async () => {
  today = { ...today, workoutType: 'REST', plannedDistanceKm: null };
  calendar[0] = { ...today };
  const { container } = await openSchedule();
  expect(container.querySelector('#schedule-featured-session')).toHaveTextContent(/12\.0\s*km/);
  expect(container.querySelector('.schedule-plan-day.is-today .schedule-plan-day-select')).toHaveAttribute('aria-pressed', 'false');
});

it('ignores an old route response after recovery reduces the daily distance', async () => {
  let finishOldRoute;
  apiFetch.mockImplementationOnce(() => new Promise(resolve => { finishOldRoute = resolve; }));
  const { container } = await openSchedule();
  await waitFor(() => expect(postedPlans()).toHaveLength(1));
  today = { ...today, plannedDistanceKm: 2 };
  generatedRoute = plannedRoute(HOTSPOT, { targetDistanceKm: 2, actualDistanceKm: 2.1 });
  await act(async () => { window.dispatchEvent(new Event('hermes-recommendations-changed')); });
  await waitFor(() => expect(postedPlans()).toHaveLength(2));
  await act(async () => { finishOldRoute({ ok: true, json: async () => plannedRoute() }); });
  expect(container.querySelector('.schedule-plan-route-card')).toHaveTextContent(/2\.0\s*km/);
  expect(container.querySelector('.schedule-plan-route-card')).not.toHaveTextContent(/4\.[58]\s*km/);
});

it('regenerates a route when its saved target belongs to an older prescription', async () => {
  savedRoutes = [plannedRoute(HOTSPOT, { targetDistanceKm: 5 })];
  await openSchedule();
  await waitFor(() => expect(postedPlans()).toHaveLength(1));
});

it('does not replace a missing heatmap with an arbitrary recent run start', async () => {
  anchor = {};
  await openSchedule();
  expect(postedPlans()).toHaveLength(0);
});

it.each(['remote hotspot', 'wrong distance'])('generates a relevant route despite a saved route with %s', async (problem) => {
  savedRoutes = [problem === 'remote hotspot'
    ? plannedRoute(LATEST_RUN_START)
    : plannedRoute(HOTSPOT, { targetDistanceKm: 12, actualDistanceKm: 12 })];
  await openSchedule();
  await waitFor(() => expect(postedPlans()).toHaveLength(1));
  expect(JSON.parse(postedPlans()[0][1].body)).toMatchObject({ startLat: HOTSPOT.lat, startLng: HOTSPOT.lng, targetDistanceKm: 4.5 });
});

it.each(['en', 'zh-CN'])('distinguishes measured route distance from the current daily target in %s', async (lang) => {
  preferences.lang = lang;
  calendar[0] = { ...today };
  const { container } = await openSchedule();
  await waitFor(() => expect(container.querySelector('.schedule-plan-route-card')).toHaveTextContent(/4\.8\s*(km|公里)/));
  expect(container.querySelector('.schedule-plan-route-card')).toHaveTextContent(/4\.5\s*(km|公里)/);
  expect(container.querySelector('.schedule-plan-route-card')).not.toHaveTextContent(/(?:12\.0|18\.0)\s*(km|公里)/);
});

it('suppresses a historical route bound to a stale daily target', async () => {
  anchor = {};
  generatedRoute = { ...generatedRoute, streetGraphBacked: false };
  historyRoute = { ...plannedRoute(HOTSPOT), source: 'history', zoneKey: 'core', activityCount: 8, targetDistanceKm: 12, confidence: 'best-recent' };
  calendar[0] = { ...today };
  const { container } = await openSchedule();
  expect(mapEvidence.lines).toHaveLength(0);
  const routeCard = container.querySelector('.schedule-plan-route-card');
  expect(routeCard).toHaveTextContent(/4\.5\s*km/);
  expect(routeCard).not.toHaveTextContent(/12\.0\s*km/);
});

it('does not let historical route metadata replace today\'s numeric distance', async () => {
  anchor = {};
  activities = activities.map((run) => ({ ...run, routePreview: null }));
  historyRoute = { ...plannedRoute(HOTSPOT), source: 'history', zoneKey: 'core', activityCount: 8, targetDistanceKm: 12, confidence: 'best-recent' };
  calendar[0] = { ...today };
  const { container } = await openSchedule();
  const routeCard = container.querySelector('.schedule-plan-route-card');
  expect(routeCard).toHaveTextContent(/4\.5\s*km/);
  expect(routeCard).not.toHaveTextContent(/12\.0\s*km/);
});

it('keeps local backend history ahead of a saved travel route when its heatmap anchor is unavailable', async () => {
  anchor = {};
  calendar[0] = { ...today };
  savedRoutes = [plannedRoute(LATEST_RUN_START)];
  historyRoute = { ...plannedRoute(HOTSPOT), source: 'history', zoneKey: 'core', activityCount: 8, confidence: 'best-recent' };
  await openSchedule();
  await waitFor(() => expect(mapEvidence.lines.length).toBeGreaterThan(0));
  expect(mapEvidence.lines.at(-1)[0]).toEqual([HOTSPOT.lat, HOTSPOT.lng]);
  expect(postedPlans()).toHaveLength(0);
});

it.each([
  ['dormant', { startTime: '2026-08-01T12:00:00Z', activityType: 'RUN' }],
  ['non-running', { startTime: '2026-10-09T12:00:00Z', activityType: 'CYCLING' }],
  ['future-only', { startTime: '2026-10-11T12:00:00Z', activityType: 'RUN' }],
])('does not present a personalized daily target with only %s activity history', async (_label, activity) => {
  activities = [{ id: 42, distanceKm: 5, ...activity }];
  const { container } = await openSchedule();
  expect(postedPlans()).toHaveLength(0);
  expect(container.querySelector('.schedule-plan-route-target')).toBeNull();
});
