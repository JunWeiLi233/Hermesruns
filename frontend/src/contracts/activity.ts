export interface ActivitySummary extends Record<string, unknown> {
  id?: number | string;
  distanceKm?: number | null;
  distanceMeters?: number | null;
  movingTimeSeconds?: number | null;
  durationSeconds?: number | null;
  startTime?: string | null;
  startDate?: string | null;
  vo2max?: number | null;
  adjustedVo2max?: number | null;
}
