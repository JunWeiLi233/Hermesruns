/**
 * The geometry of the pace curve: the runner's fastest time over each standard distance as a dot, how long the effort
 * lasted across (on a log scale, because a minute and an hour are both of interest) and how fast down (the faster the
 * higher), with the line of the critical speed model through the dots it was fitted to. Pure, like the other charts'.
 */

export const KM_PER_MILE = 1.609344;

/** The windows the page offers: the value of `?days=` and the words key. `all` has no number. */
export const WINDOWS = Object.freeze([
  Object.freeze({ key: '90', days: 90 }),
  Object.freeze({ key: '180', days: 180 }),
  Object.freeze({ key: '365', days: 365 }),
  Object.freeze({ key: 'all', days: null }),
]);

export const DEFAULT_WINDOW = '180';

/** The window a `?days=` value names, or the default for anything the page does not offer. */
export function windowOf(value) {
  return WINDOWS.find((option) => option.key === value) ?? WINDOWS.find((option) => option.key === DEFAULT_WINDOW);
}

/** A pace in seconds a kilometre, in seconds a kilometre or a mile. */
export function paceForUnit(secondsPerKm, unit) {
  return unit === 'mile' ? secondsPerKm * KM_PER_MILE : secondsPerKm;
}

/** The pace the critical speed model gives for an effort of `seconds`, in seconds a kilometre. */
export function modelPace(seconds, criticalSpeedMps, dPrimeMeters) {
  return (1000 * seconds) / (dPrimeMeters + criticalSpeedMps * seconds);
}

const TIME_TICKS = [30, 60, 120, 180, 300, 600, 1200, 1800, 2400, 3600, 5400, 7200, 10800];
/** Two time labels are never closer than this, in the chart's own units, so a narrow chart has fewer of them. */
const MIN_TICK_GAP = 58;
const PACE_STEPS = [5, 10, 15, 20, 30, 60, 120];

function logSpaced(from, to, count) {
  const a = Math.log(from);
  const b = Math.log(to);
  return Array.from({ length: count }, (_, index) => Math.exp(a + ((b - a) * index) / (count - 1)));
}

/**
 * @param points the efforts as the server sends them: `key`, `seconds`, `paceSecondsPerKm`, `inModel`
 * @param model  the fit as the server sends it (`status`, `criticalSpeedMps`, `dPrimeMeters`); the line is drawn only when it
 *               has numbers
 * @returns null when there is nothing to draw, else the dots, the line (a solid stretch where it was fitted and a dashed one
 *          where it was not), the critical pace line and the ticks
 */
export function buildPaceCurve({ points, model, unit = 'km', width = 640, height = 320 } = {}) {
  const rows = (Array.isArray(points) ? points : []).filter((point) => point && point.seconds > 0 && point.paceSecondsPerKm > 0);
  if (rows.length === 0) return null;

  const padL = 52;
  const padR = 16;
  const padT = 16;
  const padB = 34;
  const plotW = width - padL - padR;
  const baseline = height - padB;

  const seconds = rows.map((point) => point.seconds);
  const tMin = Math.max(20, Math.min(...seconds) * 0.8);
  const tMax = Math.max(tMin * 2, Math.max(...seconds) * 1.2);
  const xOf = (value) => padL + ((Math.log(value) - Math.log(tMin)) / (Math.log(tMax) - Math.log(tMin))) * plotW;

  const hasLine = Boolean(model && Number.isFinite(model.criticalSpeedMps) && Number.isFinite(model.dPrimeMeters));
  const linePace = (value) => paceForUnit(modelPace(value, model.criticalSpeedMps, model.dPrimeMeters), unit);
  const dots = rows.map((point) => ({ point, pace: paceForUnit(point.paceSecondsPerKm, unit) }));
  const paces = dots.map((dot) => dot.pace);
  const critical = hasLine ? paceForUnit(1000 / model.criticalSpeedMps, unit) : null;
  const lineSamples = hasLine ? logSpaced(tMin, tMax, 48).map((value) => ({ seconds: value, pace: linePace(value) })) : [];
  const allPaces = [...paces, ...(critical == null ? [] : [critical]), ...lineSamples.map((sample) => sample.pace)];
  const fastest = Math.min(...allPaces);
  const slowest = Math.max(...allPaces);
  const span = Math.max(slowest - fastest, 20);
  const step = PACE_STEPS.find((candidate) => span / candidate <= 6) ?? 120;
  const yMin = Math.floor((fastest - span * 0.06) / step) * step;
  const yMax = Math.ceil((slowest + span * 0.06) / step) * step;
  const yOf = (pace) => padT + ((pace - yMin) / (yMax - yMin)) * (baseline - padT);

  const yTicks = [];
  for (let value = yMin; value <= yMax + 1e-9; value += step) yTicks.push({ pace: value, y: yOf(value) });
  const xTicks = [];
  for (const value of TIME_TICKS) {
    if (value < tMin || value > tMax) continue;
    const x = xOf(value);
    if (xTicks.length === 0 || x - xTicks[xTicks.length - 1].x >= MIN_TICK_GAP) xTicks.push({ seconds: value, x });
  }

  const dotsWithPlace = dots.map(({ point, pace }) => ({ point, x: xOf(point.seconds), y: yOf(pace), pace }));

  let curve = null;
  if (hasLine) {
    const used = rows.filter((point) => point.inModel).map((point) => point.seconds);
    const low = used.length > 0 ? Math.min(...used) : tMin;
    const high = used.length > 0 ? Math.max(...used) : tMax;
    const path = (samples) => samples.map((sample, index) => `${index === 0 ? 'M' : 'L'}${xOf(sample.seconds).toFixed(2)},${yOf(sample.pace).toFixed(2)}`).join(' ');
    const solid = logSpaced(low, high, 24).map((value) => ({ seconds: value, pace: linePace(value) }));
    curve = { dashed: path(lineSamples), solid: path(solid) };
  }

  return {
    width,
    height,
    padL,
    padR,
    padT,
    baseline,
    unit,
    dots: dotsWithPlace,
    xTicks,
    yTicks,
    curve,
    critical: critical == null ? null : { pace: critical, y: yOf(critical) },
  };
}
