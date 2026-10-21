import { describe, expect, it } from 'vitest';
import * as model from './conditionComparisonModel.js';

const segment = (id, distanceMeters, durationSeconds, averageHeartRate = null, hrCoverageSeconds = 0) => ({
  id, kind: 'work', distanceMeters, durationSeconds, elapsedDurationSeconds: durationSeconds, averageHeartRate, hrCoverageSeconds,
});
const session = (id, date, conditions = {}) => ({
  id: String(id), accountLocalDate: date, accountLocalTime: '07:00:00',
  distanceMeters: 1000, durationSeconds: 300, elapsedDurationSeconds: 300, averageHeartRate: null, hrCoverageSeconds: 0,
  perceivedExertion: null, conditions, segments: [],
});

describe('explicit comparison selection and matching', () => {
  it('selects no sessions implicitly and preserves same-day doubles by stable activity id', () => {
    expect(typeof model.compareSessions).toBe('function');
    const sessions = [session('a', '2026-10-01'), session('b', '2026-10-01')];
    expect(model.compareSessions(sessions, { referenceId: 'a' }).map(row => row.included)).toEqual([false, false]);
    expect(model.compareSessions(sessions, { referenceId: 'a', selectedIds: ['a', 'b'] }).map(row => row.id)).toEqual(['a', 'b']);
  });

  it('excludes unknown dimensions when a matching rule is enabled, including unknown reference', () => {
    const sessions = [session('a', '2026-10-01', { surface: { value: 'track', provenance: 'declared' } }),
      session('b', '2026-10-02'), session('c', '2026-10-03', { surface: { value: 'road', provenance: 'recorded' } })];
    const rows = model.compareSessions(sessions, { referenceId: 'a', selectedIds: ['a', 'b', 'c'], rules: ['surface'] });
    expect(rows.map(row => row.included)).toEqual([true, false, false]);
    expect(rows[1].reasons).toContainEqual({ dimension: 'surface', reason: 'unknown' });
    expect(rows[2].reasons).toContainEqual({ dimension: 'surface', reason: 'different' });
    expect(model.compareSessions(sessions, { referenceId: 'b', selectedIds: ['b'], rules: ['surface'] })[1].included).toBe(false);
    expect(model.compareSessions(sessions, { referenceId: 'a', selectedIds: ['a', 'b', 'c'] }).every(row => row.included)).toBe(true);
  });

  it('accepts only recorded/declared metadata and updates inclusion when declarations change', () => {
    const sessions = [session('a', '2026-10-01', { weather: { value: 'cool', provenance: 'declared' } }),
      session('b', '2026-10-02', { weather: { value: 'cool', provenance: 'derived' } })];
    const options = { referenceId: 'a', selectedIds: ['a', 'b'], rules: ['weather'] };
    expect(model.compareSessions(sessions, options)[1].included).toBe(false);
    sessions[1].conditions.weather.provenance = 'declared';
    expect(model.compareSessions(sessions, options)[1].included).toBe(true);
    sessions[1].conditions.weather.value = 'hot';
    expect(model.compareSessions(sessions, options)[1].included).toBe(false);
  });
});

