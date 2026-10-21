import { formatDistance, formatPace } from './format';
import { getAccountDate } from './timeZone';

const QUALITY_TYPES = new Set(['TEMPO', 'THRESHOLD', 'INTERVALS']);
const REASON_CODES = new Set([
  'injury_protect', 'readiness_protect', 'scheduled_rest', 'readiness_limited',
  'comeback', 'onboarding', 'race_taper', 'race_day', 'high_load',
  'intensity_rebalance', 'build_consistency', 'readiness_data', 'load_data',
  'goal_specific', 'aerobic_progression', 'quality_window', 'recovery_after_hard',
  'history_required', 'versioned_plan',
  'manual_ease',
]);
// Plan reasons come from PersonalizedRunningPlanner.planReasonCodes, rather than a session.
const PLAN_CONTEXT_REASON_CODES = new Set([
  'injury_protect', 'readiness_protect', 'comeback', 'onboarding', 'race_taper',
  'race_day', 'high_load', 'intensity_rebalance', 'build_consistency',
  'readiness_data', 'load_data', 'goal_specific',
  'history_required', 'versioned_plan',
  'manual_ease',
]);
const SESSION_NEUTRAL_REASON_CODES = new Set([
  'injury_protect', 'readiness_protect', 'scheduled_rest', 'readiness_limited',
  'race_taper', 'race_day', 'high_load', 'intensity_rebalance',
  'readiness_data', 'recovery_after_hard',
]);

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

export function resolveCoachReadinessScore(payload) {
  const state = normalizeCoachEvidence(payload)?.state;
  const value = state?.currentReadinessScore ?? state?.readinessScore;
  return value != null && Number.isFinite(Number(value))
    ? Math.max(0, Math.min(100, Math.round(Number(value)))) : null;
}

export function resolveCoachReadinessLabel(payload, t) {
  const state = normalizeCoachEvidence(payload)?.state;
  const verdict = typeof state?.readinessVerdict === 'string' ? state.readinessVerdict.toLowerCase() : '';
  return resolveCoachReadinessScore(payload) != null && ['go', 'easy', 'recovery', 'rest'].includes(verdict)
    ? t(`today_run.readiness_verdict_${verdict}`) : t('today_run.shared_readiness_unavailable');
}

export function resolveCoachWeeklyTarget(payload, weekStart, accountWeekStart, datedTotal) {
  const budget = payload?.plan?.weeklyBudgets?.find(week => week.start === weekStart)?.budgetKm;
  if (Number.isFinite(budget)) return budget;
  const target = payload?.plan?.targetWeeklyKm;
  return weekStart === accountWeekStart && Number.isFinite(target) && target > 0 ? target : datedTotal;
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
  if (today?.reasonCode === 'history_required') return '—';
  // A rest day never has a run distance, even if a stale planned value
  // arrives in the payload — the grid must not show "43.8 km" next to rest.
  if (today?.workoutType === 'REST') return t('today_run.personalized_distance_rest');
  const distanceKm = today?.workoutType === 'CROSS_TRAIN' ? NaN : Number(today?.plannedDistanceKm);
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

function localizedPace(today, t, lang, unit) {
  if (today?.reasonCode === 'history_required' || today?.workoutType === 'CROSS_TRAIN') return '—';
  if (today?.workoutType === 'REST') return t('today_run.personalized_pace_rest');
  const min = Number(today?.targetPaceMinSecondsPerKm);
  const max = Number(today?.targetPaceMaxSecondsPerKm);
  const values = [min, max]
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => {
      const pace = formatPace(1, value * (unit === 'mile' ? 1.609344 : 1), lang);
      return unit === 'mile' ? pace.replace('/km', '/mi').replace('/公里', '/英里') : pace;
    });
  if (values.length === 2) return `${values[0]} - ${values[1]}`;
  if (values.length === 1) return values[0];
  return t('profile.today_run_pace_easy');
}

