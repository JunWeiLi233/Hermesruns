/** The words for a heart-rate zone, shared by the run page and Settings. `t` is the translator from useI18n. */

/** "Recovery", "Easy", "Steady", "Hard" or "Maximum". */
export function zoneName(t, zoneNumber) {
  return t(`training_zones.zone_${zoneNumber}`);
}

/** "Zone 3". */
export function zoneNumberLabel(t, zoneNumber) {
  return t('training_zones.zone_number', { n: zoneNumber });
}

/**
 * The heart rates a zone covers, "under 114 bpm", "114–132 bpm" or "171 bpm and up". The server sends a zone's
 * last bpm, so "under" is that plus one: zone 1 ends at 113 and is under 114.
 */
export function zoneRangeLabel(t, zone) {
  const from = zone?.fromBpm;
  const to = zone?.toBpm;
  if (from == null && to != null) return t('training_zones.range_below', { bpm: to + 1 });
  if (to == null && from != null) return t('training_zones.range_above', { bpm: from });
  if (from == null) return '';
  return t('training_zones.range_between', { from, to });
}
