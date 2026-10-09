import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import RacesDetail from '../RacesDetail';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { apiJson } from '../../../api';
import { estimateCurrentVdot, predictRaceTimeCalibrated } from '../../../utils/vdot';
import { resolveRaceIntel } from '../../../utils/raceIntel';
import { formatDuration } from '../../../utils/format';

const state = vi.hoisted(() => ({ lang: 'en', map: null, routeLines: [] }));
function translate(key, values = {}) {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
}
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'runner@example.test' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: state.lang, t: translate }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), getBackendBaseUrl: () => '', subscribeWakeRetry: () => () => {} }));
vi.mock('../../../utils/routePreload', () => ({ preloadRoute: () => {} }));
vi.mock('../../../utils/raceImage', () => ({
  getCachedRaceImage: () => '', resolveRaceImage: async (race) => ({ imageUrl: race.heroImage }),
  rememberLoadedRaceImage: () => {}, invalidateRaceImageCache: () => {},
}));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));
vi.mock('leaflet', () => {
  const bounds = { pad() { return this; } };
  const layer = () => ({ addTo() { return this; }, on() { return this; }, redraw() {}, bindTooltip() {}, getBounds: () => bounds });
  return { default: {
    map: (host) => {
      state.map = { host, createPane: () => ({ style: {} }), getPane: () => ({ style: {} }),
        on() { return this; }, invalidateSize: vi.fn(), fitBounds: vi.fn(), setView: vi.fn(), remove: vi.fn(),
        getZoom: () => 10, getCenter: () => ({ lat: 31.2, lng: 121.4 }) };
      return state.map;
    },
    svg: () => ({}), tileLayer: layer, circleMarker: layer, imageOverlay: layer,
    polyline: (points) => { state.routeLines.push(points); return layer(); }, latLngBounds: () => bounds,
  } };
});

let race, activities, course;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-08T16:00:00Z'));
  state.lang = 'en'; state.map = null; state.routeLines = [];
  race = { id: 'reference-marathon', name: 'Shanghai Marathon', city: 'Shanghai', country: 'China', month: 11,
    location: 'The Bund', distanceKm: 42.195, lat: 31.2, lng: 121.4, goalTimeSeconds: 12300,
    registrationStatus: 'REGISTERED', officialWebsite: 'https://example.test/race', heroImage: '/race.jpg' };
  activities = Array.from({ length: 35 }, (_, index) => {
    const date = new Date('2026-10-07T12:00:00Z'); date.setUTCDate(date.getUTCDate() - index);
    return { id: index + 1, startTime: date.toISOString(), distanceKm: 10, movingTimeSeconds: 2800 + index * 12, averageHeartRate: 150, maxHeartRate: 190 };
  });
  course = { source: 'known-official-course:reference', routeAvailable: true, confidence: 95, totalClimbMeters: 44,
    routePoints: Array.from({ length: 121 }, (_, index) => ({ lat: 31.2 + .06 * Math.sin(index * Math.PI / 60), lng: 121.4 + .07 * Math.cos(index * Math.PI / 60) })),
    elevationSamples: [8, 10, 12, 18, 14, 10, 9, 12, 8],
  };
  apiJson.mockImplementation(async (url) => {
    if (url.startsWith('/api/races/course-map?')) return course;
    if (url.startsWith('/api/races/elevation-profile?')) return { profileSamples: [] };
    if (url === '/api/profile/me') return { displayName: 'Alex' };
    if (url === '/api/activities/analysis') return activities;
    throw new Error(`Unexpected request: ${url}`);
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openPage() {
  let result;
  await act(async () => {
    result = render(<MemoryRouter initialEntries={[{ pathname: '/races/details/reference-marathon', state: { race } }]}><Routes>
      <Route path="/races/details/:raceId" element={<RacesDetail />} />
      <Route path="/schedule" element={<h1>Training plan destination</h1>} />
      <Route path="/races" element={<h1>Race list destination</h1>} />
    </Routes></MemoryRouter>);
  });
  return result;
}

it('preserves the shell and uses the real goal, forecast, registration, and course data', async () => {
  const { container } = await openPage();
  const forecast = predictRaceTimeCalibrated(estimateCurrentVdot(activities).representativeVdot, 42195, activities);
  const expected = Math.round(forecast * 60 * (1 + resolveRaceIntel(race).predictionPenaltyPct / 100));
  expect(container.querySelector('.runner-shell-sidebar')).toBeInTheDocument();
  expect(container.querySelector('.runner-shell-topbar')).toHaveTextContent('Shanghai Marathon');
  expect(container.querySelector('.rd-v2-times')).toHaveTextContent(formatDuration(race.goalTimeSeconds));
  expect(container.querySelector('.rd-v2-times dt')).toHaveTextContent(en.races.detail_v2_goal);
  expect(container.querySelector('.rd-v2-times .is-accent')).toHaveTextContent(formatDuration(expected));
  expect(container.querySelector('.rd-v2-status')).toHaveTextContent(en.races.status_registered);
  expect(container.querySelector('.rd-v2-map-chips')).toHaveTextContent('42.2 km+44 m');
  expect(container.querySelector('.rd-v2-map-chips .is-source')).toHaveTextContent(en.races.detail_map_official_badge);
  expect(container.querySelector('.race-detail-course-metrics')).toHaveTextContent('18m');
  await waitFor(() => expect(state.map?.host).toBe(container.querySelector('.race-detail-map-leaflet')));
  expect(state.routeLines).toHaveLength(2);
  expect(state.routeLines[1]).toHaveLength(course.routePoints.length);
});

it('ticks all four countdown units from the actual target date', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T16:00:00Z'));
  const { container } = await openPage();
  const values = () => [...container.querySelectorAll('.rd-v2-count strong')].map((node) => Number(node.textContent));
  const target = new Date(2026, 10, 15, 8).getTime();
  const total = Math.floor((target - Date.now()) / 1000);
  expect(values()).toEqual([Math.floor(total / 86400), Math.floor(total / 3600) % 24, Math.floor(total / 60) % 60, total % 60]);
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  const updated = total - 1;
  expect(values()).toEqual([Math.floor(updated / 86400), Math.floor(updated / 3600) % 24, Math.floor(updated / 60) % 60, updated % 60]);
});

it.each([
  ['.rd-v2-primary', 'Training plan destination'],
  ['button.rd-v2-secondary', 'Race list destination'],
])('keeps the action at %s connected to its destination', async (selector, destination) => {
  const { container } = await openPage();
  fireEvent.click(container.querySelector(selector));
  expect(screen.getByRole('heading', { name: destination })).toBeInTheDocument();
});

it('links to the actual official website in a separate tab', async () => {
  await openPage();
  const link = screen.getByRole('link', { name: `${en.races.intel_official_site} ↗` });
  expect(link).toHaveAttribute('href', race.officialWebsite);
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noreferrer');
});

it.each(['empty', 'failed'])('keeps unavailable predictions and profiles honest when data is %s', async (mode) => {
  activities = []; course = { routeAvailable: false, elevationSamples: [] };
  delete race.goalTimeSeconds; delete race.officialWebsite;
  if (mode === 'failed') apiJson.mockRejectedValue(new Error('Unavailable'));
  const { container } = await openPage();
  expect(container.querySelector('.rd-v2-times .is-accent')).toHaveTextContent('--');
  expect(container.querySelector('.rd-v2-times')).toHaveTextContent(en.races.detail_stat_distance);
  expect(container.querySelector('.rd-v2-times')).toHaveTextContent('42.2');
  expect(container.querySelector('.race-detail-elevation-svg')).not.toBeInTheDocument();
  expect(container.querySelector('.race-detail-elevation-empty')).toHaveTextContent(en.races.detail_course_empty_title);
  expect(container.querySelector('a.rd-v2-secondary')).not.toBeInTheDocument();
});

it('preserves the elevation hover tooltip and clears it on pointer leave', async () => {
  const { container } = await openPage();
  const chart = container.querySelector('.race-detail-elevation-svg');
  chart.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1250, height: 260 });
  fireEvent.pointerMove(chart, { clientX: 620, clientY: 100 });
  expect(container.querySelector('.race-detail-elevation-tooltip')).toHaveTextContent(en.races.detail_course_tooltip_elevation);
  fireEvent.pointerLeave(chart);
  expect(container.querySelector('.race-detail-elevation-tooltip')).not.toBeInTheDocument();
});

