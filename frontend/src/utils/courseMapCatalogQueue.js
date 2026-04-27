import { standardCityRoadMarathonCatalog } from '../data/worldRaceCatalog.js';

const FULL_MARATHON_DISTANCE_KM = 42.195;

export function getCourseMapQueueRaceId(item) {
  return item?.raceId || item?.id || null;
}

function hasNonEmptyRoutePoints(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const points = Array.isArray(snapshot.routePoints) ? snapshot.routePoints : [];
  return points.length > 0;
}

export function hasCourseMapBackendRecord(raceId, items = []) {
  return items.some((item) => {
    if (getCourseMapQueueRaceId(item) !== raceId) return false;
    return Boolean(item?.live || item?.pendingPreview || item?.currentLivePreview || item?.updatedAt);
  });
}

export function hasCourseMapRoutePoints(raceId, items = []) {
  return items.some((item) => {
    if (getCourseMapQueueRaceId(item) !== raceId) return false;
    return hasNonEmptyRoutePoints(item?.live)
      || hasNonEmptyRoutePoints(item?.pendingPreview)
      || hasNonEmptyRoutePoints(item?.currentLivePreview);
  });
}

export function buildCourseMapAdminDetailFallback(item) {
  return {
    raceId: getCourseMapQueueRaceId(item),
    raceName: item?.raceName || item?.name || '',
    city: item?.city || '',
    country: item?.country || '',
    live: null,
    pendingPreview: null,
    currentLivePreview: null,
  };
}

export function buildCourseMapWorkspaceSource({ queueItem = null, detail = null } = {}) {
  return {
    ...(queueItem || {}),
    ...(detail || {}),
    raceId: getCourseMapQueueRaceId(detail) || getCourseMapQueueRaceId(queueItem),
    raceName: detail?.raceName || detail?.name || queueItem?.raceName || queueItem?.name || '',
    city: detail?.city || queueItem?.city || '',
    country: detail?.country || queueItem?.country || '',
    officialWebsite: queueItem?.officialWebsite || detail?.officialWebsite || '',
    lat: queueItem?.lat ?? detail?.lat ?? null,
    lng: queueItem?.lng ?? detail?.lng ?? null,
    distanceKm: queueItem?.distanceKm ?? detail?.distanceKm ?? null,
  };
}

export function getCourseMapCatalogMarathons(catalog = standardCityRoadMarathonCatalog) {
  return catalog
    .filter((race) => Math.abs(Number(race?.distanceKm || 0) - FULL_MARATHON_DISTANCE_KM) < 0.5)
    .map((race) => ({
      raceId: race.id,
      id: race.id,
      raceName: race.name,
      name: race.name,
      location: race.location,
      city: race.city,
      country: race.country,
      lat: race.lat,
      lng: race.lng,
      distanceKm: race.distanceKm,
      officialWebsite: race.officialWebsite || '',
    }));
}

export function mergeCourseMapQueueItems({
  catalogItems = getCourseMapCatalogMarathons(),
  backendItems = [],
} = {}) {
  const catalogIds = new Set(catalogItems.map((item) => item.raceId));
  const backendById = new Map();
  const backendOnlyItems = [];

  for (const item of backendItems) {
    const raceId = getCourseMapQueueRaceId(item);
    if (!raceId) {
      backendOnlyItems.push(item);
      continue;
    }
    if (!backendById.has(raceId)) {
      backendById.set(raceId, item);
      if (!catalogIds.has(raceId)) {
        backendOnlyItems.push(item);
      }
    }
  }

  const mergedCatalogItems = catalogItems.map((item) => {
    const backendItem = backendById.get(item.raceId);
    if (!backendItem) return item;
    return {
      ...item,
      ...backendItem,
      raceId: item.raceId,
    };
  });

  return [...mergedCatalogItems, ...backendOnlyItems];
}
