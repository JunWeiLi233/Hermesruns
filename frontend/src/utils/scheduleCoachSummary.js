import { describeAcwrState } from './todayRunAcwrInsight.js';

function normalizeTrendState(vdotTrend) {
  if (!vdotTrend?.hasData) return 'unknown';
  if (vdotTrend.direction === 'improving') return 'improving';
  if (vdotTrend.direction === 'declining') return 'declining';
  return 'steady';
}

function normalizeLoadState(acwr) {
  const state = describeAcwrState(acwr);
  return state.zone === 'optimal' ? 'optimal' : state.zone;
}

export function buildWeeklyCoachSummaryModel({
  vdotTrend,
  acwr,
  targetBlock,
  nextSessionTitle,
}) {
  const focus = {
    weekIndex: targetBlock?.weekIndex ?? null,
    raceDistanceKm: targetBlock?.raceDistanceKm ?? null,
    longRunKm: targetBlock?.currentLongRunKm ?? null,
    nextSessionTitle: nextSessionTitle || '',
  };

  if (targetBlock?.hasTargetRace) {
    return {
      trendState: normalizeTrendState(vdotTrend),
      loadState: normalizeLoadState(acwr),
      focusMode: 'target-race',
      focus,
    };
  }

  if (targetBlock?.hasActiveBlock) {
    return {
      trendState: normalizeTrendState(vdotTrend),
      loadState: normalizeLoadState(acwr),
      focusMode: 'training-block',
      focus,
    };
  }

  return {
    trendState: normalizeTrendState(vdotTrend),
    loadState: normalizeLoadState(acwr),
    focusMode: 'next-session',
    focus,
  };
}
