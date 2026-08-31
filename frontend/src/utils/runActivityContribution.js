const DAYS_PER_WEEK = 7;
const DEFAULT_WEEKS = 53;

function startOfLocalDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMondayWeek(value) {
  const date = startOfLocalDay(value);
  if (!date) return null;
  date.setDate(date.getDate() - ((date.getDay() + 6) % DAYS_PER_WEEK));
  return date;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function activityDate(activity) {
  return startOfLocalDay(activity?.startTime || activity?.startDate || activity?.createdAt);
}

function activityDistanceKm(activity) {
  const distanceKm = Number(activity?.distanceKm);
  if (Number.isFinite(distanceKm) && distanceKm > 0) return distanceKm;

  const distanceMeters = Number(activity?.distanceMeters);
  return Number.isFinite(distanceMeters) && distanceMeters > 0 ? distanceMeters / 1000 : 0;
}

function contributionLevel(distanceKm, count) {
  if (count <= 0) return 0;

  const normalizedDistanceKm = Number(distanceKm);
  if (!Number.isFinite(normalizedDistanceKm) || normalizedDistanceKm <= 0) return 1;
  if (normalizedDistanceKm < 5) return 1;
  if (normalizedDistanceKm < 10) return 2;
  if (normalizedDistanceKm < 15) return 3;
  return 4;
}

export function buildRunActivityCalendar(
  runs,
  {
    now = new Date(),
    weeks = DEFAULT_WEEKS,
    resolveDate = activityDate,
    resolveDistanceKm = activityDistanceKm,
    resolveLevel = contributionLevel,
  } = {},
) {
  const today = startOfLocalDay(now) || startOfLocalDay(new Date());
  const weekCount = Math.max(1, Math.floor(Number(weeks) || DEFAULT_WEEKS));
  const currentWeekStart = startOfMondayWeek(today);
  const graphStart = new Date(currentWeekStart);
  graphStart.setDate(graphStart.getDate() - ((weekCount - 1) * DAYS_PER_WEEK));
  const graphEnd = new Date(currentWeekStart);
  graphEnd.setDate(graphEnd.getDate() + (DAYS_PER_WEEK - 1));
  const totalsByDay = new Map();

  for (const run of Array.isArray(runs) ? runs : []) {
    const date = startOfLocalDay(resolveDate(run));
    if (!date || date < graphStart || date > today || date > graphEnd) continue;
    const key = dateKey(date);
    const totals = totalsByDay.get(key) || { count: 0, distanceKm: 0 };
    totals.count += 1;
    totals.distanceKm += resolveDistanceKm(run);
    totalsByDay.set(key, totals);
  }

  const calendarWeeks = Array.from({ length: weekCount }, (_, weekIndex) => {
    const weekStart = new Date(graphStart);
    weekStart.setDate(graphStart.getDate() + (weekIndex * DAYS_PER_WEEK));
    const days = Array.from({ length: DAYS_PER_WEEK }, (_, dayIndex) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + dayIndex);
      const key = dateKey(date);
      const isFuture = date > today;
      const totals = isFuture ? null : totalsByDay.get(key);
      const count = totals?.count || 0;
      return {
        key,
        date,
        count,
        distanceKm: totals?.distanceKm || 0,
        level: resolveLevel(totals?.distanceKm || 0, count),
        isFuture,
      };
    });

    const monthMarker = days.find((day) => day.date.getDate() === 1) || (weekIndex === 0 ? days[0] : null);
    return {
      key: days[0].key,
      days,
      monthLabel: monthMarker ? monthMarker.date : null,
    };
  });

  return {
    weeks: calendarWeeks,
    monthLabels: calendarWeeks.map((week) => week.monthLabel),
    totalRuns: [...totalsByDay.values()].reduce((total, totals) => total + totals.count, 0),
    today,
  };
}
