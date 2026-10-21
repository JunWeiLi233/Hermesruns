import { StrictMode } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Schedule from '../Schedule';
import { apiJson } from '../../../api';
import { cachedApiJson } from '../../../api/resourceCache';

const translate = vi.hoisted(() => (key) => key);
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, email: 'map-lifecycle@example.test' }),
}));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: 'en', t: translate }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'km' }) }));
vi.mock('../../../api', () => ({
  apiJson: vi.fn(), apiFetch: vi.fn(), subscribeWakeRetry: () => () => {},
}));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn(), invalidateResourceCache: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));
vi.mock('../../training-plan/VersionedPlanRoute', () => ({ default: ({ children }) => children, useVersionedPlan: () => ({ allowLegacy: true }) }));
vi.mock('../../training-plan/TrainingPlan', () => ({ SchedulePlanTools: () => null, usePublishedCalendar: () => ({ data: null }), planWorkoutUrl: () => '/today-run' }));
const emptyAuthored = { events: [], loading: false };
vi.mock('../../../features/training/integrated/PageTools', () => ({ ScheduleAuthoringTools: () => null, useAuthoredCalendar: () => emptyAuthored, AuthoredWeekProvider: ({ children }) => children, AuthoredDayEntries: () => null }));

const firstRoute = [{ lat: 40.7, lng: -74.01 }, { lat: 40.72, lng: -74.01 }, { lat: 40.72, lng: -73.99 }, { lat: 40.7, lng: -73.99 }, { lat: 40.7, lng: -74.01 }];
const nextRoute = firstRoute.map(point => ({ lat: point.lat + 0.05, lng: point.lng + 0.03 }));
let payload, releaseLeaflet, importStarted, attempts, maps, leaflet, originalSvg;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
  localStorage.clear();
  payload = {
    today: { scheduledDate: '2026-10-10', workoutType: 'EASY', plannedDistanceKm: 8, reasonCode: 'aerobic_progression' },
    state: {},
    routeRecommendation: { waypoints: firstRoute, targetDistanceKm: 8, representativeDistanceKm: 8, zoneKey: 'core', activityCount: 1 },
  };
  attempts = [];
  maps = [];
  const actualModule = await vi.importActual('leaflet');
  leaflet = actualModule.default || actualModule;
  originalSvg = leaflet.Browser.svg;
  // jsdom provides SVG DOM nodes but not Leaflet's createSVGRect capability probe.
  leaflet.Browser.svg = true;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);

  let markStarted;
  importStarted = new Promise((resolve) => { markStarted = resolve; });
  const pendingImport = new Promise((resolve) => { releaseLeaflet = resolve; });
  vi.doMock('leaflet', async () => {
    markStarted();
    await pendingImport;
    return {
      ...leaflet,
      default: leaflet,
      map: (...args) => {
        attempts.push(args[0]);
        const map = leaflet.map(...args);
        vi.spyOn(map, 'remove');
        maps.push(map);
        return map;
      },
    };
  });
  cachedApiJson.mockImplementation(async (url) => (
    url === '/api/profile/me' ? { displayName: 'Map Runner', timeZone: 'UTC' } : [{ id: 1, startTime: '2026-10-09T12:00:00Z', activityType: 'RUN', distanceKm: 8 }]
  ));
  apiJson.mockImplementation(async (url) => {
    if (url === '/api/coach/today') return payload;
    if (url === '/api/coach/state') return {};
    return [];
  });
});

afterEach(async () => {
  cleanup();
  await act(async () => { releaseLeaflet(); });
  leaflet.Browser.svg = originalSvg;
  vi.doUnmock('leaflet');
  vi.useRealTimers();
});

function scheduleTree(strict = false) {
  const page = <Schedule />;
  return <MemoryRouter>{strict ? <StrictMode>{page}</StrictMode> : page}</MemoryRouter>;
}

async function openSchedule(strict = false) {
  const view = render(scheduleTree(strict));
  await waitFor(() => expect(view.container.querySelector('.schedule-plan-route-leaflet-map')).not.toBeNull());
  await importStarted;
  return view;
}

