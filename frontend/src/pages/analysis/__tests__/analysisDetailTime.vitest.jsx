import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AnalysisInsightDetail from '../AnalysisInsightDetail';
import translations from '../../../i18n/translations';
import { cachedApiJson } from '../../../api/resourceCache';
import { apiJson } from '../../../api';

let language = 'en';
const t = (key, params = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], translations[language]) ?? key;
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), copy);
};
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: language, t, formatNumber: (value, options) => new Intl.NumberFormat(language === 'en' ? 'en-US' : language, options).format(value) }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'km' }) }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn(), invalidateResourceCache: vi.fn() }));
vi.mock('../../../api', async importOriginal => ({ ...await importOriginal(), apiJson: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

let activities;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T04:30:00Z'));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  activities = [
    { id: 101, name: 'Past supporting UTC sample', startTime: '2026-10-11T04:05:00', activityInstant: '2026-10-11T04:05:00Z',
      accountLocalDate: '2026-10-11', accountTimeZone: 'America/New_York', movingTimeSeconds: 600, distanceKm: 2 },
    { id: 102, name: 'Future is not completed support', startTime: '2026-10-12T04:00:00', activityInstant: '2026-10-12T04:00:00Z',
      accountLocalDate: '2026-10-12', accountTimeZone: 'America/New_York', movingTimeSeconds: 300, distanceKm: 1 },
    { id: 103, name: 'Earlier history establishes a load window', startTime: '2026-09-01T12:00:00', activityInstant: '2026-09-01T12:00:00Z',
      accountLocalDate: '2026-09-01', accountTimeZone: 'America/New_York', movingTimeSeconds: 600, distanceKm: 2 },
  ];
  cachedApiJson.mockImplementation(async url => url === '/api/activities/analysis' ? activities : { displayName: 'Fixture', timeZone: 'America/New_York' });
  apiJson.mockResolvedValue(null);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('opens Quality sessions in the current Intensity view and reuses the page history', async () => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  language = 'en';
  const { container } = render(<MemoryRouter initialEntries={['/analysis/intensity#quality-sessions']}><Routes>
    <Route path="/analysis/:insightKey" element={<AnalysisInsightDetail />} />
  </Routes></MemoryRouter>);
  await screen.findByText('Past supporting UTC sample');
  expect(container.querySelector('#quality-sessions')).not.toHaveAttribute('hidden');
  await waitFor(() => expect(container.querySelector('#quality-sessions .quality-sessions-v2')).toBeInTheDocument());
  expect(container.querySelectorAll('.runner-shell-sidebar')).toHaveLength(1);
  expect(container.querySelectorAll('main')).toHaveLength(1);
  expect(cachedApiJson.mock.calls.filter(([url]) => url === '/api/activities/analysis')).toHaveLength(1);
});

it('includes quality sessions beyond the newest 500 activities in an all-time view', async () => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  const recent = Array.from({ length: 500 }, (_, index) => ({
    id: index + 1, name: `Easy fixture ${index}`, distanceKm: 2, movingTimeSeconds: 600,
    startTime: new Date(Date.UTC(2026, 9, 10 - index, 12)).toISOString(),
  }));
  const oldest = { id: 999, name: 'Long run beyond the activity-list cap', runType: 'LONG_RUN', distanceKm: 30,
    movingTimeSeconds: 10800, startTime: '2024-01-10T12:00:00Z' };
  cachedApiJson.mockImplementation(async url => url === '/api/activities/analysis' ? [...recent, oldest]
    : url === '/api/activities' ? recent : { displayName: 'Fixture', timeZone: 'America/New_York' });
  render(<MemoryRouter initialEntries={['/analysis/intensity?range=all&types=long#quality-sessions']}><Routes>
    <Route path="/analysis/:insightKey" element={<AnalysisInsightDetail />} />
  </Routes></MemoryRouter>);
  expect(await screen.findByRole('link', { name: new RegExp(oldest.name) })).toBeInTheDocument();
  expect(cachedApiJson.mock.calls.filter(([url]) => url === '/api/activities/analysis')).toHaveLength(1);
  expect(cachedApiJson.mock.calls.filter(([url]) => url === '/api/activities')).toHaveLength(0);
});

it.each([['en', 'intensity'], ['zh-CN', 'intensity'], ['en', 'load-balance'], ['zh-CN', 'load-balance']])(
  'uses historical inputs for detail supporting samples and leaves cached records intact in %s / %s', async (locale, insight) => {
    language = locale;
    const original = structuredClone(activities);
    const { container } = render(<MemoryRouter initialEntries={['/analysis/' + insight]}><Routes>
      <Route path="/analysis/:insightKey" element={<AnalysisInsightDetail />} />
    </Routes></MemoryRouter>);
    await screen.findByText('Past supporting UTC sample');
    await waitFor(() => expect(screen.queryByText('Future is not completed support')).not.toBeInTheDocument());
    expect(container.querySelector(insight === 'intensity' ? '.analysis-intensity-profile-content' : '.analysis-load-v2')).toBeTruthy();
    expect(activities).toEqual(original);
  },
);