export function localizedReason(reasonCode, t, { planContext = false, sessionNeutral = false } = {}) {
  if (reasonCode === 'weekly_budget_exhausted') return t('recommendation_evidence.budget_exhausted_reason');
  if (reasonCode === 'run_completed') return t('recommendation_evidence.completed_reason');
  const safeCode = typeof reasonCode === 'string'
    ? reasonCode.toLowerCase()
    : null;
  const knownCodes = planContext ? PLAN_CONTEXT_REASON_CODES : REASON_CODES;
  if (!knownCodes.has(safeCode)) return t(planContext
    ? 'today_run.personalized_plan_reason_unavailable' : 'today_run.reason_unavailable');
  const prefix = planContext
    ? 'personalized_plan_reason'
    : sessionNeutral && SESSION_NEUTRAL_REASON_CODES.has(safeCode)
      ? 'personalized_session_reason' : 'personalized_reason';
  return t(`today_run.${prefix}_${safeCode}`);
}

export function resolvePersonalizedCoachRecommendation({
  coachPayload,
  t,
  lang,
  unit,
  todayKey,
}) {
  coachPayload = normalizeCoachEvidence(coachPayload);
  const today = coachPayload?.today;
  if (!today || typeof today.workoutType !== 'string') return null;
  const prescriptionDate = todayKey && coachPayload.plan?.timeZone ? getAccountDate(coachPayload.plan.timeZone) : todayKey;
  if (prescriptionDate && today.scheduledDate !== prescriptionDate) return null;

  const rawDistance = Number(today.plannedDistanceKm);
  const distanceKm = !['REST', 'CROSS_TRAIN'].includes(today.workoutType)
    && Number.isFinite(rawDistance) && rawDistance > 0 ? rawDistance : null;

  let purpose = localizedReason(today.reasonCode, t);
  let summaryReason = purpose;
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
    summaryReason = factors.length && state.readinessScore != null
      ? localizedReason('readiness_protect', t) : t('today_run.personalized_reason_readiness_limited');
  }
  const planReasons = Array.isArray(coachPayload?.plan?.reasonCodes)
    ? coachPayload.plan.reasonCodes.map((reasonCode) => localizedReason(reasonCode, t, { planContext: true }))
    : [];
  const pace = localizedPace(today, t, lang, unit);
  const steps = today.reasonCode === 'history_required' ? [] : today.workoutType === 'REST'
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
      type: today.reasonCode === 'history_required' ? t('today_run.shared_plan_waiting') : localizedWorkoutType(today.workoutType, t),
      title: today.reasonCode === 'history_required' ? t('today_run.shared_plan_waiting') : localizedTitle(today.workoutType, t),
      distance: localizedTarget(today, t, lang, unit),
      distanceKm,
      scheduledDate: today.scheduledDate,
      pace,
      normalPace: pace,
      purpose,
      summaryReason,
      source: today.reasonCode === 'history_required' ? 'unavailable'
        : today.reasonCode === 'VERSIONED_PLAN' ? 'published-plan' : 'personalized-planner',
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

/** Current and upcoming sessions are formatted from server prescriptions only. */
export function buildCoachRecommendationSessions({ coachPayload, schedule = [], t, lang, unit, todayKey }) {
  const current = coachPayload?.today?.scheduledDate === todayKey ? coachPayload.today : null;
  const future = (Array.isArray(schedule) ? schedule : [])
    .filter(workout => typeof workout?.scheduledDate === 'string' && workout.scheduledDate > todayKey)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const used = new Set();
  return [current, ...future].filter(Boolean).filter(workout => {
    if (used.has(workout.scheduledDate)) return false;
    used.add(workout.scheduledDate);
    return true;
  }).slice(0, 4).map(workout => {
    const view = resolvePersonalizedCoachRecommendation({
      coachPayload: { ...coachPayload, today: workout }, t, lang, unit,
    });
    if (!view) return null;
    return {
      slot: workout.scheduledDate === todayKey ? t('analysisInsight.session_today') : workout.scheduledDate,
      title: view.recommendation.title, target: view.recommendation.distance,
      why: localizedReason(workout.reasonCode, t, { sessionNeutral: workout.scheduledDate !== todayKey }),
      tone: workout.workoutType === 'REST' ? 'muted' : QUALITY_TYPES.has(workout.workoutType) ? 'warn' : 'good',
      detail: view.recommendation.pace,
    };
  }).filter(Boolean);
}
