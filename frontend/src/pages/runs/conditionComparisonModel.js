import { getActivityDateKey } from '../../utils/timeZone.js';

export const COMPARISON_DIMENSIONS = ['workout', 'recovery', 'route', 'terrain', 'surface', 'weather'];
export const DECLARATION_DIMENSIONS = COMPARISON_DIMENSIONS;
const METERS_PER_MILE = 1609.344;
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const MEASUREMENT_NUMBERS = ['durationSeconds', 'elapsedDurationSeconds', 'distanceMeters', 'paceSecondsPerKm', 'averageHeartRate', 'hrCoverageSeconds', 'hrCoverageFraction', 'averageCadence', 'cadenceCoverageSeconds'];
const hasNullableNumbers = (value, fields) => object(value) && fields.every(key => Object.hasOwn(value, key) && (value[key] === null || nonnegative(value[key]) !== null));
const validMeasurements = value => hasNullableNumbers(value, MEASUREMENT_NUMBERS) && typeof value.measurementProvenance === 'string';

function validSegments(rows) {
  return Array.isArray(rows) && new Set(rows.map(row => row?.id)).size === rows.length && rows.every(row =>
    object(row) && typeof row.id === 'string' && row.id.length > 0
    && ['work', 'recovery', 'warmup', 'cooldown', 'unknown'].includes(row.kind)
    && ['imported', 'runner-declared', 'auto-detected', 'unknown'].includes(row.provenance)
    && hasNullableNumbers(row, ['startSeconds', 'endSeconds'])
    && (row.startSeconds === null || row.endSeconds === null || row.endSeconds >= row.startSeconds)
    && validMeasurements(row.measurements));
}

function validAnalysis(response) {
  return object(response) && Number.isSafeInteger(response.activityId) && response.activityId > 0
    && hasNullableNumbers(response.source, ['distanceMeters', 'durationSeconds', 'elapsedDurationSeconds', 'movingTimeSeconds'])
    && validMeasurements(response.measurements) && validSegments(response.segments) && validSegments(response.sourceSegments)
    && object(response.declarations) && object(response.declarations.comparison)
    && Object.values(response.declarations.comparison).every(value => value === null || typeof value === 'string')
    && object(response.recorded) && object(response.recorded.conditions) && object(response.recorded.rpe)
    && Object.hasOwn(response.recorded.rpe, 'value')
    && (response.recorded.rpe.value === null || (Number.isInteger(response.recorded.rpe.value) && response.recorded.rpe.value >= 1 && response.recorded.rpe.value <= 10));
}

export function paceInUnit(secondsPerKm, unit) {
  return positive(secondsPerKm) === null ? null : secondsPerKm * (unit === 'mile' ? METERS_PER_MILE / 1000 : 1);
}

export function distanceInUnit(meters, unit) {
  return nonnegative(meters) === null ? null : meters / (unit === 'mile' ? METERS_PER_MILE : 1000);
}

export function conditionValue(session, dimension) {
  const field = session?.conditions?.[dimension];
  if (field && ['recorded', 'declared', 'runner-declared'].includes(field.provenance) && typeof field.value === 'string' && field.value.trim()) return field.value.trim();
  if (dimension === 'recovery') {
    const segments = session?.segments;
    if (!segments?.length || segments.some(row => !['work', 'recovery', 'warmup', 'cooldown'].includes(row.kind))) return null;
    const recovery = segments.filter(row => row.kind === 'recovery');
    if (recovery.some(row => positive(row.elapsedDurationSeconds) === null || nonnegative(row.distanceMeters) === null)) return null;
    return JSON.stringify({ basis: 'elapsed-seconds', roles: segments.map(row => row.kind), recovery: recovery.map(row => [row.elapsedDurationSeconds, row.distanceMeters]) });
  }
  return null;
}

export function normalizeSessionAnalysis(response, activity = {}) {
  if (!validAnalysis(response)) {
    throw new Error('Invalid session-analysis response');
  }
  const conditions = Object.fromEntries(DECLARATION_DIMENSIONS.map(key => {
    const declared = response.declarations.comparison?.[key];
    return [key, typeof declared === 'string' && declared.trim()
      ? { value: declared, provenance: 'declared' } : response.recorded?.conditions?.[key] || { value: null, provenance: 'unavailable' }];
  }));
  return {
    ...activity, ...response, ...response.measurements, id: String(response.activityId), conditions,
    perceivedExertion: response.recorded?.rpe?.provenance === 'recorded' ? response.recorded.rpe.value : null,
    segments: response.segments.map(row => ({ ...row, ...row.measurements, id: String(row.id) })),
  };
}

