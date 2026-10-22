// Answers of GET /api/activities/{id}/summary, shaped as the server sends them (see RunSummaryRules for the facts of each).

export function finding(id, variant, facts, thresholds = {}, { tone = 'neutral', weight = 2 } = {}) {
  return { id, variant, tone, weight, facts, thresholds };
}

export const zonesEasy = finding('character', 'easy', {
  distanceKm: 10, movingSeconds: 3000, zonePercents: [30, 60, 7, 2, 1], easyPercent: 90, hardPercent: 3, heartRateMinutes: 33, basis: 'zones',
}, { easyPercent: 70, hardPercent: 30, minHeartRateMinutes: 10 }, { weight: 10 });

export const zonesModerate = finding('character', 'moderate', {
  distanceKm: 10, movingSeconds: 3000, zonePercents: [20, 40, 30, 8, 2], easyPercent: 60, hardPercent: 10, heartRateMinutes: 50, basis: 'zones',
}, { easyPercent: 70, hardPercent: 30, minHeartRateMinutes: 10 }, { weight: 10 });

export const zonesHard = finding('character', 'hard', {
  distanceKm: 10, movingSeconds: 3000, zonePercents: [5, 10, 30, 35, 20], easyPercent: 15, hardPercent: 55, heartRateMinutes: 50, basis: 'zones',
}, { easyPercent: 70, hardPercent: 30, minHeartRateMinutes: 10 }, { weight: 10 });

export const effortEasy = finding('character', 'easy', {
  distanceKm: 10, movingSeconds: 3000, effort: 50, usualEffort: 80, ratio: 0.63, count: 6, basis: 'effort',
}, { higherRatio: 1.25, lowerRatio: 0.75, windowDays: 90 }, { weight: 10 });

export const race = finding('character', 'race', { distanceKm: 21.1, movingSeconds: 5400, basis: 'run_type' }, {}, { weight: 10 });
export const workout = finding('character', 'workout', { distanceKm: 8, movingSeconds: 2700, basis: 'run_type' }, {}, { weight: 10 });

export const changes = finding('character', 'changes', {
  distanceKm: 6, movingSeconds: 2000, fastestPaceSecPerKm: 210, slowestPaceSecPerKm: 330, variationPercent: 22.2, splits: 6, basis: 'pace',
}, { variationPercent: 10, minSplits: 4 }, { weight: 10 });

export const unclear = finding('character', 'unclear', { distanceKm: 10, movingSeconds: 3000 }, {}, { weight: 10 });

export const longest = finding('longest', 'longest', { distanceKm: 12, previousLongestKm: 10, count: 8, windowDays: 28 },
  { windowDays: 28, minRuns: 4, minKm: 5 }, { tone: 'positive', weight: 3 });

const effortRule = { higherRatio: 1.25, lowerRatio: 0.75, minRuns: 5, recordMinRuns: 8, windowDays: 90, lengthFromPercent: 70, lengthToPercent: 140 };
export const effortHardest = finding('effort', 'hardest', {
  effort: 120, usualEffort: 80, ratio: 1.5, count: 10, highestBefore: 95, windowDays: 90, scope: 'similar_length',
}, effortRule, { weight: 3 });
export const effortHigher = finding('effort', 'higher', {
  effort: 100, usualEffort: 80, ratio: 1.25, count: 6, highestBefore: 95, windowDays: 90, scope: 'similar_length',
}, effortRule);
export const effortWorkouts = finding('effort', 'lower', {
  effort: 60, usualEffort: 90, ratio: 0.67, count: 3, highestBefore: 100, windowDays: 90, scope: 'workouts',
}, { higherRatio: 1.25, lowerRatio: 0.75, minRuns: 3, recordMinRuns: 8, windowDays: 90 });

export const driftHigh = finding('drift', 'high', { driftPercent: 12.3, firstHalfHeartRate: 140, secondHalfHeartRate: 152, minutes: 50 },
  { moderatePercent: 5, highPercent: 10, minMinutes: 20 }, { tone: 'caution', weight: 3 });
