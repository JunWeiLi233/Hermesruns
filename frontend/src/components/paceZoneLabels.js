import { formatPaceSeconds } from '../utils/format';

/** The words for a pace zone, shared by the run page and Settings. `t` is the translator from useI18n. */

export const PACE_ZONE_NAME_KEYS = {
  recovery: 'run_detail.pace_zone_recovery',
  easy: 'run_detail.pace_zone_easy',
  marathon: 'run_detail.pace_zone_marathon',
  threshold: 'run_detail.pace_zone_threshold',
  interval: 'run_detail.pace_zone_interval',
  repetition: 'run_detail.pace_zone_repetition',
};

/** "slower than 6:10 /km", "5:20–4:48 /km" or "faster than 3:50 /km": the slow edge of a band comes first, as the paces are read. */
export function paceZoneRangeLabel(band, t) {
  const unit = t('run_detail.unit_pace');
  if (band.slowest == null) return `${t('run_detail.pace_zone_slower', { pace: formatPaceSeconds(band.fastest) })} ${unit}`;
  if (band.fastest == null) return `${t('run_detail.pace_zone_faster', { pace: formatPaceSeconds(band.slowest) })} ${unit}`;
  return `${t('run_detail.pace_zone_between', { fast: formatPaceSeconds(band.fastest), slow: formatPaceSeconds(band.slowest) })} ${unit}`;
}
