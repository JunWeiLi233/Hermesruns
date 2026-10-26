import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import translations from '../../../i18n/translations';

let language = 'en';
const translate = (key, params = {}) => {
  const value = key.split('.').reduce((result, part) => result?.[part], translations[language]) ?? key;
  return Object.entries(params).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)), value);
};
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ t: translate, lang: language }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn() }));

const testDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(testDirectory, '../MeasuredHrZoneBlock.jsx');
const measuredFixture = (overrides = {}) => {
  const block = {
  days: 28, startDate: '2026-09-13', endDate: '2026-10-10', timeZone: 'America/New_York',
  activityCount: 2, distanceKm: 12, totalSeconds: 3600, coveredSeconds: 2400,
  unknownSeconds: 1200, coveragePercent: 66.7, zoneSeconds: [0, 1800, 0, 0, 600],
  source: 'STORED_HR_ZONES', percentageDenominator: 'COVERED_HR_SECONDS', durationBasis: 'MOVING_SECONDS_OR_RECORDED_DURATION',
  daily: [{ date: '2026-10-10', activityCount: 2, totalSeconds: 3600, coveredSeconds: 2400,
    unknownSeconds: 1200, zoneSeconds: [0, 1800, 0, 0, 600] }],
  activities: [
    { activityId: 101, localDate: '2026-10-10', totalSeconds: 2400, coveredSeconds: 2400,
      unknownSeconds: 0, zoneSeconds: [0, 1800, 0, 0, 600], metricsStatus: 'CURRENT', calendarBasis: 'UTC_INSTANT',
      effortSource: 'HR_ZONES', boundariesBpm: [120, 140, 160, 175], maxHeartRateBpm: 190,
      computedAt: '2026-10-10T09:00:00' },
    { activityId: 102, localDate: '2026-10-10', totalSeconds: 1200, coveredSeconds: 0,
      unknownSeconds: 1200, zoneSeconds: [0, 0, 0, 0, 0], metricsStatus: 'MISSING',
      effortSource: 'PACE_MODEL', boundariesBpm: null, maxHeartRateBpm: null, computedAt: null, calendarBasis: 'STRAVA_LOCAL_WALL_TIME' },
  ],
  ...overrides,
  };
  const accounting = item => ({ ...item,
    durationCoveredSeconds: item.durationCoveredSeconds ?? item.totalSeconds - item.unknownSeconds,
    sampleExcessSeconds: item.sampleExcessSeconds ?? Math.max(0, item.coveredSeconds - (item.totalSeconds - item.unknownSeconds)),
  });
  return { ...accounting(block), coverageDenominator: 'ACTIVITY_DURATION_SECONDS_WITH_PER_ACTIVITY_CAP',
    daily: block.daily.map(accounting), activities: block.activities.map(accounting) };
};

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const unknownFixture = (status = 'NO_HR') => {
  const block = measuredFixture();
  return {
    ...block, coveredSeconds: 0, durationCoveredSeconds: 0, unknownSeconds: block.totalSeconds, coveragePercent: 0, zoneSeconds: [0, 0, 0, 0, 0],
    daily: block.daily.map(day => ({ ...day, coveredSeconds: 0, durationCoveredSeconds: 0, unknownSeconds: day.totalSeconds, zoneSeconds: [0, 0, 0, 0, 0] })),
    activities: block.activities.map(activity => ({ ...activity, metricsStatus: status, coveredSeconds: 0,
      durationCoveredSeconds: 0, unknownSeconds: activity.totalSeconds, zoneSeconds: [0, 0, 0, 0, 0], effortSource: 'PACE_MODEL' })),
  };
};
async function mount(props = {}, strict = false) {
  expect(existsSync(sourcePath), 'Measured HR block component must exist').toBe(true);
  const { default: MeasuredHrZoneBlock } = await import('../MeasuredHrZoneBlock.jsx');
  let view;
  const element = <MeasuredHrZoneBlock {...props} />;
  const tree = <MemoryRouter>{element}</MemoryRouter>;
  await act(async () => { view = render(strict ? <StrictMode>{tree}</StrictMode> : tree); });
  return { ...view, MeasuredHrZoneBlock };
}

