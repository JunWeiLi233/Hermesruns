import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as component from './ConditionSessionComparison.jsx';
import { apiJson } from '../../api';

vi.mock('../../api', () => ({ apiJson: vi.fn() }));
let language = 'en';
vi.mock('../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: language, t: key => key }) }));

const metric = (distanceMeters, durationSeconds, averageHeartRate = null, hrCoverageSeconds = 0) => ({
  distanceMeters, durationSeconds, elapsedDurationSeconds: durationSeconds, paceSecondsPerKm: durationSeconds * 1000 / distanceMeters,
  averageHeartRate, hrCoverageSeconds, hrCoverageFraction: hrCoverageSeconds / durationSeconds,
  averageCadence: null, cadenceCoverageSeconds: 0, measurementProvenance: 'source-lap',
});
const fixture = (id, date, surface = null) => ({
  activityId: id, name: `Session ${id}`, startTime: `${date}T07:00:00`, startDate: `${date}T07:00:00`,
  source: { provider: 'TCX', distanceMeters: 1500, durationSeconds: 480, movingTimeSeconds: 480, elapsedDurationSeconds: 480, importedLapsSupported: true },
  declarations: { segments: null, comparison: { workout: '2 reps', route: null, terrain: null, surface, weather: null } },
  sourceSegments: [],
  segments: [
    { id: 'lap-1', kind: 'work', startSeconds: 0, endSeconds: 240, label: 'Active', targetPaceSecondsPerKm: null, provenance: 'imported', measurements: metric(1000, 240, 150, 120) },
    { id: 'lap-2', kind: 'work', startSeconds: 240, endSeconds: 420, label: 'Active', targetPaceSecondsPerKm: null, provenance: 'imported', measurements: metric(500, 180) },
  ],
  measurements: { ...metric(1500, 480), measurementProvenance: 'source-summary' },
  recorded: { rpe: { value: null, provenance: 'unavailable' }, conditions: Object.fromEntries(['workout', 'route', 'terrain', 'surface', 'weather'].map(key => [key, { value: null, provenance: 'unavailable' }])) },
  updatedAt: null,
});
let responses;
beforeEach(() => {
  language = 'en';
  responses = { 1: fixture(1, '2026-10-01', 'track'), 2: fixture(2, '2026-10-02'), 3: fixture(3, '2026-10-11', 'track'), 4: fixture(4, '2026-10-11', 'track') };
  apiJson.mockReset();
  apiJson.mockImplementation(async (url, options) => {
    const match = url.match(/^\/api\/activities\/(\d+)\/session-analysis$/);
    if (!match) throw new Error(`Unexpected API URL: ${url}`);
    const id = match[1];
    if (options?.method === 'PUT') responses[id].declarations = { ...responses[id].declarations, ...JSON.parse(options.body) };
    return structuredClone(responses[id]);
  });
});
afterEach(cleanup);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const malformed = [
  ['empty session measurements', value => { value.measurements = {}; }],
  ['absent segment measurements', value => { delete value.segments[0].measurements; }],
  ['absent comparison object', value => { delete value.declarations.comparison; }],
  ['string session number', value => { value.measurements.durationSeconds = '480'; }],
  ['string nested HR', value => { value.segments[0].measurements.averageHeartRate = '150'; }],
  ['nonfinite nested distance', value => { value.segments[0].measurements.distanceMeters = Infinity; }],
];
const props = { activityId: 1, token: 'synthetic-test-token', recentRuns: [1, 2, 3, 4].map(id => ({ id, name: `Session ${id}` })) };
async function open(overrides = {}) {
  expect(typeof component.default).toBe('function');
  const result = render(<component.default {...props} {...overrides} />);
  await screen.findByRole('checkbox', { name: 'Include Session 1' });
  return result;
}
const row = id => screen.getByRole('row', { name: new RegExp(`Session ${id}\\b`) });
async function select(id) {
  fireEvent.click(screen.getByRole('checkbox', { name: `Include Session ${id}` }));
  await waitFor(() => expect(row(id)).not.toHaveTextContent('Loading'));
}

it('defaults to explicit selection, plots distinct doubles on elapsed dates, and switches units internally', async () => {
  await open();
  expect(screen.getByRole('checkbox', { name: 'Include Session 1' })).not.toBeChecked();
  for (const id of [1, 2, 3, 4]) await select(id);
  const chart = screen.getByRole('img', { name: 'Pace by date' });
  const dots = [...chart.querySelectorAll('[data-activity-id]')];
  expect(dots).toHaveLength(4);
  const positions = Object.fromEntries(dots.map(dot => [dot.dataset.activityId, Number(dot.getAttribute('cx'))]));
  expect((positions[2] - positions[1]) / (positions[3] - positions[1])).toBeCloseTo(0.1);
  expect(positions[3]).toBe(positions[4]);
  expect(row(1)).toHaveTextContent('5:20 /km');
  expect(row(1)).toHaveTextContent('Pace only');
  fireEvent.click(screen.getByRole('button', { name: 'mi' }));
  expect(row(1)).toHaveTextContent('8:35 /mi');
  expect(screen.getByText(/does not establish a causal fitness improvement/)).toBeInTheDocument();
});

it('keeps calculation details collapsed while selected session measurements stay visible', async () => {
  await open(); await select(1);
  expect(row(1)).toHaveTextContent('5:20 /km');
  const explanation = screen.getByText('How this is calculated', { selector: 'summary' });
  expect(explanation.closest('details')).not.toHaveAttribute('open');
  expect(screen.getByText(/Pace = Σ time/)).not.toBeVisible();
  fireEvent.click(explanation);
  expect(screen.getByText(/Pace = Σ time/)).toBeVisible();
  expect(screen.getByRole('checkbox', { name: 'Include Session 1' })).toBeChecked();
});

it('folds the comparison section without losing selection or an unsaved condition draft', async () => {
  await open(); await select(1);
  fireEvent.click(within(row(1)).getByRole('button', { name: 'Edit conditions' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Weather' }), { target: { value: 'windy draft' } });
  const callsBeforeFold = apiJson.mock.calls.length;
  const collapse = screen.getByRole('button', { name: 'Collapse condition-matched sessions' });
  expect(collapse).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(collapse);
  expect(screen.getByRole('heading', { name: 'Condition-matched sessions' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Expand condition-matched sessions' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('checkbox', { name: 'Include Session 1' })).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Weather' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Expand condition-matched sessions' }));
  expect(screen.getByRole('checkbox', { name: 'Include Session 1' })).toBeChecked();
  expect(screen.getByRole('textbox', { name: 'Weather' })).toHaveValue('windy draft');
  expect(apiJson).toHaveBeenCalledTimes(callsBeforeFold);
});

it('shows candidate dates before selection without treating history summaries as measured comparison data', async () => {
  await open({ recentRuns: [{ id: 2, name: 'Session 2', accountLocalDate: '2026-10-02', accountLocalTime: '07:00:00', distanceMeters: 1234, durationSeconds: 999, averageHeartRate: 199 }] });
  await waitFor(() => expect(row(1)).not.toHaveTextContent('Loading'));
  expect(row(2)).toHaveTextContent('Oct 2');
  expect(row(2)).not.toHaveTextContent('199 bpm');
  expect(row(2)).not.toHaveTextContent('1.234 km');
  expect(row(2)).not.toHaveTextContent('Pace only');
  expect(screen.queryByRole('img', { name: 'Pace by date' })).not.toBeInTheDocument();
  expect(apiJson).toHaveBeenCalledTimes(1);
});

it('updates inclusion and charts together for rules and saved declarations while preserving latest interval edits', async () => {
  await open();
  await select(1); await select(2);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Match Surface' }));
  expect(row(2)).toHaveTextContent('Surface: unavailable');
  expect(screen.getByRole('img', { name: 'Pace by date' }).querySelectorAll('[data-activity-id]')).toHaveLength(1);
  fireEvent.click(within(row(2)).getByRole('button', { name: 'Edit conditions' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Surface' }), { target: { value: 'track' } });
  responses[2].declarations.segments = [{ id: 'new-boundary', kind: 'unknown', startSeconds: 0, endSeconds: 480, label: 'Latest edit', targetPaceSecondsPerKm: null }];
  fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
  await screen.findByText('Declarations saved.');
  expect(row(2)).toHaveTextContent('Included');
  expect(responses[2].declarations.segments[0].id).toBe('new-boundary');
  expect(responses[2].declarations.comparison.workout).toBe('2 reps');
  expect(apiJson.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body).not.toContain('segments');
  expect(screen.getByRole('img', { name: 'Pace by date' }).querySelectorAll('[data-activity-id]')).toHaveLength(2);
});

it('requires selected work segments, shows weighted source rows, and retains missing-HR work', async () => {
  await open(); await select(1);
  fireEvent.click(screen.getByRole('radio', { name: 'Selected work segments' }));
  expect(screen.queryByRole('img', { name: 'Pace by date' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: /Session 1.*lap-1/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Session 1.*lap-2/ }));
  expect(row(1)).toHaveTextContent('4:40 /km');
  expect(row(1)).toHaveTextContent('150 bpm');
  expect(row(1)).toHaveTextContent('120 / 420 s');
  expect(screen.getByText(/Σ time ÷ Σ distance/)).toBeInTheDocument();
  expect(screen.getByRole('table', { name: /Source work rows/ })).toHaveTextContent('lap-2');
  expect(screen.getByRole('table', { name: /Source work rows/ })).toHaveTextContent('HR unavailable');
});

it('uses detected work automatically, allows deselecting all, and keeps that choice on refresh', async () => {
  responses[1].segments.forEach(segment => { segment.provenance = 'auto-detected'; });
  await open(); await select(1);
  fireEvent.click(screen.getByRole('radio', { name: 'Selected work segments' }));
  expect(screen.getByRole('img', { name: 'Pace by date' })).toBeInTheDocument();
  expect(row(1)).toHaveTextContent('4:40 /km');
  const boxes = screen.getAllByRole('checkbox', { name: /Session 1.*lap-/ });
  expect(boxes).toHaveLength(2);
  boxes.forEach(box => { expect(box).toBeChecked(); fireEvent.click(box); });
  expect(row(1)).toHaveTextContent('No work segments selected');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh source values' }));
  await waitFor(() => expect(row(1)).not.toHaveTextContent('Loading'));
  expect(row(1)).toHaveTextContent('No work segments selected');
  expect(screen.getByRole('checkbox', { name: /Session 1.*lap-1/ })).not.toBeChecked();
});

it('shows load ownership errors, offers Retry, and renders Chinese copy', async () => {
  apiJson.mockRejectedValueOnce(Object.assign(new Error('not found'), { status: 404 }));
  const result = await open();
  await screen.findByText(/not available to this account/);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.queryByText(/not available to this account/)).not.toBeInTheDocument());
  language = 'zh-CN';
  result.rerender(<component.default {...props} />);
  expect(screen.getByRole('heading', { name: '同条件训练对比' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'mi' })).toBeInTheDocument();
});

it('ignores late GET results after changing the current activity', async () => {
  let resolveFirst;
  apiJson.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
  const result = await open();
  result.rerender(<component.default {...props} activityId={3} />);
  await waitFor(() => expect(apiJson).toHaveBeenCalledWith('/api/activities/3/session-analysis', expect.anything()));
  await act(async () => resolveFirst(fixture(1, '2026-10-01')));
  expect(screen.getByRole('combobox', { name: 'Reference session' })).toHaveValue('3');
});

it('preserves an unsaved condition draft when intervals refresh and saves only edited dimensions', async () => {
  const result = await open(); await select(1);
  fireEvent.click(within(row(1)).getByRole('button', { name: 'Edit conditions' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Surface' }), { target: { value: 'trail' } });
  responses[1].declarations.comparison.weather = 'cool';
  responses[1].segments = [responses[1].segments[0]];
  result.rerender(<component.default {...props} refreshToken={1} />);
  await waitFor(() => expect(row(1)).not.toHaveTextContent('Loading'));
  expect(screen.getByRole('textbox', { name: 'Surface' })).toHaveValue('trail');
  fireEvent.click(screen.getByRole('radio', { name: 'Selected work segments' }));
  expect(screen.queryByRole('checkbox', { name: /Session 1.*lap-2/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
  await screen.findByText('Declarations saved.');
  expect(responses[1].declarations.comparison).toMatchObject({ surface: 'trail', weather: 'cool' });
});

it('retains save drafts on errors and retries through the authenticated backend path', async () => {
  await open(); await select(1);
  fireEvent.click(within(row(1)).getByRole('button', { name: 'Edit conditions' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Weather' }), { target: { value: 'windy' } });
  const original = apiJson.getMockImplementation();
  apiJson.mockImplementation(async (url, options) => {
    if (options?.method === 'PUT') throw Object.assign(new Error('conflict'), { status: 409 });
    return original(url, options);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
  await screen.findByText(/Could not save declarations/);
  expect(screen.getByRole('textbox', { name: 'Weather' })).toHaveValue('windy');
  expect(responses[1].declarations.comparison.weather).toBeNull();
  apiJson.mockImplementation(original);
  fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
  await screen.findByText('Declarations saved.');
  expect(responses[1].declarations.comparison.weather).toBe('windy');
});

it('fails closed on a foreign activity envelope rather than showing its measurements', async () => {
  apiJson.mockResolvedValueOnce(fixture(999, '2026-10-01', 'track'));
  await open();
  await screen.findByText(/Could not load this session/);
  expect(screen.queryByText('Session 999')).not.toBeInTheDocument();
  await select(1);
  expect(row(1)).toHaveTextContent('Session 1');
});

it('caps candidates at 20 recent plus current and loads only explicit selections with at most 3 requests', async () => {
  const recentRuns = Array.from({ length: 45 }, (_, index) => ({ id: index + 2, name: `Session ${index + 2}` }));
  await open({ recentRuns, currentRun: { id: 1, name: 'Session 1' } });
  expect(screen.getAllByRole('checkbox', { name: /^Include Session/ })).toHaveLength(21);
  expect(screen.getByText(/up to 20 recent/)).toBeInTheDocument();
  await waitFor(() => expect(row(1)).not.toHaveTextContent('Loading'));
  expect(apiJson).toHaveBeenCalledTimes(1);
  let active = 0, maxActive = 0;
  apiJson.mockImplementation(async (url, { signal }) => {
    active++; maxActive = Math.max(maxActive, active);
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 15);
      signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
    active--;
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const id = Number(url.match(/activities\/(\d+)/)[1]);
    return fixture(id, '2026-10-02', 'track');
  });
  await act(async () => {
    for (const id of [1, 2, 3, 4, 5]) fireEvent.click(screen.getByRole('checkbox', { name: `Include Session ${id}` }));
  });
  await waitFor(() => expect(row(5)).toHaveTextContent('Included'));
  expect(maxActive).toBeLessThanOrEqual(3);
  expect(apiJson.mock.calls.every(([url]) => !url.includes('/6/'))).toBe(true);
});

it.each(['ready', 'error'])('F1 retires deselected pending GETs and keeps active %s Refresh/Retry usable', async outcome => {
  await open(); await waitFor(() => expect(row(1)).not.toHaveTextContent('Loading'));
  const original = apiJson.getMockImplementation();
  const pending = deferred();
  let failCurrent = false;
  apiJson.mockImplementation((url, options) => {
    if (url.includes('/2/')) return pending.promise;
    if (failCurrent) return Promise.reject(new Error('Active request failure'));
    return original(url, options);
  });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Include Session 2' }));
  await waitFor(() => expect(apiJson).toHaveBeenCalledWith('/api/activities/2/session-analysis', expect.anything()));
  failCurrent = outcome === 'error';
  fireEvent.click(screen.getByRole('checkbox', { name: 'Include Session 2' }));
  await waitFor(() => expect(row(1)).not.toHaveTextContent('Loading'));
  expect(screen.getByRole('button', { name: outcome === 'error' ? 'Retry' : 'Refresh source values' })).toBeEnabled();
  expect(screen.getByRole('status')).not.toHaveTextContent('Loading');
  await act(async () => pending.resolve(fixture(2, '2026-10-02')));
  expect(row(2)).not.toHaveTextContent('Loading');
});

it('F1 stops treating a retired error as an active Retry target', async () => {
  await open(); await waitFor(() => expect(row(1)).not.toHaveTextContent('Loading'));
  const original = apiJson.getMockImplementation();
  apiJson.mockImplementation((url, options) => url.includes('/2/') ? Promise.reject(new Error('Session 2 failed')) : original(url, options));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Include Session 2' }));
  await screen.findByText(/Could not load this session/);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Include Session 2' }));
  await waitFor(() => expect(row(1)).not.toHaveTextContent('Loading'));
  expect(screen.getByRole('button', { name: 'Refresh source values' })).toBeEnabled();
});

it.each(['old response', 'late error'])('F2 rejects a pre-save background GET %s delivered after PUT success', async outcome => {
  responses[2].declarations.comparison.surface = 'road';
  const result = await open(); await select(1); await select(2);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Match Surface' }));
  expect(row(2)).toHaveTextContent('Surface: different');
  fireEvent.click(within(row(2)).getByRole('button', { name: 'Edit conditions' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Surface' }), { target: { value: 'track' } });
  const original = apiJson.getMockImplementation();
  const put = deferred(), background = deferred();
  let holdBackground = false;
  const oldSnapshot = structuredClone(responses[2]);
  apiJson.mockImplementation(async (url, options) => {
    if (url.includes('/2/') && options?.method === 'PUT') { await put.promise; return original(url, options); }
    if (url.includes('/2/') && holdBackground) return background.promise;
    return original(url, options);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
  await waitFor(() => expect(apiJson.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true));
  holdBackground = true;
  result.rerender(<component.default {...props} refreshToken={1} />);
  await waitFor(() => expect(row(2)).toHaveTextContent('Loading'));
  await act(async () => put.resolve());
  await screen.findByText('Declarations saved.');
  expect(row(2)).toHaveTextContent('Included');
  expect(screen.getByRole('img', { name: 'Pace by date' }).querySelectorAll('[data-activity-id]')).toHaveLength(2);
  await act(async () => outcome === 'late error' ? background.reject(new Error('Pre-save GET failed late')) : background.resolve(oldSnapshot));
  expect(row(2)).toHaveTextContent('Included');
  expect(row(2)).not.toHaveTextContent('Surface: different');
  expect(screen.getByText('Declarations saved.')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Pace by date' }).querySelectorAll('[data-activity-id]')).toHaveLength(2);
  fireEvent.click(within(row(2)).getByRole('button', { name: 'Edit conditions' }));
  expect(screen.getByRole('textbox', { name: 'Surface' })).toHaveValue('track');
});

it.each(malformed)('F5 rejects GET %s and enables localized Retry', async (_name, corrupt) => {
  const invalid = fixture(1, '2026-10-01', 'track'); corrupt(invalid);
  apiJson.mockResolvedValueOnce(invalid);
  await open();
  await screen.findByText(/Could not load this session/);
  expect(within(row(1)).getByRole('button', { name: 'Edit conditions' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(within(row(1)).getByRole('button', { name: 'Edit conditions' })).toBeEnabled());
});

it.each(malformed)('F5 rejects PUT %s and retains the draft for a validated retry', async (_name, corrupt) => {
  await open(); await select(1);
  fireEvent.click(within(row(1)).getByRole('button', { name: 'Edit conditions' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Surface' }), { target: { value: 'trail' } });
  const original = apiJson.getMockImplementation();
  apiJson.mockImplementation(async (url, options) => {
    const value = await original(url, options);
    if (options?.method === 'PUT') corrupt(value);
    return value;
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
  await screen.findByText(/Could not save declarations/);
  expect(screen.queryByText('Declarations saved.')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Surface' })).toHaveValue('trail');
  apiJson.mockImplementation(original);
  fireEvent.click(screen.getByRole('button', { name: 'Save declarations' }));
  await screen.findByText('Declarations saved.');
});

it('F5 accepts valid empty segments and explicit nullable HR/elapsed measurements', async () => {
  responses[1].segments = [];
  responses[1].measurements.elapsedDurationSeconds = null;
  responses[1].source.elapsedDurationSeconds = null;
  await open(); await select(1);
  expect(within(row(1)).getByRole('button', { name: 'Edit conditions' })).toBeEnabled();
  expect(row(1)).toHaveTextContent('Coverage unavailable');
  expect(row(1)).toHaveTextContent('5:20 /km');
  expect(screen.queryByText(/Could not load this session/)).not.toBeInTheDocument();
});
