import { useState } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../../../contexts/I18nContext';
import { useUnit } from '../../../contexts/UnitContext';
import { formatDistance, formatPaceSeconds, getDistanceUnitLabel } from '../../../utils/format';
import { localizedReason } from '../../../utils/personalizedCoachPlan';
import { useResource } from '../ui/workspace';

const types = { EASY: 'easy', EASY_RUN: 'easy', RECOVERY: 'recovery', BASE: 'base', BASE_RUN: 'base', LONG_RUN: 'long',
  TEMPO: 'tempo', THRESHOLD: 'threshold', INTERVALS: 'intervals', RACE: 'race', RUN_WALK: 'runWalk', STEADY: 'base' };
const weekdayNumbers = { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 7 };

export default function PersonalizedLibrary() {
  const { t, lang } = useI18n(), { unit } = useUnit();
  const s = (key, values) => t(`training_authoring.${key}`, values);
  const query = useResource('getPersonalizedLibrary'), [expanded, setExpanded] = useState(null);
  const dateLabel = date => new Intl.DateTimeFormat(lang, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  if (query.loading) return <section className="library-personalized library-personalized-state" role="status">{s('personalizedLoading')}</section>;
  if (query.error) return <section className="library-personalized library-personalized-state" role="status"><p>{s('personalizedError')}</p><Link to="/schedule?planView=setup">{s('buildPlan')} →</Link></section>;
  const { workouts = [], plan = {}, availabilitySource, goal, activePlan, setupPlanId } = query.data;
  const setupUrl = `/schedule?planView=setup${setupPlanId ? `&planId=${encodeURIComponent(setupPlanId)}` : ''}`;
  const days = (plan.preferredRunDays || []).filter(day => weekdayNumbers[day]).map(day => new Intl.DateTimeFormat(lang, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 18 + weekdayNumbers[day])))).join(' · ');
  const historyRequired = plan.reasonCodes?.includes('history_required');
  const paceLabel = workout => {
    const low = workout.targetPaceMinSecondsPerKm, high = workout.targetPaceMaxSecondsPerKm;
    if (!(low > 0 && high >= low)) return s('personalizedPaceUnknown');
    const factor = unit === 'mile' ? 1.609344 : 1;
    return `${formatPaceSeconds(low * factor)}–${formatPaceSeconds(high * factor)} /${getDistanceUnitLabel(lang, unit)}`;
  };
  return <section className="library-personalized" aria-label={s('forYou')}>
    <header className="library-personalized-heading"><div><h2>{s('forYou')}</h2><p>{s(activePlan ? 'personalizedPublished' : 'personalizedBasis')}</p></div><Link to={setupUrl}>{s('personalizedAdjust')} →</Link></header>
    {goal?.name && <p className="library-personalized-goal">{s('personalizedGoal', { goal: goal.name })}</p>}
    {days && <p className="library-personalized-days">{s(availabilitySource === 'CONFIRMED' ? 'personalizedDays' : 'personalizedInferredDays', { days })}</p>}
    {availabilitySource !== 'CONFIRMED' && !historyRequired && <p className="library-personalized-hint">{s('personalizedConfirmDays')}</p>}
    {!workouts.length ? <p className="library-personalized-state">{s(historyRequired ? 'personalizedHistoryRequired' : 'personalizedNoSessions')}</p> : <ul className="workout-library-list">{workouts.map((workout, index) => {
      const key = `${workout.scheduledDate}:${index}`, kind = types[workout.workoutType] || 'base', open = expanded === key;
      const title = s(`session_${kind}`);
      return <li key={key} className={`workout-library-row workout-tone-${kind === 'long' || kind === 'race' ? 'long' : ['tempo', 'threshold', 'intervals'].includes(kind) ? 'quality' : 'easy'}`}>
        <div className="workout-library-copy"><div className="workout-library-title"><strong>{title}</strong><span className="workout-ownership is-shared">{s('personalizedBadge')}</span></div>
          <span className="workout-library-meta">{dateLabel(workout.scheduledDate)}{workout.plannedDistanceKm > 0 && ` · ${formatDistance(workout.plannedDistanceKm, 1, lang, unit)}`}{workout.plannedDurationMinutes > 0 && ` · ${s('durationMinutes', { minutes: workout.plannedDurationMinutes })}`}</span>
        </div>
        <button type="button" className="workout-row-action personalized-view" aria-expanded={open} onClick={() => setExpanded(open ? null : key)}>{s(open ? 'personalizedHide' : 'personalizedView')} <span aria-hidden="true">{open ? '↑' : '→'}</span><span className="ds-sr"> {title} {workout.scheduledDate}</span></button>
        {open && <div className="personalized-workout-details"><p><strong>{s('personalizedPace')}</strong> {paceLabel(workout)}</p><p>{workout.reasonCode === 'aerobic_progression' ? s('personalizedAerobicReason') : localizedReason(workout.reasonCode, t)}</p><p>{s(activePlan ? 'personalizedAlreadyScheduled' : 'personalizedSuggestion')}</p><Link to="/schedule">{s('openCalendar')} →</Link></div>}
      </li>;
    })}</ul>}
  </section>;
}
