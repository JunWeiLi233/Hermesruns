import { expect,it } from 'vitest';
import { asCoachWorkout } from './publishedWorkout';
it('adapts published units without inventing distance for timed workouts or dropping its identity',()=>{
  const workout={id:'9007199254740995',versionId:'version',localDate:'2026-10-20',workoutType:'LONG',targetDistanceM:12345,targetDurationS:null,state:'PARTIAL',steps:[]};
  expect(asCoachWorkout(workout)).toMatchObject({id:workout.id,versionId:'version',scheduledDate:'2026-10-20',workoutType:'LONG_RUN',plannedDistanceKm:12.345,state:'PARTIAL'});
  expect(asCoachWorkout({...workout,workoutType:'RUN_WALK',targetDistanceM:null,targetDurationS:1320})).toMatchObject({plannedDistanceKm:null,plannedDurationMinutes:22});
});
