/** Display adapter only: published identity, targets and completion remain authoritative. */
export function asCoachWorkout(workout) {
  if(!workout)return null;
  const main=workout.steps?.find(step=>step.stepType==='RUN'||step.stepType==='MAIN');
  return {...workout,publishedType:workout.workoutType,scheduledDate:workout.localDate,
    workoutType:({LONG:'LONG_RUN',EASY:'EASY_RUN',EVENT:'RACE'})[workout.workoutType]||workout.workoutType,
    plannedDistanceKm:workout.targetDistanceM==null?null:workout.targetDistanceM/1000,
    plannedDurationMinutes:workout.targetDurationS==null?null:workout.targetDurationS/60,
    targetPaceMinSecondsPerKm:main?.paceMinSPerKm,targetPaceMaxSecondsPerKm:main?.paceMaxSPerKm};
}
