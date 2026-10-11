const DAY_MS = 24 * 60 * 60 * 1000;

/** How long ago the basis of the training zones was worked out, as the Analysis page words it: today, 1 day ago, N days ago. */
export function formatTrainingZoneBasisUpdated(value, t, now = Date.now()) {
  const date = value instanceof Date ? value : new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return t('analysis.stitch_zone_basis_updated_recently');
  const days = Math.max(0, Math.floor((now - date.getTime()) / DAY_MS));
  if (days <= 0) return t('analysis.stitch_zone_basis_updated_today');
  if (days === 1) return t('analysis.stitch_zone_basis_updated_one_day');
  return t('analysis.stitch_zone_basis_updated_days', { count: days });
}
