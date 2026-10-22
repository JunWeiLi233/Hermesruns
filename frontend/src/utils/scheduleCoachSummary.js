import { describeAcwrState } from './todayRunAcwrInsight.js';
import { addCalendarDays } from './timeZone.js';

export function selectNextSessionForWeek(schedule, todayKey, weekStart) {
  const end = addCalendarDays(weekStart, 6);
  return (Array.isArray(schedule) ? schedule : []).filter(entry => entry?.scheduledDate >= todayKey
    && entry.scheduledDate >= weekStart && entry.scheduledDate <= end
    && String(entry.workoutType || '').toUpperCase() !== 'REST')
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0] || null;
}

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

function plannerLoadEvidence(coachPayload) {
  if (!coachPayload?.today?.workoutType) return null;
  const reasonCodes = Array.isArray(coachPayload.plan?.reasonCodes)
    ? coachPayload.plan.reasonCodes.filter(code => typeof code === 'string' && code.length > 0)
    : [];
  // A separate effort EWMA must not supply opposing advice for a personalized
  // session. Keep the planner's own rationale, including weekly context on REST.
  const planReason = reasonCodes.find(code => code === 'high_load')
    || reasonCodes.find(code => code !== 'load_data') || reasonCodes[0];
  return {
    loadState: 'planner',
    plannerReasonCode: planReason ?? coachPayload.today.reasonCode,
    plannerReasonIsPlan: planReason != null,
  };
}

export function buildWeeklyCoachSummaryModel({
  vdotTrend,
  acwr,
  targetBlock,
  nextSessionTitle,
  coachPayload,
}) {
  const loadEvidence = plannerLoadEvidence(coachPayload)
    || { loadState: normalizeLoadState(acwr) };
  const focus = {
    weekIndex: targetBlock?.weekIndex ?? null,
    raceDistanceKm: targetBlock?.raceDistanceKm ?? null,
    longRunKm: targetBlock?.currentLongRunKm ?? null,
    nextSessionTitle: nextSessionTitle || '',
  };

  if (targetBlock?.hasTargetRace) {
    return {
      trendState: normalizeTrendState(vdotTrend),
      ...loadEvidence,
      focusMode: 'target-race',
      focus,
    };
  }

  if (targetBlock?.hasActiveBlock) {
    return {
      trendState: normalizeTrendState(vdotTrend),
      ...loadEvidence,
      focusMode: 'training-block',
      focus,
    };
  }

  return {
    trendState: normalizeTrendState(vdotTrend),
    ...loadEvidence,
    focusMode: 'next-session',
    focus,
  };
}
