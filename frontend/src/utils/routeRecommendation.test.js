import assert from 'node:assert/strict';
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

console.log('[PASS] Route recommendation quality guard passed.');
