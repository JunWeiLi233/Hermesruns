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

/** The UTC calendar day `daysBack` days before today, as `yyyy-MM-dd` (where `daysAgo(n)` puts a run). */
export function utcDay(daysBack: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

/** The Monday of the week a `yyyy-MM-dd` day is in (weeks run Monday to Sunday). */
export function weekStartOf(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  const back = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - back);
  return date.toISOString().slice(0, 10);
}

/** A `yyyy-MM-dd` day moved by whole days. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 3.14159 -> "3.1": one decimal, the way the fitness cards write a number. */
export function oneDecimal(value: number): string {
  return value.toFixed(1);
}

/** 3.14 -> "+3.1", -4.06 -> "−4.1" (a real minus sign), 0.02 -> "0.0": how the cards write a change or a form value. */
export function signedChange(value: number, digits = 1): string {
  const rounded = Number(Math.abs(value).toFixed(digits));
  if (rounded === 0) return (0).toFixed(digits);
  return `${value > 0 ? '+' : '−'}${rounded.toFixed(digits)}`;
}

/** "2026-10-07" -> "Oct 7": a day without its year, as the chart axes and the week lists write it. */
export function shortDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
