import assert from 'node:assert/strict';

import { buildWeeklyCoachSummaryModel } from './scheduleCoachSummary.js';

const raceWeekSummary = buildWeeklyCoachSummaryModel({
  vdotTrend: { direction: 'improving', delta: 2.1, hasData: true },
  acwr: 1.08,
  targetBlock: {
    hasActiveBlock: true,
    hasTargetRace: true,
    weekIndex: 6,
    raceDistanceKm: 10,
    currentLongRunKm: 18,
  },
  nextSessionTitle: 'Threshold Session',
});

assert.equal(raceWeekSummary.trendState, 'improving');
assert.equal(raceWeekSummary.loadState, 'optimal');
assert.equal(raceWeekSummary.focusMode, 'target-race');
assert.equal(raceWeekSummary.focus.weekIndex, 6);
assert.equal(raceWeekSummary.focus.raceDistanceKm, 10);

const fallbackSummary = buildWeeklyCoachSummaryModel({
  vdotTrend: { direction: 'maintaining', delta: 0, hasData: false },
  acwr: null,
  targetBlock: null,
  nextSessionTitle: 'Recovery Run',
});

assert.equal(fallbackSummary.trendState, 'unknown');
assert.equal(fallbackSummary.loadState, 'unknown');
assert.equal(fallbackSummary.focusMode, 'next-session');
assert.equal(fallbackSummary.focus.nextSessionTitle, 'Recovery Run');

const blockSummary = buildWeeklyCoachSummaryModel({
  vdotTrend: { direction: 'declining', delta: -1.4, hasData: true },
  acwr: 1.37,
  targetBlock: {
    hasActiveBlock: true,
    hasTargetRace: false,
    weekIndex: 3,
    raceDistanceKm: null,
    currentLongRunKm: 14,
  },
  nextSessionTitle: 'Easy Run',
});

assert.equal(blockSummary.trendState, 'declining');
assert.equal(blockSummary.loadState, 'high');
assert.equal(blockSummary.focusMode, 'training-block');
assert.equal(blockSummary.focus.longRunKm, 14);

console.log('[PASS] Weekly coach summary model coverage passed.');
