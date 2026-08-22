import { describe, expect, it } from 'vitest';
import { resolvePersonalizedCoachRecommendation } from './personalizedCoachPlan.js';

const t = (key, values = {}) => `${key}${Object.keys(values).length ? `:${JSON.stringify(values)}` : ''}`;

describe('resolvePersonalizedCoachRecommendation', () => {
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
    expect(result.recommendation.pace).toContain('4:40');
    expect(result.recommendation.pace).toContain('5:00');
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
    expect(result.recommendation.purpose).toBe('today_run.personalized_reason_readiness_protect');
  });

  it('returns null when no structured backend session exists', () => {
    expect(resolvePersonalizedCoachRecommendation({ coachPayload: null, t, lang: 'en', unit: 'km' })).toBeNull();
  });
});
