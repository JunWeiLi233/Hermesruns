import { describe, expect, it } from 'vitest';
import { buildWeeklyCoachSummaryModel } from './scheduleCoachSummary.js';
import { getTodayRunAcwrInsight } from './todayRunAcwrInsight.js';
import { getTodayRunRecommendation } from './todayRun.js';

// Actual RV03 payload: remaining-validation/coaching-date/boundary-visible.json.
// Live replay: remaining-fixes/coaching/before-dev-boundary.json, 12 imports/56km.
const coachPayload = {
  today: { workoutType: 'RECOVERY', plannedDistanceKm: 3, intent: 'recovery', reasonCode: 'high_load', phase: 'absorb' },
  plan: { phase: 'absorb', reasonCodes: ['high_load', 'load_data'], targetWeeklyKm: 9 },
  state: { volumeKm7d: 10, volumeKm28d: 10 },
};

describe('planner evidence versus independent effort load', () => {
  it('uses the actual high-load plan rationale instead of light0.66 advice', () => {
    expect(buildWeeklyCoachSummaryModel({ acwr: 0.66, coachPayload, nextSessionTitle: 'Recovery run' }))
      .toMatchObject({ loadState: 'planner', plannerReasonCode: 'high_load', plannerReasonIsPlan: true });
  });

  it('keeps high-load weekly context when today is scheduled REST', () => {
    const payload = { ...coachPayload, today: { workoutType: 'REST', reasonCode: 'scheduled_rest', intent: 'rest' } };
    expect(buildWeeklyCoachSummaryModel({ acwr: 0.66, coachPayload: payload }))
      .toMatchObject({ loadState: 'planner', plannerReasonCode: 'high_load', plannerReasonIsPlan: true });
  });

  it('uses session evidence if the weekly plan has no explanation', () => {
    expect(buildWeeklyCoachSummaryModel({ acwr: 0.66, coachPayload: { today: coachPayload.today } }))
      .toMatchObject({ loadState: 'planner', plannerReasonCode: 'high_load', plannerReasonIsPlan: false });
  });

  it.each([null, undefined, '', 'future_reason', 27])('does not invent advice for missing/unknown planner rationale %s', reasonCode => {
    const payload = { today: { workoutType: 'EASY', reasonCode }, plan: { reasonCodes: [] } };
    expect(buildWeeklyCoachSummaryModel({ acwr: 0.66, coachPayload: payload }))
      .toMatchObject({ loadState: 'planner', plannerReasonCode: reasonCode, plannerReasonIsPlan: false });
  });

  it('preserves effort-load fallback when no personalized session is supplied', () => {
    expect(buildWeeklyCoachSummaryModel({ acwr: 0.66 }).loadState).toBe('low');
    expect(buildWeeklyCoachSummaryModel({ acwr: null }).loadState).toBe('unknown');
  });

  it('distinguishes the Today Run effort estimate without prescribing a push', () => {
    expect(getTodayRunAcwrInsight(0.66, { source: 'personalized-planner' }))
      .toMatchObject({ zone: 'low', intensityAction: 'follow-plan',
        stripLabelKey: 'today_run.acwr_planner_estimate_label',
        calloutTitleKey: 'today_run.acwr_planner_estimate_title',
        calloutBodyKey: 'today_run.acwr_planner_estimate_body' });
  });

  it.each([
    ['RECOVERY', 'high_load', 'recovery'], ['REST', 'scheduled_rest', 'rest'],
    ['EASY', 'build_consistency', 'easy'], ['LONG_RUN', 'aerobic_progression', 'long_run'],
  ])('preserves %s session semantics and exposes the planner as the advice basis', (workoutType, reasonCode, intent) => {
    const payload = { ...coachPayload, today: { ...coachPayload.today, workoutType, reasonCode, intent } };
    const result = getTodayRunRecommendation({ runs: [], races: [], coachPayload: { ...payload, today: { ...payload.today, scheduledDate: '2026-10-10' } }, todayKey: '2026-10-10', t: key => key, lang: 'en', unit: 'km' });
    expect(result.recommendation).toMatchObject({ workoutType, intent, purpose: `today_run.personalized_reason_${reasonCode}` });
    expect(result.metrics.coachLoadEvidence).toMatchObject({ source: 'personalized-planner' });
    expect(result.reasons).toContain('today_run.personalized_plan_reason_high_load');
  });
});
