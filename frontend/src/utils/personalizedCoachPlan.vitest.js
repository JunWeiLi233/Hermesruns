import { describe, expect, it } from 'vitest';
import { localizedReason, normalizeCoachEvidence, resolvePersonalizedCoachRecommendation } from './personalizedCoachPlan.js';
import { generateMorningBriefing } from './coachVoice.js';

const t = (key, values = {}) => `${key}${Object.keys(values).length ? `:${JSON.stringify(values)}` : ''}`;

describe('resolvePersonalizedCoachRecommendation', () => {
  it.each([
    'injury_protect', 'readiness_protect', 'scheduled_rest', 'readiness_limited',
    'race_taper', 'race_day', 'high_load', 'intensity_rebalance',
    'readiness_data', 'recovery_after_hard',
  ])('uses session-neutral %s copy without changing today copy', reasonCode => {
    expect(localizedReason(reasonCode, t, { sessionNeutral: true }))
      .toBe(`today_run.personalized_session_reason_${reasonCode}`);
    expect(localizedReason(reasonCode, t)).toBe(`today_run.personalized_reason_${reasonCode}`);
  });

  it.each([
    ['REST', 'scheduled_rest'],
    ['EASY', 'build_consistency'],
  ])('keeps the %s session reason distinct from weekly plan context', (workoutType, reasonCode) => {
    const reasonCodes = ['build_consistency', 'load_data', 'goal_specific'];
    const result = resolvePersonalizedCoachRecommendation({
      coachPayload: {
        today: { workoutType, reasonCode, intent: workoutType === 'REST' ? 'rest' : 'easy' },
        plan: { reasonCodes, targetWeeklyKm: 23.6, sessionsPerWeek: 3 },
      },
      t,
      lang: 'en',
      unit: 'km',
    });

    expect(result.recommendation.workoutType).toBe(workoutType);
    expect(result.recommendation.purpose).toBe(`today_run.personalized_reason_${reasonCode}`);
    expect(result.recommendation.summaryReason).toBe(result.recommendation.purpose);
    expect(result.reasons).toEqual([
      `today_run.personalized_reason_${reasonCode}`,
      ...reasonCodes.map(code => `today_run.personalized_plan_reason_${code}`),
    ]);
    expect(result.plan).toMatchObject({ reasonCodes, targetWeeklyKm: 23.6, sessionsPerWeek: 3 });
    if (workoutType === 'REST') {
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].isRest).toBe(true);
      expect(result.recommendation.distance).toBe('today_run.personalized_distance_rest');
    }
  });

  it.each([
    'injury_protect', 'readiness_protect', 'comeback', 'onboarding', 'race_taper',
    'race_day', 'high_load', 'intensity_rebalance', 'readiness_data',
  ])('keeps backend plan code %s separate from a scheduled rest reason', reasonCode => {
    const result = resolvePersonalizedCoachRecommendation({
      coachPayload: {
        today: { workoutType: 'REST', intent: 'rest', reasonCode: 'scheduled_rest' },
        plan: { reasonCodes: [reasonCode] },
      }, t, lang: 'en', unit: 'km',
    });
    expect(result.recommendation.workoutType).toBe('REST');
    expect(result.recommendation.purpose).toBe('today_run.personalized_reason_scheduled_rest');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].isRest).toBe(true);
    expect(result.reasons).toEqual([
      'today_run.personalized_reason_scheduled_rest',
      `today_run.personalized_plan_reason_${reasonCode}`,
    ]);
  });

  it.each(['future_plan_reason', 'aerobic_progression', undefined])('keeps unavailable plan context honest for %s', reasonCode => {
    const result = resolvePersonalizedCoachRecommendation({
      coachPayload: {
        today: { workoutType: 'REST', reasonCode: 'scheduled_rest' },
        plan: { reasonCodes: [reasonCode] },
      }, t, lang: 'en', unit: 'km',
    });
    expect(result.reasons).toEqual([
      'today_run.personalized_reason_scheduled_rest',
      'today_run.personalized_plan_reason_unavailable',
    ]);
    expect(result.plan.reasonCodes).toEqual([reasonCode]);
  });

  it.each([true, false])('preserves primary readiness behavior with plan protection and supported evidence=%s', supported => {
    const coachPayload = {
      today: { workoutType: 'REST', intent: 'rest', reasonCode: 'readiness_protect' },
      state: { readinessScore: 48, readinessStress: 35, readinessSleep: 10,
        readinessAvailability: supported ? { stress: true } : {} },
    };
    const baseline = resolvePersonalizedCoachRecommendation({ coachPayload, t, lang: 'en', unit: 'km' });
    const result = resolvePersonalizedCoachRecommendation({
      coachPayload: { ...coachPayload, plan: { reasonCodes: ['readiness_protect'] } },
      t, lang: 'en', unit: 'km',
    });
    expect(result.recommendation).toEqual(baseline.recommendation);
    expect(result.steps).toEqual(baseline.steps);
    expect(result.recommendation.summaryReason).toBe(supported
      ? 'today_run.personalized_reason_readiness_protect'
      : 'today_run.personalized_reason_readiness_limited');
    if (supported) {
      expect(result.recommendation.purpose).toContain('readiness_signal_stress');
      expect(result.recommendation.purpose).not.toContain('readiness_signal_sleep');
    }
    expect(result.reasons).toEqual([
      baseline.recommendation.purpose,
      'today_run.personalized_plan_reason_readiness_protect',
    ]);
  });

  it('removes unsupported cached scores and the fabricated stamina fallback', () => {
    const { state } = normalizeCoachEvidence({ state: {
      lastSleepScore: 35, lastStressScore: 95, readinessSleep: 35, readinessHrv: 45,
      readinessRhr: 60, readinessStress: 5, readinessScore: 45,
      stamina: { scorePercent: 87 },
      readinessAvailability: { trainingLoad: true }, readinessLoad: 78,
    } });
    expect([state.lastSleepScore, state.lastStressScore, state.readinessSleep,
      state.readinessHrv, state.readinessRhr, state.readinessStress, state.stamina]).toEqual(Array(7).fill(null));
    expect(state.readinessLoad).toBe(78);
  });

  it('explains only the current evidenced limiting signals', () => {
    const result = resolvePersonalizedCoachRecommendation({ coachPayload: {
      today: { workoutType: 'REST', reasonCode: 'readiness_protect' },
      state: { readinessScore: 45, readinessSleep: 35, readinessStress: 5,
        readinessHrv: 45, readinessAvailability: { stress: true } },
    }, t, lang: 'en', unit: 'km' });
    expect(result.recommendation.purpose).toContain('readiness_signal_stress');
    expect(result.recommendation.purpose).not.toContain('readiness_signal_sleep');
    expect(result.recommendation.purpose).not.toContain('readiness_signal_hrv');
  });

  it.each(['en', 'zh-CN'])('keeps a rest-day briefing consistent without invented wellness claims in %s', lang => {
    const message = generateMorningBriefing({ recommendation: { workoutType: 'REST', intent: 'rest',
      type: 'Rest', purpose: 'The recorded reason.' }, metrics: { bestVdot: 50, acwr: 0.42, recoveryHours: 0 }, lang });
    expect(message).toContain('The recorded reason.');
    expect(message).not.toMatch(/healthy zone|fully recovered|ready to push|健康区间|完全恢复|跑得开心|30.40/);
    expect(message).toMatch(/No run is scheduled|今天不安排跑步/);
  });
  it('uses the backend session as the source of truth for type, target, pace, and reason', () => {
    const result = resolvePersonalizedCoachRecommendation({
      coachPayload: {
        today: {
          workoutType: 'THRESHOLD',
          plannedDistanceKm: 10,
          targetPaceMinSecondsPerKm: 270,
          targetPaceMaxSecondsPerKm: 290,
          reasonCode: 'goal_specific',
          intent: 'quality',
          phase: 'build',
        },
        plan: { confidence: 88, targetWeeklyKm: 42, sessionsPerWeek: 5 },
      },
      t,
      lang: 'en',
      unit: 'km',
      weatherPenaltySecPerKm: 10,
    });

    expect(result.recommendation.type).toBe('profile.today_run_type_quality');
    expect(result.recommendation.distance).toContain('10');
    expect(result.steps[1].value).toContain(result.recommendation.pace);
    expect(result.steps[2].value).toBe('today_run.plan_base_3');
    expect(result.recommendation.pace).toContain('4:30');
    expect(result.recommendation.pace).toContain('4:50');
    expect(result.recommendation.purpose).toBe('today_run.personalized_reason_goal_specific');
    expect(result.plan).toMatchObject({ phase: 'build', confidence: 88, targetWeeklyKm: 42, sessionsPerWeek: 5 });
  });

  it('represents backend rest days without inventing a running distance', () => {
    const result = resolvePersonalizedCoachRecommendation({
      coachPayload: {
        today: { workoutType: 'REST', reasonCode: 'readiness_protect', intent: 'rest', phase: 'protect' },
        plan: { confidence: 62 },
      },
      t,
      lang: 'zh-CN',
      unit: 'km',
    });

    expect(result.recommendation.type).toBe('today_run.personalized_type_rest');
    expect(result.recommendation.distance).toBe('today_run.personalized_distance_rest');
    expect(result.recommendation.purpose).toBe('today_run.personalized_reason_readiness_limited');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].isRest).toBe(true);
  });

  it('never surfaces a planned distance on rest days, even with a stale payload value', () => {
    const result = resolvePersonalizedCoachRecommendation({
      coachPayload: {
        today: {
          workoutType: 'REST',
          plannedDistanceKm: 43.8,
          plannedDurationMinutes: 45,
          reasonCode: 'readiness_protect',
          intent: 'rest',
          phase: 'protect',
        },
        plan: { confidence: 62 },
      },
      t,
      lang: 'zh-CN',
      unit: 'km',
    });

    expect(result.recommendation.distance).toBe('today_run.personalized_distance_rest');
    expect(result.recommendation.distance).not.toContain('43.8');
  });

  it('returns null when no structured backend session exists', () => {
    expect(resolvePersonalizedCoachRecommendation({ coachPayload: null, t, lang: 'en', unit: 'km' })).toBeNull();
  });
});
