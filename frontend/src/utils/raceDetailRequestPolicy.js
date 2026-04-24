export function shouldFetchRaceElevationProfile({
  isAuthenticated,
  raceName,
  courseMapRequestSettled,
  hasAlignedElevationSamples,
}) {
  if (!isAuthenticated) return false;
  if (!String(raceName || '').trim()) return false;
  if (!courseMapRequestSettled) return false;
  if (hasAlignedElevationSamples) return false;
  return true;
}
