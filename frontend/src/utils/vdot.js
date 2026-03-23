/**
 * VDOT calculation utilities — ported from the Daniels/Gilbert formula
 * used in analysis.html.
 */

/**
 * Calculate VDOT from distance (meters) and time (minutes).
 * Jack Daniels' formula.
 */
export function calculateVdot(distanceMeters, timeMinutes) {
  if (distanceMeters <= 0 || timeMinutes <= 0) return 0;
  const velocity = distanceMeters / timeMinutes; // m/min
  const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;
  const percentMax =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes);
  return percentMax > 0 ? vo2 / percentMax : 0;
}

/**
 * Convert VDOT + %VO2max fraction to pace in seconds per km.
 * Solves the quadratic VO2-velocity equation for velocity, then converts.
 */
export function vdotToPaceSecondsPerKm(vdot, vo2Fraction) {
  const targetVo2 = vdot * vo2Fraction;
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.60 - targetVo2;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const v = (-b + Math.sqrt(disc)) / (2 * a); // m/min
  return v > 0 ? (1000 / v) * 60 : null;
}

/**
 * Compute Daniels' training paces from VDOT.
 * Returns pace ranges in seconds/km for each zone.
 */
export function computeTrainingPaces(vdot) {
  return {
    easy: [vdotToPaceSecondsPerKm(vdot, 0.54), vdotToPaceSecondsPerKm(vdot, 0.62)],
    marathon: [vdotToPaceSecondsPerKm(vdot, 0.78)],
    threshold: [vdotToPaceSecondsPerKm(vdot, 0.85)],
    interval: [vdotToPaceSecondsPerKm(vdot, 0.96)],
    repetition: [vdotToPaceSecondsPerKm(vdot, 1.11)],
  };
}

/**
 * Predict race time for a given distance using binary search on the VDOT equation.
 * Returns time in minutes, or null if inputs are invalid.
 */
export function predictRaceTime(vdot, distanceMeters) {
  if (!vdot || vdot <= 0 || distanceMeters <= 0) return null;
  let lo = 1;
  let hi = 600;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const v = calculateVdot(distanceMeters, mid);
    if (v > vdot) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Standard race distances used for predictions.
 */
export const RACE_DISTANCES = [
  { key: '5k', meters: 5000, labelZh: '5 公里', labelEn: '5K' },
  { key: '10k', meters: 10000, labelZh: '10 公里', labelEn: '10K' },
  { key: 'half', meters: 21097.5, labelZh: '半程马拉松', labelEn: 'Half Marathon' },
  { key: 'marathon', meters: 42195, labelZh: '全程马拉松', labelEn: 'Marathon' },
];
