import { formatDistance, formatPace } from './format';

const QUALITY_TYPES = new Set(['TEMPO', 'THRESHOLD', 'INTERVALS']);

export function normalizeCoachEvidence(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const state = { ...payload.state };
  const available = state.readinessAvailability || {};
  const fields = {
    sleep: ['readinessSleep', 'lastSleepScore'],
    hrv: ['readinessHrv', 'lastHrvMs', 'lastHrvStatus'],
    restingHeartRate: ['readinessRhr', 'lastNightRestingHr'],
    stress: ['readinessStress', 'lastStressScore'],
    trainingLoad: ['readinessLoad'],
  };
  for (const [metric, names] of Object.entries(fields)) {
    if (available[metric] !== true) names.forEach(name => { state[name] = null; });
  }
  state.sleepDataSupported = available.sleep === true;
  if (!Object.keys(fields).some(metric => available[metric] === true)) {
    state.readinessScore = null;
    state.currentReadinessScore = null;
    state.readinessVerdict = null;
    state.readinessDataSupported = false;
  }
  if (available.restingHeartRate !== true || state.lastBodyBatteryAtWake == null) {
    state.lastBodyBatteryAtWake = null;
    state.stamina = null;
  }
  return { ...payload, state };
}

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
  if (today?.workoutType === 'REST') return t('today_run.personalized_pace_rest');
  const min = Number(today?.targetPaceMinSecondsPerKm);
  const max = Number(today?.targetPaceMaxSecondsPerKm);
  const penalty = Number.isFinite(Number(weatherPenaltySecPerKm)) ? Number(weatherPenaltySecPerKm) : 0;
  const values = [min, max]
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => formatPace(1, value + penalty, lang));
  if (values.length === 2) return `${values[0]} - ${values[1]}`;
  if (values.length === 1) return values[0];
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
  coachPayload = normalizeCoachEvidence(coachPayload);
  const today = coachPayload?.today;
  if (!today || typeof today.workoutType !== 'string') return null;

  let purpose = localizedReason(today.reasonCode, t);
  if (today.reasonCode === 'readiness_protect') {
    const state = coachPayload.state;
    const factors = [['sleep', state.readinessSleep], ['hrv', state.readinessHrv],
      ['rhr', state.readinessRhr], ['stress', state.readinessStress], ['load', state.readinessLoad]]
      .filter(([, score]) => score != null && Number.isFinite(score) && score < 70)
      .map(([metric, score]) => t('today_run.personalized_readiness_factor', {
        metric: t(`today_run.readiness_signal_${metric}`), score,
      }));
    purpose = factors.length && state.readinessScore != null
      ? t('today_run.personalized_readiness_explanation', { score: state.readinessScore, factors: factors.join(' · ') })
      : t('today_run.personalized_reason_readiness_limited');
  }
  const planReasons = Array.isArray(coachPayload?.plan?.reasonCodes)
    ? coachPayload.plan.reasonCodes.map((reasonCode) => localizedReason(reasonCode, t))
    : [];
  const pace = localizedPace(today, t, lang, weatherPenaltySecPerKm);
  const steps = today.workoutType === 'REST'
    ? [{ label: t('today_run.plan_step_1'), value: t('today_run.personalized_plan_rest'), isRest: true }]
    : [
      { label: t('today_run.plan_step_1'), value: t('today_run.personalized_plan_warmup') },
      { label: t('today_run.plan_step_2'), value: t('today_run.personalized_plan_main', { pace }) },
      { label: t('today_run.plan_step_3'), value: t(today.stridesSuggested
        ? 'today_run.plan_easy_3' : 'today_run.plan_base_3') },
    ];

  return {
    steps,
    recommendation: {
      intent: today.intent || 'base',
      workoutType: today.workoutType,
      type: localizedWorkoutType(today.workoutType, t),
      title: localizedTitle(today.workoutType, t),
      distance: localizedTarget(today, t, lang, unit),
      pace,
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
