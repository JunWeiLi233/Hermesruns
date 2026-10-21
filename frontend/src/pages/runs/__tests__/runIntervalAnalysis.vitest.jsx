import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import { intervalFixture, stationaryWorkFixture } from './intervalFixtures';

const state = vi.hoisted(() => ({ lang: 'en', messages: {} }));
vi.mock('../../../api', () => ({ apiJson: vi.fn() }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: state.lang, t: (key, params = {}) => {
  const value = key.split('.').reduce((node, part) => node?.[part], state.messages) || key;
  return Object.entries(params).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), value);
} }) }));
let Component;
let locales;
let response;
let intervalRowsCsv;
beforeAll(async () => {
  const path = '../RunIntervalAnalysis.jsx';
  Component = (await import(/* @vite-ignore */ path).catch(() => ({}))).default;
  intervalRowsCsv = (await import(/* @vite-ignore */ path)).intervalRowsCsv;
  locales = await Promise.all(['en', 'zh-CN'].map(async (lang) => (await import(`../../../i18n/locales/${lang}/intervalAnalytics.js`).catch(() => ({}))).default));
});
beforeEach(() => {
  state.lang = 'en';
  state.messages = locales?.[0] || {};
  response = intervalFixture({ missingHr: true });
  apiJson.mockReset();
  apiJson.mockImplementation(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
});
afterEach(cleanup);
function mount(props = {}) {
  expect(Component).toBeTypeOf('function');
  return render(<Component activityId={9} {...props} />);
}

it.each(['en', 'zh-CN'])('renders detected estimates with review copy and classification provenance in %s', async lang => {
  state.lang = lang;
  state.messages = locales[lang === 'en' ? 0 : 1];
  response.segments.forEach(segment => { segment.provenance = 'auto-detected'; });
  mount();
  await screen.findByRole('table');
  expect(screen.getByText(state.messages.interval_analytics.detectionNote)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: state.messages.interval_analytics.showSources }));
  expect(screen.getAllByText(state.messages.interval_analytics.autoDetected).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: state.messages.interval_analytics.edit }));
  expect(screen.getByText(state.messages.interval_analytics.editNote)).toBeInTheDocument();
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function savedSnapshot(kind, label) {
  const snapshot = intervalFixture();
  snapshot.segments[0] = { ...snapshot.segments[0], kind, label, provenance: 'runner-declared' };
  return snapshot;
}

async function deliver(request, outcome, snapshot) {
  await act(async () => {
    if (outcome === 'success') request.resolve(snapshot);
    else request.reject(new Error('Late GET failed'));
    await request.promise.catch(() => {});
  });
}

