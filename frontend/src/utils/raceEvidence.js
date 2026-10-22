/**
 * The runner's races set against their VO2max number (the VDOT): for each run they flagged as a race, the VO2max the time
 * alone gives and the VO2max the app showed the day before it, worked out in the same way from the runs they had by then.
 * The difference says whether the number was too low or too high for them. Pure: it takes the run list the Analysis page
 * loads and reads the rule from vdot.js, so what it compares against is the number the runner saw, not a second rule.
 * See docs/README-ANALYSIS.md, "Your races against the number".
 */
import { VDOT_LOOKBACK_MS, VDOT_MIN_KM_LOOSE, estimateCurrentVdot, estimateVo2maxFromRun } from './vdot';

/** The run type the runner sets on a run's page (RunTypes.RACE on the server). */
export const RACE_TYPE = 'RACE';
/** How far back the estimate before a race looks (days): the window of the number itself. */
export const BEFORE_WINDOW_DAYS = VDOT_LOOKBACK_MS / (24 * 60 * 60 * 1000);
/** The shortest race that gets a VO2max from its time (km): the shortest run the estimate takes at all. */
export const SHORTEST_RACE_KM = VDOT_MIN_KM_LOOSE;

const round1 = (value) => Math.round(value * 10) / 10;

/** The moment a run began, as the browser reads it; null when it has none that can be read. */
function startOf(run) {
  const time = new Date(run?.startTime || run?.startDate || 0).getTime();
  return Number.isFinite(time) && time > 0 ? time : null;
}

/**
 * @param {Array} runs the runner's runs as /api/activities/analysis lists them (with `runType`)
 * @returns `rows`, newest race first, each with `vdot` (the VO2max the time gives, one decimal), `before` (the VO2max
 *   the number stood at before it, one decimal, null when no run of the 90 days before it gave an estimate) and `gap`
 *   (`vdot` minus `before` as the two are printed: positive when the race was better than the number said, null when
 *   either is missing); `count` of races; `comparedCount` of those with a gap; `meanGap` of the printed gaps (null with
 *   none); `above`, `below` and `level` counting them by the sign of the gap.
 */
export function buildRaceEvidence(runs) {
  const dated = (Array.isArray(runs) ? runs : [])
    .filter((run) => run && typeof run === 'object')
    .map((run) => ({ run, time: startOf(run) }))
    .filter((item) => item.time != null);

  const rows = dated
    .filter(({ run }) => run.runType === RACE_TYPE && Number(run.distanceKm) > 0 && Number(run.movingTimeSeconds) > 0)
    .map(({ run, time }) => {
      const distanceKm = Number(run.distanceKm);
      const timeSeconds = Number(run.movingTimeSeconds);
      const tooShort = distanceKm < SHORTEST_RACE_KM;

      // The time alone: the race equation, with no heart rate in it, however the runner's own estimates are made.
      const fromTime = tooShort ? null : estimateVo2maxFromRun({ distanceKm, movingTimeSeconds: timeSeconds }, { hrMax: 0, medianPaceSecPerKm: null });
      const vdot = fromTime ? round1(fromTime.vo2max) : null;

      // The number as it stood: the rule applied to the runs that had been run by then, the race itself not among them.
      const earlier = tooShort ? [] : dated.filter((item) => item.time < time).map((item) => item.run);
      const standing = earlier.length > 0 ? estimateCurrentVdot(earlier, time).representativeVdot : 0;
      const before = standing > 0 ? standing : null;

      return {
        key: run.id != null ? `race-${run.id}` : `race-${time}`,
        id: run.id ?? null,
        name: typeof run.name === 'string' ? run.name : '',
        date: new Date(time),
        distanceKm,
        timeSeconds,
        tooShort,
        vdot,
        before,
        gap: vdot != null && before != null ? round1(vdot - before) : null,
      };
    })
    .sort((a, b) => b.date - a.date || Number(b.id ?? 0) - Number(a.id ?? 0));

  const compared = rows.filter((row) => row.gap != null);
  return {
    rows,
    count: rows.length,
    comparedCount: compared.length,
    meanGap: compared.length > 0 ? round1(compared.reduce((sum, row) => sum + row.gap, 0) / compared.length) : null,
    above: compared.filter((row) => row.gap > 0).length,
    below: compared.filter((row) => row.gap < 0).length,
    level: compared.filter((row) => row.gap === 0).length,
    windowDays: BEFORE_WINDOW_DAYS,
  };
}
