import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(rootDir, 'frontend/src/data/worldRaceCatalog.json');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const locationsByCountry = new Map();

for (const race of catalog) {
  if (
    !locationsByCountry.has(race.country)
    && Number.isFinite(Number(race.lat))
    && Number.isFinite(Number(race.lng))
  ) {
    locationsByCountry.set(race.country, {
      country: race.country,
      latitude: Number(race.lat),
      longitude: Number(race.lng),
    });
  }
}

const locations = [...locationsByCountry.values()];
assert.ok(locations.length > 0, 'World race catalog must contain country coordinates.');

for (let offset = 0; offset < locations.length; offset += 20) {
  const batch = locations.slice(offset, offset + 20);
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', batch.map((location) => location.latitude).join(','));
  url.searchParams.set('longitude', batch.map((location) => location.longitude).join(','));
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,dew_point_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code',
  );
  url.searchParams.set('hourly', 'temperature_2m,weather_code');
  url.searchParams.set('cell_selection', 'land');
  url.searchParams.set('temperature_unit', 'celsius');
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('forecast_hours', '12');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  assert.equal(response.status, 200, `Open-Meteo batch failed with HTTP ${response.status}.`);

  const payload = await response.json();
  const forecasts = Array.isArray(payload) ? payload : [payload];
  assert.equal(forecasts.length, batch.length, 'Provider response count must match requested countries.');

  forecasts.forEach((forecast, index) => {
    const location = batch[index];
    assert.ok(Number.isFinite(forecast?.current?.temperature_2m), `${location.country}: current temperature missing.`);
    assert.ok(Number.isFinite(forecast?.current?.dew_point_2m), `${location.country}: current dew point missing.`);
    assert.ok(Number.isFinite(forecast?.current?.relative_humidity_2m), `${location.country}: humidity missing.`);
    assert.ok(Number.isFinite(forecast?.current?.wind_speed_10m), `${location.country}: wind speed missing.`);
    assert.ok(forecast?.hourly?.time?.length >= 12, `${location.country}: 12-hour forecast missing.`);
    assert.equal(
      forecast.hourly.time.length,
      forecast.hourly.temperature_2m.length,
      `${location.country}: hourly temperatures are misaligned.`,
    );
  });
}

console.log(`[PASS] Live weather data verified for ${locations.length} Hermes catalog countries.`);
