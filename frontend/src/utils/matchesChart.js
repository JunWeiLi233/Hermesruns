/**
 * The geometry of the same-route scatter: one dot per run by day (left to right) and pace (faster nearer the top), and
 * a least-squares trend line when there are enough runs. Pure, so the card only has to draw what it is given.
 */

const DAY_MS = 86_400_000;

/** A run's calendar day ("2026-10-03") as a number of days; NaN for anything else. */
export function dayNumber(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate ?? ''));
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS : Number.NaN;
}

/**
 * @param runs the runs of the route, each with `date` and `paceSecPerKm`; one without a usable pace or day is left out
 * @returns null when no run can be drawn, else the box, the dots, three pace ticks and the trend line (or null)
 */
export function buildMatchScatter(runs, { width = 640, height = 210, left = 48, right = 14, top = 14, bottom = 30 } = {}) {
  const usable = (Array.isArray(runs) ? runs : []).filter((run) => Number.isFinite(run?.paceSecPerKm)
    && run.paceSecPerKm > 0 && Number.isFinite(dayNumber(run.date)));
  if (usable.length === 0) return null;

  const days = usable.map((run) => dayNumber(run.date));
  const paces = usable.map((run) => run.paceSecPerKm);
  const firstDay = Math.min(...days);
  const lastDay = Math.max(...days);
  const fastest = Math.min(...paces);
  const slowest = Math.max(...paces);
  const pad = Math.max(5, (slowest - fastest) * 0.12);
  const paceTop = fastest - pad;
  const paceBottom = slowest + pad;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const xOf = (day) => (lastDay === firstDay ? left + plotWidth / 2 : left + ((day - firstDay) / (lastDay - firstDay)) * plotWidth);
  const yOf = (pace) => top + ((pace - paceTop) / (paceBottom - paceTop)) * plotHeight;

  const points = usable.map((run, index) => ({ run, x: xOf(days[index]), y: yOf(paces[index]) }));
  const ticks = [fastest, (fastest + slowest) / 2, slowest].map((pace) => ({ pace, y: yOf(pace) }));
  // A single pace would repeat one tick three times.
  const distinctTicks = fastest === slowest ? [ticks[0]] : ticks;

  let trend = null;
  if (usable.length >= 3 && lastDay > firstDay) {
    const meanDay = days.reduce((sum, day) => sum + day, 0) / days.length;
    const meanPace = paces.reduce((sum, pace) => sum + pace, 0) / paces.length;
    let covariance = 0;
    let variance = 0;
    for (let i = 0; i < days.length; i += 1) {
      covariance += (days[i] - meanDay) * (paces[i] - meanPace);
      variance += (days[i] - meanDay) ** 2;
    }
    if (variance > 0) {
      const slope = covariance / variance;
      const at = (day) => Math.min(paceBottom, Math.max(paceTop, meanPace + slope * (day - meanDay)));
      trend = { x1: xOf(firstDay), y1: yOf(at(firstDay)), x2: xOf(lastDay), y2: yOf(at(lastDay)), slopeSecPerKmPerDay: slope };
    }
  }

  return {
    width, height, left, right, top, bottom,
    points,
    ticks: distinctTicks,
    trend,
    firstDate: usable[days.indexOf(firstDay)].date,
    lastDate: usable[days.lastIndexOf(lastDay)].date,
  };
}

/** "+0:05" for a pace slower than the one it is compared with, "−0:12" for a faster one, "0:00" for the same second. */
export function formatPaceDelta(seconds) {
  if (!Number.isFinite(seconds)) return '–';
  const rounded = Math.round(Math.abs(seconds));
  const text = `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
  if (rounded === 0) return text;
  return `${seconds > 0 ? '+' : '−'}${text}`;
}
