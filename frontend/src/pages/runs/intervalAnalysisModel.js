const KINDS = ['work', 'recovery', 'unknown', 'warmup', 'cooldown'];
const nonNegative = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const positive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

function summarizeSegments(rows) {
  const sum = (key) => rows.reduce((total, row) => total + (row[key] ?? 0), 0);
  const paceRows = rows.filter((row) => row.durationSeconds != null && row.distanceMeters != null);
  const paceDistance = paceRows.reduce((total, row) => total + row.distanceMeters, 0);
  const paceDuration = paceRows.reduce((total, row) => total + row.durationSeconds, 0);
  const hrCoverageSeconds = sum('hrCoverageSeconds');
  const elapsedSeconds = rows.every((row) => row.elapsedSeconds != null) ? sum('elapsedSeconds') : null;
  return {
    count: rows.length,
    distanceMeters: rows.every((row) => row.distanceMeters != null) ? sum('distanceMeters') : null,
    durationSeconds: rows.every((row) => row.durationSeconds != null) ? sum('durationSeconds') : null, elapsedSeconds,
    // Known stationary time remains part of aggregate pace.
    paceSecPerKm: paceDistance > 0 && paceDuration > 0 ? paceDuration * 1000 / paceDistance : null,
    paceSegmentCount: paceRows.length, paceIsPartial: paceRows.length < rows.length,
    averageHeartRate: hrCoverageSeconds > 0 ? rows.reduce((total, row) => total + (row.averageHeartRate ?? 0) * row.hrCoverageSeconds, 0) / hrCoverageSeconds : null,
    hrCoverageSeconds, hrCoverageFraction: elapsedSeconds > 0 ? hrCoverageSeconds / elapsedSeconds : null,
  };
}

/** Consume source labels, runner declarations, or explicitly identified detection estimates. */
export function buildIntervalModel(analysis = {}) {
  const segments = (Array.isArray(analysis.segments) ? analysis.segments : []).map((segment, index) => {
    const measurements = segment.measurements || {};
    const startSeconds = nonNegative(segment.startSeconds);
    const endSeconds = nonNegative(segment.endSeconds);
    const hasElapsedPlacement = startSeconds != null && endSeconds != null && endSeconds >= startSeconds;
    const timerFallback = analysis.source?.elapsedDurationSeconds == null && segment.provenance === 'unknown' && measurements.measurementProvenance === 'source-summary';
    const elapsedSeconds = timerFallback ? null : startSeconds != null && endSeconds != null && endSeconds > startSeconds
      ? endSeconds - startSeconds : nonNegative(measurements.elapsedDurationSeconds);
    const durationSeconds = nonNegative(measurements.durationSeconds);
    const distanceMeters = nonNegative(measurements.distanceMeters);
    const averageHeartRate = positive(measurements.averageHeartRate);
    const hrCoverageSeconds = averageHeartRate == null ? 0 : Math.min(nonNegative(measurements.hrCoverageSeconds) || 0, elapsedSeconds ?? Infinity);
    return {
      ...segment,
      id: segment.id || `segment-${index + 1}`, index: index + 1,
      kind: KINDS.includes(segment.kind) ? segment.kind : 'unknown',
      startSeconds, endSeconds, hasElapsedPlacement, elapsedSeconds, durationSeconds, distanceMeters,
      paceSecPerKm: distanceMeters > 0 && durationSeconds > 0 ? durationSeconds * 1000 / distanceMeters : null,
      averageHeartRate: hrCoverageSeconds > 0 ? averageHeartRate : null,
      hrCoverageSeconds,
      hrCoverageFraction: elapsedSeconds > 0 ? hrCoverageSeconds / elapsedSeconds : null,
      provenance: segment.provenance || 'unavailable',
      measurementProvenance: measurements.measurementProvenance || 'unavailable',
      targetPaceSecondsPerKm: positive(segment.targetPaceSecondsPerKm),
    };
  });
  const lanes = Object.fromEntries(KINDS.map((kind) => [kind, segments.filter((segment) => segment.kind === kind)]));
  const summary = Object.fromEntries(KINDS.map((kind) => [kind, summarizeSegments(lanes[kind])]));
  const warmupCooldownSummary = summarizeSegments([...lanes.warmup, ...lanes.cooldown]);
  const sourceExtent = nonNegative(analysis.source?.elapsedDurationSeconds) ?? nonNegative(analysis.source?.durationSeconds) ?? 0;
  const sourceElapsed = nonNegative(analysis.source?.elapsedDurationSeconds);
  let unassignedSeconds = null;
  if (sourceElapsed != null && segments.every((row) => row.hasElapsedPlacement)) {
    const spans = segments.map((row) => [Math.min(sourceElapsed, row.startSeconds), Math.min(sourceElapsed, row.endSeconds)]).sort((a, b) => a[0] - b[0]);
    let covered = 0;
    let previousEnd = 0;
    for (const [start, end] of spans) {
      covered += Math.max(0, end - Math.max(previousEnd, start));
      previousEnd = Math.max(previousEnd, end);
    }
    unassignedSeconds = sourceElapsed - covered;
  }
  return { segments, lanes, summary, warmupCooldownSummary, sourceTotals: analysis.source || {}, unassignedSeconds, extentSeconds: Math.max(sourceExtent, ...segments.map((row) => row.endSeconds || 0)) };
}

