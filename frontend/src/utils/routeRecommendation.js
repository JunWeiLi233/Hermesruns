const ROUTE_COORDINATE_SCALE = 10_000_000;
// Match the street-graph planner's measured-distance tolerance, including short runs.
const MAX_ROUTE_DISTANCE_GAP_RATIO = 0.15;
const EARTH_RADIUS_METERS = 6_371_000;
const ROUTE_ANCHOR_RADIUS_METERS = 1_000;
const RUNNING_WORKOUT_TYPES = new Set([
  'BASE', 'RECOVERY', 'EASY', 'EASY_RUN', 'TEMPO', 'THRESHOLD', 'INTERVALS',
  'LONG_RUN', 'RUN', 'RUN_WALK', 'LONG', 'QUALITY', 'RACE', 'EVENT',
]);

function finiteNumber(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function resolveDailyRouteDistanceKm({ workout, todayKey, hasRunningHistory, explicitPlan = false } = {}) {
  if (hasRunningHistory !== true && explicitPlan !== true) return null;
  if (!isCalendarDate(todayKey) || workout?.scheduledDate !== todayKey || workout?.authored === true) return null;
  const workoutType = String(workout?.workoutType || '').trim().toUpperCase();
  if (!RUNNING_WORKOUT_TYPES.has(workoutType)) return null;
  const distanceKm = finiteNumber(workout?.plannedDistanceKm);
  return distanceKm !== null && distanceKm > 0 ? distanceKm : null;
}

export function normalizeRouteWaypoint(point) {
  const lat = finiteNumber(Array.isArray(point) ? point[0] : point?.lat ?? point?.latitude);
  const lng = finiteNumber(Array.isArray(point) ? point[1] : point?.lng ?? point?.lon ?? point?.longitude);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

export function normalizeRouteAnchor(data) {
  const point = normalizeRouteWaypoint({
    lat: data?.startLat ?? data?.lat ?? data?.latitude,
    lng: data?.startLng ?? data?.lng ?? data?.lon ?? data?.longitude,
  });
  if (!point) return null;
  return {
    ...point,
    source: data?.source ?? data?.anchorSource ?? null,
    activityCount: finiteNumber(data?.activityCount) ?? 0,
    pointCount: finiteNumber(data?.pointCount) ?? 0,
  };
}

export function isRouteNearAnchor(route, anchor) {
  if (anchor == null) return true;
  const origin = normalizeRouteAnchor(anchor);
  if (!origin) return false;
  const radians = degrees => degrees * Math.PI / 180;
  return (Array.isArray(route?.waypoints) ? route.waypoints : []).some(rawPoint => {
    const point = normalizeRouteWaypoint(rawPoint);
    if (!point) return false;
    const latitudeGap = radians(point.lat - origin.lat);
    const longitudeGap = radians(point.lng - origin.lng);
    const haversine = Math.sin(latitudeGap / 2) ** 2
      + Math.cos(radians(origin.lat)) * Math.cos(radians(point.lat)) * Math.sin(longitudeGap / 2) ** 2;
    const distanceMeters = 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
    return distanceMeters <= ROUTE_ANCHOR_RADIUS_METERS;
  });
}

export function extractRouteWaypoints(route) {
  const rawPoints = Array.isArray(route?.waypoints) ? route.waypoints : [];
  const points = rawPoints.map(normalizeRouteWaypoint);
  return points.length >= 4 && points.every(Boolean) ? points : null;
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
  const actualDistanceKm = finiteNumber(route?.actualDistanceKm);
  const rawTarget = targetDistanceKm !== undefined ? targetDistanceKm : route?.targetDistanceKm;
  const targetKm = rawTarget !== undefined ? finiteNumber(rawTarget) : actualDistanceKm;
  const boundTargetKm = finiteNumber(route?.targetDistanceKm);
  if (!waypoints || actualDistanceKm === null || actualDistanceKm <= 0
    || targetKm === null || targetKm <= 0 || hasRepeatedRouteSegment(waypoints)) {
    return false;
  }
  if (options.requireStreetGraph !== false && route?.streetGraphBacked !== true) {
    return false;
  }
  if (boundTargetKm === null || Math.abs(boundTargetKm - targetKm) > 0.000001) return false;
  const allowedGapKm = targetKm * MAX_ROUTE_DISTANCE_GAP_RATIO;
  return Math.abs(actualDistanceKm - targetKm) <= allowedGapKm;
}
