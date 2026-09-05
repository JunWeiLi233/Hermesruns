function asFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeOverlayBounds(rawBounds) {
  if (!rawBounds || typeof rawBounds !== 'object') return null;
  const north = asFiniteNumber(rawBounds.north);
  const south = asFiniteNumber(rawBounds.south);
  const east = asFiniteNumber(rawBounds.east);
  const west = asFiniteNumber(rawBounds.west);
  if (north == null || south == null || east == null || west == null) return null;
  if (north <= south || east <= west) return null;
  return { north, south, east, west };
}
