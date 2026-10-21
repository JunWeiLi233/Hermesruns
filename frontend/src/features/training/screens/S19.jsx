import { useState } from 'react';
import { Link as AppLink } from 'react-router';
import { useI18n } from '../../../contexts/I18nContext';
import { currentDate } from '../data/dates.mjs';
import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { Badge, Button, Feedback, Notice, Panel, QueryGate, SelectField, TextField } from '../ui/components.jsx';
import { BulkReview } from '../ui/BulkReview.jsx';
import './authoring.css';

export default function Plans() {
  const { t } = useI18n(), s = (key, args) => t(`training_authoring.${key}`, args);
  const { api, actor, athleteId } = useWorkspace(), query = useResource('getLibrary'), roster = useResource('getRoster');
  const [title, setTitle] = useState(s('defaultPlan')), [items, setItems] = useState([]);
  const [workout, setWorkout] = useState(''), [day, setDay] = useState(0), [targets, setTargets] = useState([athleteId]);
  const [date, setDate] = useState(currentDate()), [preview, setPreview] = useState(null), command = useCommand();
  const eligible = roster.data?.items.filter(athlete => ['owner', 'coach'].includes(athlete.access)) || [];
  const applicationTargets = targets.filter(id => eligible.some(athlete => athlete.id === id));
  return <QueryGate query={query}>{data => <>
    {actor === athleteId ? <section className="personal-plan-card"><span className="authoring-eyebrow">{s('personalEyebrow')}</span><h2>{s('personalTitle')}</h2><p>{s('personalBody')}</p>
      <ul className="personal-plan-factors">{['personalGoal', 'personalFitness', 'personalWeek', 'personalReview'].map(key => <li key={key}>{s(key)}</li>)}</ul>
      <AppLink className="authoring-primary" to="/schedule?planView=setup">{s('buildPlan')} <span aria-hidden="true">→</span></AppLink>
    </section> : <Notice>{s('selectedAthleteHelp')}</Notice>}
    <div className="tw-grid"><Panel title={s('composePlan')} meta={s('reusableHelp')}>
      <TextField label={s('planName')} value={title} maxLength={160} onChange={event => setTitle(event.target.value)} />
      <SelectField label={s('workoutToAdd')} value={workout} onChange={event => setWorkout(event.target.value)} options={[{ value: '', label: s('chooseWorkout') }, ...data.workouts.map(item => ({ value: item.id, label: `${item.title} · v${item.version}` }))]} />
      <TextField label={s('dayOffset')} type="number" min="0" max="365" step="1" value={day} onChange={event => setDay(Number(event.target.value))} />
      <Button disabled={!workout || !Number.isInteger(day) || day < 0 || day > 365} onClick={() => {
        const selected = data.workouts.find(item => item.id === workout);
        if (selected) setItems(previous => [...previous, { day, title: selected.title, minutes: selected.minutes, sport: selected.sport, source: selected.source, workoutId: selected.id, sourceVersion: selected.version }]);
      }}>{s('addToPlan')}</Button>
      <ol className="workout-step-list" aria-label={s('draftSessions')}>{items.map((item, index) => <li key={index} className="authoring-draft-row"><div><strong>{item.title}</strong><small>{s('dayOffset')} {item.day} · {s('durationMinutes', { minutes: item.minutes })}</small></div><Button size="sm" disabled={!item.day} onClick={() => setItems(previous => previous.map((row, position) => position === index ? { ...row, day: row.day - 1 } : row))}>{s('moveEarlier')}</Button><Button size="sm" onClick={() => setItems(previous => previous.filter((_, position) => position !== index))}>{s('remove')}</Button></li>)}</ol>
      <Button variant="primary" busy={command.busy} disabled={!items.length || !title.trim()} onClick={() => command.run(() => api.savePlan({ title: title.trim(), items }), s('planSaved'))}>{s('publishPlan')}</Button>
    </Panel><Panel title={s('recipientsTitle')}>
      {roster.error && <Notice tone="danger" alert>{roster.error.message}</Notice>}
      <fieldset className="tw-checklist"><legend>{s('recipients')}</legend>{roster.data?.items.map(athlete => <label className="authoring-recipient" key={athlete.id}><input type="checkbox" disabled={!['owner', 'coach'].includes(athlete.access)} checked={applicationTargets.includes(athlete.id)} onChange={event => { setTargets(event.target.checked ? [...targets, athlete.id] : targets.filter(id => id !== athlete.id)); setPreview(null); }} />{athlete.name} · {t(`training_integration.access_${athlete.access}`)}</label>)}</fieldset>
      <TextField label={s('startDay')} type="date" value={date} onChange={event => { setDate(event.target.value); setPreview(null); }} /><p className="tw-muted">{s('recipientsHelp')}</p>
      {preview && <BulkReview preview={preview} />}<Feedback command={command} />
    </Panel></div>
    <Panel title={s('publishedPlans')}><div className="tw-card-list">{data.plans.map(plan => <article className="tw-card" key={plan.id}><Badge>{s('planVersion', { version: plan.version })}</Badge><h3>{plan.title}</h3><p>{s('sessionCount', { count: plan.items.length })}</p><Button busy={command.busy} disabled={!applicationTargets.length || !date} onClick={() => command.run(async () => setPreview(await api.previewPlan({ planId: plan.id, athleteIds: applicationTargets, date })), s('previewReady'))}>{s('previewPlan', { title: plan.title })}</Button></article>)}</div>{!data.plans.length && <div className="workout-library-empty"><h2>{s('noPlans')}</h2><p>{s('noPlansBody')}</p></div>}</Panel>
  </>}</QueryGate>;
}
