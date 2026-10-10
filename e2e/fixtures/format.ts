// How the app writes numbers, so a test can build the text it should see from a number it knows.

/** 270 -> "4:30" */
export function mmss(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** 3725 -> "1:02:05" */
export function hms(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** 270 -> "4:30 /km" */
export function pacePerKm(secondsPerKm: number): string {
  return `${mmss(secondsPerKm)} /km`;
}

/** A UTC calendar day as the run page writes it: "Oct 7, 2026". */
export function shortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** The cost of running on a grade relative to the flat, as the app documents it (docs/README-ANALYSIS.md). */
export function gradeCostRatio(grade: number): number {
  return 1 + 2.896 * grade + 15.14 * grade * grade;
}

/** Grade-adjusted pace for a pace run on a constant grade (rise over run, 0.03 = 3 %). */
export function gradeAdjustedPace(secondsPerKm: number, grade: number): number {
  return secondsPerKm / gradeCostRatio(grade);
}

/** Total seconds in an "m:ss" or "h:mm:ss" string. */
export function toSeconds(text: string): number {
  const parts = text.trim().split(':').map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

// Daniels and Gilbert's oxygen-power model, the published method the app's VDOT is built on. Written out again here, from
// the paper's formulas, so a test can check the app's predictions against something it does not share code with.

/** ml/kg/min needed to run at `metresPerMinute`. */
function oxygenCost(metresPerMinute: number): number {
  return -4.6 + 0.182258 * metresPerMinute + 0.000104 * metresPerMinute * metresPerMinute;
}

/** The share of VO2max a runner can hold for `minutes`. */
function fractionOfVo2max(minutes: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes);
}

/** VDOT of a race: `distanceM` metres in `seconds`. */
export function danielsVdot(distanceM: number, seconds: number): number {
  const minutes = seconds / 60;
  return oxygenCost(distanceM / minutes) / fractionOfVo2max(minutes);
}

/** The time in seconds a runner of this VDOT takes over `distanceM` metres. */
export function danielsPredictSeconds(vdot: number, distanceM: number): number {
  let low = 3; // minutes
  let high = 900;
  for (let step = 0; step < 80; step += 1) {
    const middle = (low + high) / 2;
    // The longer the time, the lower the VDOT it implies: bisect on that.
    if (danielsVdot(distanceM, middle * 60) > vdot) low = middle;
    else high = middle;
  }
  return ((low + high) / 2) * 60;
}
