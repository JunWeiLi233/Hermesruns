import { compileWorkout } from '../../features/training/data/model.mjs';

export const authoredOn = (events,date) => events.filter(event=>event.date===date&&event.state!=='cancelled');

/** A scheduled event supplies its own title, duration and steps, never inferred run targets. */
export function asAuthoredWorkout(events) {
  if(!events.length)return null;
  return {id:events.map(e=>e.id).join(':'),authored:true,title:events.map(e=>e.title).join(' · '),
    scheduledDate:events[0].date,workoutType:'AUTHORED',plannedDistanceKm:null,
    plannedDurationMinutes:events.reduce((sum,e)=>sum+Number(e.minutes||0),0),
    steps:events.flatMap(event=>{const compiled=compileWorkout(event.source||'');return compiled.steps.length&&!compiled.errors.length?compiled.steps:[{name:event.title,minutes:event.minutes,target:null,unit:''}];})};
}
