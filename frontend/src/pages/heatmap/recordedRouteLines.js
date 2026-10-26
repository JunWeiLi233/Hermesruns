const BATCH_SIZE = 50; // Existing owner-scoped route-preview API limit.
const MAX_GAP_KM = 2;
const valid = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng)
  && Math.abs(lat) <= 85.051129 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

export function normalizeRecordedRoute(entry) {
  const segments = [];
  let line = [];
  const finish = () => { if (line.length > 1) segments.push(line); line = []; };
  // This endpoint returns points in sequence_index order. The spatial heatmap
  // sample is deliberately never used to construct lines.
  for (const point of Array.isArray(entry?.points) ? entry.points : []) {
    const lat = Number(point?.latitude ?? NaN), lng = Number(point?.longitude ?? NaN);
    if (!valid(lat, lng)) { finish(); continue; }
    const previous = line.at(-1);
    if (previous && Math.hypot((lat - previous[0]) * 111.2,
      (lng - previous[1]) * 111.2 * Math.cos(lat * Math.PI / 180)) > MAX_GAP_KM) finish();
    line.push([lat, lng]);
  }
  finish();
  return { activityId: String(entry.activityId), segments };
}

export async function loadRecordedRoutes(activityIds, { fetchJson, signal, onBatch }) {
  const ids = [...new Set(activityIds.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))];
  // Sequential batches bound both database work and memory; paint each completed
  // batch so a large history does not delay the first visible routes.
  for (let offset = 0; offset < ids.length && !signal.aborted; offset += BATCH_SIZE) {
    const batch = ids.slice(offset, offset + BATCH_SIZE);
    const response = await fetchJson(`/api/activities/route-previews?${new URLSearchParams({ ids: batch.join(',') })}`, { signal });
    if (signal.aborted) return;
    if (!Array.isArray(response)) throw new Error('Invalid recorded-route response');
    const owned = new Map(response.map(entry => [String(entry?.activityId), entry]));
    onBatch(batch.map(id => normalizeRecordedRoute(owned.get(String(id)) || { activityId: id, points: [] })));
  }
}

export function paintRecordedRouteLines(context, routes, project) {
  context.beginPath();
  let count = 0;
  for (const route of routes) for (const segment of route.segments) {
    let started = false;
    for (const coordinate of segment) {
      const { x, y } = project(coordinate);
      if (!Number.isFinite(x) || !Number.isFinite(y)) { started = false; continue; }
      if (started) context.lineTo(x, y);
      else { context.moveTo(x, y); started = true; }
    }
    count++;
  }
  // CSS pixels, independent of map zoom and device pixel ratio. One stroke
  // avoids opacity accumulation turning overlapping runs into a solid area.
  context.lineWidth = 1.6;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = '#ff3038';
  context.globalAlpha = .9;
  context.stroke();
  context.globalAlpha = 1;
  return count;
}
