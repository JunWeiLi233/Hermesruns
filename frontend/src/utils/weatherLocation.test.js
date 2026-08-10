import assert from 'node:assert/strict';

import {
  buildOpenMeteoForecastUrl,
  normalizeWeatherCoordinates,
} from './weatherLocation.js';

const GLOBAL_LOCATION_MATRIX = [
  { country: 'Canada', latitude: 45.4215, longitude: -75.6972 },
  { country: 'Brazil', latitude: -15.7939, longitude: -47.8828 },
  { country: 'Iceland', latitude: 64.1466, longitude: -21.9426 },
  { country: 'Ghana', latitude: 5.6037, longitude: -0.1870 },
  { country: 'South Africa', latitude: -33.9249, longitude: 18.4241 },
  { country: 'Kenya', latitude: -1.2921, longitude: 36.8219 },
  { country: 'India', latitude: 28.6139, longitude: 77.2090 },
  { country: 'China', latitude: 39.9042, longitude: 116.4074 },
  { country: 'Japan', latitude: 35.6762, longitude: 139.6503 },
  { country: 'Australia', latitude: -35.2809, longitude: 149.1300 },
  { country: 'New Zealand', latitude: -41.2866, longitude: 174.7756 },
  { country: 'Fiji', latitude: -18.1248, longitude: 178.4501 },
];

for (const location of GLOBAL_LOCATION_MATRIX) {
  const coordinates = normalizeWeatherCoordinates(location.latitude, location.longitude);
  assert.deepEqual(
    coordinates,
    { latitude: location.latitude, longitude: location.longitude },
    `${location.country} coordinates should remain valid.`,
  );

  const url = buildOpenMeteoForecastUrl(coordinates);
  assert.equal(Number(url.searchParams.get('latitude')), location.latitude);
  assert.equal(Number(url.searchParams.get('longitude')), location.longitude);
  assert.equal(url.searchParams.get('timezone'), 'auto');
  assert.equal(url.searchParams.has('models'), false);
  assert.equal(url.searchParams.get('cell_selection'), 'land');
  assert.equal(url.searchParams.get('temperature_unit'), 'celsius');
  assert.equal(url.searchParams.get('wind_speed_unit'), 'kmh');
  assert.equal(url.searchParams.get('forecast_hours'), '12');
  assert.match(url.searchParams.get('current') || '', /dew_point_2m/);
}

assert.deepEqual(normalizeWeatherCoordinates('0', '0'), { latitude: 0, longitude: 0 });
assert.equal(normalizeWeatherCoordinates(null, 0), null);
assert.equal(normalizeWeatherCoordinates(91, 0), null);
assert.equal(normalizeWeatherCoordinates(0, -181), null);
assert.equal(normalizeWeatherCoordinates(Number.NaN, 0), null);

console.log('[PASS] Global weather coordinate coverage guardrails passed.');
