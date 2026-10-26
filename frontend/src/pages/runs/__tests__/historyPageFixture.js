import { activityCalendarSortTime, activitySortTime, getActivityDateKey, getAccountDate } from '../../../utils/timeZone';

/** A complete server response for small histories in existing page tests. */
export function historyPageFixture(runs, searchParams = new URLSearchParams(), timeZone) {
  if (!Array.isArray(runs) || runs.some(run => !run || typeof run !== 'object' || Array.isArray(run))) return runs;
  const facets = new Map();
  runs.forEach(run => {
    const key = getActivityDateKey(run, timeZone);
    if (!key) return;
    const year = Number(key.slice(0, 4));
    if (!facets.has(year)) facets.set(year, new Set());
    facets.get(year).add(Number(key.slice(5, 7)));
  });
  const items = runs.filter(run => {
    const key = getActivityDateKey(run, timeZone);
    return (!searchParams.has('year') || Number(key?.slice(0, 4)) === Number(searchParams.get('year')))
      && (!searchParams.has('month') || Number(key?.slice(5, 7)) === Number(searchParams.get('month')))
      && (!searchParams.has('day') || key === searchParams.get('day'))
      && (!searchParams.has('search') || (run.name || searchParams.get('defaultName') || 'Run').toLowerCase().includes(searchParams.get('search').toLowerCase()));
  });
  const sortTime = items.some(run => !run.activityInstant) ? activityCalendarSortTime : activitySortTime;
  const pace = run => Number(run.movingTimeSeconds || 0) / Math.max(0.1, Number(run.distanceKm || 0));
  items.sort((a, b) => searchParams.get('sort') === 'distance' ? b.distanceKm - a.distanceKm : searchParams.get('sort') === 'pace' ? pace(a) - pace(b) : sortTime(b) - sortTime(a));
  const months = new Map();
  items.forEach(run => {
    const month = getActivityDateKey(run, timeZone)?.slice(0, 7);
    if (!month) return;
    const summary = months.get(month) || { month, count: 0, distanceKm: 0, movingTimeSeconds: 0 };
    summary.count += 1;
    summary.distanceKm += Number(run.distanceKm || 0);
    summary.movingTimeSeconds += Number(run.movingTimeSeconds || 0);
    months.set(month, summary);
  });
  return {
    items, nextCursor: null, hasMore: false, totalCount: runs.length,
    summary: {
      count: items.length,
      distanceKm: items.reduce((sum, run) => sum + Number(run.distanceKm || 0), 0),
      movingTimeSeconds: items.reduce((sum, run) => sum + Number(run.movingTimeSeconds || 0), 0),
      activeDays: new Set(items.map(run => getActivityDateKey(run, timeZone))).size,
      longestRun: [...items].sort((a, b) => b.distanceKm - a.distanceKm)[0] || null,
      fastestRun: [...items].filter(run => run.distanceKm > 0 && run.movingTimeSeconds > 0).sort((a, b) => pace(a) - pace(b))[0] || null,
    },
    years: [...facets.keys()].sort((a, b) => b - a),
    monthsByYear: Object.fromEntries([...facets.entries()].map(([year, months]) => [year, [...months].sort((a, b) => a - b)])),
    monthSummaries: [...months.values()],
    weeklyDistance: [{ weekStart: getAccountDate(timeZone), distanceKm: 0 }],
  };
}