export const driftLow = finding('drift', 'low', { driftPercent: 1.2, firstHalfHeartRate: 140, secondHalfHeartRate: 142, minutes: 50 },
  { moderatePercent: 5, highPercent: 10, minMinutes: 20 }, { tone: 'positive', weight: 1 });

export const shapeNegative = finding('shape', 'negative', {
  firstHalfPaceSecPerKm: 300, secondHalfPaceSecPerKm: 293, deltaSeconds: -7, deltaPercent: -2.3, splitsPerHalf: 2, splits: 5,
  fastestPaceSecPerKm: 290, slowestPaceSecPerKm: 305, basis: 'grade_adjusted',
}, { bandPercent: 2, minSplits: 4, variationPercent: 10 }, { tone: 'positive' });
export const shapeFaded = finding('shape', 'faded', {
  firstHalfPaceSecPerKm: 300, secondHalfPaceSecPerKm: 312, deltaSeconds: 12, deltaPercent: 4, splitsPerHalf: 2, splits: 4,
  fastestPaceSecPerKm: 298, slowestPaceSecPerKm: 314, basis: 'pace',
}, { bandPercent: 2, minSplits: 4, variationPercent: 10 }, { tone: 'caution' });
export const shapeEven = finding('shape', 'even', {
  firstHalfPaceSecPerKm: 300, secondHalfPaceSecPerKm: 301, deltaSeconds: 1, deltaPercent: 0.3, splitsPerHalf: 2, splits: 4,
  fastestPaceSecPerKm: 298, slowestPaceSecPerKm: 303, basis: 'pace',
}, { bandPercent: 2, minSplits: 4, variationPercent: 10 }, { weight: 1 });

const paceRule = { bandPercent: 3, minRuns: 3, windowDays: 30, lengthFromPercent: 70, lengthToPercent: 140 };
export const paceFaster = finding('pace', 'faster', {
  paceSecPerKm: 270, recentPaceSecPerKm: 300, deltaSeconds: -30, deltaPercent: -10, count: 6, windowDays: 30, fromKm: 7, toKm: 14,
}, paceRule, { tone: 'positive' });
export const paceSlower = finding('pace', 'slower', {
  paceSecPerKm: 330, recentPaceSecPerKm: 300, deltaSeconds: 30, deltaPercent: 10, count: 6, windowDays: 30, fromKm: 7, toKm: 14,
}, paceRule);
export const paceSimilar = finding('pace', 'similar', {
  paceSecPerKm: 301, recentPaceSecPerKm: 300, deltaSeconds: 1, deltaPercent: 0.3, count: 6, windowDays: 30, fromKm: 7, toKm: 14,
}, paceRule, { weight: 1 });

export const formFresh = finding('form', 'fresh', { form: 20, fitness: 100, fatigue: 80, day: '2026-03-14' }, { bandPercent: 10, minSwing: 3 }, { tone: 'positive' });
export const formTired = finding('form', 'tired', { form: -25.5, fitness: 100, fatigue: 125.5, day: '2026-03-14' }, { bandPercent: 10, minSwing: 3 }, { tone: 'caution' });

export const climbPlain = finding('climb', 'hilly', { climbMetres: 200, metresPerKm: 20 }, { hillyMetresPerKm: 12, paceDifferenceSeconds: 5 });
export const climbAdjusted = finding('climb', 'hilly', { climbMetres: 200, metresPerKm: 20, paceSecPerKm: 331, gradeAdjustedPaceSecPerKm: 302 },
  { hillyMetresPerKm: 12, paceDifferenceSeconds: 5 });

export function summary(findings, overrides = {}) {
  return { runId: 7, state: 'ready', reason: null, day: '2026-03-15', findings, ...overrides };
}

/** A run with a headline and a few lines of every tone. */
export function fullSummary() {
  return summary([zonesEasy, longest, effortHardest, shapeNegative, paceFaster]);
}

export function tooShort() {
  return summary([], { state: 'none', reason: 'too_short' });
}
