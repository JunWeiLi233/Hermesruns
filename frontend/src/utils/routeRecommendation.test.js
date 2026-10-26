import assert from 'node:assert/strict';
import test from 'node:test';
import * as routeHelpers from './routeRecommendation.js';
import {
  hasRepeatedRouteSegment,
  isRouteRecommendationUsable,
} from './routeRecommendation.js';

const usableLoop = [
  [40.7128, -74.0060],
  [40.7128, -74.0045],
  [40.7140, -74.0045],
  [40.7140, -74.0060],
  [40.7128, -74.0060],
];

const repeatedTinyLoop = [
  [40.7128, -74.0060],
  [40.7128, -74.0052],
  [40.7135, -74.0060],
  [40.7128, -74.0060],
  [40.7128, -74.0052],
  [40.7135, -74.0060],
  [40.7128, -74.0060],
];

assert.equal(hasRepeatedRouteSegment(usableLoop), false);
assert.equal(hasRepeatedRouteSegment(repeatedTinyLoop), true);

assert.equal(isRouteRecommendationUsable({
  streetGraphBacked: true,
  actualDistanceKm: 8.4,
  targetDistanceKm: 8,
  waypoints: usableLoop,
}, 8), true);

assert.equal(isRouteRecommendationUsable({
  streetGraphBacked: true,
  actualDistanceKm: 8,
  waypoints: repeatedTinyLoop,
}, 8), false);

assert.equal(isRouteRecommendationUsable({
  actualDistanceKm: 14,
  waypoints: usableLoop,
}, 8, { requireStreetGraph: false }), false);

test('route coordinates reject absent, blank, nonfinite, out-of-range and null-island values', () => {
  for (const point of [
    null, {}, [null, 2], ['', 2], ['  ', 2], [false, 2],
    [NaN, 2], [Infinity, 2], [91, 2], [1, -181], [0, 0],
    { latitude: null, longitude: 3 }, { lat: 3, lng: '' },
  ]) {
    assert.equal(routeHelpers.normalizeRouteWaypoint(point), null, JSON.stringify(point));
  }
  assert.deepEqual(routeHelpers.normalizeRouteWaypoint([0, 10]), { lat: 0, lng: 10 });
  assert.deepEqual(routeHelpers.normalizeRouteWaypoint([10, 0]), { lat: 10, lng: 0 });
  assert.deepEqual(routeHelpers.normalizeRouteWaypoint({ latitude: '40', longitude: '-74' }), { lat: 40, lng: -74 });
});

test('route quality requires finite measured distance and rejects explicitly invalid targets', () => {
  const valid = { streetGraphBacked: true, actualDistanceKm: 8, targetDistanceKm: 8, waypoints: usableLoop };
  for (const invalid of [null, '', ' ', false, NaN, Infinity, -Infinity, -1, 0, 'unknown']) {
    assert.equal(isRouteRecommendationUsable({ ...valid, actualDistanceKm: invalid }, 8), false, `actual ${String(invalid)}`);
    assert.equal(isRouteRecommendationUsable(valid, invalid), false, `target ${String(invalid)}`);
    assert.equal(isRouteRecommendationUsable({ ...valid, targetDistanceKm: invalid }), false, `stored target ${String(invalid)}`);
  }
  assert.equal(isRouteRecommendationUsable(valid), true);
  assert.equal(isRouteRecommendationUsable({ ...valid, targetDistanceKm: 9 }, 8), false, 'old target must not be silently relabeled');
  assert.equal(isRouteRecommendationUsable({ ...valid, actualDistanceKm: 2.9, targetDistanceKm: 2 }, 2), false, 'short runs get the same proportional tolerance');
  assert.equal(isRouteRecommendationUsable({ ...valid, targetDistanceKm: 8.4 }), true);
  assert.equal(isRouteRecommendationUsable({ ...valid, waypoints: [[null, null], ...usableLoop.slice(0, 2)] }, 8), false);
  assert.equal(isRouteRecommendationUsable({ ...valid, waypoints: [...usableLoop, [91, 2]] }, 8), false);
});

