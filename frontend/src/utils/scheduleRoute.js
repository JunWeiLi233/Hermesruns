const EARTH_RADIUS_METERS = 6371000;
const CLUSTER_RADIUS_METERS = 900;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getRunActivityId(run) {
  const raw = Number(run?.id ?? run?.activityId ?? run?.runId);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

function buildPreview(points) {
  if (!Array.isArray(points) || points.length < 2) return null;

  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;

  points.forEach((point) => {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLng = Math.min(minLng, point.longitude);
    maxLng = Math.max(maxLng, point.longitude);
  });

  const padding = 10;
  const width = 100;
  const height = 100;
  const latSpan = Math.max(0.00012, maxLat - minLat);
  const lngSpan = Math.max(0.00012, maxLng - minLng);
  const innerWidth = width - (padding * 2);
  const innerHeight = height - (padding * 2);
  const stride = Math.max(1, Math.floor(points.length / 40));
  const sampled = points.filter((_, index) => index % stride === 0 || index === points.length - 1);
  const normalized = sampled.map((point) => {
    const x = padding + (((point.longitude - minLng) / lngSpan) * innerWidth);
    const y = padding + (innerHeight - (((point.latitude - minLat) / latSpan) * innerHeight));
    return [x, y];
  });

  return {
    path: normalized.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' '),
    start: normalized[0],
    finish: normalized[normalized.length - 1],
  };
}

function deriveZoneKey(centroid, bounds) {
  if (!centroid || !bounds) return 'core';

  const latSpan = Math.max(0.0001, bounds.maxLatitude - bounds.minLatitude);
  const lngSpan = Math.max(0.0001, bounds.maxLongitude - bounds.minLongitude);
  const vertical = (centroid.latitude - bounds.minLatitude) / latSpan;
  const horizontal = (centroid.longitude - bounds.minLongitude) / lngSpan;

  const northSouth = vertical >= 0.66 ? 'north' : vertical <= 0.34 ? 'south' : 'mid';
  const eastWest = horizontal >= 0.66 ? 'east' : horizontal <= 0.34 ? 'west' : 'mid';

  if (northSouth === 'mid' && eastWest === 'mid') return 'core';
  if (northSouth === 'mid') return eastWest;
  if (eastWest === 'mid') return northSouth;
  return `${northSouth}-${eastWest}`;
}

export function buildScheduleRouteModel(heatmap, runs = []) {
  const bounds = heatmap?.bounds;
  const points = Array.isArray(heatmap?.points)
    ? heatmap.points.filter((point) => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude))
    : [];

  if (points.length === 0) return null;

  const recentRank = new Map();
  runs.forEach((run, index) => {
    const activityId = getRunActivityId(run);
    if (activityId != null && !recentRank.has(activityId)) {
      recentRank.set(activityId, index);
    }
  });

  const clusters = [];
  points.forEach((point) => {
    let bestCluster = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    clusters.forEach((cluster) => {
      const distance = haversineMeters(
        point.latitude,
        point.longitude,
        cluster.centroid.latitude,
        cluster.centroid.longitude,
      );
      if (distance < CLUSTER_RADIUS_METERS && distance < bestDistance) {
        bestCluster = cluster;
        bestDistance = distance;
      }
    });

    if (!bestCluster) {
      bestCluster = {
        points: [],
        activityIds: new Set(),
        sumLat: 0,
        sumLng: 0,
        minLat: point.latitude,
        maxLat: point.latitude,
        minLng: point.longitude,
        maxLng: point.longitude,
        avgSpeedAccumulator: 0,
        centroid: { latitude: point.latitude, longitude: point.longitude },
      };
      clusters.push(bestCluster);
    }

    bestCluster.points.push(point);
    bestCluster.activityIds.add(point.activityId);
    bestCluster.sumLat += point.latitude;
    bestCluster.sumLng += point.longitude;
    bestCluster.minLat = Math.min(bestCluster.minLat, point.latitude);
    bestCluster.maxLat = Math.max(bestCluster.maxLat, point.latitude);
    bestCluster.minLng = Math.min(bestCluster.minLng, point.longitude);
    bestCluster.maxLng = Math.max(bestCluster.maxLng, point.longitude);
    bestCluster.avgSpeedAccumulator += Number.isFinite(point.speedRatio) ? point.speedRatio : 0.5;
    bestCluster.centroid = {
      latitude: bestCluster.sumLat / bestCluster.points.length,
      longitude: bestCluster.sumLng / bestCluster.points.length,
    };
  });

  const rankedClusters = clusters
    .map((cluster) => {
      const activityIds = [...cluster.activityIds];
      const pointsByActivity = new Map();
      cluster.points.forEach((point) => {
        const key = point.activityId;
        const list = pointsByActivity.get(key) || [];
        list.push(point);
        pointsByActivity.set(key, list);
      });
      const recentActivityRank = activityIds.reduce((best, activityId) => {
        const rank = recentRank.get(activityId);
        return rank == null ? best : Math.min(best, rank);
      }, Number.POSITIVE_INFINITY);
      const representativeActivityId = activityIds
        .sort((left, right) => {
          const pointDelta = (pointsByActivity.get(right)?.length || 0) - (pointsByActivity.get(left)?.length || 0);
          if (pointDelta !== 0) return pointDelta;
          return (recentRank.get(left) ?? Number.POSITIVE_INFINITY) - (recentRank.get(right) ?? Number.POSITIVE_INFINITY);
        })[0];
      const footprintMeters = haversineMeters(
        cluster.minLat,
        cluster.minLng,
        cluster.maxLat,
        cluster.maxLng,
      );

      return {
        centroid: cluster.centroid,
        points: cluster.points,
        activityCount: activityIds.length,
        pointCount: cluster.points.length,
        recentActivityRank,
        source: activityIds.length > 1 ? 'most-used' : 'most-recent',
        zoneKey: deriveZoneKey(cluster.centroid, bounds),
        footprintKm: footprintMeters > 0 ? Math.max(0.2, footprintMeters / 1000) : 0.2,
        avgSpeedRatio: clamp(cluster.avgSpeedAccumulator / Math.max(1, cluster.points.length), 0, 1),
        preview: buildPreview(pointsByActivity.get(representativeActivityId) || cluster.points),
      };
    })
    .sort((left, right) => {
      if (right.activityCount !== left.activityCount) return right.activityCount - left.activityCount;
      if (left.recentActivityRank !== right.recentActivityRank) return left.recentActivityRank - right.recentActivityRank;
      if (right.pointCount !== left.pointCount) return right.pointCount - left.pointCount;
      return left.footprintKm - right.footprintKm;
    });

  return rankedClusters[0] || null;
}
