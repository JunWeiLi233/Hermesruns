import { formatDistance, formatPace } from './format';

const QUALITY_TYPES = new Set(['TEMPO', 'THRESHOLD', 'INTERVALS']);

function localizedWorkoutType(workoutType, t) {
  if (workoutType === 'REST') return t('today_run.personalized_type_rest');
  if (workoutType === 'RECOVERY' || workoutType === 'CROSS_TRAIN') return t('profile.today_run_type_recovery');
  if (workoutType === 'EASY') return t('profile.today_run_type_easy');
  if (QUALITY_TYPES.has(workoutType)) return t('profile.today_run_type_quality');
  return t('profile.today_run_type_base');
}

function localizedTitle(workoutType, t) {
  if (workoutType === 'REST') return t('today_run.personalized_title_rest');
  if (workoutType === 'RECOVERY' || workoutType === 'CROSS_TRAIN') return t('profile.today_run_title_recovery');
  if (workoutType === 'EASY') return t('profile.today_run_title_base');
  if (workoutType === 'LONG_RUN') return t('today_run.personalized_title_long_run');
  if (QUALITY_TYPES.has(workoutType)) return t('profile.today_run_title_threshold');
  return t('profile.today_run_title_base');
}

function localizedTarget(today, t, lang, unit) {
  // A rest day never has a run distance, even if a stale planned value
  // arrives in the payload — the grid must not show "43.8 km" next to rest.
  if (today?.workoutType === 'REST') return t('today_run.personalized_distance_rest');
  const distanceKm = Number(today?.plannedDistanceKm);
  if (Number.isFinite(distanceKm) && distanceKm > 0) {
    return formatDistance(distanceKm, 1, lang, unit);
  }
  const durationMinutes = Number(today?.plannedDurationMinutes);
  if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
    return t('today_run.personalized_duration', { minutes: Math.round(durationMinutes) });
  }
  return t(today?.workoutType === 'REST'
    ? 'today_run.personalized_distance_rest'
    : 'today_run.personalized_distance_flexible');
}

function localizedPace(today, t, lang, weatherPenaltySecPerKm) {
  const min = Number(today?.targetPaceMinSecondsPerKm);
  const max = Number(today?.targetPaceMaxSecondsPerKm);
  const penalty = Number.isFinite(Number(weatherPenaltySecPerKm)) ? Number(weatherPenaltySecPerKm) : 0;
  const values = [min, max]
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => formatPace(1, value + penalty, lang));
  if (values.length === 2) return `${values[0]} - ${values[1]}`;
  if (values.length === 1) return values[0];
  if (today?.workoutType === 'REST') return t('today_run.personalized_pace_rest');
  return t('profile.today_run_pace_easy');
}

function localizedReason(reasonCode, t) {
  const safeCode = typeof reasonCode === 'string' && /^[a-z0-9_]+$/i.test(reasonCode)
    ? reasonCode.toLowerCase()
    : 'build_consistency';
  return t(`today_run.personalized_reason_${safeCode}`);
}

export function resolvePersonalizedCoachRecommendation({
  coachPayload,
  t,
  lang,
  unit,
  weatherPenaltySecPerKm = 0,
}) {
  const today = coachPayload?.today;
  if (!today || typeof today.workoutType !== 'string') return null;

  const purpose = localizedReason(today.reasonCode, t);
  const planReasons = Array.isArray(coachPayload?.plan?.reasonCodes)
    ? coachPayload.plan.reasonCodes.map((reasonCode) => localizedReason(reasonCode, t))
    : [];

  return {
    recommendation: {
      intent: today.intent || 'base',
      type: localizedWorkoutType(today.workoutType, t),
      title: localizedTitle(today.workoutType, t),
      distance: localizedTarget(today, t, lang, unit),
      pace: localizedPace(today, t, lang, weatherPenaltySecPerKm),
      normalPace: localizedPace(today, t, lang, 0),
      purpose,
      source: 'personalized-planner',
    },
    reasons: [...new Set([purpose, ...planReasons])],
    plan: {
      phase: today.phase || coachPayload?.plan?.phase || null,
      confidence: coachPayload?.plan?.confidence ?? null,
      targetWeeklyKm: coachPayload?.plan?.targetWeeklyKm ?? null,
      sessionsPerWeek: coachPayload?.plan?.sessionsPerWeek ?? null,
      preferredRunDays: coachPayload?.plan?.preferredRunDays || [],
      reasonCodes: coachPayload?.plan?.reasonCodes || [],
    },
  };
}