describe('reproducible metrics', () => {
  it('F4 compares derived recovery on elapsed seconds without mixing source timer and runner boundary meanings', () => {
    const recoverySession = (id, timer, elapsed, provenance) => ({
      ...session(id, '2026-10-01'),
      segments: [segment('w1', 400, 120),
        { ...segment('r1', 0, timer), kind: 'recovery', elapsedDurationSeconds: elapsed, measurementProvenance: provenance }, segment('w2', 400, 120)],
    });
    const reference = recoverySession('a', 60, 120, 'source-lap');
    const rows = model.compareSessions([
      reference, recoverySession('b', 60, 60, 'derived-stream'),
      recoverySession('c', 30, 120, 'source-lap'), recoverySession('d', 120, 120, 'derived-stream'),
      recoverySession('e', 60, null, 'source-lap'),
    ], { referenceId: 'a', selectedIds: ['a', 'b', 'c', 'd', 'e'], rules: ['recovery'] });
    expect(rows.map(row => row.included)).toEqual([true, false, true, true, false]);
    expect(rows[1].reasons).toContainEqual({ dimension: 'recovery', reason: 'different' });
    expect(rows[4].reasons).toContainEqual({ dimension: 'recovery', reason: 'unknown' });
    const declared = recoverySession('e', 60, null, 'source-lap');
    declared.conditions.recovery = reference.conditions.recovery = { value: 'standing 120s', provenance: 'declared' };
    expect(model.compareSessions([reference, declared], { referenceId: 'a', selectedIds: ['a', 'e'], rules: ['recovery'] }).every(row => row.included)).toBe(true);
  });

  it('normalizes the exact backend envelope with declared conditions and original segment measurements', () => {
    expect(typeof model.normalizeSessionAnalysis).toBe('function');
    const response = { activityId: 7, name: 'Intervals', startTime: '2026-10-01T07:00:00',
      source: { distanceMeters: 1000, durationSeconds: 300, movingTimeSeconds: 300, elapsedDurationSeconds: 360 },
      sourceSegments: [],
      declarations: { segments: null, comparison: { surface: 'track', weather: 'cool' } },
      recorded: { rpe: { value: 8, provenance: 'recorded' }, conditions: { surface: { value: 'road', provenance: 'recorded' } } },
      measurements: { distanceMeters: 1000, durationSeconds: 300, elapsedDurationSeconds: 360, paceSecondsPerKm: 300, averageHeartRate: 160, hrCoverageSeconds: 180, hrCoverageFraction: 0.5, averageCadence: null, cadenceCoverageSeconds: 0, measurementProvenance: 'source-summary' },
      segments: [{ id: 'lap-1', kind: 'work', startSeconds: 0, endSeconds: 360, provenance: 'imported', measurements: { distanceMeters: 1000, durationSeconds: 300, elapsedDurationSeconds: 360, paceSecondsPerKm: 300, averageHeartRate: 160, hrCoverageSeconds: 180, hrCoverageFraction: 0.5, averageCadence: null, cadenceCoverageSeconds: 0, measurementProvenance: 'source-lap' } }],
    };
    const normalized = model.normalizeSessionAnalysis(response, { accountLocalDate: '2026-09-30', accountLocalTime: '23:00:00' });
    expect(normalized).toMatchObject({ id: '7', perceivedExertion: 8, accountLocalDate: '2026-09-30', accountLocalTime: '23:00:00' });
    expect(normalized.conditions.surface).toEqual({ value: 'track', provenance: 'declared' });
    expect(normalized.segments[0]).toMatchObject({ id: 'lap-1', kind: 'work', durationSeconds: 300, elapsedDurationSeconds: 360, measurementProvenance: 'source-lap' });
    const summary = model.summarizeComparisonScope(normalized, 'work', ['lap-1']);
    expect(summary.paceSecondsPerKm).toBe(300);
    expect(summary.elapsedDurationSeconds).toBe(360);
    expect(summary.hrCoveragePercent).toBe(50);
    expect(summary.rpeScope).toBe('session');
    expect(() => model.normalizeSessionAnalysis({})).toThrow();
  });

  it('matches recovery only from a known explicit sequence; unknown roles never become a recovery match', () => {
    const known = [segment('w1', 400, 120), { ...segment('r1', 200, 90), kind: 'recovery' }, segment('w2', 400, 120)];
    const sessions = [{ ...session('a', '2026-10-01'), segments: known },
      { ...session('b', '2026-10-02'), segments: known.map(s => ({ ...s, id: `copy-${s.id}` })) },
      { ...session('c', '2026-10-03'), segments: [{ ...known[0], kind: 'unknown' }] },
      { ...session('d', '2026-10-04'), segments: known.map(s => s.kind === 'recovery' ? { ...s, durationSeconds: 60, elapsedDurationSeconds: 60 } : s) }];
    const rows = model.compareSessions(sessions, { referenceId: 'a', selectedIds: ['a', 'b', 'c', 'd'], rules: ['recovery'] });
    expect(rows.map(row => row.included)).toEqual([true, true, false, false]);
    expect(rows[2].reasons).toContainEqual({ dimension: 'recovery', reason: 'unknown' });
  });

  it('weights work pace by distance and measured HR by covered time, never deleting missing-HR work', () => {
    expect(typeof model.summarizeComparisonScope).toBe('function');
    const input = { ...session('a', '2026-10-01'), segments: [
      segment('w1', 1000, 240, 150, 120), segment('w2', 500, 180, 180, 180),
      segment('w3', 500, 150), { ...segment('r1', 100, 100, 100, 100), kind: 'recovery' },
      { ...segment('u1', 500, 200, 160, 200), kind: 'unknown' },
    ] };
    const result = model.summarizeComparisonScope(input, 'work', ['w1', 'w2', 'w3', 'r1', 'u1']);
    expect(result.sourceRows.map(row => row.id)).toEqual(['w1', 'w2', 'w3']);
    expect(result.distanceMeters).toBe(2000);
    expect(result.durationSeconds).toBe(570);
    expect(result.paceSecondsPerKm).toBe(285);
    expect(result.averageHeartRate).toBe(168);
    expect(result.hrCoverageSeconds).toBe(300);
    expect(result.hrCoveragePercent).toBeCloseTo(300 / 570 * 100);
    expect(model.summarizeComparisonScope(input, 'work', []).paceSecondsPerKm).toBeNull();
  });

  it('does not infer HR coverage or turn null/zero metrics and RPE into measured values', () => {
    const input = { ...session('a', '2026-10-01'), averageHeartRate: 160, segments: [segment('w1', 1000, 300, 160)] };
    expect(model.summarizeComparisonScope(input, 'work', ['w1']).averageHeartRate).toBeNull();
    expect(model.summarizeComparisonScope(input, 'whole').averageHeartRate).toBeNull();
    expect(model.summarizeComparisonScope(input, 'whole').hrCoveragePercent).toBe(0);
    expect(model.summarizeComparisonScope({ ...input, averageHeartRate: 0, distanceMeters: 0 }, 'whole').paceSecondsPerKm).toBeNull();
    expect(model.summarizeComparisonScope({ ...input, averageHeartRate: null }, 'whole').averageHeartRate).toBeNull();
    expect(model.summarizeComparisonScope(input, 'whole').perceivedExertion).toBeNull();
    expect(model.summarizeComparisonScope({ ...input, perceivedExertion: 8 }, 'whole').perceivedExertion).toBe(8);
  });

  it('keeps explicitly unknown elapsed duration null instead of inventing an HR coverage denominator', () => {
    const input = { ...session('a', '2026-10-01'), elapsedDurationSeconds: null, averageHeartRate: 150, hrCoverageSeconds: 120 };
    expect(model.summarizeComparisonScope(input, 'whole').elapsedDurationSeconds).toBeNull();
    expect(model.summarizeComparisonScope(input, 'whole').hrCoveragePercent).toBeNull();
    expect(model.summarizeComparisonScope(input, 'whole').paceSecondsPerKm).toBe(300);
  });

  it('uses the fresh source account zone for instant dates and keeps unknown elapsed dates off the chart', () => {
    const input = [
      { ...session('a', '1999-01-01'), activityInstant: '2026-10-05T03:55:00Z', accountTimeZone: 'America/New_York' },
      { ...session('b', '1999-01-01'), activityInstant: '2026-10-06T04:05:00Z', accountTimeZone: 'America/New_York' },
      { ...session('c', ''), startTime: null },
    ];
    const points = model.progressionPoints(model.compareSessions(input, { selectedIds: ['a', 'b', 'c'] }));
    expect(points.map(point => point.dateKey)).toEqual(['2026-10-04', '2026-10-06']);
    expect(points.map(point => point.id)).toEqual(['a', 'b']);
  });

  it('prefers explicit recovery declarations and rejects unknown recovery distances in derived rules', () => {
    const input = { ...session('a', '2026-10-01'), segments: [{ ...segment('r1', null, 60), kind: 'recovery' }] };
    expect(model.conditionValue(input, 'recovery')).toBeNull();
    input.conditions.recovery = { value: 'standing 60s', provenance: 'declared' };
    expect(model.conditionValue(input, 'recovery')).toBe('standing 60s');
  });

  it('reports a measured zero coverage honestly when elapsed duration is known', () => {
    const result = model.summarizeComparisonScope(session('a', '2026-10-01'), 'whole');
    expect(result.averageHeartRate).toBeNull();
    expect(result.hrCoverageSeconds).toBe(0);
    expect(result.hrCoveragePercent).toBe(0);
  });

  it('keeps a selected stationary work segment in combined time/distance pace', () => {
    const input = { ...session('a', '2026-10-01'), segments: [segment('w1', 1000, 240), segment('w2', 0, 60)] };
    const result = model.summarizeComparisonScope(input, 'work', ['w1', 'w2']);
    expect(result.distanceMeters).toBe(1000);
    expect(result.durationSeconds).toBe(300);
    expect(result.paceSecondsPerKm).toBe(300);
    expect(result.sourceRows).toHaveLength(2);
  });

  it('requires explicit segment selection; includes pace-only points and uses elapsed date spacing', () => {
    expect(typeof model.progressionPoints).toBe('function');
    const sessions = [session('a', '2026-10-01'), session('b', '2026-10-02'), session('c', '2026-10-11'), session('d', '2026-10-11')];
    const rows = model.compareSessions(sessions, { referenceId: 'a', selectedIds: ['a', 'b', 'c', 'd'] });
    const points = model.progressionPoints(rows);
    expect(points.map(p => p.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(points.map(p => p.datePosition)).toEqual([0, 0.1, 1, 1]);
    expect(points.every(p => p.averageHeartRate === null)).toBe(true);
    expect(model.progressionPoints(model.compareSessions(sessions, { selectedIds: ['a'], scope: 'work' }))).toEqual([]);
  });

  it('converts pace and distance units consistently without changing source values', () => {
    expect(typeof model.paceInUnit).toBe('function');
    expect(model.paceInUnit(300, 'mile')).toBeCloseTo(482.8032);
    expect(model.paceInUnit(300, 'km')).toBe(300);
    expect(model.distanceInUnit(1609.344, 'mile')).toBe(1);
    expect(model.distanceInUnit(0, 'km')).toBe(0);
    expect(model.paceInUnit(null, 'mile')).toBeNull();
  });
});
