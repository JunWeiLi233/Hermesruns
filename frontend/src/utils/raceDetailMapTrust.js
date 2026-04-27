function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function midpoint(a, b) {
  return (a + b) / 2;
}

function minimumRoutePointCount(distanceKm) {
  if (!Number.isFinite(distanceKm)) return 4;
  if (distanceKm >= 40) return 6;
  if (distanceKm >= 20) return 5;
  return 4;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const earthRadiusKm = 6371.0088;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function deriveBoundsFromRoutePoints(routePoints) {
  if (!Array.isArray(routePoints) || routePoints.length === 0) return null;
  let north = Number.NEGATIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let west = Number.POSITIVE_INFINITY;
  for (const point of routePoints) {
    const lat = toFiniteNumber(point?.lat);
    const lng = toFiniteNumber(point?.lng);
    if (lat == null || lng == null) continue;
    north = Math.max(north, lat);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    west = Math.min(west, lng);
  }
  if (!Number.isFinite(north) || !Number.isFinite(south) || !Number.isFinite(east) || !Number.isFinite(west)) {
    return null;
  }
  return { north, south, east, west };
}

export function padBounds(bounds, ratio = 0.18) {
  if (!bounds) return null;
  const latSpan = Math.max(0.01, bounds.north - bounds.south);
  const lngSpan = Math.max(0.01, bounds.east - bounds.west);
  const latPad = Math.max(0.006, latSpan * ratio);
  const lngPad = Math.max(0.006, lngSpan * ratio);
  return {
    north: bounds.north + latPad,
    south: bounds.south - latPad,
    east: bounds.east + lngPad,
    west: bounds.west - lngPad,
  };
}

function approximateBoundsAreaKm2(bounds) {
  if (!bounds) return 0;
  const midLat = midpoint(bounds.north, bounds.south);
  const latKm = Math.max(0.2, Math.abs(bounds.north - bounds.south) * 111);
  const lngKm = Math.max(0.2, Math.abs(bounds.east - bounds.west) * 111 * Math.cos(toRadians(midLat)));
  return latKm * lngKm;
}

function boundsCenter(bounds) {
  if (!bounds) return null;
  return {
    lat: midpoint(bounds.north, bounds.south),
    lng: midpoint(bounds.east, bounds.west),
  };
}

function boundsContainRouteWithMargin(outerBounds, innerBounds) {
  if (!outerBounds || !innerBounds) return false;
  const latMargin = Math.max(0.01, (outerBounds.north - outerBounds.south) * 0.06);
  const lngMargin = Math.max(0.01, (outerBounds.east - outerBounds.west) * 0.06);
  return innerBounds.south >= outerBounds.south - latMargin
    && innerBounds.north <= outerBounds.north + latMargin
    && innerBounds.west >= outerBounds.west - lngMargin
    && innerBounds.east <= outerBounds.east + lngMargin;
}

function largestSegmentRatio(routePoints) {
  if (!Array.isArray(routePoints) || routePoints.length < 2) return 1;
  let largestSegmentKm = 0;
  let totalKm = 0;
  for (let i = 1; i < routePoints.length; i += 1) {
    const previous = routePoints[i - 1];
    const current = routePoints[i];
    const segmentKm = haversineKm(previous.lat, previous.lng, current.lat, current.lng);
    totalKm += segmentKm;
    largestSegmentKm = Math.max(largestSegmentKm, segmentKm);
  }
  if (totalKm <= 0) return 1;
  return largestSegmentKm / totalKm;
}

function polylineDistanceKm(routePoints) {
  if (!Array.isArray(routePoints) || routePoints.length < 2) return 0;
  let totalKm = 0;
  for (let i = 1; i < routePoints.length; i += 1) {
    totalKm += haversineKm(
      routePoints[i - 1].lat,
      routePoints[i - 1].lng,
      routePoints[i].lat,
      routePoints[i].lng,
    );
  }
  return totalKm;
}

export function deriveRaceMapTrust({
  imageUrl,
  overlayBounds,
  routePoints,
  confidence,
  distanceKm,
  mapCenter,
}) {
  const normalizedRoutePoints = Array.isArray(routePoints) ? routePoints.filter((point) => (
    Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng))
  )).map((point) => ({
    lat: Number(point.lat),
    lng: Number(point.lng),
    label: typeof point.label === 'string' ? point.label : '',
  })) : [];

  const routeBounds = deriveBoundsFromRoutePoints(normalizedRoutePoints);
  const trustedRoute = normalizedRoutePoints.length >= minimumRoutePointCount(distanceKm);
  const overlayAreaKm2 = approximateBoundsAreaKm2(overlayBounds);
  const routeAreaKm2 = approximateBoundsAreaKm2(routeBounds);
  const overlayAreaRatio = routeAreaKm2 > 0 ? overlayAreaKm2 / routeAreaKm2 : Number.POSITIVE_INFINITY;
  const routeCenter = boundsCenter(routeBounds);
  const overlayCenter = boundsCenter(overlayBounds);
  const centerDriftKm = routeCenter && overlayCenter
    ? haversineKm(routeCenter.lat, routeCenter.lng, overlayCenter.lat, overlayCenter.lng)
    : 0;
  const routeCenterDriftFromRaceKm = routeCenter && Array.isArray(mapCenter)
    ? haversineKm(routeCenter.lat, routeCenter.lng, mapCenter[0], mapCenter[1])
    : 0;
  const routeSegmentRatio = largestSegmentRatio(normalizedRoutePoints);
  const routeDistanceKm = polylineDistanceKm(normalizedRoutePoints);
  const minimumPlausibleRouteKm = Number.isFinite(Number(distanceKm))
    ? Math.max(3, Number(distanceKm) * 0.45)
    : 3;
  const confidenceValue = Number.isFinite(Number(confidence)) ? Number(confidence) : 0;
  const routeIsNearRaceCity = routeCenterDriftFromRaceKm === 0
    || routeCenterDriftFromRaceKm <= Math.max(35, Number(distanceKm || 0));
  const trustedRouteGeometry = trustedRoute
    && routeDistanceKm >= minimumPlausibleRouteKm
    && routeIsNearRaceCity
    && routeSegmentRatio <= 0.5;
  const overlayConfidenceFloor = confidenceValue > 0 ? Math.max(78, Number(distanceKm) >= 40 ? 82 : 76) : 82;
  const overlayLooksTrustworthy = Boolean(imageUrl)
    && Boolean(overlayBounds)
    && trustedRoute
    && routeDistanceKm >= minimumPlausibleRouteKm
    && confidenceValue >= overlayConfidenceFloor
    && boundsContainRouteWithMargin(overlayBounds, routeBounds)
    && overlayAreaRatio <= 14
    && centerDriftKm <= 18
    && routeSegmentRatio <= 0.5
    && (routeCenterDriftFromRaceKm === 0 || routeCenterDriftFromRaceKm <= Math.max(24, Number(distanceKm || 0) * 1.5));

  const cityLevelMatch = Boolean(imageUrl) && trustedRoute && routeIsNearRaceCity;

  const viewportBounds = trustedRoute
    ? (
      overlayLooksTrustworthy && overlayAreaRatio <= 5
        ? padBounds(overlayBounds, 0.04)
        : padBounds(routeBounds, 0.22)
    )
    : null;

  return {
    trustedRoute,
    trustedRouteGeometry,
    trustedOverlay: overlayLooksTrustworthy,
    cityLevelMatch,
    viewportBounds,
    routeBounds,
    routePoints: normalizedRoutePoints,
  };
}
