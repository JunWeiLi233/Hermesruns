import { expect, it } from 'vitest';
import { trainingPlanReturnPath } from './trainingPlanReturnPath';

it('returns to the same internal plan preview or workout after sign-in', () => {
  expect(trainingPlanReturnPath('/training-plan/plan/workouts/session', 'https://hermes.test')).toBe('/training-plan/plan/workouts/session');
  expect(trainingPlanReturnPath('/training-plan/plan/preview/version?workout=session', 'https://hermes.test')).toBe('/training-plan/plan/preview/version?workout=session');
});
it('rejects external, sibling and malformed return destinations', () => {
  for (const value of [null, '', '//evil.test/training-plan', 'https://evil.test/training-plan', '/training-plan/../../admin', '/training-plan-evil', 'javascript:alert(1)', '/runs/1/../../admin','/settings-evil']) {
    expect(trainingPlanReturnPath(value, 'https://hermes.test')).toBe('/profile');
  }
});
it('returns to merged host pages without widening access to other destinations',()=>{
 expect(trainingPlanReturnPath('/schedule?planView=setup','https://hermes.test')).toBe('/schedule?planView=setup');
 expect(trainingPlanReturnPath('/runs/42?conversation=1','https://hermes.test')).toBe('/runs/42?conversation=1');
 expect(trainingPlanReturnPath('/settings?section=account','https://hermes.test')).toBe('/settings?section=account');
});
it('returns to a native training deep link after Hermes sign-in',()=>{
  expect(trainingPlanReturnPath('/training/activity?id=session-1','https://hermes.test')).toBe('/training/activity?id=session-1');
  expect(trainingPlanReturnPath('/training/team','https://hermes.test')).toBe('/training/team');
  expect(trainingPlanReturnPath('/training-evil','https://hermes.test')).toBe('/profile');
});
