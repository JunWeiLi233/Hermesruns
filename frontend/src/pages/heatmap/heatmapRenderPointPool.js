export function isValidGpsCoordinate(latitude, longitude) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function activityKey(point) {
  const activityId = Number(point?.activityId);
  return Number.isFinite(activityId) ? `activity:${activityId}` : 'activity:unknown';
}

function sampleBucket(bucket, quota) {
  if (quota >= bucket.length) return bucket.slice();
  if (quota <= 1) return [bucket[0]];

  return Array.from({ length: quota }, (_, index) => {
    const bucketIndex = Math.round((index * (bucket.length - 1)) / (quota - 1));
    return bucket[bucketIndex];
  });
}

export function buildHeatmapRenderPointPool(points, limit) {
  if (!Array.isArray(points) || points.length === 0) return [];

  const cappedLimit = Math.max(1, Number(limit) || 1);
  const validEntries = points.reduce((entries, point, index) => {
    if (isValidGpsCoordinate(point?.latitude, point?.longitude)) {
      entries.push({ point, index });
    }
    return entries;
  }, []);

  if (validEntries.length <= cappedLimit) {
    return validEntries.map(({ point }) => point);
  }

  const buckets = new Map();
  for (const entry of validEntries) {
    const key = activityKey(entry.point);
    const bucket = buckets.get(key) || [];
    bucket.push(entry);
    buckets.set(key, bucket);
  }

  const bucketEntries = [...buckets.values()];
  const budget = Math.min(cappedLimit, validEntries.length);
  const selectedEntries = [];

  if (bucketEntries.length >= budget) {
    for (let index = 0; index < budget; index += 1) {
      const bucketIndex = Math.floor((index * bucketEntries.length) / budget);
      selectedEntries.push(bucketEntries[bucketIndex][0]);
    }
  } else {
    const baseQuota = Math.floor(budget / bucketEntries.length);
    const remainder = budget - (baseQuota * bucketEntries.length);
    const largestBucketsFirst = bucketEntries
      .map((bucket, index) => ({ bucket, index }))
      .sort((left, right) => right.bucket.length - left.bucket.length || left.index - right.index);
    const extraQuota = new Set(largestBucketsFirst.slice(0, remainder).map(({ index }) => index));

    bucketEntries.forEach((bucket, index) => {
      const quota = Math.min(bucket.length, baseQuota + (extraQuota.has(index) ? 1 : 0));
      selectedEntries.push(...sampleBucket(bucket, quota));
    });
  }

  return selectedEntries
    .sort((left, right) => left.index - right.index)
    .map(({ point }) => point);
}