function expectLatestSave(container, callback, snapshot) {
  const row = within(screen.getByRole('table')).getByText(snapshot.segments[0].label).closest('tr');
  expect(row).toHaveTextContent('Recovery');
  expect(container.querySelectorAll('[data-segment-kind="work"]')).toHaveLength(5);
  expect(container.querySelectorAll('[data-segment-kind="recovery"]')).toHaveLength(6);
  expect(screen.getByText('Declarations saved')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenLastCalledWith(snapshot);
  fireEvent.click(screen.getByRole('button', { name: 'Edit segments' }));
  expect(screen.getByLabelText('Classification 1')).toHaveValue('recovery');
  expect(screen.getByLabelText('Label 1')).toHaveValue(snapshot.segments[0].label);
}

describe('usable interval view', () => {
  it.each([1, 2, 3])('labels each of %i segment indices once, centred beneath its own bar', async (count) => {
    response = intervalFixture();
    response.segments = response.segments.slice(0, count);
    const { container } = mount();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Segment index' }));
    const ticks = [...container.querySelectorAll('.run-interval__tick')];
    expect(ticks.map(tick => tick.textContent)).toEqual(Array.from({ length: count }, (_, i) => String(i + 1)));
    const width = Number(container.querySelector('.run-interval__chart svg').getAttribute('viewBox').split(' ')[2]);
    ticks.forEach((tick, i) => expect(Number(tick.getAttribute('x'))).toBeCloseTo((i + .5) / count * width));
  });

  it('keeps interval details visible when a pointer click follows hover and focus', async () => {
    const { container } = mount();
    await screen.findByRole('table');
    const first = container.querySelector('.run-interval__chart g[role="button"]');
    fireEvent.mouseEnter(first);
    fireEvent.focus(first);
    fireEvent.click(first);
    expect(container.querySelector('.run-interval__tooltip')).toHaveTextContent('Rep 1');
    expect(container.querySelector('.run-interval__bar.is-active')).toBeInTheDocument();
  });

  it('exports canonical measured rows with unknown values blank and spreadsheet formulas escaped', () => {
    expect(intervalRowsCsv).toBeTypeOf('function');
    const csv = intervalRowsCsv([{ index: 1, label: '=SUM(1,2)', kind: 'work', startSeconds: 0, endSeconds: 90, distanceMeters: null, durationSeconds: 90, paceSecPerKm: null, averageHeartRate: 0 }]);
    expect(csv).toContain('distance_meters,duration_seconds,pace_seconds_per_km,average_heart_rate');
    expect(csv).toContain('1,"\'=SUM(1,2)",work,0,90,,90,,0');
    expect(csv).not.toContain('undefined');
  });

  it('offers interval export after the authoritative rows load', async () => {
    mount();
    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: 'training_integration.export_intervals' })).toBeEnabled();
  });

  it('shows work and recovery bars on one continuous timeline baseline', async () => {
    const { container } = mount();
    await screen.findByRole('table');
    const baselines = [...container.querySelectorAll('[data-segment-kind]')]
      .map(bar => Number(bar.getAttribute('y')) + Number(bar.getAttribute('height')));
    expect(new Set(baselines).size).toBe(1);
  });

  it('reveals source columns without changing segment measurements or fetching again', async () => {
    await mount();
    const table = await screen.findByRole('table');
    expect(within(table).queryByRole('columnheader', { name: 'Classification source' })).not.toBeInTheDocument();
    const reads = apiJson.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Show source columns' }));
    expect(within(table).getByRole('columnheader', { name: 'Classification source' })).toBeVisible();
    expect(within(table).getByRole('columnheader', { name: 'Measurement source' })).toBeVisible();
    expect(within(table).getByText('Rep 1')).toBeInTheDocument();
    expect(apiJson).toHaveBeenCalledTimes(reads);
    fireEvent.click(screen.getByRole('button', { name: 'Hide source columns' }));
    expect(within(table).queryByRole('columnheader', { name: 'Measurement source' })).not.toBeInTheDocument();
  });

  it.each(['success', 'failure'])('R1 keeps save B authoritative when save A post-PUT reload delivers late %s', async (outcome) => {
    const savedA = savedSnapshot('work', 'Save A');
    const savedB = savedSnapshot('recovery', 'Save B');
    const reloadA = deferred();
    const callback = vi.fn();
    let reads = 0;
    let writes = 0;
    apiJson.mockImplementation((_url, options) => {
      if (options?.method === 'PUT') return Promise.resolve(++writes === 1 ? savedA : savedB);
      reads += 1;
      if (reads === 2) return reloadA.promise;
      return Promise.resolve(reads === 1 ? response : savedB);
    });
    const { container } = mount({ onAnalysisSaved: callback });
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Edit segments' }));
    fireEvent.change(screen.getByLabelText('Label 1'), { target: { value: 'Save A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
    await screen.findByText('Declarations saved');
    await waitFor(() => expect(reads).toBe(2));
    expect(callback).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit segments' }));
    fireEvent.change(screen.getByLabelText('Classification 1'), { target: { value: 'recovery' } });
    fireEvent.change(screen.getByLabelText('Label 1'), { target: { value: 'Save B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
    await waitFor(() => expect(callback).toHaveBeenCalledWith(savedB));
    expect(reads).toBe(3);
    await deliver(reloadA, outcome, savedA);
    expectLatestSave(container, callback, savedB);
  });

  it.each(['success', 'failure'])('keeps authoritative PUT after a pre-save refresh GET delivers late %s', async (outcome) => {
    const refresh = deferred();
    const put = deferred();
    const saved = savedSnapshot('recovery', 'Saved after refresh');
    const callback = vi.fn();
    let reads = 0;
    apiJson.mockImplementation((_url, options) => {
      if (options?.method === 'PUT') return put.promise;
      reads += 1;
      if (reads === 2) return refresh.promise;
      return Promise.resolve(reads === 1 ? response : saved);
    });
    const { container, rerender } = mount({ onAnalysisSaved: callback });
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Edit segments' }));
    fireEvent.change(screen.getByLabelText('Classification 1'), { target: { value: 'recovery' } });
    fireEvent.change(screen.getByLabelText('Label 1'), { target: { value: saved.segments[0].label } });
    fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
    rerender(<Component activityId={9} refreshToken={1} onAnalysisSaved={callback} />);
    await waitFor(() => expect(reads).toBe(2));
    await deliver(put, 'success', saved);
    await waitFor(() => expect(callback).toHaveBeenCalledWith(saved));
    expect(reads).toBe(3);
    await deliver(refresh, outcome, response);
    expectLatestSave(container, callback, saved);
  });

  it('retains the authoritative PUT and notifies once when its own reload fails, then Retry works', async () => {
    const saved = savedSnapshot('recovery', 'Saved despite reload failure');
    const callback = vi.fn();
    let reads = 0;
    apiJson.mockImplementation((_url, options) => {
      if (options?.method === 'PUT') return Promise.resolve(saved);
      reads += 1;
      if (reads === 2) return Promise.reject(new Error('Reload failed'));
      return Promise.resolve(reads === 1 ? response : saved);
    });
    mount({ onAnalysisSaved: callback });
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Edit segments' }));
    fireEvent.change(screen.getByLabelText('Classification 1'), { target: { value: 'recovery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Declarations saved, but reloading measurements failed');
    expect(screen.getByText(saved.segments[0].label).closest('tr')).toHaveTextContent('Recovery');
    expect(callback).toHaveBeenCalledExactlyOnceWith(saved);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('table');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it.each(['activity change', 'unmount'])('does not publish a pending save after %s', async (transition) => {
    const put = deferred();
    const callback = vi.fn();
    apiJson.mockImplementation((_url, options) => options?.method === 'PUT' ? put.promise : Promise.resolve({ ...response, activityId: _url.includes('/10/') ? 10 : 9 }));
    const { rerender, unmount } = mount({ onAnalysisSaved: callback });
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Edit segments' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
    if (transition === 'activity change') {
      rerender(<Component activityId={10} onAnalysisSaved={callback} />);
      await screen.findByRole('table');
    } else unmount();
    const callsBeforeCompletion = apiJson.mock.calls.length;
    await deliver(put, 'success', savedSnapshot('recovery', 'Retired save'));
    expect(callback).not.toHaveBeenCalled();
    expect(apiJson).toHaveBeenCalledTimes(callsBeforeCompletion);
    expect(screen.queryByText('Retired save')).not.toBeInTheDocument();
  });

  it('loads the owner-gated API and displays all labeled lanes, source totals and measured HR coverage', async () => {
    const { container } = mount();
    await screen.findByRole('table', { name: 'Interval source values' });
    expect(apiJson.mock.calls[0][0]).toBe('/api/activities/9/session-analysis');
    expect(container.querySelectorAll('[data-segment-kind="work"]')).toHaveLength(6);
    expect(container.querySelectorAll('[data-segment-kind="recovery"]')).toHaveLength(5);
    expect(screen.getByText('Source totals')).toBeInTheDocument();
    expect(screen.getByText('3.650 km')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Interval source values' });
    expect(within(table).getAllByRole('row')).toHaveLength(12);
    expect(within(table).getAllByText('Unavailable')).toHaveLength(3);
    expect(screen.getByText(/HR is weighted only/)).toBeInTheDocument();
  });

  it('provides elapsed time and segment-index axes and an internal km/mi switch', async () => {
    mount();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Segment index' }));
    expect(screen.getByRole('button', { name: 'Segment index' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'mi' }));
    expect(screen.getByText('2.268 mi')).toBeInTheDocument();
    expect(screen.getAllByText(/\/mi/).length).toBeGreaterThan(0);
  });

  it('keeps unknown labels and saves explicit edits with runner-declared provenance then reloads', async () => {
    response = intervalFixture({ unknown: true });
    const { container } = mount();
    await screen.findByRole('table');
    expect(container.querySelectorAll('[data-segment-kind="unknown"]')).toHaveLength(11);
    fireEvent.click(screen.getByRole('button', { name: 'Edit segments' }));
    fireEvent.change(screen.getByLabelText('Classification 1'), { target: { value: 'work' } });
    fireEvent.change(screen.getByLabelText('End seconds 1'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
    await waitFor(() => expect(apiJson.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true));
    const [, options] = apiJson.mock.calls.find(([, options]) => options?.method === 'PUT');
    const body = JSON.parse(options.body);
    expect(body.segments[0]).toEqual({ id: 'w1', startSeconds: 0, endSeconds: 90, kind: 'work', label: 'Rep 1', targetPaceSecondsPerKm: null });
    expect(body).not.toHaveProperty('comparison');
    expect(body.segments[0]).not.toHaveProperty('averageHeartRate');
    await waitFor(() => expect(apiJson.mock.calls.filter(([, options]) => !options?.method).length).toBe(2));
    expect(await screen.findByText('Declarations saved')).toBeInTheDocument();
  });

  it('adds and removes segment rows and blocks overlap before making a PUT', async () => {
    response = { ...intervalFixture(), source: { ...intervalFixture().source, elapsedDurationSeconds: 100 }, segments: [] };
    mount();
    await screen.findByText('No segments available');
    fireEvent.click(screen.getByRole('button', { name: 'Edit segments' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add segment' }));
    fireEvent.change(screen.getByLabelText('Start seconds 1'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('End seconds 1'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add segment' }));
    fireEvent.change(screen.getByLabelText('Start seconds 2'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('End seconds 2'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Segments must not overlap');
    expect(apiJson.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Remove segment 2' }));
    expect(screen.queryByLabelText('Start seconds 2')).not.toBeInTheDocument();
  });

  it('has retry for API failures and does not retain previous activity when identity changes', async () => {
    response = Object.assign(new Error('failed'), { status: 403 });
    const { rerender } = mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load interval analysis');
    response = intervalFixture();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('table');
    let finish;
    apiJson.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    rerender(<Component activityId={10} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    finish({ ...intervalFixture(), activityId: 10, segments: [] });
    await screen.findByText('No segments available');
  });

  it('renders EN and ZH from equal-key dedicated dictionaries without formatDate assumptions', async () => {
    expect(locales[0]).toBeTypeOf('object');
    expect(Object.keys(locales[0].interval_analytics).sort()).toEqual(Object.keys(locales[1].interval_analytics).sort());
    state.lang = 'zh-CN';
    state.messages = locales[1];
    mount();
    expect(await screen.findByRole('table', { name: '间歇来源数据' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '编辑分段' })).toBeInTheDocument();
    expect(screen.getAllByText('恢复').length).toBeGreaterThan(0);
  });

  it('treats malformed 200 responses as errors with Retry instead of empty success', async () => {
    response = {};
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load interval analysis');
    expect(screen.queryByText('No segments available')).not.toBeInTheDocument();
  });

  it('notifies the parent after successful save and exposes the navigation anchor', async () => {
    const onAnalysisSaved = vi.fn();
    const { container } = mount({ onAnalysisSaved });
    await screen.findByRole('table');
    expect(container.querySelector('#run-detail-intervals')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit segments' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
    await waitFor(() => expect(onAnalysisSaved).toHaveBeenCalledTimes(1));
  });

  it('keeps missing-HR dots absent and maps pauses to elapsed widths while index bars have equal widths', async () => {
    const { container } = mount();
    await screen.findByRole('table');
    expect(container.querySelectorAll('[data-recorded-hr]')).toHaveLength(8);
    expect(screen.getByText(/120–154 bpm/)).toBeInTheDocument();
    let work = [...container.querySelectorAll('[data-segment-kind="work"]')];
    expect(Number(work[5].getAttribute('width'))).toBeGreaterThan(Number(work[0].getAttribute('width')));
    fireEvent.click(screen.getByRole('button', { name: 'Segment index' }));
    work = [...container.querySelectorAll('[data-segment-kind="work"]')];
    expect(work[0].getAttribute('width')).toBe(work[5].getAttribute('width'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show recorded HR' }));
    expect(container.querySelectorAll('[data-recorded-hr]')).toHaveLength(0);
  });

  it('retains edits when a save is rejected and shows saved runner/derived-stream provenance on reload', async () => {
    const callback = vi.fn();
    mount({ onAnalysisSaved: callback });
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Edit segments' }));
    fireEvent.change(screen.getByLabelText('Classification 1'), { target: { value: 'unknown' } });
    apiJson.mockImplementation(async (_url, options) => {
      if (options?.method === 'PUT') throw Object.assign(new Error('Not owner'), { status: 404 });
      return response;
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your edits are retained');
    expect(screen.getByLabelText('Classification 1')).toHaveValue('unknown');
    expect(callback).not.toHaveBeenCalled();
    response = { ...response, segments: response.segments.map((row) => ({ ...row, provenance: 'runner-declared', measurements: { ...row.measurements, measurementProvenance: 'derived-stream' } })) };
    apiJson.mockResolvedValue(response);
    fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
    await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Show source columns' }));
    const table = screen.getByRole('table');
    expect(within(table).getAllByText('Runner-declared')).toHaveLength(11);
    expect(within(table).getAllByText('Derived from recorded telemetry')).toHaveLength(11);
  });

  it('displays supplied targets only and keeps missing-stream pace/time/distance usable', async () => {
    response.segments = response.segments.map((row) => ({ ...row, measurements: { ...row.measurements, averageHeartRate: null, hrCoverageSeconds: 0 } }));
    response.segments[0].targetPaceSecondsPerKm = 300;
    mount();
    await screen.findByRole('table');
    expect(screen.getByRole('columnheader', { name: 'Supplied target' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('5:00 /km')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(12);
  });

  it('discloses timer fallback instead of reporting known source elapsed time', async () => {
    response.source.elapsedDurationSeconds = null;
    response.segments = [{ id: 'session', kind: 'unknown', provenance: 'unknown', startSeconds: 0, endSeconds: 970,
      measurements: { durationSeconds: 970, elapsedDurationSeconds: 970, distanceMeters: 3650, averageHeartRate: null, hrCoverageSeconds: 0, measurementProvenance: 'source-summary' } }];
    mount();
    await screen.findByRole('table');
    expect(screen.getByText(/Source elapsed time is unavailable/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Source timer' })).toBeInTheDocument();
  });

  it('retains imported unlocated laps in the table and index chart without placing them at elapsed zero', async () => {
    response.segments[0] = { ...response.segments[0], startSeconds: null, endSeconds: null,
      measurements: { ...response.segments[0].measurements, elapsedDurationSeconds: null, averageHeartRate: null, hrCoverageSeconds: 0 } };
    response.sourceSegments = structuredClone(response.segments);
    const { container } = mount();
    await screen.findByRole('table');
    expect(container.querySelectorAll('[data-segment-kind]')).toHaveLength(10);
    expect(screen.getByText(/1 segments lack elapsed boundaries/)).toBeInTheDocument();
    expect(screen.getByText('Unassigned elapsed time: Unavailable')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(12);
    fireEvent.click(screen.getByRole('button', { name: 'Segment index' }));
    expect(container.querySelectorAll('[data-segment-kind]')).toHaveLength(11);
  });

  it('shows all source elapsed time as unassigned for an explicitly empty segment list', async () => {
    response.segments = [];
    mount();
    await screen.findByText('No segments available');
    expect(screen.getByText('Unassigned elapsed time: 17:30')).toBeInTheDocument();
  });

  it.each(['en', 'zh-CN'])('discloses the API trapezoid/10-second integration rule in %s', async (lang) => {
    state.lang = lang;
    state.messages = locales[lang === 'en' ? 0 : 1];
    mount();
    await screen.findByRole('table');
    expect(screen.getByText(lang === 'en' ? /trapezoidal integration/ : /梯形积分/)).toHaveTextContent('10');
    expect(screen.getByText(lang === 'en' ? /trapezoidal integration/ : /梯形积分/)).toHaveTextContent(lang === 'en' ? 'both endpoints' : '两个端点');
  });

  it('F3 renders 300s/1000m as 5:00/km and 8:03/mi while stationary row pace stays unavailable', async () => {
    response = stationaryWorkFixture();
    const { container } = mount();
    await screen.findByRole('table');
    const summary = container.querySelector('.run-interval__summaries > .is-work');
    expect(within(summary).getByText('5:00 /km')).toBeInTheDocument();
    expect(within(summary).getByText(/2\/2 segments included in aggregate pace/)).toBeInTheDocument();
    const stationaryRow = screen.getByText('Stationary work').closest('tr');
    expect(within(stationaryRow).getAllByText('Unavailable')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'mi' }));
    expect(within(summary).getByText('8:03 /mi')).toBeInTheDocument();
    expect(within(stationaryRow).getByText('0.000 mi')).toBeInTheDocument();
  });

  it.each(['en', 'zh-CN'])('F3 explicitly labels partial pace scope for unavailable stationary measurements in %s', async (lang) => {
    state.lang = lang;
    state.messages = locales[lang === 'en' ? 0 : 1];
    response = stationaryWorkFixture();
    response.segments[1].measurements.distanceMeters = null;
    const { container } = mount();
    await screen.findByRole('table');
    const summary = container.querySelector('.run-interval__summaries > .is-work');
    expect(within(summary).getByText('4:00 /km')).toBeInTheDocument();
    expect(within(summary).getByText(lang === 'en' ? /Partial pace: 1\/2/ : /部分配速：1\/2/)).toBeInTheDocument();
  });
});
