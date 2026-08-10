const ROUTE_COORDINATE_SCALE = 10_000_000;
const MAX_ROUTE_DISTANCE_GAP_RATIO = 0.25;
const MIN_ROUTE_DISTANCE_GAP_KM = 1;

export function normalizeRouteWaypoint(point) {
  if (Array.isArray(point) && point.length >= 2) {
    const lat = Number(point[0]);
    const lng = Number(point[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  const lat = Number(point?.lat ?? point?.latitude);
  const lng = Number(point?.lng ?? point?.lon ?? point?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function extractRouteWaypoints(route) {
  const points = (Array.isArray(route?.waypoints) ? route.waypoints : [])
    .map(normalizeRouteWaypoint)
    .filter(Boolean);
  return points.length >= 4 ? points : null;
}

function routePointKey(point) {
  return `${Math.round(point.lat * ROUTE_COORDINATE_SCALE)}:${Math.round(point.lng * ROUTE_COORDINATE_SCALE)}`;
}

export function hasRepeatedRouteSegment(waypoints) {
  const points = (Array.isArray(waypoints) ? waypoints : [])
    .map(normalizeRouteWaypoint)
    .filter(Boolean);
  const traversed = new Set();
  for (let index = 1; index < points.length; index += 1) {
    const previousKey = routePointKey(points[index - 1]);
    const currentKey = routePointKey(points[index]);
    const segmentKey = previousKey <= currentKey
      ? `${previousKey}|${currentKey}`
      : `${currentKey}|${previousKey}`;
    if (traversed.has(segmentKey)) return true;
    traversed.add(segmentKey);
  }
  return false;
}

export function isRouteRecommendationUsable(route, targetDistanceKm, options = {}) {
  const waypoints = extractRouteWaypoints(route);
  const actualDistanceKm = Number(route?.actualDistanceKm || 0);
  const targetKm = Number(targetDistanceKm || route?.targetDistanceKm || actualDistanceKm || 0);
  if (!waypoints || actualDistanceKm <= 0 || hasRepeatedRouteSegment(waypoints)) {
    return false;
  }
  if (options.requireStreetGraph !== false && route?.streetGraphBacked !== true) {
    return false;
  }
  if (targetKm <= 0) return true;
  const allowedGapKm = Math.max(MIN_ROUTE_DISTANCE_GAP_KM, targetKm * MAX_ROUTE_DISTANCE_GAP_RATIO);
  return Math.abs(actualDistanceKm - targetKm) <= allowedGapKm;
}
