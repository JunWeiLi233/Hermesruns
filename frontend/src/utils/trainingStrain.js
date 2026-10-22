/**
 * Monotony and training strain of a week of daily loads (Foster 1998; see docs/README-ANALYSIS.md, "Monotony and training
 * strain"). Pure: the Load balance page hands in the daily loads it already has and prints what comes back, so the same
 * seven numbers feed the Monotony card and the Strain card and cannot disagree.
 */

/** The days in a week. */
export const STRAIN_DAYS = 7;

/**
 * A spread this small, against the mean, is zero. Seven loads that are really the same number can still differ in the last
 * bits after adding and dividing, and a speck of spread would otherwise turn "no variety" into a monotony of ten million.
 */
const FLAT_SPREAD = 1e-9;

/**
 * One week of seven daily loads, oldest first.
 *
 * @returns null when it is not seven finite numbers; otherwise
 *   `load`      the sum of the seven days
 *   `mean`      the average day (`load` / 7)
 *   `spread`    the standard deviation of the seven days, the population one (divided by 7, not 6)
 *   `monotony`  `mean` / `spread`; null when the week had no load at all, Infinity when every day was the same
 *   `strain`    `load` x `monotony`, with the same two special cases
 */
export function weekStrain(loads) {
  if (!Array.isArray(loads) || loads.length !== STRAIN_DAYS || !loads.every((value) => Number.isFinite(value))) return null;
  const load = loads.reduce((total, value) => total + value, 0);
  const mean = load / STRAIN_DAYS;
  const spread = Math.sqrt(loads.reduce((total, value) => total + (value - mean) ** 2, 0) / STRAIN_DAYS);
  if (!(mean > 0)) return { load, mean, spread, monotony: null, strain: null };
  if (spread <= mean * FLAT_SPREAD) return { load, mean, spread, monotony: Infinity, strain: Infinity };
  const monotony = mean / spread;
  return { load, mean, spread, monotony, strain: load * monotony };
}

/**
 * The last week and the week before it, from the daily loads of a runner's whole history, oldest first, ending today
 * (a rolling week, not a calendar one: the card is read on any day).
 *
 * @returns `week` (see {@link weekStrain}), null with fewer than 7 days; `previous`, the 7 days before those, null with
 *   fewer than 14 days; `change`, the strain's change on the week before as a whole percent, null unless both strains are
 *   numbers above zero (a rest week or a flat one has nothing to compare with)
 */
export function trainingStrain(dailyLoads) {
  const loads = Array.isArray(dailyLoads) ? dailyLoads : [];
  const week = weekStrain(loads.slice(-STRAIN_DAYS));
  const previous = loads.length >= 2 * STRAIN_DAYS ? weekStrain(loads.slice(-2 * STRAIN_DAYS, -STRAIN_DAYS)) : null;
  const comparable = (value) => Number.isFinite(value) && value > 0;
  const change = week && previous && comparable(week.strain) && comparable(previous.strain)
    ? Math.round((week.strain / previous.strain - 1) * 100)
    : null;
  return { week, previous, change };
}
