import { useState } from 'react';
import { useWorkspace, useCommand, useCanWrite } from './workspace.jsx';
import { Badge, Button, Feedback, Modal, SelectField, TextField } from './components.jsx';
export function CalendarEntry({
  event: e,
  activities
}) {
  const canWrite = useCanWrite();
  const {
      api
    } = useWorkspace(),
    c = useCommand(),
    [date, setDate] = useState(e.date),
    [activityId, setActivity] = useState(activities[0]?.id || '');
  return <article className="tw-session planned" draggable={e.state === 'planned' && canWrite} onDragStart={event => event.dataTransfer.setData('text/plain', JSON.stringify({
    eventId: e.id,
    revision: e.revision
  }))}><Badge tone="info">{e.state === 'completed' ? 'Matched completion' : 'Planned'}</Badge><strong>{e.title}</strong><span className="tw-muted">{e.minutes} min · projected load {e.projectedLoad}</span>{e.state === 'planned' && canWrite && <Modal trigger={`Manage ${e.title}`} title="Move or match this workout">{close => <><TextField label="New workout date" type="date" value={date} onChange={event => setDate(event.target.value)} /><Button onClick={async () => {
          if (await c.run(() => api.updateEvent({
            eventId: e.id,
            date,
            revision: e.revision
          }), 'Workout moved.')) close();
        }}>Move workout</Button><SelectField label="Completed session" value={activityId} onChange={event => setActivity(event.target.value)} options={[{
          value: '',
          label: 'Choose a completed session'
        }, ...activities.map(a => ({
          value: a.id,
          label: a.title
        }))]} /><Button disabled={!activityId} onClick={async () => {
          if (await c.run(() => api.linkCompletion({
            eventId: e.id,
            activityId,
            revision: e.revision
          }), 'Completion linked once.')) close();
        }}>Link completion</Button><Button variant="danger" onClick={async () => {
          if (await c.run(() => api.updateEvent({
            eventId: e.id,
            state: 'cancelled',
            revision: e.revision
          }), 'Workout cancelled.')) close();
        }}>Cancel prescription</Button><Feedback command={c} /></>}</Modal>}<Feedback command={c} /></article>;
}
