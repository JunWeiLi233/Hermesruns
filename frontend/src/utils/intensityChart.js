/**
 * The geometry of the intensity chart: a bar for each week, made of the time the runner's heart rate spent in each of
 * the five zones, zone 1 at the bottom. Pure, like the weekly effort chart's.
 */

import { niceCeiling } from './fitnessChart';

/** The heart-rate zones in the order they are stacked, lowest first. */
export const ZONE_NUMBERS = [1, 2, 3, 4, 5];

/** Zones 1 to this number are the low band, the next is the moderate band, the last the high band (the server says so too). */
export const DEFAULT_LOW_ZONES = 3;

/** Which band a zone belongs to, for a server that cuts the low band after `lowZones` zones. */
export function bandOfZone(zoneNumber, lowZones = DEFAULT_LOW_ZONES) {
  if (zoneNumber <= lowZones) return 'low';
  return zoneNumber === lowZones + 1 ? 'moderate' : 'high';
}

/** Whole numbers of seconds in the five zones, or null when a week does not carry them. */
function zonesOf(week) {
  const seconds = week?.zoneSeconds;
  if (!Array.isArray(seconds) || seconds.length !== ZONE_NUMBERS.length) return null;
  return seconds.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
}

/** What the axis counts: hours when the tallest week holds two hours or more of heart-rate time, else minutes. */
export function axisUnit(weeks) {
  const totals = (Array.isArray(weeks) ? weeks : [])
    .map((week) => zonesOf(week))
    .filter(Boolean)
    .map((zones) => zones.reduce((sum, value) => sum + value, 0));
  return totals.length > 0 && Math.max(...totals) >= 2 * 3600 ? 'h' : 'min';
}

/**
 * @param weeks the weeks as the server sends them, oldest first: `start`, `complete`, `runs`, `runsWithHeartRate` and
 *              `zoneSeconds` (five numbers)
 * @returns null when there are no weeks, else every bar with the segment of each zone in it, the axis and its ticks.
 *          The axis counts hours when the tallest week is two hours or more, else minutes (`unit`).
 */
export function buildIntensityChart(weeks, { width = 640, height = 220 } = {}) {
  const rows = (Array.isArray(weeks) ? weeks : [])
    .map((week) => ({ week, zones: zonesOf(week) }))
    .filter((row) => row.zones);
  if (rows.length === 0) return null;

  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = width - padL - padR;
  const baseline = height - padB;
  const top = padT;
  const totals = rows.map((row) => row.zones.reduce((sum, value) => sum + value, 0));
  const tallestSeconds = Math.max(...totals);
  const unit = axisUnit(rows.map((row) => row.week));
  const perUnit = unit === 'h' ? 3600 : 60;
  const tallest = tallestSeconds / perUnit;
  const step = tallest > 0 ? niceCeiling((tallest * 1.1) / 4) : 1;
  const yMax = step * 4;
  const yOf = (value) => baseline - (Math.max(0, value) / yMax) * (baseline - top);

  const slot = plotW / rows.length;
  const barW = Math.max(6, Math.min(44, slot * 0.56));
  const bars = rows.map(({ week, zones }, index) => {
    const centre = padL + slot * (index + 0.5);
    let stacked = 0;
    const segments = zones.map((seconds, zoneIndex) => {
      const from = yOf(stacked / perUnit);
      stacked += seconds;
      const to = yOf(stacked / perUnit);
      return { zone: ZONE_NUMBERS[zoneIndex], seconds, y: to, height: Math.max(0, from - to) };
    });
    const total = zones.reduce((sum, value) => sum + value, 0);
    const barTop = yOf(total / perUnit);
    return {
      index,
      week,
      total,
      segments,
      x: centre - barW / 2,
      centre,
      width: barW,
      y: barTop,
      height: baseline - barTop,
      slotX: padL + slot * index,
      slotWidth: slot,
    };
  });

  // A label under every n-th week counted back from the current one, so the gaps between them are the same and the newest week is named.
  const maxTicks = width < 480 ? 3 : width < 720 ? 5 : 7;
  const every = Math.max(1, Math.ceil(bars.length / maxTicks));
  const xTicks = bars.filter((bar) => (bars.length - 1 - bar.index) % every === 0);
  const yTicks = [0, 1, 2, 3, 4].map((index) => ({ value: step * index, y: yOf(step * index) }));

  return { width, height, padL, padR, padT: top, baseline, yMax, unit, bars, xTicks, yTicks, slot, barW };
}

/** The shares of a week's heart-rate time in the three bands, or null when it has none. */
export function weekBands(week, lowZones = DEFAULT_LOW_ZONES) {
  const zones = zonesOf(week);
  if (!zones) return null;
  const sums = { low: 0, moderate: 0, high: 0 };
  zones.forEach((seconds, index) => { sums[bandOfZone(index + 1, lowZones)] += seconds; });
  const total = sums.low + sums.moderate + sums.high;
  if (total <= 0) return null;
  return { low: sums.low / total, moderate: sums.moderate / total, high: sums.high / total };
}

/** A whole percent for a share between 0 and 1, never rounding a small share down to nothing nor a big one up to all. */
export function percentOf(share) {
  if (!Number.isFinite(share) || share <= 0) return 0;
  const percent = Math.round(share * 100);
  if (percent === 0) return 1;
  return share < 1 && percent === 100 ? 99 : percent;
}