beforeEach(() => { language = 'en'; apiJson.mockReset(); apiJson.mockResolvedValue(measuredFixture()); });
afterEach(cleanup);

describe('measured HR block presentation', () => {
  it('keeps zone shares visible while detailed accounting is collapsed until requested', async () => {
    await mount();
    const table = await screen.findByRole('table', { name: 'Measured HR zone time' });
    expect(within(table).getByRole('row', { name: /Z2/ })).toHaveTextContent('75.0%');
    expect(screen.getByLabelText('Unknown HR time')).toBeVisible();
    const explanation = screen.getByText('How this is calculated', { selector: 'summary' });
    expect(explanation.closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText(/Zone percentages use stored HR sample time/)).not.toBeVisible();
    fireEvent.click(explanation);
    expect(screen.getByText(/Zone percentages use stored HR sample time/)).toBeVisible();
    expect(screen.getByLabelText('Stored HR sample time')).toHaveTextContent('2400 s');
    expect(screen.getByLabelText('Covered activity duration')).toHaveTextContent('2400 s');
    expect(apiJson).toHaveBeenCalledOnce();
  });

  it.each(['daily-zone-shape', 'activity-coverage', 'negative-zone', 'inconsistent-accounting'])('rejects malformed %s data without rendering misleading totals', async fault => {
    const block = measuredFixture();
    if (fault === 'daily-zone-shape') block.daily[0].zoneSeconds = null;
    if (fault === 'activity-coverage') delete block.activities[0].durationCoveredSeconds;
    if (fault === 'negative-zone') block.zoneSeconds[0] = -1;
    if (fault === 'inconsistent-accounting') block.sampleExcessSeconds = 1;
    apiJson.mockResolvedValueOnce(block);
    await mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load measured HR time.');
    expect(screen.queryByRole('table', { name: 'Measured HR zone time' })).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN|undefined/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry measured HR' }));
    await screen.findByRole('table', { name: 'Measured HR zone time' });
    expect(apiJson).toHaveBeenCalledTimes(2);
  });

  it.each(['en', 'zh-CN'])('retains sample excess while reporting duration coverage separately in %s', async locale => {
    language = locale;
    const base = measuredFixture();
    const measured = { ...base.activities[0], totalSeconds: 2400, coveredSeconds: 2401,
      durationCoveredSeconds: 2400, sampleExcessSeconds: 1, unknownSeconds: 0, zoneSeconds: [0, 2401, 0, 0, 0] };
    const missing = { ...base.activities[1], durationCoveredSeconds: 0, sampleExcessSeconds: 0 };
    apiJson.mockResolvedValue(measuredFixture({ coveredSeconds: 2401, durationCoveredSeconds: 2400,
      sampleExcessSeconds: 1, coverageDenominator: 'ACTIVITY_DURATION_SECONDS_WITH_PER_ACTIVITY_CAP',
      zoneSeconds: measured.zoneSeconds, activities: [measured, missing],
      daily: [{ ...base.daily[0], coveredSeconds: 2401, durationCoveredSeconds: 2400,
        sampleExcessSeconds: 1, zoneSeconds: measured.zoneSeconds }] }));
    await mount();
    const table = await screen.findByRole('table', { name: translate('analysis.measured_hr_title') });
    expect(within(table).getByRole('row', { name: /Z2/ })).toHaveTextContent(locale === 'en' ? '2401 s' : '2401 秒');
    expect(within(table).getByRole('row', { name: /Z2/ })).toHaveTextContent('100.0%');
    expect(screen.getByLabelText(locale === 'en' ? 'Covered activity duration' : '已覆盖的活动时长')).toHaveTextContent('2400');
    expect(screen.getByLabelText(translate('analysis.measured_hr_coverage'))).toHaveTextContent('66.7%');
    fireEvent.click(screen.getByText(translate('analysis.measured_hr_calculation'), { selector: 'summary' }));
    expect(screen.getByText(locale === 'en' ? /Stored HR sample time exceeds activity duration by 1 s/ : /存储心率采样时间比活动时长多 1 秒/)).toBeVisible();
    fireEvent.click(screen.getByText(translate('analysis.measured_hr_sources_summary', { count: 2 })));
    const sources = screen.getByRole('table', { name: translate('analysis.measured_hr_sources') });
    expect(within(sources).getByRole('columnheader', { name: locale === 'en' ? 'Sample time beyond duration' : '超出活动时长的采样时间' })).toBeVisible();
    expect(within(sources).getByRole('row', { name: /Activity 101|活动 101/ })).toHaveTextContent('2401');
    expect(apiJson).toHaveBeenCalledOnce();
  });

  it('uses one read-only block request and preserves 30-minute Z2 / 10-minute Z5 measured time', async () => {
    await mount();
    const table = await screen.findByRole('table', { name: 'Measured HR zone time' });
    expect(within(table).getByRole('row', { name: /Z2/ })).toHaveTextContent('30.0 min (1800 s)');
    expect(within(table).getByRole('row', { name: /Z2/ })).toHaveTextContent('75.0%');
    expect(within(table).getByRole('row', { name: /Z5/ })).toHaveTextContent('10.0 min (600 s)');
    expect(within(table).getByRole('row', { name: /Z5/ })).toHaveTextContent('25.0%');
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(apiJson).toHaveBeenCalledOnce();
    expect(apiJson).toHaveBeenCalledWith('/api/activities/training-metrics/block?days=28', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByText(/Zone percentages use stored HR sample time/)).toHaveTextContent('2400 s');
    expect(screen.getByText(/Coverage uses covered activity duration/)).toHaveTextContent('3600 s');
  });

  it('dispatches only one request through the app StrictMode effect replay', async () => {
    await mount({}, true);
    await screen.findByRole('table', { name: 'Measured HR zone time' });
    expect(apiJson).toHaveBeenCalledOnce();
  });

  it('exposes numerical coverage, unknown time, distance, account dates and both same-day activity sources', async () => {
    await mount();
    await screen.findByRole('table', { name: 'Measured HR zone time' });
    expect(screen.getByLabelText('Stored HR sample time')).toHaveTextContent('40.0 min (2400 s)');
    expect(screen.getByLabelText('Unknown HR time')).toHaveTextContent('20.0 min (1200 s)');
    expect(screen.getByLabelText('HR coverage')).toHaveTextContent('66.7%');
    expect(screen.getByLabelText('Recorded distance')).toHaveTextContent('12.0 km');
    expect(screen.getByText(/2026-09-13.*2026-10-10.*America\/New_York/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Activity sources and applied boundaries (2)'));
    expect(screen.getByRole('link', { name: 'Activity 101 · 2026-10-10' })).toHaveAttribute('href', '/runs/101');
    expect(screen.getByRole('link', { name: 'Activity 102 · 2026-10-10' })).toHaveAttribute('href', '/runs/102');
    const sources = screen.getByRole('table', { name: 'Activity sources and applied boundaries' });
    expect(within(sources).getByRole('row', { name: /Activity 101/ })).toHaveTextContent('HR samples');
    expect(within(sources).getByRole('row', { name: /Activity 101/ })).toHaveTextContent('Z2 120–139 bpm');
    expect(within(sources).getByRole('row', { name: /Activity 101/ })).toHaveTextContent('Z5 ≥ 175 bpm');
    expect(within(sources).getByRole('row', { name: /Activity 101/ })).toHaveTextContent('190 bpm');
    expect(within(sources).getByRole('row', { name: /Activity 101/ })).toHaveTextContent('2026-10-10T09:00:00');
    expect(within(sources).getByRole('row', { name: /Activity 102/ })).toHaveTextContent('MISSING');
    expect(within(sources).getByRole('row', { name: /Activity 102/ })).toHaveTextContent('Pace model');
    expect(apiJson).toHaveBeenCalledOnce();
  });

  it('keeps all-no-HR volume and unknown time without a measured percentage denominator', async () => {
    apiJson.mockResolvedValue(unknownFixture());
    await mount();
    expect(await screen.findByText('No usable measured HR time in this block. Recorded volume is retained.')).toBeInTheDocument();
    expect(screen.getByLabelText('Unknown HR time')).toHaveTextContent('60.0 min (3600 s)');
    expect(screen.getByLabelText('Recorded distance')).toHaveTextContent('12.0 km');
    const zoneRow = within(screen.getByRole('table', { name: 'Measured HR zone time' })).getByRole('row', { name: /Z2/ });
    expect(zoneRow).toHaveTextContent('—');
    expect(zoneRow).not.toHaveTextContent('0.0%');
  });

  it.each(['STALE', 'INVALID'])('presents %s metrics as unknown with recorded volume retained', async status => {
    apiJson.mockResolvedValue(unknownFixture(status));
    await mount();
    await screen.findByRole('table', { name: 'Measured HR zone time' });
    expect(screen.getByLabelText('Stored HR sample time')).toHaveTextContent('0.0 min (0 s)');
    expect(screen.getByLabelText('Unknown HR time')).toHaveTextContent('60.0 min (3600 s)');
    expect(screen.getByLabelText('Recorded distance')).toHaveTextContent('12.0 km');
    fireEvent.click(screen.getByText('Activity sources and applied boundaries (2)'));
    expect(within(screen.getByRole('table', { name: 'Activity sources and applied boundaries' })).getByRole('row', { name: /Activity 101/ })).toHaveTextContent(status);
    expect(apiJson).toHaveBeenCalledOnce();
  });

  it('shows a CURRENT one-second covered value without imposing a coverage threshold', async () => {
    const block = measuredFixture();
    const zoneSeconds = [0, 1, 0, 0, 0];
    apiJson.mockResolvedValue(measuredFixture({ totalSeconds: 2400, coveredSeconds: 1, unknownSeconds: 2399, coveragePercent: 1 / 24,
      activityCount: 1, distanceKm: 8, zoneSeconds,
      daily: [{ ...block.daily[0], activityCount: 1, totalSeconds: 2400, coveredSeconds: 1, durationCoveredSeconds: 1, unknownSeconds: 2399, zoneSeconds }],
      activities: [{ ...block.activities[0], coveredSeconds: 1, durationCoveredSeconds: 1, unknownSeconds: 2399, zoneSeconds }],
    }));
    await mount();
    const table = await screen.findByRole('table', { name: 'Measured HR zone time' });
    expect(within(table).getByRole('row', { name: /Z2/ })).toHaveTextContent('0.0 min (1 s)');
    expect(within(table).getByRole('row', { name: /Z2/ })).toHaveTextContent('100.0%');
    expect(screen.queryByText('No usable measured HR time in this block. Recorded volume is retained.')).not.toBeInTheDocument();
  });

  it('discloses stored source, duration and row calendar basis without inferring original boundary settings', async () => {
    await mount();
    await screen.findByRole('table', { name: 'Measured HR zone time' });
    fireEvent.click(screen.getByText('Stored metrics status', { selector: 'summary' }));
    expect(screen.getByText(/STORED_HR_ZONES/)).toHaveTextContent('MOVING_SECONDS_OR_RECORDED_DURATION');
    expect(screen.getByText(/STORED_HR_ZONES/)).toHaveTextContent('COVERED_HR_SECONDS');
    fireEvent.click(screen.getByText('Activity sources and applied boundaries (2)'));
    const sources = screen.getByRole('table', { name: 'Activity sources and applied boundaries' });
    expect(sources).toHaveTextContent('UTC_INSTANT');
    expect(sources).toHaveTextContent('STRAVA_LOCAL_WALL_TIME');
    expect(sources).not.toHaveTextContent('AUTO');
    expect(sources).not.toHaveTextContent('MANUAL');
  });

  it.each(['en', 'zh-CN'])('localizes all stored statuses and calendar bases while retaining raw codes in %s', async locale => {
    language = locale;
    const base = measuredFixture();
    const statuses = ['CURRENT', 'NO_HR', 'MISSING', 'STALE', 'INVALID'];
    const calendars = ['UTC_INSTANT', 'STRAVA_LOCAL_WALL_TIME', 'ADDED_DATE_FALLBACK'];
    const activities = statuses.map((metricsStatus, index) => ({
      ...base.activities[0], activityId: 201 + index, metricsStatus, calendarBasis: calendars[index % calendars.length],
      totalSeconds: 600, coveredSeconds: index === 0 ? 600 : 0, unknownSeconds: index === 0 ? 0 : 600,
      durationCoveredSeconds: index === 0 ? 600 : 0, sampleExcessSeconds: 0,
      zoneSeconds: [0, index === 0 ? 600 : 0, 0, 0, 0], effortSource: index === 0 ? 'HR_ZONES' : 'PACE_MODEL',
    }));
    apiJson.mockResolvedValue(measuredFixture({ activityCount: 5, totalSeconds: 3000, coveredSeconds: 600,
      unknownSeconds: 2400, coveragePercent: 20, zoneSeconds: [0, 600, 0, 0, 0], activities,
      daily: [{ ...base.daily[0], activityCount: 5, totalSeconds: 3000, coveredSeconds: 600,
        durationCoveredSeconds: 600, unknownSeconds: 2400, zoneSeconds: [0, 600, 0, 0, 0] }],
    }));
    await mount();
    await screen.findByRole('table', { name: translate('analysis.measured_hr_title') });
    fireEvent.click(screen.getByText(translate('analysis.measured_hr_sources_summary', { count: 5 })));
    const table = screen.getByRole('table', { name: translate('analysis.measured_hr_sources') });
    const expectedStatuses = locale === 'en'
      ? ['Current stored metrics', 'No usable HR samples', 'No stored metrics', 'Outdated stored metrics', 'Invalid stored metrics']
      : ['当前有效的存储指标', '没有可用心率采样', '没有存储指标', '存储指标已过期', '存储指标无效'];
    const expectedCalendars = locale === 'en'
      ? ['Date from recorded UTC instant', 'Recorded Strava local wall time', 'Added-date fallback']
      : ['依据记录的 UTC 时刻', '记录的 Strava 本地墙上时间', '回退到添加日期'];
    for (const label of expectedStatuses) expect(within(table).getByText(label)).toBeVisible();
    for (const label of expectedCalendars) expect(within(table).getAllByText(label)[0]).toBeVisible();
    const row = within(table).getByRole('row', { name: /201/ });
    fireEvent.click(within(row).getByText(translate('analysis.measured_hr_codes'), { selector: 'summary' }));
    expect(within(row).getByText('CURRENT · UTC_INSTANT · HR_ZONES')).toBeVisible();
  });

  it('offers refresh for an empty account-calendar block', async () => {
    apiJson.mockResolvedValue(measuredFixture({ activityCount: 0, distanceKm: 0, totalSeconds: 0,
      coveredSeconds: 0, unknownSeconds: 0, coveragePercent: null, zoneSeconds: [0, 0, 0, 0, 0], daily: [], activities: [] }));
    await mount();
    expect(await screen.findByText('No activities in this block.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh measured HR' })).toBeEnabled();
    expect(screen.getByLabelText('HR coverage')).toHaveTextContent('—');
  });

  it('shows loading, error and retry with a single new request', async () => {
    const request = deferred();
    apiJson.mockReturnValueOnce(request.promise);
    await mount();
    expect(screen.getByRole('status')).toHaveTextContent('Loading measured HR time…');
    expect(screen.getByRole('button', { name: 'Refresh measured HR' })).toBeDisabled();
    await act(async () => request.reject(new Error('unavailable')));
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load measured HR time.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry measured HR' }));
    await screen.findByRole('table', { name: 'Measured HR zone time' });
    expect(apiJson).toHaveBeenCalledTimes(2);
  });

  it('allows explicit read-only refresh and replaces previous totals', async () => {
    await mount();
    await screen.findByRole('table', { name: 'Measured HR zone time' });
    apiJson.mockResolvedValueOnce(measuredFixture({ distanceKm: 15 }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh measured HR' }));
    await waitFor(() => expect(screen.getByLabelText('Recorded distance')).toHaveTextContent('15.0 km'));
    expect(apiJson).toHaveBeenCalledTimes(2);
    expect(apiJson.mock.calls.every(([url]) => url === '/api/activities/training-metrics/block?days=28')).toBe(true);
  });

  it('fetches once for a newly selected window and ignores an aborted late result', async () => {
    const first = deferred();
    apiJson.mockReturnValueOnce(first.promise).mockResolvedValueOnce(measuredFixture({ days: 7, startDate: '2026-10-04', distanceKm: 7 }));
    await mount();
    fireEvent.click(screen.getByRole('button', { name: '7 days', exact: true }));
    await waitFor(() => expect(screen.getByLabelText('Recorded distance')).toHaveTextContent('7.0 km'));
    expect(apiJson.mock.calls[0][1].signal.aborted).toBe(true);
    expect(apiJson.mock.calls[1][0]).toBe('/api/activities/training-metrics/block?days=7');
    await act(async () => first.resolve(measuredFixture({ distanceKm: 99 })));
    expect(screen.getByLabelText('Recorded distance')).toHaveTextContent('7.0 km');
    expect(screen.queryByText(/2026-09-13/)).not.toBeInTheDocument();
    expect(apiJson).toHaveBeenCalledTimes(2);
  });

  it('ignores an aborted rejection and aborts on unmount', async () => {
    const first = deferred();
    const second = deferred();
    apiJson.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view = await mount();
    fireEvent.click(screen.getByRole('button', { name: '7 days', exact: true }));
    await act(async () => first.reject(new Error('late failure')));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading measured HR time…');
    view.unmount();
    expect(apiJson.mock.calls[1][1].signal.aborted).toBe(true);
    await act(async () => second.resolve(measuredFixture({ days: 7 })));
  });

  it('uses returned calendar dates and daily numeric totals without per-activity requests', async () => {
    await mount();
    await screen.findByRole('table', { name: 'Measured HR zone time' });
    fireEvent.click(screen.getByText('Daily recorded time', { selector: 'summary' }));
    const daily = screen.getByRole('table', { name: 'Daily recorded time' });
    expect(within(daily).getByRole('row', { name: /2026-10-10/ })).toHaveTextContent('2');
    expect(within(daily).getByRole('row', { name: /2026-10-10/ })).toHaveTextContent('60.0 min (3600 s)');
    expect(within(daily).getByRole('row', { name: /2026-10-10/ })).toHaveTextContent('30.0 min (1800 s)');
    expect(apiJson).toHaveBeenCalledOnce();
  });

  it('renders Chinese time, denominator and state copy without refetching when language changes', async () => {
    const view = await mount();
    await screen.findByRole('table', { name: 'Measured HR zone time' });
    language = 'zh-CN';
    view.rerender(<MemoryRouter><view.MeasuredHrZoneBlock /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: '心率区间' })).toBeInTheDocument();
    expect(screen.getByLabelText('心率未知时间')).toHaveTextContent('20.0 分钟（1200 秒）');
    expect(screen.getByRole('table', { name: '实测心率区间时间' })).toHaveTextContent('存储采样时间占比');
    expect(apiJson).toHaveBeenCalledOnce();
  });
});

describe('intensity summary presentation', () => {
  const estimated = { hasData: true, easyRatio: 90, hardRatio: 10, zones: [
    { label: 'Easy', value: 78, hint: 'Easy running', color: '#9cd2aa' },
    { label: 'Moderate', value: 14, hint: 'Moderate running', color: '#ffd38a' },
    { label: 'Hard', value: 8, hint: 'Hard running', color: '#e0705c' },
  ] };
  it('uses covered HR seconds, exposes missing time, and switches estimates without refetching', async () => {
    const { container } = await mount({ presentation: 'summary', estimated });
    await screen.findByText('75%');
    expect(container.querySelector('.intensity-zones-footer')).toHaveTextContent('40 min of heart-rate data · 67% coverage');
    fireEvent.click(screen.getByRole('button', { name: translate('methods.link') }));
    expect(screen.getByText('Time without heart-rate coverage: 20 min.')).toBeInTheDocument();
    expect(screen.getByText(/never filled in from pace/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Estimated' }));
    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(container.querySelector('.intensity-zones-footer')).toHaveTextContent('90 / 10');
    expect(screen.getByText(/no single right split/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Measured HR' }));
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(apiJson).toHaveBeenCalledOnce();
  });
  it('keeps a measured failure explicit while allowing the independent estimate', async () => {
    apiJson.mockRejectedValue(new Error('network'));
    await mount({ presentation: 'summary', estimated });
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: translate('analysis.measured_hr_retry') })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Estimated' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Measured HR' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
  it('shows unknown shares for a block without HR instead of filling zones from the estimate', async () => {
    apiJson.mockResolvedValue(unknownFixture());
    const { container } = await mount({ presentation: 'summary', estimated });
    await screen.findByText(translate('analysis.measured_hr_no_hr'));
    expect(container.querySelectorAll('.intensity-zone-stack span')).toHaveLength(0);
    expect(container.querySelectorAll('.intensity-zone-readings dd')).toHaveLength(5);
    expect(container.querySelector('.intensity-zone-readings')).not.toHaveTextContent('%');
  });
});

describe('truthful analysis presentation labels', () => {
  it('mounts the shared measured block and avoids hardcoded lab VO2max labels in overview', () => {
    const source = readFileSync(resolve(testDirectory, '../Analysis.jsx'), 'utf8');
    expect(source).toMatch(/<MeasuredHrZoneBlock/);
    expect(source).not.toMatch(/<small>VO2max|aria-label=\{`[^`]*VO2max/);
    expect(source).toContain("t('analysis.aggregate_intensity_basis'");
    expect(source).toContain("t('analysis.aggregate_load_basis')");
    expect(source).not.toContain('polarized.easySharePct >= 75');
  });

  it.each(['en', 'zh-CN'])('labels VDOT, aggregate estimates and model basis honestly in %s', (locale) => {
    const copy = translations[locale].analysis;
    expect(copy.stitch_vo2_title).toContain('VDOT');
    expect(copy.stitch_vo2_unit).not.toMatch(/mL|ml|kg|min/);
    expect(copy.v2_predictions_basis).toContain('VDOT');
    expect(copy.stitch_intensity_title).toMatch(locale === 'en' ? /estimated/i : /估算/);
    expect(copy.aggregate_load_basis).toMatch(locale === 'en' ? /average HR.*pace.*fallback/i : /平均心率.*配速.*回退/);
    expect(copy.intensity_dashboard_distribution_window).toMatch(locale === 'en' ? /whole.session/i : /整次/);
    expect(copy.intensity_dashboard_compliance).not.toContain('80/20');
    const distributionCopy = Object.entries(copy).filter(([key]) => key.startsWith('intensity_dashboard_')).map(([, value]) => value).join(' ');
    expect(distributionCopy).not.toMatch(/ideal polarized|理想极化|80\/20|actually landing/i);
  });

  it('keeps all measured-HR translation keys and interpolation fields synchronized', () => {
    const keys = Object.keys(translations.en.analysis).filter(key => key.startsWith('measured_hr_') || key.startsWith('intensity_redesign_'));
    expect(keys.length).toBeGreaterThan(20);
    expect(Object.keys(translations['zh-CN'].analysis).filter(key => key.startsWith('measured_hr_') || key.startsWith('intensity_redesign_')).sort()).toEqual(keys.sort());
    for (const key of keys) {
      const fields = value => value.match(/\{[^}]+\}/g)?.sort() || [];
      expect(fields(translations['zh-CN'].analysis[key]), key).toEqual(fields(translations.en.analysis[key]));
    }
  });
});