export function intervalUnitValues({ distanceMeters, paceSecPerKm }, unitPreference = 'metric') {
  const imperial = unitPreference === 'imperial' || unitPreference === 'mi' || unitPreference === 'mile';
  return {
    distance: nonNegative(distanceMeters) == null ? null : distanceMeters / (imperial ? 1609.344 : 1000),
    paceSeconds: positive(paceSecPerKm) == null ? null : paceSecPerKm * (imperial ? 1.609344 : 1),
    distanceUnit: imperial ? 'mi' : 'km', paceUnit: imperial ? '/mi' : '/km',
  };
}

export function validateIntervalDraft(segments, extentSeconds) {
  const errors = new Set();
  if (!Array.isArray(segments) || segments.length > 200) return ['segmentLimit'];
  const ids = new Set();
  let previousEnd = 0;
  for (const segment of segments) {
    const start = segment.startSeconds === '' ? NaN : Number(segment.startSeconds);
    const end = segment.endSeconds === '' ? NaN : Number(segment.endSeconds);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start) errors.add('invalidBoundary');
    if (extentSeconds == null || end > extentSeconds) errors.add('outsideSource');
    if (start < previousEnd) errors.add('overlap');
    previousEnd = end;
    if (!KINDS.includes(segment.kind)) errors.add('invalidKind');
    if (!segment.id || segment.id.length > 80 || ids.has(segment.id)) errors.add('invalidId');
    ids.add(segment.id);
    if ((segment.label || '').length > 160) errors.add('invalidLabel');
    if (segment.targetPaceSecondsPerKm != null && positive(segment.targetPaceSecondsPerKm) == null) errors.add('invalidTarget');
  }
  return [...errors];
}

/** Only declarations cross the PUT boundary; measurements are recomputed by the owner-gated backend. */
export function intervalSavePayload(segments) {
  return {
    segments: segments.map(({ id, kind, startSeconds, endSeconds, label, targetPaceSecondsPerKm }) => ({
      id, kind, startSeconds: Number(startSeconds), endSeconds: Number(endSeconds),
      label: label || '', targetPaceSecondsPerKm: targetPaceSecondsPerKm ?? null,
    })),
  };
}

/** A malformed success must enter the error/Retry state instead of looking like an empty activity. */
export function validateIntervalResponse(value, activityId) {
  const object = (entry) => entry != null && typeof entry === 'object' && !Array.isArray(entry);
  const numericFields = (entry, fields) => fields.every((field) => entry[field] == null || nonNegative(entry[field]) != null);
  const measurementFields = ['durationSeconds', 'elapsedDurationSeconds', 'distanceMeters', 'paceSecondsPerKm', 'averageHeartRate', 'hrCoverageSeconds', 'hrCoverageFraction', 'averageCadence', 'cadenceCoverageSeconds'];
  const hasMeasurementFields = (entry) => ['durationSeconds', 'elapsedDurationSeconds', 'distanceMeters', 'averageHeartRate', 'hrCoverageSeconds'].every((key) => Object.hasOwn(entry, key));
  const sourceFields = ['distanceMeters', 'durationSeconds', 'elapsedDurationSeconds', 'movingTimeSeconds'];
  const validBoundaries = (row) => Object.hasOwn(row, 'startSeconds') && Object.hasOwn(row, 'endSeconds')
    && (row.startSeconds === null || nonNegative(row.startSeconds) != null)
    && (row.endSeconds === null || nonNegative(row.endSeconds) != null)
    && (row.startSeconds == null || row.endSeconds == null || row.endSeconds >= row.startSeconds)
    && (row.provenance !== 'runner-declared' || (row.startSeconds != null && row.endSeconds > row.startSeconds));
  const validRows = (rows) => Array.isArray(rows) && new Set(rows.map((row) => row?.id)).size === rows.length
    && rows.every((row) => object(row) && typeof row.id === 'string' && row.id.length > 0 && KINDS.includes(row.kind)
      && validBoundaries(row)
      && (row.label == null || typeof row.label === 'string')
      && (row.targetPaceSecondsPerKm == null || positive(row.targetPaceSecondsPerKm) != null)
      && ['imported', 'runner-declared', 'auto-detected', 'unknown', 'unavailable'].includes(row.provenance)
      && object(row.measurements) && hasMeasurementFields(row.measurements) && numericFields(row.measurements, measurementFields));
  if (!object(value) || !Number.isInteger(value.activityId) || String(value.activityId) !== String(activityId)
    || !object(value.source) || !sourceFields.every((key) => Object.hasOwn(value.source, key)) || !numericFields(value.source, sourceFields)
    || !object(value.measurements) || !hasMeasurementFields(value.measurements) || !numericFields(value.measurements, measurementFields)
    || !object(value.declarations) || !object(value.declarations.comparison) || !object(value.recorded)
    || !validRows(value.segments) || !validRows(value.sourceSegments)) {
    throw new Error('Invalid session-analysis response');
  }
  return value;
}
