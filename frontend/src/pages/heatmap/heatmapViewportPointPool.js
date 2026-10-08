const CELL_SIZE = 12;
const SUBCELL_SIZE = 2;

function evenlySample(entries, quota) {
  if (entries.length <= quota) return entries;
  if (quota === 1) return [entries[Math.floor(entries.length / 2)]];
  return Array.from({ length: quota }, (_, index) => entries[
    Math.round(index * (entries.length - 1) / (quota - 1))
  ]);
}

// World-pixel cells keep selection anchored to the map when the camera pans.
// Every returned location is an input GPS point; no jitter or interpolation.
export function buildHeatmapViewportPointPool(points, limit) {
  if (!Array.isArray(points) || !Number.isFinite(limit) || limit < 1) return [];
  const budget = Math.floor(limit);
  const cells = new Map();
  points.forEach((point, index) => {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
    const x = point.worldX ?? point.x;
    const y = point.worldY ?? point.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const column = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);
    const key = `${column}:${row}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = { column, row, runs: new Set(), visits: 1, points: new Map() };
      cells.set(key, cell);
    }
    if (point.activityId != null) cell.runs.add(String(point.activityId));
    const recordedVisits = Number(point.visitCount);
    if (Number.isFinite(recordedVisits)) cell.visits = Math.max(cell.visits, recordedVisits);
    const subcell = `${Math.floor(x / SUBCELL_SIZE)}:${Math.floor(y / SUBCELL_SIZE)}`;
    const previous = cell.points.get(subcell);
    // Prefer the refined server sample over a coincident bootstrap sample.
    if (!previous || (Number(point.visitCount) || 0) > (Number(previous.point.visitCount) || 0)) {
      cell.points.set(subcell, { point, x, y, index });
    }
  });

  const buckets = [...cells.values()].sort((a, b) => a.column - b.column || a.row - b.row);
  for (const cell of buckets) {
    // Server counts include all runs, including those omitted from the sample.
    // The distinct-ID fallback supports the existing bootstrap/cache payload.
    cell.visits = Math.max(cell.visits, cell.runs.size);
    const quota = Math.min(16, Math.max(1, Math.ceil(Math.sqrt(cell.visits)) * 2 - 1));
    const entries = [...cell.points.values()].sort((a, b) => a.x - b.x || a.y - b.y || a.index - b.index);
    cell.samples = evenlySample(entries, Math.min(quota, entries.length));
  }
  const result = [];
  const append = (cell, entry) => result.push({ ...entry.point, densityVisits: cell.visits });
  if (buckets.length >= budget) {
    for (const cell of evenlySample(buckets, budget)) append(cell, cell.samples[0]);
    return result;
  }

  // Reserve coverage first, then give repeat-run areas the additional dots.
  for (const cell of buckets) append(cell, cell.samples[0]);
  const busiestFirst = buckets.slice().sort((a, b) => b.visits - a.visits || a.column - b.column || a.row - b.row);
  for (let layer = 1; layer < 16 && result.length < budget; layer += 1) {
    for (const cell of busiestFirst) {
      if (result.length >= budget) break;
      if (cell.samples[layer]) append(cell, cell.samples[layer]);
    }
  }
  return result;
}