test('daily route distance uses only a current running prescription backed by recorded history or an explicit plan', () => {
  assert.equal(typeof routeHelpers.resolveDailyRouteDistanceKm, 'function');
  const input = {
    workout: { scheduledDate: '2026-10-15', workoutType: 'EASY', plannedDistanceKm: 4.5 },
    todayKey: '2026-10-15', hasRunningHistory: true,
  };
  assert.equal(routeHelpers.resolveDailyRouteDistanceKm(input), 4.5);
  assert.equal(routeHelpers.resolveDailyRouteDistanceKm({ ...input, hasRunningHistory: false }), null);
  assert.equal(routeHelpers.resolveDailyRouteDistanceKm({ ...input, hasRunningHistory: false, explicitPlan: true }), 4.5);
  assert.equal(routeHelpers.resolveDailyRouteDistanceKm({ ...input, hasRunningHistory: false, explicitPlan: 'true' }), null);
  for (const workoutType of ['BASE', 'RECOVERY', 'EASY', 'EASY_RUN', 'TEMPO', 'THRESHOLD', 'INTERVALS', 'LONG_RUN', 'RUN', 'RUN_WALK', 'LONG', 'QUALITY', 'RACE', 'EVENT']) {
    assert.equal(routeHelpers.resolveDailyRouteDistanceKm({ ...input, workout: { ...input.workout, workoutType } }), 4.5, workoutType);
  }
  for (const workoutType of ['REST', 'CROSS_TRAIN', 'AUTHORED', 'WALK', 'BIKE', '', undefined]) {
    assert.equal(routeHelpers.resolveDailyRouteDistanceKm({ ...input, workout: { ...input.workout, workoutType } }), null, String(workoutType));
  }
  assert.equal(routeHelpers.resolveDailyRouteDistanceKm({ ...input, workout: { ...input.workout, authored: true } }), null);
  for (const scheduledDate of ['2026-10-14', '2026-10-16', '2026-02-30', '2026-10-15T00:00:00Z', '', null]) {
    assert.equal(routeHelpers.resolveDailyRouteDistanceKm({ ...input, workout: { ...input.workout, scheduledDate } }), null, String(scheduledDate));
  }
  assert.equal(routeHelpers.resolveDailyRouteDistanceKm({ ...input, todayKey: '2026-02-30', workout: { ...input.workout, scheduledDate: '2026-02-30' } }), null);
  for (const plannedDistanceKm of [null, '', ' ', false, NaN, Infinity, 0, -2]) {
    assert.equal(routeHelpers.resolveDailyRouteDistanceKm({ ...input, workout: { ...input.workout, plannedDistanceKm } }), null, String(plannedDistanceKm));
  }
  assert.equal(routeHelpers.resolveDailyRouteDistanceKm({ ...input, workout: { ...input.workout, plannedDistanceKm: null, plannedDurationMinutes: 45 } }), null);
  assert.equal(routeHelpers.resolveDailyRouteDistanceKm({ ...input, workout: null, nextSession: input.workout, actualDistanceKm: 10 }), null);
});

test('heatmap anchors validate real coordinates and preserve evidence metadata', () => {
  assert.equal(typeof routeHelpers.normalizeRouteAnchor, 'function');
  assert.deepEqual(routeHelpers.normalizeRouteAnchor({ startLat: 40.7, startLng: -74, source: 'heatmap', activityCount: 7, pointCount: 450 }), {
    lat: 40.7, lng: -74, source: 'heatmap', activityCount: 7, pointCount: 450,
  });
  for (const invalid of [null, {}, { startLat: null, startLng: 5 }, { startLat: '', startLng: 5 },
    { startLat: 0, startLng: 0 }, { startLat: NaN, startLng: 5 }, { startLat: 91, startLng: 5 }, { startLat: 5, startLng: 181 }]) {
    assert.equal(routeHelpers.normalizeRouteAnchor(invalid), null);
  }
  assert.equal(routeHelpers.normalizeRouteAnchor({ startLat: 0, startLng: 10 }).lat, 0);
  assert.equal(routeHelpers.normalizeRouteAnchor({ lat: 10, lng: 0 }).lng, 0);
});

test('routes must reach within one kilometer of the frequent running area when an anchor is available', () => {
  assert.equal(typeof routeHelpers.isRouteNearAnchor, 'function');
  const anchor = { lat: 40.7128, lng: -74.0060 };
  assert.equal(routeHelpers.isRouteNearAnchor({ waypoints: usableLoop }, anchor), true);
  assert.equal(routeHelpers.isRouteNearAnchor({ waypoints: [[41.7, -74.0], [41.8, -74.0]] }, anchor), false);
  assert.equal(routeHelpers.isRouteNearAnchor({ waypoints: [[0, 0], [null, null]] }, anchor), false);
  assert.equal(routeHelpers.isRouteNearAnchor({ waypoints: [[40.7128 + 0.008, -74.0060]] }, anchor), true);
  assert.equal(routeHelpers.isRouteNearAnchor({ waypoints: [[40.7128 + 0.010, -74.0060]] }, anchor), false);
  assert.equal(routeHelpers.isRouteNearAnchor({ waypoints: usableLoop }, null), true);
});