async function finishImport() {
  await act(async () => { releaseLeaflet(); });
  await waitFor(() => expect(maps.length).toBeGreaterThan(0));
}

function renderedRoute(map) {
  const line = Object.values(map._layers).find((layer) => layer instanceof leaflet.Polyline);
  return line.getLatLngs().map(({ lat, lng }) => ({ lat, lng }));
}

it.each([false, true])('initializes only the latest route after a pending import (StrictMode=%s)', async (strict) => {
  const view = await openSchedule(strict);
  const host = view.container.querySelector('.schedule-plan-route-leaflet-map');
  payload.routeRecommendation = { ...payload.routeRecommendation, waypoints: nextRoute };
  view.rerender(scheduleTree(strict));
  expect(view.container.querySelector('.schedule-plan-route-leaflet-map')).toBe(host);

  await finishImport();
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toBe(host);
  expect(renderedRoute(maps[0])).toEqual(nextRoute);
  expect(host.querySelectorAll('.leaflet-overlay-pane path')).toHaveLength(3);
  view.unmount();
  expect(maps[0].remove).toHaveBeenCalledTimes(1);
  expect(host._leaflet_id).toBeUndefined();
});

it('does not initialize a replacement container from a disposed pending setup', async () => {
  const view = await openSchedule();
  const previousHost = view.container.querySelector('.schedule-plan-route-leaflet-map');
  payload.routeRecommendation = null;
  view.rerender(scheduleTree());
  expect(view.container.querySelector('.schedule-plan-route-leaflet-map')).toBeNull();
  payload.routeRecommendation = { waypoints: nextRoute, targetDistanceKm: 8, representativeDistanceKm: 8, zoneKey: 'core', activityCount: 1 };
  view.rerender(scheduleTree());
  const nextHost = view.container.querySelector('.schedule-plan-route-leaflet-map');
  expect(nextHost).not.toBe(previousHost);

  await finishImport();
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toBe(nextHost);
  expect(renderedRoute(maps[0])).toEqual(nextRoute);
  expect(previousHost._leaflet_id).toBeUndefined();
});

it('keeps the live map when Schedule rerenders with the same route', async () => {
  const view = await openSchedule();
  await finishImport();
  const map = maps[0];
  view.rerender(scheduleTree());
  await act(async () => {});

  expect(maps).toHaveLength(1);
  expect(maps[0]).toBe(map);
  expect(map.remove).not.toHaveBeenCalled();
  expect(renderedRoute(map)).toEqual(firstRoute);
});

it('removes the previous map exactly once when the route changes or disappears', async () => {
  const view = await openSchedule();
  await finishImport();
  const previousMap = maps[0];
  payload.routeRecommendation = { ...payload.routeRecommendation, waypoints: nextRoute };
  view.rerender(scheduleTree());
  await waitFor(() => expect(maps).toHaveLength(2));
  const nextMap = maps[1];
  expect(previousMap.remove).toHaveBeenCalledTimes(1);
  expect(renderedRoute(nextMap)).toEqual(nextRoute);

  payload.routeRecommendation = null;
  view.rerender(scheduleTree());
  expect(nextMap.remove).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(previousMap.remove).toHaveBeenCalledTimes(1);
  expect(nextMap.remove).toHaveBeenCalledTimes(1);
});

it('ignores an import that resolves after unmount', async () => {
  const view = await openSchedule();
  view.unmount();
  await act(async () => { releaseLeaflet(); });
  expect(attempts).toEqual([]);
});

it('initializes a new mount after a disposed import resolves', async () => {
  const previousView = await openSchedule(true);
  const previousHost = previousView.container.querySelector('.schedule-plan-route-leaflet-map');
  previousView.unmount();
  await act(async () => { releaseLeaflet(); });
  expect(attempts).toHaveLength(0);
  const nextView = await openSchedule(true);
  const nextHost = nextView.container.querySelector('.schedule-plan-route-leaflet-map');

  await finishImport();
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toBe(nextHost);
  expect(previousHost._leaflet_id).toBeUndefined();
  expect(renderedRoute(maps[0])).toEqual(firstRoute);
});
