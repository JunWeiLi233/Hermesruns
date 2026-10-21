import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Schedule from '../Schedule';
import { apiFetch, apiJson } from '../../../api';
import { cachedApiJson } from '../../../api/resourceCache';

const fixture = vi.hoisted(() => ({
  selection: null, published: null, authored: null,
  translate: (key, values = {}) => [key, ...Object.values(values)].join(' '),
}));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'route-source@example.test' }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'km' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: 'en', t: fixture.translate }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));
vi.mock('../../training-plan/VersionedPlanRoute', () => ({
  default: ({ children }) => children,
  useVersionedPlan: () => fixture.selection,
}));
vi.mock('../../training-plan/TrainingPlan', () => ({
  SchedulePlanTools: () => null,
  usePublishedCalendar: () => fixture.published,
  planWorkoutUrl: (planId, workoutId) => `/today-run?planId=${planId}&workoutId=${workoutId}`,
}));
vi.mock('../../../features/training/integrated/PageTools', () => ({
  ScheduleAuthoringTools: () => null,
  useAuthoredCalendar: () => fixture.authored,
  AuthoredWeekProvider: ({ children }) => children,
  AuthoredDayEntries: () => null,
}));
vi.mock('leaflet', () => ({
  map: () => ({ fitBounds: vi.fn(), remove: vi.fn() }),
  tileLayer: () => ({ addTo: vi.fn() }),
  circleMarker: () => ({ addTo: vi.fn() }),
  polyline: () => {
    const line = { addTo: () => line, getBounds: () => [] };
    return line;
  },
}));

const HOTSPOT = { startLat: 40.75, startLng: -73.85, source: 'heatmap-hotspot', pointCount: 1200, activityCount: 8 };
const supplementalEvent = {
  id: 'supplemental', title: 'Additional mobility', date: '2026-10-10',
  minutes: 20, sport: 'Other', state: 'planned', revision: 0,
};
let publishedWorkout, activities;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T23:12:00Z'));
  localStorage.clear();
  activities = [];
  publishedWorkout = {
    id: 'published-workout', localDate: '2026-10-10', workoutType: 'EASY', phase: 'ADAPT',
    targetDistanceM: 4500, targetDurationS: 1800, state: 'PLANNED', steps: [],
  };
  fixture.selection = {
    allowLegacy: false,
    data: {
      localDate: '2026-10-10', workout: publishedWorkout,
      plan: { id: 'published-plan', title: 'Published daily plan', inputs: { startDate: '2026-10-05', endDate: '2026-11-01', timeZone: 'America/New_York' } },
    },
  };
  fixture.published = {
    loading: false,
    data: { weeks: [{ startDate: '2026-10-05', days: [publishedWorkout], trainingDistanceM: 4500, trainingDurationS: 1800 }], actualDistanceM: 0, actualDurationS: 0 },
  };
  fixture.authored = { loading: false, events: [supplementalEvent] };
  const read = async (url) => {
    if (url === '/api/profile/me') return { timeZone: 'America/New_York' };
    if (url === '/api/activities') return activities;
    if (url === '/api/route/plan/anchor') return HOTSPOT;
    if (url === '/api/coach/today') return { today: { scheduledDate: '2026-10-10', workoutType: 'EASY', plannedDistanceKm: 9 } };
    if (url === '/api/coach/schedule?days=14') return [{ scheduledDate: '2026-10-10', workoutType: 'EASY', plannedDistanceKm: 9 }];
    if (url === '/api/coach/state') return { activeBlock: { currentLongRunKm: 18 } };
    return [];
  };
  apiJson.mockImplementation(read);
  cachedApiJson.mockImplementation(read);
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({
    id: 'generated-route', streetGraphBacked: true, targetDistanceKm: 4.5, actualDistanceKm: 4.8,
    waypoints: [
      { lat: 40.75, lng: -73.85 }, { lat: 40.7608, lng: -73.85 },
      { lat: 40.7608, lng: -73.8357 }, { lat: 40.75, lng: -73.8357 },
      { lat: 40.75, lng: -73.85 },
    ],
  }) });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openSchedule() {
  const view = render(<MemoryRouter><Schedule /></MemoryRouter>);
  await screen.findByRole('heading', { level: 1 });
  await act(async () => {});
  return view;
}

function postedPlans() {
  return apiFetch.mock.calls.filter(([url, options]) => url === '/api/route/plan' && options?.method === 'POST');
}

it('uses the published daily distance when a same-day supplemental authored event has only duration', async () => {
  const { container } = await openSchedule();
  expect(screen.getByRole('status')).toHaveTextContent('training_integration.generatedPriority');
  await waitFor(() => expect(postedPlans()).toHaveLength(1));
  expect(JSON.parse(postedPlans()[0][1].body)).toMatchObject({ startLat: HOTSPOT.startLat, startLng: HOTSPOT.startLng, targetDistanceKm: 4.5 });
  expect(container.querySelector('.schedule-plan-route-card')).toHaveTextContent(/4\.5\s*km/);
  expect(apiJson).not.toHaveBeenCalledWith('/api/coach/today');
});

it('keeps an authored-only duration prescription from borrowing a legacy coach distance', async () => {
  fixture.selection = { allowLegacy: true, data: null };
  fixture.published = { loading: false, data: null };
  activities = [{ id: 1, startTime: '2026-10-09T12:00:00Z', distanceKm: 5 }];
  await openSchedule();
  expect(postedPlans()).toHaveLength(0);
  expect(apiJson).not.toHaveBeenCalledWith('/api/coach/today');
});

it('keeps a duration-only published prescription from borrowing a legacy coach distance', async () => {
  publishedWorkout.targetDistanceM = null;
  fixture.authored.events = [];
  activities = [{ id: 1, startTime: '2026-10-09T12:00:00Z', distanceKm: 5 }];
  await openSchedule();
  expect(postedPlans()).toHaveLength(0);
  expect(apiJson).not.toHaveBeenCalledWith('/api/coach/today');
});

it('keeps published running guidance when a day is selected', async () => {
  const { container } = await openSchedule();
  fireEvent.click(container.querySelector('.schedule-plan-day.is-today .schedule-plan-day-select'));
  const card = container.querySelector('.schedule-plan-next-card');
  expect(card.querySelector('.schedule-plan-next-content > p')).toHaveTextContent('Published daily plan · training_plan.ADAPT');
  expect(card).not.toHaveTextContent('training_plan.restHelp');
  expect(card).toHaveTextContent(/4\.5\s*km/);
});
