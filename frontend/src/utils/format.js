/**
 * Formatting utilities for Hermes running analytics.
 */

/**
 * Format a duration in seconds as h:mm:ss or m:ss.
 */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Number(totalSeconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Format pace seconds as m:ss for pace display.
 */
export function formatPaceSeconds(totalSeconds) {
  if (!Number.isFinite(totalSeconds)) return '--:--';
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format a date value as a short date string.
 */
export function formatDate(value, lang) {
  if (!value) return '--';
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return '--';
  return parsedDate.toLocaleDateString(lang || 'zh-CN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date value as a long date string with weekday and time.
 */
export function formatLongDate(value, lang) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(lang || 'zh-CN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a distance in km with unit label.
 * e.g. "5.0 km" or "5.0 公里"
 */
export function formatDistance(km, digits = 1, lang) {
  const value = Number(km || 0);
  const unit = (lang || 'zh-CN') === 'en' ? 'km' : '公里';
  return `${value.toFixed(digits)} ${unit}`;
}

/**
 * Format pace from distance and time.
 * e.g. "5:30 /km" or "5:30 /公里"
 */
export function formatPace(distanceKm, movingTimeSeconds, lang) {
  if (!distanceKm || !movingTimeSeconds) {
    const suffix = (lang || 'zh-CN') === 'en' ? '/km' : '/公里';
    return `0:00 ${suffix}`;
  }
  const paceSeconds = movingTimeSeconds / distanceKm;
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);
  const suffix = (lang || 'zh-CN') === 'en' ? '/km' : '/公里';
  return `${minutes}:${String(seconds).padStart(2, '0')} ${suffix}`;
}

/**
 * Escape HTML special characters.
 */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
