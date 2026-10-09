import { vdotToPaceSecondsPerKm } from './vdot';

/** Everything here works in seconds per kilometre, as the pace-profile endpoint sends it. */

/** Pace zones from slowest to fastest, named as the Analysis page names the Daniels paces, with a recovery zone below easy. */
export const PACE_ZONE_KEYS = ['recovery', 'easy', 'marathon', 'threshold', 'interval', 'repetition'];

/** Where one zone ends and the next begins, as a fraction of VO2max (Daniels, as in README-ANALYSIS): easy starts at 59%, marathon at 75%, and so on. */
const ZONE_CUTS = [0.59, 0.75, 0.83, 0.92, 1.05];

/**
 * The zones as pace bands, slowest first. `slowest` and `fastest` are the pace edges of a band in seconds per km;
 * the slowest band has no slow edge and the fastest has no fast edge. Empty when there is no VDOT to work from.
 */
export function paceZoneBands(vdot) {
  if (!(Number(vdot) > 0)) return [];
  const edges = ZONE_CUTS.map((fraction) => vdotToPaceSecondsPerKm(Number(vdot), fraction));
  if (edges.some((edge) => !Number.isFinite(edge) || edge <= 0)) return [];
  return PACE_ZONE_KEYS.map((key, index) => ({
    key,
    slowest: index === 0 ? null : edges[index - 1],
    fastest: index === PACE_ZONE_KEYS.length - 1 ? null : edges[index],
  }));
}

/** The index of the band a pace falls in (a pace exactly on an edge belongs to the slower band). */
export function zoneIndexForPace(pace, bands) {
  for (let index = 0; index < bands.length; index += 1) {
    const { fastest } = bands[index];
    if (fastest == null || pace > fastest) return index;
  }
  return bands.length - 1;
}

/**
 * Time in each band, from the smoothed series. Each sample stands for `stepSeconds`; a sample with no pace is the
 * runner standing still and is counted separately, so the zones add up to the time spent moving.
 *
 * @param metric 'pace' or 'gap'
 * @returns {{ seconds: number[], moving: number, stopped: number }}
 */
export function timeInPaceZones(series, bands, metric = 'pace') {
  const seconds = bands.map(() => 0);
  let moving = 0;
  let stopped = 0;
  if (!series || !bands.length) return { seconds, moving, stopped };
  const values = metric === 'gap' ? series.gapSecPerKm : series.paceSecPerKm;
  const step = Number(series.stepSeconds) || 0;
  for (const value of values || []) {
    if (value == null || !Number.isFinite(value)) {
      stopped += step;
      continue;
    }
    seconds[zoneIndexForPace(value, bands)] += step;
    moving += step;
  }
  return { seconds, moving, stopped };
}

/**
 * The pace range to draw: a little beyond the values, on whole tens of seconds and at least a minute wide. A long
 * series ignores its extreme two percent each way so one GPS spike does not flatten the line.
 */
export function paceDomain(values) {
  const finite = (values || []).filter((value) => value != null && Number.isFinite(value));
  if (!finite.length) return null;
  let low;
  let high;
  if (finite.length > 40) {
    const sorted = [...finite].sort((a, b) => a - b);
    low = sorted[Math.floor((sorted.length - 1) * 0.02)];
    high = sorted[Math.ceil((sorted.length - 1) * 0.98)];
  } else {
    low = Math.min(...finite);
    high = Math.max(...finite);
  }
  const pad = Math.max(5, (high - low) * 0.08);
  let min = Math.floor((low - pad) / 10) * 10;
  let max = Math.ceil((high + pad) / 10) * 10;
  if (max - min < 60) {
    const middle = (min + max) / 2;
    min = Math.floor((middle - 30) / 10) * 10;
    max = min + 60;
  }
  return { min: Math.max(0, min), max: Math.max(60, max) };
}

/** Whole-number pace labels at a step that leaves no more than six of them. */
export function paceTicks(domain) {
  if (!domain) return [];
  for (const step of [10, 15, 30, 60, 120, 300]) {
    const first = Math.ceil(domain.min / step) * step;
    const ticks = [];
    for (let tick = first; tick <= domain.max; tick += step) ticks.push(tick);
    if (ticks.length <= 6) return ticks;
  }
  return [];
}

/** Kilometre marks along the bottom, at a step that leaves no more than eight of them. */
export function distanceTicks(totalKm) {
  if (!(totalKm > 0)) return [];
  for (const step of [0.5, 1, 2, 5, 10, 20, 50, 100]) {
    const ticks = [];
    for (let tick = step; tick <= totalKm + 1e-9; tick += step) ticks.push(Number(tick.toFixed(3)));
    if (ticks.length <= 8) return ticks;
  }
  return [];
}

/** The index of the value in a sorted list that is closest to `target`; -1 for an empty list. */
export function nearestIndex(sorted, target) {
  if (!sorted || !sorted.length) return -1;
  let low = 0;
  let high = sorted.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (sorted[middle] < target) low = middle + 1;
    else high = middle;
  }
  if (low > 0 && Math.abs(sorted[low - 1] - target) <= Math.abs(sorted[low] - target)) return low - 1;
  return low;
}

/**
 * An SVG path through the points, lifting the pen wherever a value is missing so a stop is a gap in the line, not a
 * line to nowhere. Returns an empty string when fewer than two points can be joined.
 */
export function linePath(xs, ys, scaleX, scaleY) {
  let path = '';
  let drawing = false;
  let segmentPoints = 0;
  let segmentStart = '';
  const finish = () => {
    if (drawing && segmentPoints >= 2) path += segmentStart;
    drawing = false;
    segmentPoints = 0;
    segmentStart = '';
  };
  for (let index = 0; index < xs.length; index += 1) {
    const y = ys[index];
    if (y == null || !Number.isFinite(y)) {
      finish();
      continue;
    }
    const command = `${drawing ? 'L' : 'M'}${scaleX(xs[index]).toFixed(1)} ${scaleY(y).toFixed(1)}`;
    segmentStart += command;
    drawing = true;
    segmentPoints += 1;
  }
  finish();
  return path;
}

/** The closed shape under a line, down to a baseline, for the elevation area. Empty when there is nothing to fill. */
export function areaPath(xs, ys, scaleX, scaleY, baseline) {
  const points = [];
  for (let index = 0; index < xs.length; index += 1) {
    if (ys[index] == null || !Number.isFinite(ys[index])) continue;
    points.push([scaleX(xs[index]), scaleY(ys[index])]);
  }
  if (points.length < 2) return '';
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  return `${line}L${points[points.length - 1][0].toFixed(1)} ${baseline.toFixed(1)}L${points[0][0].toFixed(1)} ${baseline.toFixed(1)}Z`;
}
