import { calendarDate, getAccountDate, getActivityDateKey } from './timeZone.js';

export function calculateStreaks(runs, timeZone, todayKey = getAccountDate(timeZone)) {
  const sortedDays = [...new Set(
    runs
      .map((run) => calendarDate(getActivityDateKey(run, timeZone)))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => date.getTime()),
  )].sort((a, b) => a - b);

  if (sortedDays.length === 0) return { current: 0, best: 0 };

  let bestStreak = 0;
  let runningStreak = 1;

  // Calculate all streaks
  for (let i = 1; i < sortedDays.length; i += 1) {
    const diffDays = Math.round((sortedDays[i] - sortedDays[i - 1]) / 86400000);
    if (diffDays === 1) {
      runningStreak += 1;
    } else {
      bestStreak = Math.max(bestStreak, runningStreak);
      runningStreak = 1;
    }
  }
  bestStreak = Math.max(bestStreak, runningStreak);

  // Current streak (only if most recent run was today or yesterday)
  const today = calendarDate(todayKey);
  const lastRunDate = new Date(sortedDays[sortedDays.length - 1]);
  const diffFromToday = Math.round((today.getTime() - lastRunDate.getTime()) / 86400000);

  let currentStreak = diffFromToday <= 1 ? 1 : 0;
  if (diffFromToday <= 1) {
    // Walk backward from the end to find current streak
    for (let i = sortedDays.length - 2; i >= 0; i -= 1) {
      const diffDays = Math.round((sortedDays[i + 1] - sortedDays[i]) / 86400000);
      if (diffDays === 1) currentStreak += 1;
      else break;
    }
  } else {
    currentStreak = 0;
  }

  return { current: currentStreak, best: bestStreak };
}

export function getDaysSinceLastRun(runs, timeZone, todayKey = getAccountDate(timeZone)) {
  if (!runs || runs.length === 0) return null;
  
  const sortedDays = runs
    .map((run) => calendarDate(getActivityDateKey(run, timeZone)))
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) => date.getTime())
    .sort((a, b) => b - a);

  if (sortedDays.length === 0) return null;

  const today = calendarDate(todayKey);
  const lastRunDate = new Date(sortedDays[0]);
  return Math.round((today.getTime() - lastRunDate.getTime()) / 86400000);
}
