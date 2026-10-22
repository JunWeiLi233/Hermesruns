import { beforeAll, describe, expect, it } from 'vitest';
import { intervalFixture, stationaryWorkFixture } from './intervalFixtures';

let model;
beforeAll(async () => {
  const path = '../intervalAnalysisModel.js';
  model = await import(/* @vite-ignore */ path).catch(() => ({}));
});

describe('interval analysis source model', () => {
  it('combines warm-up and cool-down using summed pace and coverage-weighted HR', () => {
    const fixture = intervalFixture();
    fixture.segments = [
      { ...fixture.segments[0], kind: 'warmup', startSeconds: 0, endSeconds: 900,
        measurements: { ...fixture.segments[0].measurements, durationSeconds: 900, distanceMeters: 2000, averageHeartRate: 138, hrCoverageSeconds: 900 } },
      { ...fixture.segments[1], kind: 'cooldown', startSeconds: 900, endSeconds: 1500,
        measurements: { ...fixture.segments[1].measurements, durationSeconds: 600, distanceMeters: 1800, averageHeartRate: 140, hrCoverageSeconds: 500 } },
    ];
    const summary = model.buildIntervalModel(fixture).warmupCooldownSummary;
    expect(summary.count).toBe(2);
    expect(summary.paceSecPerKm).toBeCloseTo(1500 / 3.8);
    expect(summary.averageHeartRate).toBeCloseTo((138 * 900 + 140 * 500) / 1400);
    expect(summary.hrCoverageFraction).toBeCloseTo(1400 / 1500);
  });

  it('preserves six works and five recoveries and immutable source totals', () => {
    expect(model.buildIntervalModel).toBeTypeOf('function');
    const source = intervalFixture();
    const snapshot = JSON.stringify(source);
    const result = model.buildIntervalModel(source);
    expect(result.lanes.work).toHaveLength(6);
    expect(result.lanes.recovery).toHaveLength(5);
    expect(result.sourceTotals).toEqual(source.source);
    expect(JSON.stringify(source)).toBe(snapshot);
    expect(result.summary.work.distanceMeters).toBe(3150);
    expect(result.summary.work.durationSeconds).toBe(720);
    expect(result.summary.work.paceSecPerKm).toBeCloseTo(720 / 3.15);
  });

  it('keeps missing HR in three of six work segments and weights HR only by measured duration', () => {
    expect(model.buildIntervalModel).toBeTypeOf('function');
    const result = model.buildIntervalModel(intervalFixture({ missingHr: true }));
    expect(result.lanes.work).toHaveLength(6);
    expect(result.lanes.work.filter((segment) => segment.averageHeartRate === null)).toHaveLength(3);
    expect(result.summary.work.hrCoverageSeconds).toBe(95 + 115 + 135);
    expect(result.summary.work.averageHeartRate).toBeCloseTo((150 * 95 + 152 * 115 + 154 * 135) / 345);
    expect(result.summary.work.hrCoverageFraction).toBeCloseTo(345 / 750);
  });

  it('never infers alternating work/rest and retains elapsed pauses and unknown lane', () => {
    expect(model.buildIntervalModel).toBeTypeOf('function');
    const result = model.buildIntervalModel(intervalFixture({ unknown: true }));
    expect(result.lanes.unknown).toHaveLength(11);
    expect(result.lanes.work).toHaveLength(0);
    expect(result.segments[1].startSeconds).toBe(100);
    expect(result.segments[0].elapsedSeconds).toBe(100);
    expect(result.segments[0].durationSeconds).toBe(95);
  });

  it('has explicit nulls for unavailable measurements and handles empty data', () => {
    expect(model.buildIntervalModel).toBeTypeOf('function');
    expect(model.buildIntervalModel({ segments: [] }).segments).toEqual([]);
    const result = model.buildIntervalModel({ segments: [{ id: 'a', startSeconds: 0, endSeconds: 50 }] });
    expect(result.lanes.unknown).toHaveLength(1);
    expect(result.segments[0].paceSecPerKm).toBeNull();
    expect(result.segments[0].averageHeartRate).toBeNull();
    expect(result.segments[0].distanceMeters).toBeNull();
    expect(result.summary.unknown.averageHeartRate).toBeNull();
  });

  it('converts distance and pace consistently to miles without modifying SI source', () => {
    expect(model.intervalUnitValues).toBeTypeOf('function');
    const converted = model.intervalUnitValues({ distanceMeters: 1609.344, paceSecPerKm: 300 }, 'imperial');
    expect(converted).toMatchObject({ distance: 1, distanceUnit: 'mi', paceUnit: '/mi' });
    expect(converted.paceSeconds).toBeCloseTo(482.8032, 8);
    expect(model.intervalUnitValues({ distanceMeters: null, paceSecPerKm: null }, 'metric')).toEqual({ distance: null, paceSeconds: null, distanceUnit: 'km', paceUnit: '/km' });
  });

  it('validates edited boundaries, permits gaps, and never sends derived or source telemetry as declarations', () => {
    expect(model.validateIntervalDraft).toBeTypeOf('function');
    expect(model.intervalSavePayload).toBeTypeOf('function');
    const draft = [{ id: 'a', startSeconds: 10, endSeconds: 50, kind: 'work', label: '', targetPaceSecondsPerKm: null, distanceMeters: 123 }];
    expect(model.validateIntervalDraft(draft, 100)).toEqual([]);
    expect(model.validateIntervalDraft([{ ...draft[0], endSeconds: 150 }], 100)).toContain('outsideSource');
    expect(model.validateIntervalDraft([{ ...draft[0], endSeconds: 10 }], 100)).toContain('invalidBoundary');
    expect(model.validateIntervalDraft([draft[0], { id: 'b', startSeconds: 30, endSeconds: 70, kind: 'unknown' }], 100)).toContain('overlap');
    expect(model.intervalSavePayload(draft)).toEqual({ segments: [{ id: 'a', startSeconds: 10, endSeconds: 50, kind: 'work', label: '', targetPaceSecondsPerKm: null }] });
  });

  it('does not report unavailable aggregate duration or distance as zero or complete totals', () => {
    const fixture = intervalFixture();
    fixture.segments[0].measurements.distanceMeters = null;
    fixture.segments[2].measurements.durationSeconds = null;
    const result = model.buildIntervalModel(fixture);
    expect(result.summary.work.distanceMeters).toBeNull();
    expect(result.summary.work.durationSeconds).toBeNull();
    expect(result.summary.work.paceSegmentCount).toBe(4);
    expect(result.summary.unknown.distanceMeters).toBe(0);
  });

  it('rejects malformed successful DTOs and incorrect activity identities', () => {
    expect(model.validateIntervalResponse).toBeTypeOf('function');
    expect(() => model.validateIntervalResponse({}, 9)).toThrow();
    expect(() => model.validateIntervalResponse(intervalFixture(), 10)).toThrow();
    expect(model.validateIntervalResponse(intervalFixture(), 9)).toEqual(intervalFixture());
    const malformed = intervalFixture();
    malformed.segments[0].measurements.distanceMeters = '400';
    expect(() => model.validateIntervalResponse(malformed, 9)).toThrow();
    expect(() => model.validateIntervalResponse({ ...intervalFixture(), measurements: {} }, 9)).toThrow();
    expect(() => model.validateIntervalResponse({ ...intervalFixture(), source: {} }, 9)).toThrow();
    const badLabel = intervalFixture();
    badLabel.segments[0].label = { text: 'bad' };
    expect(() => model.validateIntervalResponse(badLabel, 9)).toThrow();
  });

  it('keeps unavailable elapsed time unknown for a source-summary timer fallback', () => {
    const fixture = intervalFixture();
    fixture.source.elapsedDurationSeconds = null;
    fixture.segments = [{ id: 'session', kind: 'unknown', provenance: 'unknown', startSeconds: 0, endSeconds: 970,
      measurements: { durationSeconds: 970, elapsedDurationSeconds: 970, distanceMeters: 3650, averageHeartRate: null, hrCoverageSeconds: 0, measurementProvenance: 'source-summary' } }];
    const result = model.buildIntervalModel(fixture);
    expect(result.segments[0].elapsedSeconds).toBeNull();
    expect(result.summary.unknown.elapsedSeconds).toBeNull();
    expect(result.summary.unknown.hrCoverageFraction).toBeNull();
    expect(result.extentSeconds).toBe(970);
    fixture.segments = [];
    expect(model.buildIntervalModel(fixture).extentSeconds).toBe(970);
  });

  it('accepts missing imported elapsed boundaries without losing timer/pace or inventing unassigned time', () => {
    const fixture = intervalFixture();
    fixture.segments[0] = { ...fixture.segments[0], startSeconds: null, endSeconds: null,
      measurements: { ...fixture.segments[0].measurements, elapsedDurationSeconds: null, averageHeartRate: null, hrCoverageSeconds: 0 } };
    fixture.sourceSegments = structuredClone(fixture.segments);
    expect(() => model.validateIntervalResponse(fixture, 9)).not.toThrow();
    const result = model.buildIntervalModel(fixture);
    expect(result.segments[0].hasElapsedPlacement).toBe(false);
    expect(result.segments[0].elapsedSeconds).toBeNull();
    expect(result.segments[0].durationSeconds).toBe(95);
    expect(result.segments[0].paceSecPerKm).toBeCloseTo(237.5);
    expect(result.unassignedSeconds).toBeNull();
    expect(result.summary.work.elapsedSeconds).toBeNull();
  });

  it('computes unassigned time from the union of located spans, including empty declarations', () => {
    const fixture = intervalFixture();
    fixture.source.elapsedDurationSeconds = 100;
    fixture.segments = [
      { ...fixture.segments[0], startSeconds: 15, endSeconds: 35 },
      { ...fixture.segments[2], startSeconds: 25, endSeconds: 55 },
    ];
    expect(model.buildIntervalModel(fixture).unassignedSeconds).toBe(60);
    fixture.segments = [];
    expect(model.buildIntervalModel(fixture).unassignedSeconds).toBe(100);
    fixture.source.elapsedDurationSeconds = null;
    expect(model.buildIntervalModel(fixture).unassignedSeconds).toBeNull();
  });

  it('F3 includes known stationary work time in the kind pace, retaining an unavailable individual pace', () => {
    const fixture = stationaryWorkFixture();
    const result = model.buildIntervalModel(fixture);
    expect(result.summary.work.durationSeconds).toBe(300);
    expect(result.summary.work.distanceMeters).toBe(1000);
    expect(result.summary.work.paceSecPerKm).toBe(300);
    expect(result.summary.work.paceSegmentCount).toBe(2);
    expect(result.summary.work.paceIsPartial).toBe(false);
    expect(result.segments[1].paceSecPerKm).toBeNull();
    expect(model.intervalUnitValues(result.summary.work, 'imperial').paceSeconds).toBeCloseTo(482.8032);
  });

  it.each(['durationSeconds', 'distanceMeters'])('F3 treats missing %s as a partial pace scope rather than a known zero', (field) => {
    const fixture = stationaryWorkFixture();
    fixture.segments[1].measurements[field] = null;
    const result = model.buildIntervalModel(fixture);
    expect(result.summary.work[field]).toBeNull();
    expect(result.summary.work.paceSecPerKm).toBe(240);
    expect(result.summary.work.paceSegmentCount).toBe(1);
    expect(result.summary.work.paceIsPartial).toBe(true);
    fixture.segments[0].measurements[field] = null;
    expect(model.buildIntervalModel(fixture).summary.work.paceSecPerKm).toBeNull();
  });
});
