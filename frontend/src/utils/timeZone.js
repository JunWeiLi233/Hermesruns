/** The IANA time zone this device is set to, e.g. "America/New_York"; '' when the browser will not say. */
export function getDeviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
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
