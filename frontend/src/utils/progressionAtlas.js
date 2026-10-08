export const PROGRESSION_TIMEFRAMES = ['day', 'week', 'month', 'year', 'total', '1m', '3m', '6m', '12m'];

function startOfNMonthsAgo(date, months) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setMonth(copy.getMonth() - months);
  return copy;
}

function resolveRunDistanceKm(run) {
  const km = Number(run?.distanceKm || 0);
  if (Number.isFinite(km) && km > 0) return km;
  const meters = Number(run?.distanceMeters || 0);
  return Number.isFinite(meters) && meters > 0 ? meters / 1000 : 0;
}

function resolveRunElevationMeters(run) {
  return Number(run?.elevationGainMeters ?? run?.totalElevationGainMeters ?? run?.totalElevationGain ?? 0);
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfIsoWeek(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfCurrentDay(date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function getRunStartedAt(run) {
  return new Date(run?.startTime || run?.startDate || NaN);
}

function formatProgressionWindowLabel(start, end, timeframe, lang) {
  const locale = lang === 'zh-CN' ? 'zh-CN' : 'en-US';
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) return '--';
  if (!(end instanceof Date) || Number.isNaN(end.getTime())) return '--';

  if (timeframe === 'day') {
    return start.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (timeframe === 'week') {
    const sameYear = start.getFullYear() === end.getFullYear();
    const startLabel = start.toLocaleDateString(locale, sameYear
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' });
    const endLabel = end.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startLabel} - ${endLabel}`;
  }

  if (timeframe === 'month') {
    return start.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }

  if (timeframe === 'year') {
    return start.toLocaleDateString(locale, { year: 'numeric' });
  }

  const startLabel = start.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  const endLabel = end.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  return `${startLabel} - ${endLabel}`;
}

function formatProgressionAxisLabel(date, timeframe, lang) {
  const locale = lang === 'zh-CN' ? 'zh-CN' : 'en-US';
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '--';

  if (timeframe === 'year' || timeframe === 'total' || timeframe === '12m' || timeframe === '6m') {
    return date.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  }

  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function buildLinearPath(points) {
  if (!Array.isArray(points) || points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function buildLinearAreaPath(points, baselineY) {
  if (!Array.isArray(points) || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${baselineY} L ${points[0].x} ${points[0].y} L ${points[0].x} ${baselineY} Z`;
  }

  return `${buildLinearPath(points)} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
}

function getDistanceAxisMax(distanceKm) {
  if (distanceKm <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(distanceKm));
  const factor = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((value) => value * magnitude >= distanceKm);
  return factor * magnitude;
}

export function getNearestProgressionPointIndex(points, xPercent) {
  if (!Array.isArray(points) || points.length === 0) return -1;

  return points.reduce((closestIndex, point, index) => {
    if (closestIndex < 0) return index;

    const currentDistance = Math.abs(Number(point?.x || 0) - xPercent);
    const closestDistance = Math.abs(Number(points[closestIndex]?.x || 0) - xPercent);
    return currentDistance < closestDistance ? index : closestIndex;
  }, -1);
}

export function buildProgressionAtlas(runs, timeframe, lang, now = new Date()) {
  const locale = lang === 'zh-CN' ? 'zh-CN' : 'en-US';
  const sortedAsc = [...runs]
    .filter((run) => !Number.isNaN(getRunStartedAt(run).getTime()))
    .sort((a, b) => getRunStartedAt(a) - getRunStartedAt(b));
  const rangeEnd = endOfCurrentDay(now);

  let rangeStart = startOfDay(now);

  if (timeframe === 'week') {
    rangeStart = startOfIsoWeek(now);
  } else if (timeframe === 'month') {
    rangeStart = startOfMonth(now);
  } else if (timeframe === 'year') {
    rangeStart = startOfYear(now);
  } else if (timeframe === '1m') {
    rangeStart = startOfNMonthsAgo(now, 1);
  } else if (timeframe === '3m') {
    rangeStart = startOfNMonthsAgo(now, 3);
  } else if (timeframe === '6m') {
    rangeStart = startOfNMonthsAgo(now, 6);
  } else if (timeframe === '12m') {
    rangeStart = startOfNMonthsAgo(now, 12);
  } else if (timeframe === 'total') {
    rangeStart = sortedAsc[0] ? startOfDay(getRunStartedAt(sortedAsc[0])) : startOfDay(now);
  }

  const filteredAsc = sortedAsc.filter((run) => {
    const startedAt = getRunStartedAt(run);
    return startedAt >= rangeStart && startedAt <= rangeEnd;
  });
  const filteredDesc = [...filteredAsc].reverse();

  const totalDistanceKm = filteredAsc.reduce((sum, run) => sum + resolveRunDistanceKm(run), 0);
  const totalMovingSeconds = filteredAsc.reduce((sum, run) => sum + Number(run?.movingTimeSeconds || 0), 0);
  const totalElevationMeters = filteredAsc.reduce(
    (sum, run) => sum + resolveRunElevationMeters(run),
    0,
  );
  const sessionCount = filteredAsc.length;
  const allDistanceKm = sortedAsc.reduce((sum, run) => sum + resolveRunDistanceKm(run), 0);
  const shareOfDistance = allDistanceKm > 0 ? Math.round((totalDistanceKm / allDistanceKm) * 100) : 0;
  const averagePaceSeconds = totalDistanceKm > 0 ? totalMovingSeconds / totalDistanceKm : null;

  const grouped = filteredAsc.reduce((map, run) => {
    const startedAt = getRunStartedAt(run);
    const bucketDate = startOfDay(startedAt);
    const key = bucketDate.toISOString().slice(0, 10);
    const existing = map.get(key) || {
      key,
      date: bucketDate,
      distanceKm: 0,
      sessions: 0,
    };
    existing.distanceKm += resolveRunDistanceKm(run);
    existing.sessions += 1;
    map.set(key, existing);
    return map;
  }, new Map());

  // Daily totals are joined linearly at day boundaries. Keeping zero-run
  // days avoids spreading a later run's growth across an inactive interval.
  const chartBaseLine = 210;
  const chartHeight = 200;
  const rangeSpanMs = Math.max(1, rangeEnd.getTime() - rangeStart.getTime());
  const timeToX = (date) => 400 * Math.min(1, Math.max(0, (date.getTime() - rangeStart.getTime()) / rangeSpanMs));
  const axisMaxKm = getDistanceAxisMax(totalDistanceKm);
  const distanceToY = (distanceKm) => chartBaseLine - (distanceKm / axisMaxKm) * chartHeight;
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const valueKm = axisMaxKm * (1 - index / 4);
    return { valueKm, y: distanceToY(valueKm) };
  });
  const xTicks = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(rangeStart.getTime() + rangeSpanMs * index / 4);
    return { x: timeToX(date), date, label: formatProgressionAxisLabel(date, timeframe, lang) };
  });
  const chartSeries = [];
  const chartPoints = [];
  let cumulativeDistance = 0;
  if (filteredAsc.length > 0) {
    chartSeries.push({ key: 'baseline', date: rangeStart, distanceKm: 0, sessions: 0, cumulativeDistance: 0, x: 0, y: chartBaseLine });
    for (const date = new Date(rangeStart); date <= rangeEnd; date.setDate(date.getDate() + 1)) {
      const key = date.toISOString().slice(0, 10);
      const entry = grouped.get(key);
      cumulativeDistance += entry?.distanceKm || 0;
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const point = {
        key,
        date: new Date(date),
        distanceKm: entry?.distanceKm || 0,
        sessions: entry?.sessions || 0,
        cumulativeDistance,
        x: timeToX(new Date(Math.min(nextDay.getTime(), rangeEnd.getTime()))),
        y: distanceToY(cumulativeDistance),
        label: formatProgressionAxisLabel(date, timeframe, lang),
      };
      chartSeries.push(point);
      if (entry) chartPoints.push(point);
    }
  }
  const chartLine = buildLinearPath(chartSeries);
  const chartArea = buildLinearAreaPath(chartSeries, chartBaseLine);

  const weeklyTotals = new Map();
  for (const entry of grouped.values()) {
    const weekKey = startOfIsoWeek(entry.date).getTime();
    weeklyTotals.set(weekKey, (weeklyTotals.get(weekKey) || 0) + entry.distanceKm);
  }
  const weeklyBars = [];
  for (const week = startOfIsoWeek(rangeStart); week <= rangeEnd; week.setDate(week.getDate() + 7)) {
    const nextWeek = new Date(week);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const start = new Date(Math.max(rangeStart.getTime(), week.getTime()));
    const end = new Date(Math.min(rangeEnd.getTime(), nextWeek.getTime() - 1));
    weeklyBars.push({
      key: week.getTime(), start, end,
      distanceKm: weeklyTotals.get(week.getTime()) || 0,
      x: timeToX(start), width: timeToX(new Date(Math.min(nextWeek.getTime(), rangeEnd.getTime()))) - timeToX(start),
      label: formatProgressionWindowLabel(start, end, 'week', lang),
    });
  }
  const maxWeeklyDistanceKm = Math.max(0, ...weeklyBars.map((bar) => bar.distanceKm));

  return {
    hasData: filteredAsc.length > 0,
    rangeLabel: formatProgressionWindowLabel(rangeStart, rangeEnd, timeframe, lang),
    totalDistanceKm,
    totalMovingSeconds,
    totalElevationMeters,
    sessionCount,
    shareOfDistance,
    averagePaceSeconds,
    chartPoints,
    chartSeries,
    chartLine,
    chartArea,
    yTicks,
    xTicks,
    weeklyBars,
    maxWeeklyDistanceKm,
    latestPoint: chartPoints[chartPoints.length - 1] || null,
    // Chart-edge labels mirror the true window boundaries, not the first/last
    // run's date — so the visible time-axis matches the cumulative line shape.
    startLabel: formatProgressionAxisLabel(rangeStart, timeframe, lang),
    endLabel: formatProgressionAxisLabel(rangeEnd, timeframe, lang),
    recentRuns: filteredDesc.slice(0, 4).map((run) => {
      const distanceKm = resolveRunDistanceKm(run);
      const movingTimeSeconds = Number(run?.movingTimeSeconds || 0);
      const paceSeconds = distanceKm > 0 && movingTimeSeconds > 0 ? movingTimeSeconds / distanceKm : null;
      return {
        ...run,
        distanceKm,
        movingTimeSeconds,
        paceSeconds,
        startedAtLabel: getRunStartedAt(run).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
        completionLabel: getRunStartedAt(run).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
      };
    }),
  };
}
