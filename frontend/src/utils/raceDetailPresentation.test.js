import assert from 'node:assert/strict';

import {
  deriveRaceElevationPresentation,
  deriveRaceMapPresentation,
} from './raceDetailPresentation.js';

const candidateOnlyMap = deriveRaceMapPresentation({
  city: 'Boston',
  imageUrl: 'https://cdn.example.com/boston-course-map.png',
  overlayBounds: null,
  routePoints: [],
});

assert.equal(candidateOnlyMap.mode, 'detected-image');
assert.equal(candidateOnlyMap.shouldRenderLeaflet, false);
assert.equal(candidateOnlyMap.title, 'Boston city map');

const alignedMap = deriveRaceMapPresentation({
  city: 'Boston',
  imageUrl: 'https://cdn.example.com/boston-course-map.png',
  overlayBounds: { north: 42.4, south: 42.3, east: -71.0, west: -71.1 },
  routePoints: [
    { lat: 42.35, lng: -71.08 },
    { lat: 42.36, lng: -71.05 },
  ],
});

assert.equal(alignedMap.mode, 'aligned-overlay');
assert.equal(alignedMap.shouldRenderLeaflet, true);

const candidateOnlyElevation = deriveRaceElevationPresentation({
  alignedElevationSamples: [],
  totalClimbMeters: null,
  citedProfileImageUrl: 'https://cdn.example.com/boston-profile.png',
  citedProfileSource: 'official-site',
  imageDerivedProfileSamples: [22, 40, 61, 80],
});

assert.equal(candidateOnlyElevation.mode, 'profile-image');
assert.equal(candidateOnlyElevation.chartProfile, null);
assert.equal(candidateOnlyElevation.totalClimbMeters, null);
assert.equal(candidateOnlyElevation.peakMeters, null);

const alignedElevation = deriveRaceElevationPresentation({
  alignedElevationSamples: [18, 26, 34, 28],
  totalClimbMeters: 77,
  citedProfileImageUrl: '',
  citedProfileSource: '',
  imageDerivedProfileSamples: [22, 40, 61, 80],
});

assert.equal(alignedElevation.mode, 'aligned-route-chart');
assert.deepEqual(alignedElevation.chartProfile, [18, 26, 34, 28]);
assert.equal(alignedElevation.totalClimbMeters, 77);
assert.equal(alignedElevation.peakMeters, 34);

console.log('[PASS] Race detail presentation guardrails passed.');
