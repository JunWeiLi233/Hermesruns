/** The IANA time zone this device is set to, e.g. "America/New_York"; '' when the browser will not say. */
export function getDeviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

/** Account calendar date; matches the backend's UTC fallback for an unset/invalid zone. */
export function getAccountDate(timeZone, now = new Date()) {
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : 'UTC',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
  }
  const parts = Object.fromEntries(formatter.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Date-only arithmetic uses UTC as a calendar coordinate, never as an activity instant. */
export function calendarDate(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key))) return new Date(NaN);
  return new Date(`${key}T00:00:00Z`);
}

export function addCalendarDays(key, days) {
  const date = calendarDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function accountWeekStart(key) {
  return addCalendarDays(key, -((calendarDate(key).getUTCDay() + 6) % 7));
}

export function getActivityDateKey(activity, timeZone) {
  const instant = activity?.activityInstant;
  if (instant && timeZone && !Number.isNaN(new Date(instant).getTime())) return getAccountDate(timeZone, new Date(instant));
  if (activity?.accountLocalDate) return activity.accountLocalDate;
  const raw = activity?.startTime || activity?.startDate || activity?.createdAt || '';
  // Legacy offset-free timestamps have no trustworthy zone. Keep their wall date until refreshed.
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    if (timeZone && /(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) return getAccountDate(timeZone, new Date(raw));
    return raw.slice(0, 10);
  }
  return '';
}

/** A UTC coordinate for rendering a calendar wall clock; not an inferred activity instant. */
export function getActivityCalendarDate(activity, timeZone) {
  const key = getActivityDateKey(activity, timeZone);
  if (!key) return new Date(NaN);
  const clock = activity?.accountLocalTime || (activity?.startTime || activity?.startDate || '').slice(11, 19) || '00:00:00';
  return new Date(`${key}T${clock}Z`);
}

export function activitySortTime(activity) {
  const value = activity?.activityInstant;
  return value ? new Date(value).getTime() : getActivityCalendarDate(activity).getTime();
}

/** Display-calendar ordering only; this coordinate is not an elapsed-time instant. */
export function activityCalendarSortTime(activity) {
  const coordinate = getActivityCalendarDate(activity).getTime();
  return Number.isNaN(coordinate) ? activitySortTime(activity) : coordinate;
}

export function formatActivityTime(activity, lang, options, timeZone) {
  if (activity?.activityInstant && timeZone) {
    try { return new Intl.DateTimeFormat(lang, { ...options, timeZone }).format(new Date(activity.activityInstant)); } catch { /* UTC fallback below */ }
  }
  const date = getActivityCalendarDate(activity, timeZone);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(lang, { ...options, timeZone: 'UTC' }).format(date);
}

/** Every IANA zone this browser knows, sorted, always including the extra ones passed in. */
export function listTimeZones(...extra) {
  let known;
  try {
    known = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  } catch {
    known = [];
  }
  return [...new Set([...known, 'UTC', ...extra.filter(Boolean)])].sort((a, b) => a.localeCompare(b));
}
