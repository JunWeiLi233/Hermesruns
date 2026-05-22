/** WMO Weather interpretation codes (Open-Meteo). Returns an emoji icon. */
export function wmoWeatherIcon(code) {
  const c = Number(code);
  if (!Number.isFinite(c)) return '🌡️';
  if (c === 0) return '☀️';
  if (c >= 1 && c <= 3) return '⛅';
  if (c >= 45 && c <= 48) return '🌫️';
  if (c >= 51 && c <= 57) return '🌦️';
  if (c >= 61 && c <= 67) return '🌧️';
  if (c >= 71 && c <= 77) return '❄️';
  if (c >= 80 && c <= 82) return '🌧️';
  if (c >= 85 && c <= 86) return '🌨️';
  if (c >= 95 && c <= 99) return '⛈️';
  return '☁️';
}
