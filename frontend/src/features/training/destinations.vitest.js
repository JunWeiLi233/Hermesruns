import {expect,it} from 'vitest';
import {canonicalDestination,planDestination,trainingDestination} from './destinations.mjs';
it('moves duplicate views to their existing Hermes owners',()=>{
 expect(trainingDestination('/training/calendar')).toBe('/schedule');
 expect(trainingDestination('/intervals?id=public-uuid')).toBe('/runs?view=activity&panel=intervals&activity=public-uuid');
 expect(trainingDestination('/settings')).toBe('/settings?section=training');
 expect(trainingDestination('/team')).toBe('/profile/team?view=team');
 expect(trainingDestination('/settings/import-data')).toBe('/settings/import-data');
});
it('keeps discussion, interval and hash context when resolving a legacy UUID activity link',()=>{
 expect(canonicalDestination({canonicalId:42,athleteId:'own'},'own','?view=activity&activity=uuid&conversation=1&panel=intervals&athlete=own','#intervals')).toBe('/runs/42?conversation=1&panel=intervals#intervals');
 expect(canonicalDestination({canonicalId:43,athleteId:'shared'},'own','?view=activity&activity=uuid&conversation=1')).toBe('/runs/43?conversation=1&athlete=shared');
});
it('preserves selected athlete and resource context across hosts without leaking it into account settings',()=>{
 expect(trainingDestination('/messages?activity=session',{athleteId:'athlete'})).toBe('/profile/team?view=messages&activity=session&athlete=athlete');
 expect(trainingDestination('/privacy',{athleteId:'athlete'})).toBe('/settings?section=account');
 expect(trainingDestination('https://example.test/path')).toBe('https://example.test/path');
});
it('keeps old plan bookmarks within Schedule or Today and preserves identifiers',()=>{
 expect(planDestination('/training-plan/setup/plan')).toBe('/schedule?planView=setup&planId=plan');
 expect(planDestination('/training-plan/plan/preview/version')).toBe('/schedule?planView=preview&planId=plan&versionId=version');
 expect(planDestination('/training-plan/plan/workouts/workout')).toBe('/today-run?planId=plan&workoutId=workout');
});
