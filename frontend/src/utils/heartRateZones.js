import { formatDuration } from './format';

export const ZONE_COUNT = 5;

/** Time in a zone, "12:05" or "1:02:03"; a dash when there is none. */
export function zoneDurationLabel(seconds) {
  return seconds > 0 ? formatDuration(seconds) : '–';
}

/**
 * The five zones that four boundaries make, shaped as the server sends them. A boundary is the first bpm of the
 * next zone, so zone 1 has no lower edge and zone 5 has no upper edge.
 */
export function zonesFromBoundaries(boundaries) {
  return Array.from({ length: ZONE_COUNT }, (_, index) => ({
    zone: index + 1,
    fromBpm: index === 0 ? null : boundaries[index - 1],
    toBpm: index === ZONE_COUNT - 1 ? null : boundaries[index] - 1,
  }));
}

function wholeNumber(text) {
  return /^\s*\d+\s*$/.test(String(text)) ? Number(text) : null;
}

/**
 * Checks four typed-in boundaries against the same rules the server enforces. Returns null when they are fine,
 * otherwise 'incomplete' (a box is empty or not a whole number), 'range' (outside the allowed bpm) or 'order'
 * (a zone does not start higher than the one before).
 */
export function boundaryProblem(texts, limits) {
  const values = texts.map(wholeNumber);
  if (values.length !== ZONE_COUNT - 1 || values.some((value) => value == null)) return 'incomplete';
  if (values.some((value) => value < limits.minBoundary || value > limits.maxBoundary)) return 'range';
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] <= values[index - 1]) return 'order';
  }
  return null;
}

/**
 * Which of the four boxes cause the problem boundaryProblem reports, so only those are marked: the boxes that
 * are empty or not a number, the ones outside the limits, or both boxes of every pair that is out of order.
 */
export function invalidBoundaryIndexes(texts, limits) {
  const values = texts.map(wholeNumber);
  const problem = boundaryProblem(texts, limits);
  const flagged = new Set();
  if (problem === 'incomplete') {
    values.forEach((value, index) => { if (value == null) flagged.add(index); });
    if (values.length !== ZONE_COUNT - 1) texts.forEach((_, index) => flagged.add(index));
  } else if (problem === 'range') {
    values.forEach((value, index) => { if (value < limits.minBoundary || value > limits.maxBoundary) flagged.add(index); });
  } else if (problem === 'order') {
    for (let index = 1; index < values.length; index += 1) {
      if (values[index] <= values[index - 1]) { flagged.add(index - 1); flagged.add(index); }
    }
  }
  return flagged;
}

/** The four typed-in boundaries as numbers; only meaningful once boundaryProblem says they are fine. */
export function boundaryValues(texts) {
  return texts.map(wholeNumber);
}

/** A max heart rate typed in: the whole number, or null when it is not one inside the allowed range. */
export function parseMaxHeartRate(text, limits) {
  const value = wholeNumber(text);
  if (value == null) return null;
  return value >= limits.minMaxHeartRate && value <= limits.maxMaxHeartRate ? value : null;
}
