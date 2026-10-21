import { useState } from 'react';
import { useI18n } from '../../../contexts/I18nContext';
import { Link, useSearchParams } from '../ui/router.jsx';
import { currentDate } from '../data/dates.mjs';
import { useWorkspace, useResource, useCommand, useCanWrite } from '../ui/workspace.jsx';
import { Button, Feedback, Field, Notice, Panel, QueryGate, SelectField, TextField, fmt } from '../ui/components.jsx';
import { compileWorkout } from '../data/model.mjs';
import { workoutDuration } from './S17';
import './authoring.css';

function Editor({ workout, folders }) {
  const { t } = useI18n(), s = (key, args) => t(`training_authoring.${key}`, args);
  const canWrite = useCanWrite(), { api, actor, athleteId } = useWorkspace();
  const [title, setTitle] = useState(workout?.title || s('defaultWorkout'));
  const [source, setSource] = useState(workout?.source || '10m @65% Warm up\n20m @80% Steady work\n10m @55% Cool down');
  const [sport, setSport] = useState(workout?.sport || 'Running');
  const [date, setDate] = useState(currentDate()), [folderId, setFolder] = useState(folders.some(folder => folder.id === workout?.folderId) ? workout.folderId : '');
  const [saved, setSaved] = useState(null), command = useCommand(), compiled = compileWorkout(source);
  const owned = workout?.ownerId === actor;
  const persisted = saved || workout;
  const matchesVersion = persisted && persisted.title === title && persisted.source === source && persisted.sport === sport;
  const invalid = !!compiled.errors.length || !compiled.steps.length || !title.trim();
  return <><div className="tw-actions"><Link className="workout-row-action" to="/library">← {s('backLibrary')}</Link></div><div className="tw-grid">
    <Panel title={s('authorSteps')} meta={saved || owned ? s('ownedVersion', { version: persisted.version }) : workout ? s('sharedSource') : s('newDraft')}>
      <TextField label={s('workoutName')} value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required />
      <div className="tw-grid"><SelectField label={s('sport')} value={sport} onChange={event => setSport(event.target.value)} options={['Running', 'Cycling', 'Swimming'].map(value => ({ value, label: s(`sport${value}`) }))} />
      <SelectField label={s('workoutFolder')} value={folderId} onChange={event => setFolder(event.target.value)} options={[{ value: '', label: s('unfiled') }, ...folders.map(folder => ({ value: folder.id, label: folder.name }))]} /></div>
      <Field label={s('workoutSource')} error={compiled.errors.join(' ')} hint={s('sourceHint')}>{props => <textarea {...props} rows={10} maxLength={65536} value={source} onChange={event => setSource(event.target.value)} spellCheck={false} />}</Field>
      <Button variant="primary" disabled={invalid} busy={command.busy} onClick={() => command.run(async () => {
        const base = saved || (owned ? workout : null);
        const result = await api.saveWorkout({ workoutId: base?.id, revision: base?.revision, title: title.trim(), source, sport, folderId });
        setSaved(result);
      }, s('workoutSaved'))}>{s('saveWorkout')}</Button><Feedback command={command} />
    </Panel>
    <Panel title={s('previewSchedule')} meta={`${workoutDuration(compiled.minutes, t)} · ${s('steps', { count: compiled.steps.length })}`}>
      <div className="workout-profile" role="img" aria-label={s('workoutTargets')}>{compiled.steps.map((step, index) => <span key={index} style={{ '--step-minutes': step.minutes, '--step-height': `${Math.max(12, Math.min(100, step.target / Math.max(1, ...compiled.steps.filter(item => item.unit === step.unit).map(item => item.target)) * 100))}%` }} />)}</div>
      <ol className="workout-step-list">{compiled.steps.map((step, index) => <li key={index}><span>{String(index + 1).padStart(2, '0')}</span><div>{step.name}<small>{workoutDuration(step.minutes, t)} · {fmt(step.target)}{step.unit}</small></div></li>)}</ol>
      <TextField label={s('scheduleDay')} type="date" value={date} onChange={event => setDate(event.target.value)} required />
      {!canWrite && <Notice>{t('training_integration.readOnly')}</Notice>}
      <Button variant="primary" busy={command.busy} disabled={invalid || !date || !canWrite} onClick={() => command.run(() => api.createEvent({ athleteId, date, title: title.trim(), minutes: compiled.minutes, sport, snapshot: { source, steps: compiled.steps }, sourceVersion: matchesVersion ? persisted.version : null, key: crypto.randomUUID() }), s('workoutScheduled'))}>{s('scheduleWorkout')}</Button>
      <Link className="workout-row-action" to="/calendar">{s('openCalendar')} →</Link>
    </Panel>
  </div></>;
}
export default function Workout() {
  const { t } = useI18n(), [params] = useSearchParams(), query = useResource('getLibrary');
  return <QueryGate query={query}>{data => {
    const id = params.get('id'), workout = data.workouts.find(item => item.id === id);
    if (id && !workout) return <Notice tone="danger" alert>{t('training_authoring.invalidWorkout')} <Link to="/library">{t('training_authoring.backLibrary')}</Link></Notice>;
    return <Editor folders={data.folders} key={id || 'new'} workout={workout} />;
  }}</QueryGate>;
}
