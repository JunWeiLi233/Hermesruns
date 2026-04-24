export const PROGRESSION_TIMEFRAMES = ['day', 'week', 'month', 'year', 'total'];

function resolveRunDistanceKm(run) {
  const km = Number(run?.distanceKm || 0);
  if (km > 0) return km;
  const meters = Number(run?.distanceMeters || 0);
  return meters > 0 ? meters / 1000 : 0;
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
  return new Date(run?.startTime || run?.startDate || 0);
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

  if (timeframe === 'year' || timeframe === 'total') {
    return date.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  }

  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function buildSmoothPath(points) {
  if (!Array.isArray(points) || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] || points[index];
    const current = points[index];
    const next = points[index + 1];
    const nextNext = points[index + 2] || next;

    const controlPointOneX = current.x + ((next.x - previous.x) / 6);
    const controlPointOneY = current.y + ((next.y - previous.y) / 6);
    const controlPointTwoX = next.x - ((nextNext.x - current.x) / 6);
    const controlPointTwoY = next.y - ((nextNext.y - current.y) / 6);

    path += ` C ${controlPointOneX} ${controlPointOneY}, ${controlPointTwoX} ${controlPointTwoY}, ${next.x} ${next.y}`;
  }

  return path;
}

function buildSmoothAreaPath(points, baselineY) {
  if (!Array.isArray(points) || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${baselineY} L ${points[0].x} ${points[0].y} L ${points[0].x} ${baselineY} Z`;
  }

  return `${buildSmoothPath(points)} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
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

  let cumulativeDistance = 0;
  const chartBaseLine = 86;
  const chartLeft = 6;
  const chartRight = 94;
  const chartHeight = 56;
  const groupedSeries = Array.from(grouped.values())
    .sort((a, b) => a.date - b.date)
    .map((entry, index, source) => {
      cumulativeDistance += entry.distanceKm;
      const ratio = source.length === 1 ? 1 : index / (source.length - 1);
      return {
        ...entry,
        cumulativeDistance,
        x: chartLeft + ((chartRight - chartLeft) * ratio),
      };
    });

  const maxCumulativeDistance = Math.max(1, ...groupedSeries.map((entry) => entry.cumulativeDistance));
  const chartPoints = groupedSeries.map((entry) => ({
    ...entry,
    y: chartBaseLine - ((entry.cumulativeDistance / maxCumulativeDistance) * chartHeight),
    label: formatProgressionAxisLabel(entry.date, timeframe, lang),
  }));
  const chartLine = buildSmoothPath(chartPoints);
  const chartArea = buildSmoothAreaPath(chartPoints, chartBaseLine);

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
    chartLine,
    chartArea,
    latestPoint: chartPoints[chartPoints.length - 1] || null,
    startLabel: chartPoints[0]?.label || formatProgressionAxisLabel(rangeStart, timeframe, lang),
    endLabel: chartPoints[chartPoints.length - 1]?.label || formatProgressionAxisLabel(rangeEnd, timeframe, lang),
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
