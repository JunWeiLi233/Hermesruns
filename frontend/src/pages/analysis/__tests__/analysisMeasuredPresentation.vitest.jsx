import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Analysis from '../Analysis';
import translations from '../../../i18n/translations';
import { apiJson } from '../../../api';
import { cachedApiJson } from '../../../api/resourceCache';

let language = 'en';
const translate = (key, params = {}) => {
  const value = key.split('.').reduce((result, part) => result?.[part], translations[language]) ?? key;
  return Object.entries(params).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)), value);
};
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'mile' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: language, t: translate, formatNumber: (value, options) => new Intl.NumberFormat(language, options).format(value) }) }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn(), invalidateResourceCache: vi.fn() }));
vi.mock('../../../api', async importOriginal => ({ ...await importOriginal(), apiJson: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

let activities;
let block;
beforeEach(() => {
  language = 'en';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T16:00:00Z'));
  vi.stubGlobal('requestIdleCallback', callback => window.setTimeout(callback, 0));
  vi.stubGlobal('cancelIdleCallback', handle => window.clearTimeout(handle));
  activities = [];
  block = { days: 28, startDate: '2026-09-13', endDate: '2026-10-10', timeZone: 'America/New_York',
    activityCount: 0, distanceKm: 0, totalSeconds: 0, coveredSeconds: 0, durationCoveredSeconds: 0, sampleExcessSeconds: 0, unknownSeconds: 0,
    coveragePercent: null, zoneSeconds: [0, 0, 0, 0, 0], daily: [], activities: [],
    source: 'STORED_HR_ZONES', percentageDenominator: 'COVERED_HR_SECONDS', coverageDenominator: 'ACTIVITY_DURATION_SECONDS_WITH_PER_ACTIVITY_CAP', durationBasis: 'MOVING_SECONDS_OR_RECORDED_DURATION' };
  cachedApiJson.mockImplementation(async url => url === '/api/activities/analysis' ? activities : { displayName: 'Fictional Runner' });
  apiJson.mockImplementation(async url => url.startsWith('/api/activities/training-metrics/block') ? block : null);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('places the measured HR summary after the overview checks without remounting its request', async () => {
  activities = [{ id: 101, name: 'Recent run', startTime: '2026-10-10T12:00:00Z',
    distanceKm: 8, movingTimeSeconds: 2400 }];
  const { container } = render(<MemoryRouter><Analysis /></MemoryRouter>);
  await waitFor(() => expect(container.querySelector('.analysis-v2-checks')).toBeInTheDocument());
  const measured = container.querySelector('.measured-hr-block');
  expect(container.querySelector('.analysis-v2-checks').compareDocumentPosition(measured)
    & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(measured.compareDocumentPosition(container.querySelector('.analysis-v2-zones'))
    & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await screen.findByText(translate('analysis.measured_hr_empty'));
  expect(apiJson.mock.calls.filter(([url]) => url.startsWith('/api/activities/training-metrics/block'))).toHaveLength(1);
});

it.each(['en', 'zh-CN'])('discloses both elapsed and legacy calendar windows in the intensity detail scope in %s', locale => {
  language = locale;
  const scope = translate('analysis.aggregate_intensity_scope');
  if (locale === 'en') {
    expect(scope).toContain('28 elapsed days');
    expect(scope).toContain('28 account-calendar days');
    expect(scope).toContain('without inferring an instant');
  } else {
    expect(scope).toContain('28 天的实际时间窗口');
    expect(scope).toContain('28 个账户日历日');
    expect(scope).toContain('不推断其 UTC 时刻');
  }
});

it.each(['en', 'zh-CN'])('does not count future completed-history timestamps in the modeled split in %s', async locale => {
  language = locale;
  activities = [
    { id: 101, name: 'Past UTC fixture', startTime: '2026-10-10T12:00:00', activityInstant: '2026-10-10T12:00:00Z',
      accountLocalDate: '2026-10-10', accountTimeZone: 'America/New_York', distanceKm: 8, movingTimeSeconds: 2400 },
    { id: 102, name: 'Future UTC fixture', startTime: '2026-10-11T12:00:00', activityInstant: '2026-10-11T12:00:00Z',
      accountLocalDate: '2026-10-11', accountTimeZone: 'America/New_York', distanceKm: 2, movingTimeSeconds: 600 },
  ];
  const { container } = render(<MemoryRouter><Analysis /></MemoryRouter>);
  await waitFor(() => expect(container.querySelector('.analysis-v2-check--intensity')).toHaveTextContent(
    translate('analysis.aggregate_intensity_basis', { seconds: 2400 })));
  expect(container.querySelector('.analysis-v2-check--intensity')).not.toHaveTextContent('3000');
});

it.each(['en', 'zh-CN'])('keeps the measured block and refresh available on a wholly empty Analysis page in %s', async locale => {
  language = locale;
  const { container } = render(<MemoryRouter><Analysis /></MemoryRouter>);
  expect(await screen.findByText(translate('analysis.measured_hr_empty'))).toBeInTheDocument();
  expect(screen.getByRole('button', { name: translate('analysis.measured_hr_refresh') })).toBeEnabled();
  expect(screen.getByText(translate('analysis.stitch_empty_title'))).toBeInTheDocument();
  expect(container.querySelector('.runner-shell-sidebar')).toBeInTheDocument();
  expect(container.querySelector('.runner-shell-topbar')).toBeInTheDocument();
  expect(apiJson.mock.calls.filter(([url]) => url.startsWith('/api/activities/training-metrics/block'))).toHaveLength(1);
});

it.each(['en', 'zh-CN'])('separates the null-average-HR whole-session estimate from measured 30/10-minute zones in %s', async locale => {
  language = locale;
  activities = [{ id: 101, name: 'Fictional mixed TCX', startTime: '2026-10-10T12:00:00Z',
    distanceKm: 8, movingTimeSeconds: 2400, averageHeartRate: null, maxHeartRate: null }];
  const zoneSeconds = [0, 1800, 0, 0, 600];
  block = { ...block, activityCount: 1, distanceKm: 8, totalSeconds: 2400, coveredSeconds: 2400, durationCoveredSeconds: 2400,
    coveragePercent: 100, zoneSeconds,
    daily: [{ date: '2026-10-10', activityCount: 1, totalSeconds: 2400, coveredSeconds: 2400, durationCoveredSeconds: 2400, sampleExcessSeconds: 0, unknownSeconds: 0, zoneSeconds }],
    activities: [{ activityId: 101, localDate: '2026-10-10', totalSeconds: 2400, coveredSeconds: 2400,
      durationCoveredSeconds: 2400, sampleExcessSeconds: 0, unknownSeconds: 0, zoneSeconds, metricsStatus: 'CURRENT', effortSource: 'HR_ZONES',
      boundariesBpm: [120, 140, 160, 175], maxHeartRateBpm: 190, computedAt: '2026-10-10T09:00:00', calendarBasis: 'UTC_INSTANT' }] };
  const { container } = render(<MemoryRouter><Analysis /></MemoryRouter>);
  const table = await screen.findByRole('table', { name: translate('analysis.measured_hr_title') });
  expect(within(table).getByRole('row', { name: /Z2/ })).toHaveTextContent('1800');
  expect(within(table).getByRole('row', { name: /Z5/ })).toHaveTextContent('600');
  await waitFor(() => expect(container.querySelector('.analysis-v2-check--intensity strong')).toHaveTextContent('0 / 0 / 100'));
  expect(container.querySelector('.analysis-v2-check--intensity')).toHaveTextContent(translate('analysis.aggregate_intensity_basis', { seconds: 2400 }));
  expect(screen.getByLabelText(translate('analysis.measured_hr_distance'))).toHaveTextContent(translate('analysis.measured_hr_distance_value', { distance: '8.0' }));
  expect(container.querySelector('.analysis-overview-vdot-title')).toHaveTextContent('VDOT');
  expect(screen.getByLabelText(translate('analysis.vdot_performance_basis'))).toHaveTextContent(translate('analysis.v3_vo2_basis'));
  expect(apiJson.mock.calls.filter(([url]) => url.startsWith('/api/activities/training-metrics/block'))).toHaveLength(1);
});
