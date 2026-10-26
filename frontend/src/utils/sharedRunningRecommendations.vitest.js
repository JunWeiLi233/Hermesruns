import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getTodayRunRecommendation } from './todayRun';
import { buildCoachRecommendationSessions, resolveCoachReadinessScore, resolveCoachReadinessLabel, resolveCoachWeeklyTarget, resolvePersonalizedCoachRecommendation } from './personalizedCoachPlan';

const t = key => key;
const runs = [{ id: 1, startTime: '2026-10-15T16:00:00Z', distanceKm: 36, movingTimeSeconds: 10800 }];
const input = { runs, t, lang:'en', unit:'km', timeZone:'America/New_York' };
beforeEach(() => { vi.useFakeTimers({ toFake:['Date'] }); vi.setSystemTime(new Date('2026-10-16T16:00:00Z')); });
afterEach(() => vi.useRealTimers());

it('does not replace an unavailable shared plan with local fixed distance ranges', () => {
  const result = getTodayRunRecommendation(input);
  expect(result.recommendation.distance).toBe('—');
  expect(result.recommendation.source).toBe('unavailable');
  expect(result.plan).toEqual([]);
});
it('keeps today and route-facing numeric targets tied to the shared prescription', () => {
  const coachPayload = { today: { scheduledDate:'2026-10-16', workoutType:'RECOVERY', plannedDistanceKm:4.5, reasonCode:'high_load' }, plan:{targetWeeklyKm:9,sessionsPerWeek:2} };
  const result = getTodayRunRecommendation({...input,coachPayload});
  const formatted = resolvePersonalizedCoachRecommendation({coachPayload,t,lang:'en',unit:'km',todayKey:'2026-10-16'});
  expect(result.recommendation.distance).toBe(formatted.recommendation.distance);
  expect(result.recommendation.distanceKm).toBe(4.5);
  expect(result.personalizedPlan.targetWeeklyKm).toBe(9);
});
it('keeps the prescribed pace consistent when only one page has weather data', () => {
  const coachPayload = { today: { scheduledDate:'2026-10-16', workoutType:'EASY', plannedDistanceKm:4.5,
    targetPaceMinSecondsPerKm:300, targetPaceMaxSecondsPerKm:330 } };
  const weatherContext = { available:true, pacePenaltySecPerKm:15 };
  const today = getTodayRunRecommendation({...input, coachPayload, weatherContext});
  const analysis = resolvePersonalizedCoachRecommendation({coachPayload,t,lang:'en',unit:'km',todayKey:'2026-10-16'});
  expect(today.recommendation.pace).toBe(analysis.recommendation.pace);
});
it.each(['2026-10-15','2026-10-17'])('does not prescribe another day %s on any surface', scheduledDate => {
  const coachPayload = {today:{scheduledDate,workoutType:'EASY',plannedDistanceKm:12}};
  expect(getTodayRunRecommendation({...input,coachPayload}).recommendation.distance).toBe('—');
  expect(resolvePersonalizedCoachRecommendation({coachPayload,t,lang:'en',unit:'km',todayKey:'2026-10-16'})).toBeNull();
});
it('does not turn a cross-training prescription into running kilometres', () => {
  const coachPayload = {today:{scheduledDate:'2026-10-16',workoutType:'CROSS_TRAIN',plannedDistanceKm:12,plannedDurationMinutes:30}};
  const result = getTodayRunRecommendation({...input,coachPayload});
  expect(result.recommendation.distanceKm).toBeNull();
  expect(result.recommendation.distance).not.toContain('12');
});

it('uses the same supported readiness score everywhere and leaves missing evidence unknown', () => {
  expect(resolveCoachReadinessScore({state:{readinessScore:78,readinessAvailability:{trainingLoad:true}}})).toBe(78);
  expect(resolveCoachReadinessScore({state:{readinessScore:78}})).toBeNull();
  expect(resolveCoachReadinessScore({state:{readinessScore:0,readinessAvailability:{trainingLoad:true}}})).toBe(0);
});
it('uses the server verdict and full weekly budget even when only future sessions remain', () => {
  const payload = {state:{readinessScore:76,readinessVerdict:'EASY',readinessAvailability:{trainingLoad:true}},plan:{targetWeeklyKm:24.9}};
  expect(resolveCoachReadinessLabel(payload,t)).toBe('today_run.readiness_verdict_easy');
  expect(resolveCoachWeeklyTarget(payload,'2026-10-12','2026-10-12',4.7)).toBe(24.9);
  expect(resolveCoachWeeklyTarget(payload,'2026-10-19','2026-10-12',18)).toBe(18);
});
it('does not invent extra analysis sessions or infer their distances from an average', () => {
  const today={scheduledDate:'2026-10-16',workoutType:'RECOVERY',plannedDistanceKm:4.5};
  const future={scheduledDate:'2026-10-18',workoutType:'LONG_RUN',plannedDistanceKm:9};
  const sessions=buildCoachRecommendationSessions({coachPayload:{today},schedule:[future],todayKey:'2026-10-16',t,lang:'en',unit:'km'});
  expect(sessions).toHaveLength(2);
  expect(sessions[0].target).toBe('4.5 km');
  expect(sessions[1].target).toBe('9.0 km');
  expect(buildCoachRecommendationSessions({coachPayload:null,todayKey:'2026-10-16',t,lang:'en',unit:'km'})).toEqual([]);
});
it('uses the published plan calendar and converts pace only for display units', () => {
  const coachPayload={today:{scheduledDate:'2026-10-17',workoutType:'EASY',plannedDistanceKm:4.5,targetPaceMinSecondsPerKm:300,targetPaceMaxSecondsPerKm:330},plan:{timeZone:'Asia/Tokyo'}};
  const result=resolvePersonalizedCoachRecommendation({coachPayload,todayKey:'2026-10-16',t,lang:'en',unit:'mile'});
  expect(result.recommendation.distanceKm).toBe(4.5);
  expect(result.recommendation.pace).toContain('/mi');
  expect(result.recommendation.pace).toContain('8:03');
});
