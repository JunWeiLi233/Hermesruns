const FALLBACK_ROUTE_PATH = 'M 8 72 C 24 18, 36 82, 52 42 S 78 22, 92 68';

function isCoordinatePair(point) {
  return Array.isArray(point)
    && Number.isFinite(Number(point[0]))
    && Number.isFinite(Number(point[1]));
}

export function buildCourseMapStaticGeometry(points) {
  const routePoints = Array.isArray(points)
    ? points.filter(isCoordinatePair).map(([lat, lng]) => [Number(lat), Number(lng)])
    : [];

  if (routePoints.length < 2) {
    return {
      path: FALLBACK_ROUTE_PATH,
      start: { x: 8, y: 72 },
      end: { x: 92, y: 68 },
    };
  }

  const lats = routePoints.map(([lat]) => lat);
  const lngs = routePoints.map(([, lng]) => lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(maxLat - minLat, 0.000001);
  const lngRange = Math.max(maxLng - minLng, 0.000001);
  const project = ([lat, lng]) => ({
    x: 8 + ((lng - minLng) / lngRange) * 84,
    y: 86 - ((lat - minLat) / latRange) * 72,
  });
  const sampledPoints = routePoints.filter(
    (_, index) => index % Math.max(1, Math.ceil(routePoints.length / 18)) === 0
      || index === routePoints.length - 1,
  );

  return {
    path: sampledPoints
      .map((point, index) => {
        const projected = project(point);
        return `${index === 0 ? 'M' : 'L'} ${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`;
      })
      .join(' '),
    start: project(routePoints[0]),
    end: project(routePoints[routePoints.length - 1]),
  };
}
