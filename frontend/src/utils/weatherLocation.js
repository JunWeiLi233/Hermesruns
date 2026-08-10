const OPEN_METEO_FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const CURRENT_WEATHER_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'dew_point_2m',
  'relative_humidity_2m',
  'wind_speed_10m',
  'wind_direction_10m',
  'weather_code',
];

export function toFiniteNumber(value) {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeWeatherCoordinates(latitude, longitude) {
  const normalizedLatitude = toFiniteNumber(latitude);
  const normalizedLongitude = toFiniteNumber(longitude);
  if (
    normalizedLatitude === null
    || normalizedLongitude === null
    || normalizedLatitude < -90
    || normalizedLatitude > 90
    || normalizedLongitude < -180
    || normalizedLongitude > 180
  ) {
    return null;
  }
  return { latitude: normalizedLatitude, longitude: normalizedLongitude };
}

export function buildOpenMeteoForecastUrl(coordinates) {
  const normalized = normalizeWeatherCoordinates(coordinates?.latitude, coordinates?.longitude);
  if (!normalized) throw new TypeError('Invalid weather coordinates.');

  const url = new URL(OPEN_METEO_FORECAST_ENDPOINT);
  url.searchParams.set('latitude', normalized.latitude);
  url.searchParams.set('longitude', normalized.longitude);
  url.searchParams.set('current', CURRENT_WEATHER_FIELDS.join(','));
  url.searchParams.set('hourly', 'temperature_2m,weather_code');
  // Omitting `models` activates Open-Meteo's documented auto/Best Match selector.
  url.searchParams.set('cell_selection', 'land');
  url.searchParams.set('temperature_unit', 'celsius');
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('forecast_hours', '12');
  url.searchParams.set('timezone', 'auto');
  return url;
}
