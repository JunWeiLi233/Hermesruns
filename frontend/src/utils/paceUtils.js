/**
 * Format pace seconds into a display string (min:sec/km).
 * @param {number} paceSeconds - Pace in seconds per kilometer.
 * @returns {string} - Formatted pace string.
 */
export function formatPace(paceSeconds) {
  if (!paceSeconds || paceSeconds <= 0) return '--:--/km';
  const roundedSeconds = Math.round(paceSeconds);
  const mins = Math.floor(roundedSeconds / 60);
  const secs = roundedSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}/km`;
}

/**
 * Calculate pace and return it as a formatted m:ss/km string.
 * @param {number} distanceKm - Distance in kilometers.
 * @param {number} timeMinutes - Time in minutes.
 * @returns {string|null} - Formatted pace string, or null for invalid inputs.
 */
export function calculatePace(distanceKm, timeMinutes) {
  if (!distanceKm || distanceKm <= 0 || !timeMinutes || timeMinutes <= 0) {
    return null;
  }

  const paceSeconds = (timeMinutes * 60) / distanceKm;
  return formatPace(paceSeconds);
}
