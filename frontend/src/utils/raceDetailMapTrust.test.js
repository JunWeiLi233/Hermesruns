import assert from 'node:assert/strict';

import { deriveRaceMapTrust } from './raceDetailMapTrust.js';

const trustedOverlay = deriveRaceMapTrust({
  imageUrl: 'https://cdn.example.com/boston-course-map.png',
  overlayBounds: { north: 42.38, south: 42.22, east: -71.04, west: -71.55 },
  routePoints: [
    { lat: 42.228, lng: -71.522, label: 'Start' },
    { lat: 42.247, lng: -71.470 },
    { lat: 42.262, lng: -71.418 },
    { lat: 42.279, lng: -71.360 },
    { lat: 42.302, lng: -71.278 },
    { lat: 42.331, lng: -71.192 },
    { lat: 42.344, lng: -71.122 },
    { lat: 42.349, lng: -71.078, label: 'Finish' },
  ],
  confidence: 86,
  distanceKm: 42.195,
  mapCenter: [42.3601, -71.0589],
});

assert.equal(trustedOverlay.trustedRoute, true);
assert.equal(trustedOverlay.trustedOverlay, true);
assert.ok(trustedOverlay.viewportBounds);

const wrongCityOverlay = deriveRaceMapTrust({
  imageUrl: 'https://cdn.example.com/boston-course-map.png',
  overlayBounds: { north: 34.15, south: 33.95, east: -118.15, west: -118.45 },
  routePoints: [
    { lat: 34.0522, lng: -118.2437, label: 'Start' },
    { lat: 34.0610, lng: -118.2500 },
    { lat: 34.0720, lng: -118.2700 },
    { lat: 34.0810, lng: -118.3000 },
    { lat: 34.0950, lng: -118.3300 },
    { lat: 34.1100, lng: -118.3600 },
    { lat: 34.1200, lng: -118.3900 },
    { lat: 34.1300, lng: -118.4100, label: 'Finish' },
  ],
  confidence: 91,
  distanceKm: 42.195,
  mapCenter: [42.3601, -71.0589],
});

assert.equal(wrongCityOverlay.trustedRoute, true);
assert.equal(wrongCityOverlay.trustedOverlay, false);

const oversizedOverlay = deriveRaceMapTrust({
  imageUrl: 'https://cdn.example.com/boston-course-map.png',
  overlayBounds: { north: 43.4, south: 41.0, east: -69.5, west: -73.5 },
  routePoints: [
    { lat: 42.228, lng: -71.522, label: 'Start' },
    { lat: 42.247, lng: -71.470 },
    { lat: 42.262, lng: -71.418 },
    { lat: 42.279, lng: -71.360 },
    { lat: 42.302, lng: -71.278 },
    { lat: 42.331, lng: -71.192 },
    { lat: 42.344, lng: -71.122 },
    { lat: 42.349, lng: -71.078, label: 'Finish' },
  ],
  confidence: 88,
  distanceKm: 42.195,
  mapCenter: [42.3601, -71.0589],
});

assert.equal(oversizedOverlay.trustedOverlay, false);
assert.equal(
  oversizedOverlay.trustedRouteGeometry,
  true,
  'A plausible live route should remain drawable on OpenStreetMap even when the source image overlay is too broad to trust.',
);
assert.ok(oversizedOverlay.viewportBounds);
assert.ok(oversizedOverlay.viewportBounds.north < 43.4);
assert.ok(oversizedOverlay.viewportBounds.south > 41.0);

const sparseRoute = deriveRaceMapTrust({
  imageUrl: 'https://cdn.example.com/boston-course-map.png',
  overlayBounds: { north: 42.38, south: 42.22, east: -71.04, west: -71.55 },
  routePoints: [
    { lat: 42.228, lng: -71.522, label: 'Start' },
    { lat: 42.279, lng: -71.360 },
    { lat: 42.302, lng: -71.278 },
    { lat: 42.344, lng: -71.122 },
    { lat: 42.349, lng: -71.078, label: 'Finish' },
  ],
  confidence: 97,
  distanceKm: 42.195,
  mapCenter: [42.3601, -71.0589],
});

assert.equal(sparseRoute.trustedRoute, false);
assert.equal(sparseRoute.trustedOverlay, false);
assert.equal(sparseRoute.routePoints.length, 5);

const tinyRoute = deriveRaceMapTrust({
  imageUrl: 'https://cdn.example.com/tokyo-course-map.png',
  overlayBounds: { north: 35.705, south: 35.662, east: 139.754, west: 139.687 },
  routePoints: [
    { lat: 35.6895, lng: 139.6917, label: 'Start' },
    { lat: 35.6902, lng: 139.7031 },
    { lat: 35.6938, lng: 139.7124 },
    { lat: 35.6897, lng: 139.7188 },
    { lat: 35.6961, lng: 139.7227 },
    { lat: 35.6933, lng: 139.7291, label: 'Finish' },
  ],
  confidence: 94,
  distanceKm: 42.195,
  mapCenter: [35.6762, 139.6503],
});

assert.equal(tinyRoute.trustedRoute, true);
assert.equal(
  tinyRoute.trustedRouteGeometry,
  false,
  'A city-level trace that is far too short for a marathon should not be treated as drawable route geometry.',
);
assert.equal(tinyRoute.trustedOverlay, false);
assert.equal(tinyRoute.cityLevelMatch, true);
assert.ok(tinyRoute.viewportBounds);

const stylizedChicagoMap = deriveRaceMapTrust({
  imageUrl: 'https://cdn.example.com/chicago-stylized-course-map.png',
  overlayBounds: { north: 42.01, south: 41.67, east: -87.52, west: -87.78 },
  routePoints: [
    { lat: 41.902, lng: -87.646, label: 'North side' },
    { lat: 41.895, lng: -87.640 },
    { lat: 41.888, lng: -87.634 },
    { lat: 41.881, lng: -87.638 },
    { lat: 41.874, lng: -87.632 },
    { lat: 41.867, lng: -87.626, label: 'South side' },
  ],
  confidence: 93,
  distanceKm: 42.195,
  mapCenter: [41.8781, -87.6298],
});

assert.equal(stylizedChicagoMap.trustedRoute, true);
assert.equal(stylizedChicagoMap.trustedOverlay, false);
assert.equal(
  stylizedChicagoMap.cityLevelMatch,
  true,
  'Stylized marathon maps in the right city should be accepted only as city-level matches when distance plausibility fails.',
);

const storedCityLevelChicagoReference = deriveRaceMapTrust({
  imageUrl: 'https://cdn.example.com/chicago-stylized-course-map.png',
  overlayBounds: { north: 42.01, south: 41.67, east: -87.52, west: -87.78 },
  routePoints: [],
  confidence: 58,
  distanceKm: 42.195,
  mapCenter: [41.8781, -87.6298],
});

assert.equal(storedCityLevelChicagoReference.trustedRoute, false);
assert.equal(storedCityLevelChicagoReference.trustedOverlay, false);
assert.equal(
  storedCityLevelChicagoReference.cityLevelMatch,
  false,
  'City-level-only references without live route geometry should not be treated as a city-level course-map match. Only render when actual route geometry exists.',
);
assert.equal(storedCityLevelChicagoReference.viewportBounds, null);

assert.equal(
  wrongCityOverlay.cityLevelMatch,
  false,
  'A route centered in the wrong city should not be accepted as a city-level match.',
);

console.log('[PASS] Race detail map trust guardrails passed.');