it('shows the full course distance and only annotates the real highest point', async () => {
  const { container } = await openPage();
  expect(container.querySelector('.rd-v2-elevation-distance-axis')).toHaveTextContent('42.2 km');
  expect(container.querySelector('.rd-v2-elevation-peak')).toHaveTextContent('18 m');
  expect(container.querySelectorAll('.rd-v2-elevation-peak')).toHaveLength(1);
  expect(container.querySelectorAll('.rd-v2-elevation-altitude-axis span').length).toBeGreaterThanOrEqual(3);
});

it.each([42.195, 21.0975, 5])('lets keyboard users inspect the start and exact finish of a %s km course', async (distance) => {
  race.distanceKm = distance;
  const { container } = await openPage();
  const chart = screen.getByRole('slider', { name: en.races.detail_course_profile });
  fireEvent.focus(chart);
  fireEvent.keyDown(chart, { key: 'End' });
  expect(chart).toHaveAttribute('aria-valuenow', String(distance));
  expect(container.querySelector('.race-detail-elevation-tooltip')).toHaveTextContent(distance.toFixed(1));
  fireEvent.keyDown(chart, { key: 'Home' });
  expect(chart).toHaveAttribute('aria-valuenow', '0');
  fireEvent.keyDown(chart, { key: 'ArrowRight' });
  expect(Number(chart.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  fireEvent.blur(chart);
  expect(container.querySelector('.race-detail-elevation-tooltip')).not.toBeInTheDocument();
});

it('renders the reference actions and countdown in Chinese', async () => {
  state.lang = 'zh-CN';
  const { container } = await openPage();
  expect(container.querySelector('button.rd-v2-secondary')).toHaveTextContent(zh.races.detail_v2_back);
  expect(container.querySelector('.rd-v2-status')).toHaveTextContent(zh.races.status_registered);
  expect(container.querySelector('.rd-v2-countdown')).toHaveTextContent(zh.races.detail_count_seconds);
  expect(container.textContent).not.toMatch(/races\.detail_|\{(?:time|course|distance)\}/);
});
