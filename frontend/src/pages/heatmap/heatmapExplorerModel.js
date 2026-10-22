import { getActivityDateKey } from '../../utils/timeZone.js';

export const EMPTY_EXPLORER_FILTERS = Object.freeze({ query: '', from: '', to: '', provider: '', minDistance: '', maxDistance: '', minMinutes: '', maxMinutes: '' });
export const EXPLORER_ZOOM = 14;
const valid = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 85.05112878 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
const metric = (value) => value === null || value === undefined || value === '' ? NaN : Number(value);
export const activityDistance = (run) => Number.isFinite(metric(run.distanceKm)) ? metric(run.distanceKm) : metric(run.distanceMeters) / 1000;
export const activityDuration = (run) => metric(run.movingTimeSeconds ?? run.durationSeconds);

export function filterExplorerActivities(activities, filters = {}, timeZone) {
  const within = (value, min, max) => (min === '' || min == null || (Number.isFinite(value) && value >= Number(min)))
    && (max === '' || max == null || (Number.isFinite(value) && value <= Number(max)));
  return activities.filter((run) => {
    const day = getActivityDateKey(run, timeZone);
    return (!filters.query || String(run.name || '').toLocaleLowerCase().includes(filters.query.trim().toLocaleLowerCase()))
      && (!filters.from || (day && day >= filters.from)) && (!filters.to || (day && day <= filters.to))
      && (!filters.provider || run.provider === filters.provider)
      && within(activityDistance(run), filters.minDistance, filters.maxDistance)
      && within(activityDuration(run) / 60, filters.minMinutes, filters.maxMinutes);
  });
}

export function summarizeExplorerActivities(activities) {
  return activities.reduce((summary, run) => {
    summary.count++;
    const distance = activityDistance(run);
    const duration = activityDuration(run);
    if (Number.isFinite(distance) && distance >= 0) { summary.distanceKm += distance; summary.distanceCount++; }
    if (Number.isFinite(duration) && duration >= 0) { summary.movingSeconds += duration; summary.durationCount++; }
    return summary;
  }, { count: 0, distanceKm: 0, movingSeconds: 0, distanceCount: 0, durationCount: 0 });
}

export function tileBounds(x, y) {
  const n = 2 ** EXPLORER_ZOOM;
  const latitude = (row) => Math.atan(Math.sinh(Math.PI * (1 - 2 * row / n))) * 180 / Math.PI;
  return [[latitude(y + 1), x / n * 360 - 180], [latitude(y), (x + 1) / n * 360 - 180]];
}

/** Observed tiles only: never interpolate the spatially sampled point pool. */
export function buildExplorerTiles(points) {
  const n = 2 ** EXPLORER_ZOOM;
  const cells = new Map();
  for (const point of points) {
    const lat = point.latitude;
    const lng = point.longitude;
    if (!valid(lat, lng)) continue;
    const x = Math.min(n - 1, Math.floor((lng + 180) / 360 * n));
    const y = Math.max(0, Math.min(n - 1, Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n)));
    cells.set(`${x}:${y}`, { x, y, key: `${x}:${y}` });
  }
  const clusterKeys = new Set();
  const tiles = [...cells.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  const dp = new Map();
  let maxSquare = { size: 0, x: 0, y: 0 };
  for (const { x, y, key } of tiles) {
    if (cells.has(`${x - 1}:${y}`) && cells.has(`${x + 1}:${y}`) && cells.has(`${x}:${y - 1}`) && cells.has(`${x}:${y + 1}`)) clusterKeys.add(key);
    const size = 1 + Math.min(dp.get(`${x - 1}:${y}`) || 0, dp.get(`${x}:${y - 1}`) || 0, dp.get(`${x - 1}:${y - 1}`) || 0);
    dp.set(key, size);
    if (size > maxSquare.size) maxSquare = { size, x: x - size + 1, y: y - size + 1 };
  }
  const pending = new Set(clusterKeys);
  const maxClusterKeys = new Set();
  while (pending.size) {
    const stack = [pending.values().next().value];
    pending.delete(stack[0]);
    const group = [];
    while (stack.length) {
      const key = stack.pop();
      group.push(key);
      const { x, y } = cells.get(key);
      for (const next of [`${x - 1}:${y}`, `${x + 1}:${y}`, `${x}:${y - 1}`, `${x}:${y + 1}`]) {
        if (pending.delete(next)) stack.push(next);
      }
    }
    if (group.length > maxClusterKeys.size) { maxClusterKeys.clear(); for (const key of group) maxClusterKeys.add(key); }
  }
  return { tiles, clusterKeys, maxClusterKeys, maxCluster: maxClusterKeys.size, maxSquare };
}

export function explorerCsv(activities, timeZone) {
  const quote = (value) => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return ['id,date,name,distance_km,moving_seconds,source', ...activities.map((run) => [run.id, getActivityDateKey(run, timeZone), run.name, Number.isFinite(activityDistance(run)) ? activityDistance(run) : '', Number.isFinite(activityDuration(run)) ? activityDuration(run) : '', run.provider].map(quote).join(','))].join('\r\n');
}

export function splitRouteAtGaps(points) {
  const segments = [];
  let line = [];
  let previous = null;
  for (const point of points) {
    const lat = Number(point?.latitude ?? point?.lat ?? point?.[0]);
    const lng = Number(point?.longitude ?? point?.lng ?? point?.[1]);
    if (!valid(lat, lng)) { if (line.length > 1) segments.push(line); line = []; previous = null; continue; }
    // A conservative ten-kilometre break also avoids antimeridian connectors.
    const gap = previous && Math.hypot((lat - previous[0]) * 111.2, (lng - previous[1]) * 111.2 * Math.cos(lat * Math.PI / 180)) > 10;
    if (gap) { if (line.length > 1) segments.push(line); line = []; }
    previous = [lat, lng];
    line.push(previous);
  }
  if (line.length > 1) segments.push(line);
  return segments;
}
