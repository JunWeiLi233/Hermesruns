import { formatDistance, formatDuration, formatPaceSeconds } from './format';

/**
 * How the current stretch of the Progression card differs from the one before it, in words a runner reads under each figure:
 * "12.4 km more (+8%)", "27 min less", "0:12 /km faster", "same as before". `tone` says whether the change is for the better
 * (more distance, time, climb or sessions; a faster pace), for the worse, or none, and the words carry the same meaning, so
 * colour is never the only way to read it.
 *
 * @param deltas the `comparison.deltas` of an atlas built with `compare: true`
 * @returns one `{ text, tone }` for each of distance, time, elevation, sessions and pace; null for a figure there is no basis for
 *          (a pace or a climb that one of the stretches does not have)
 */
export function describeProgressionDeltas(deltas, { t, lang, unit }) {
  const signed = (value, flat, amount, more, less, moreIsBetter = true) => {
    if (!Number.isFinite(value)) return null;
    if (Math.abs(value) < flat) return { text: t('profile.dashboard_redesign.progression_delta_same'), tone: 'flat' };
    const text = t(value > 0 ? more : less, { value: amount(Math.abs(value)) });
    const better = moreIsBetter ? value > 0 : value < 0;
    return { text, tone: better ? 'better' : 'worse' };
  };
  const prefix = 'profile.dashboard_redesign.progression_delta_';

  const distance = signed(deltas.distanceKm, 0.05, (value) => formatDistance(value, 1, lang, unit), `${prefix}more`, `${prefix}less`);
  if (distance && distance.tone !== 'flat' && deltas.distancePercent != null && deltas.distancePercent !== 0) {
    distance.text = t(`${prefix}with_percent`, { change: distance.text, percent: `${deltas.distancePercent > 0 ? '+' : '-'}${Math.abs(deltas.distancePercent)}` });
  }

  return {
    distance,
    time: signed(deltas.movingSeconds, 60, (value) => formatDuration(value), `${prefix}more`, `${prefix}less`),
    elevation: signed(deltas.elevationMeters, 1, (value) => `${Math.round(value)} ${t('run_detail.unit_meter')}`, `${prefix}more`, `${prefix}less`),
    sessions: signed(deltas.sessions, 1, (value) => String(Math.round(value)), `${prefix}more`, `${prefix}less`),
    // A pace is seconds per kilometre, so a smaller number is the better one. Under a second a kilometre is the same pace.
    pace: deltas.paceSeconds == null
      ? null
      : signed(deltas.paceSeconds, 1, (value) => `${formatPaceSeconds(value)} ${t('run_detail.unit_pace')}`, `${prefix}slower`, `${prefix}faster`, false),
  };
}
