import { useRef, useState } from 'react';
import { Link as AppLink } from 'react-router';
import { useI18n } from '../../../contexts/I18nContext';
import { Link } from '../ui/router.jsx';
import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { Feedback, QueryGate } from '../ui/components.jsx';
import './authoring.css';
import PersonalizedLibrary from './PersonalizedLibrary';

export function workoutTone(workout) {
  if (/(?:^|\n)\s*\d+x\b/i.test(workout.source || '') || /\b(?:interval|tempo|threshold|hill|track)\b/i.test(workout.title || '')) return 'quality';
  return workout.minutes >= 90 ? 'long' : 'easy';
}
export function workoutDuration(minutes, t) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return t('training_authoring.durationMinutes', { minutes: total });
  const hours = Math.floor(total / 60), remainder = total % 60;
  return t(remainder ? 'training_authoring.durationHoursMinutes' : 'training_authoring.durationHours', { hours, minutes: remainder });
}
export default function Library() {
  const { t } = useI18n();
  const s = (key, args) => t(`training_authoring.${key}`, args);
  const { api, actor, athleteId } = useWorkspace(), query = useResource('getLibrary');
  const [folder, setFolder] = useState('all'), [adding, setAdding] = useState(false), [name, setName] = useState('');
  const addButton = useRef(null), command = useCommand();
  function cancelFolder() { setAdding(false); setName(''); requestAnimationFrame(() => addButton.current?.focus()); }
  async function createFolder(event) {
    event.preventDefault();
    if (!name.trim() || command.busy) return;
    const result = await command.run(() => api.createFolder({ name: name.trim() }), s('folderCreated'));
    if (result) { setFolder(result.id); cancelFolder(); }
  }
  return <QueryGate query={query}>{data => {
    const matches = (workout, id) => id === 'all' || (id === 'root' ? !workout.folderId : workout.folderId === id);
    const folders = [{ id: 'all', name: s('all') }, { id: 'root', name: s('unfiled') }, ...data.folders];
    const rows = data.workouts.filter(workout => matches(workout, folder));
    return <section className="workout-library" aria-label={s('libraryTitle')}>
      <div className="workout-library-toolbar">
        <div className="workout-library-toolbar-heading"><span className="authoring-eyebrow">{s('folders')}</span><Link className="authoring-primary" to="/workout"><span aria-hidden="true">+</span> {s('createWorkout')}</Link></div>
        <div className="workout-folder-list" role="group" aria-label={s('folders')}>
          {folders.map(item => <button type="button" className="workout-folder" key={item.id} aria-pressed={folder === item.id} onClick={() => setFolder(item.id)}>{item.name}{' '}<span>{data.workouts.filter(workout => matches(workout, item.id)).length}</span></button>)}
          {adding ? <form className="workout-folder-form" onSubmit={createFolder} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.nativeEvent.stopImmediatePropagation(); cancelFolder(); } }}>
            <input aria-label={s('folderName')} autoFocus placeholder={s('folderName')} value={name} maxLength={80} onChange={event => setName(event.target.value)} required disabled={command.busy} />
            <button type="submit" disabled={!name.trim() || command.busy}>{s('addFolder')}</button><button type="button" onClick={cancelFolder} aria-label={s('cancel')} disabled={command.busy}>×</button>
          </form> : <button type="button" ref={addButton} className="workout-folder workout-folder-add" onClick={() => setAdding(true)}><span aria-hidden="true">+</span> {s('newFolder')}</button>}
        </div><Feedback command={command} />
      </div>
      <div className="workout-library-content">
      {folder === 'all' && actor === athleteId && <PersonalizedLibrary />}
      <h2 className="library-saved-heading">{s('savedWorkouts')}</h2>
      {rows.length ? <ul className="workout-library-list">{rows.map(workout => {
        const owned = workout.ownerId === actor, by = !owned && (workout.sharedByName || workout.ownerName);
        return <li key={workout.id} className={`workout-library-row workout-tone-${workoutTone(workout)}`}>
          <div className="workout-library-copy"><div className="workout-library-title"><strong>{workout.title}</strong><span className={`workout-ownership ${owned ? '' : 'is-shared'}`}>{s(owned ? 'owned' : 'shared')} · v{workout.version}</span></div>
            <span className="workout-library-meta">{workoutDuration(workout.minutes, t)} · {s(['Running', 'Cycling', 'Swimming'].includes(workout.sport) ? `sport${workout.sport}` : 'sportOther')}{by && ` · ${s('sharedFrom', { name: by })}`}</span></div>
          <Link className="workout-row-action" to={`/workout?id=${encodeURIComponent(workout.id)}`}>{s(owned ? 'editSchedule' : 'copySchedule')} <span aria-hidden="true">→</span><span className="ds-sr"> {workout.title}</span></Link>
        </li>;
      })}</ul> : <div className="workout-library-empty"><h2>{s(data.workouts.length ? 'folderEmptyTitle' : 'savedEmptyTitle')}</h2><p>{s(data.workouts.length ? 'folderEmptyBody' : 'emptyBody')}</p>
        {data.workouts.length ? <button type="button" className="authoring-secondary" onClick={() => setFolder('all')}>{s('showAll')}</button> : <Link className="authoring-secondary" to="/workout">{s('createFirst')}</Link>}
        {!data.workouts.length && actor === athleteId && <AppLink className="workout-row-action" to="/schedule?planView=setup">{s('buildPlan')} <span aria-hidden="true">→</span></AppLink>}
      </div>}
      </div>
      <footer className="workout-library-footer"><span>{s('ownershipHelp')}</span><span className="workout-library-legend"><span><i aria-hidden="true" />{s('owned')}</span><span><i className="is-shared" aria-hidden="true" />{s('shared')}</span></span></footer>
    </section>;
  }}</QueryGate>;
}
