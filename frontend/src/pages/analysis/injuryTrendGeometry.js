import { buildRunInsightRows } from '../../utils/analysisInsights.js';
import { addCalendarDays, calendarDate, getAccountDate, getActivityDateKey } from '../../utils/timeZone.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function calendarDayNumber(key) {
  const date = calendarDate(key);
  const coordinate = date.getTime();
  return Number.isFinite(coordinate) && date.toISOString().slice(0, 10) === key ? coordinate / 86400000 : null;
}

/** Adapt dates for this timeline only. The existing effort/load calculation is unchanged. */
export function buildInjuryTimelineRows(runs, bestVdot, unit, lang, timeZone, now = new Date()) {
  // The activity endpoint applies one account calendar to the whole response.
  // A different tab can change it while this tab still has a cached profile.
  // Use that same applied calendar for both the window and every activity date.
  const appliedTimeZone = runs.find(run => run.accountTimeZone)?.accountTimeZone || timeZone || 'UTC';
  const endDate = getAccountDate(appliedTimeZone, now);
  const startDate = addCalendarDays(endDate, -41);
  const calendarRuns = runs.flatMap(run => {
    const dateKey = getActivityDateKey(run, appliedTimeZone);
    if (calendarDayNumber(dateKey) == null || dateKey < startDate || dateKey > endDate) return [];
    // This is a rendering coordinate consumed by the legacy row builder, NOT an activity instant.
    // Never write it back to a run or use it to infer the instant of legacy Strava wall time.
    return [{ ...run, startTime: `${dateKey}T00:00:00Z` }];
  });
  const formatter = new Intl.DateTimeFormat(lang === 'zh-CN' ? 'zh-CN' : 'en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
  return buildRunInsightRows(calendarRuns, bestVdot, unit, lang, calendarRuns.length).map(row => ({
    ...row, dateLabel: formatter.format(calendarDate(row.trainingDate)),
  }));
}

/** Calendar-day spacing, not elapsed hours or session index. No missing-day values are added. */
export function buildTrendGeometry(rows, sampleLimit = 4) {
  const samples = rows.slice(0, sampleLimit).reverse()
    .map((sample, index) => ({ sample, index, day: calendarDayNumber(sample.trainingDate) }))
    .filter(entry => entry.day != null)
    .sort((a, b) => a.day - b.day);
  if (!samples.length) return { areaPath: '', primaryPath: '', comparisonPath: '', points: [], labels: [], ticks: [] };

  const left = 18;
  const right = 982;
  const top = 22;
  const baseline = 192;
  const chartHeight = baseline - top;
  const firstDay = samples[0].day;
  const daySpan = samples.at(-1).day - firstDay;
  const maxLoad = Math.max(100, ...samples.map(({ sample }) => Number(sample.loadScore || 0)));
  const cadenceValues = samples.map(({ sample }) => Number(sample.cadence)).filter(value => Number.isFinite(value) && value > 0);
  const cadenceMax = cadenceValues.length ? Math.max(...cadenceValues) : 190;
  const cadenceMin = cadenceValues.length ? Math.min(...cadenceValues) : 170;
  const cadenceRange = Math.max(1, cadenceMax - cadenceMin);

  const points = samples.map(({ sample, index, day }) => {
    const loadRatio = clamp(Number(sample.loadScore || 0) / maxLoad, 0.1, 1);
    const cadence = Number(sample.cadence);
    return {
      id: sample.id,
      sampleNumber: index + 1,
      key: sample.id != null ? `activity-${sample.id}` : `sample-${sample.trainingDate}-${index}`,
      dateKey: sample.trainingDate,
      x: daySpan ? left + ((day - firstDay) / daySpan) * (right - left) : (left + right) / 2,
      y: top + (1 - loadRatio) * chartHeight,
      comparisonY: Number.isFinite(cadence) && cadence > 0 ? top + (1 - clamp((cadence - cadenceMin) / cadenceRange, 0, 1)) * chartHeight : null,
      label: sample.dateLabel,
      title: sample.title,
      loadScore: sample.loadScore,
      paceLabel: sample.paceLabel,
      cadence: Number.isFinite(cadence) && cadence > 0 ? sample.cadence : null,
    };
  });
  const primaryPath = points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
  let comparisonStarted = false;
  const comparisonPath = points.map(point => {
    if (point.comparisonY == null) { comparisonStarted = false; return ''; }
    const command = comparisonStarted ? 'L' : 'M';
    comparisonStarted = true;
    return `${command}${point.x},${point.comparisonY}`;
  }).filter(Boolean).join(' ');
  const areaPath = `${primaryPath} L${points.at(-1).x},${baseline} L${points[0].x},${baseline} Z`;
  const ticks = points.filter((point, index) => !index || point.dateKey !== points[index - 1].dateKey)
    .map(({ dateKey, x, label }) => ({ dateKey, x, label }));
  return { areaPath, primaryPath, comparisonPath, points, labels: ticks.map(tick => tick.label), ticks };
}

/** Same-day points use vertical proximity; exact overlaps keep the user's current selection. */
export function nearestTrendPoint(points, x, y, preferredKey) {
  if (!Number.isFinite(x) || !points.length) return null;
  const minXDistance = Math.min(...points.map(point => Math.abs(point.x - x)));
  const candidates = points.filter(point => Math.abs(Math.abs(point.x - x) - minXDistance) < 1e-8);
  const minYDistance = Number.isFinite(y) ? Math.min(...candidates.map(point => Math.abs(point.y - y))) : 0;
  const nearest = Number.isFinite(y) ? candidates.filter(point => Math.abs(Math.abs(point.y - y) - minYDistance) < 1e-8) : candidates;
  return nearest.find(point => point.key === preferredKey) || nearest[0];
}