export function defaultDetectedWorkIds(session) {
  return (session.segments || []).filter(row => row.kind === 'work' && row.provenance === 'auto-detected').map(row => String(row.id));
}

export function summarizeComparisonScope(session, scope = 'whole', selectedSegmentIds) {
  const selected = new Set((selectedSegmentIds ?? defaultDetectedWorkIds(session)).map(String));
  const sourceRows = scope === 'work'
    ? (session.segments || []).filter(row => row.kind === 'work' && selected.has(String(row.id)))
    : [{ ...session, id: String(session.id) }];
  // Partial rows remain visible. A missing duration/distance makes the combined
  // pace unavailable rather than biasing it by silently dropping that row.
  const total = key => sourceRows.length && sourceRows.every(row => nonnegative(row[key]) !== null)
    ? sourceRows.reduce((sum, row) => sum + row[key], 0) : null;
  const durationSeconds = total('durationSeconds');
  const distanceMeters = total('distanceMeters');
  const elapsedDurationSeconds = total('elapsedDurationSeconds');
  const coveredRows = sourceRows.filter(row => positive(row.averageHeartRate) !== null && positive(row.hrCoverageSeconds) !== null);
  const hrCoverageSeconds = coveredRows.reduce((sum, row) => sum + row.hrCoverageSeconds, 0);
  const averageHeartRate = hrCoverageSeconds > 0 ? coveredRows.reduce((sum, row) => sum + row.averageHeartRate * row.hrCoverageSeconds, 0) / hrCoverageSeconds : null;
  return {
    sourceRows, durationSeconds, distanceMeters, elapsedDurationSeconds, rpeScope: 'session',
    paceSecondsPerKm: durationSeconds && distanceMeters ? durationSeconds * 1000 / distanceMeters : null,
    averageHeartRate, hrCoverageSeconds,
    hrCoveragePercent: elapsedDurationSeconds > 0 && sourceRows.every(row => nonnegative(row.hrCoverageSeconds) !== null) ? Math.min(hrCoverageSeconds / elapsedDurationSeconds * 100, 100) : null,
    perceivedExertion: Number.isInteger(session.perceivedExertion) && session.perceivedExertion >= 1 && session.perceivedExertion <= 10 ? session.perceivedExertion : null,
  };
}

export function compareSessions(sessions, { referenceId, selectedIds = [], rules = [], scope = 'whole', segmentSelections = {} } = {}) {
  const reference = sessions.find(session => String(session.id) === String(referenceId));
  const selected = new Set(selectedIds.map(String));
  return sessions.map(session => {
    const id = String(session.id);
    const reasons = [];
    if (!selected.has(id)) reasons.push({ reason: 'not_selected' });
    for (const dimension of rules.filter(key => COMPARISON_DIMENSIONS.includes(key))) {
      const basis = conditionValue(reference, dimension);
      const value = conditionValue(session, dimension);
      if (basis === null || value === null) reasons.push({ dimension, reason: 'unknown' });
      else if (basis !== value) reasons.push({ dimension, reason: 'different' });
    }
    const metrics = summarizeComparisonScope(session, scope, segmentSelections[id]);
    if (scope === 'work' && !metrics.sourceRows.length) reasons.push({ reason: 'no_work' });
    return { ...session, ...metrics, id, reasons, included: reasons.length === 0 };
  });
}

export function progressionPoints(rows) {
  const dated = rows.filter(row => row.included && positive(row.paceSecondsPerKm) !== null)
    .map(row => ({ ...row, dateKey: getActivityDateKey(row, row.accountTimeZone) }))
    .map(row => ({ ...row, dateCoordinate: /^\d{4}-\d{2}-\d{2}$/.test(row.dateKey) ? Date.parse(`${row.dateKey}T00:00:00Z`) : NaN }))
    .filter(row => Number.isFinite(row.dateCoordinate))
    .sort((a, b) => a.dateCoordinate - b.dateCoordinate || a.id.localeCompare(b.id));
  if (!dated.length) return [];
  const first = dated[0].dateCoordinate;
  const span = dated.at(-1).dateCoordinate - first;
  return dated.map(row => ({ ...row, datePosition: span ? (row.dateCoordinate - first) / span : 0.5 }));
}
