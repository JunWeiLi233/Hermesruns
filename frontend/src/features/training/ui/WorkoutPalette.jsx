import { currentDate } from '../data/dates.mjs';
import { useState } from 'react';
import { useWorkspace, useCommand, useCanWrite } from './workspace.jsx';
import { Button, Feedback, TextField } from './components.jsx';
export function WorkoutPalette({
  workouts
}) {
  const canWrite = useCanWrite();
  const {
      api,
      athleteId
    } = useWorkspace(),
    [date, setDate] = useState(currentDate()),
    c = useCommand();
  return <details><summary>Place a saved workout</summary><div className="ds-stack"><TextField label="Library placement day" type="date" value={date} onChange={e => setDate(e.target.value)} /><div className="tw-grid">{workouts.map(w => <article className="tw-card" key={w.id} draggable onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({
          workoutId: w.id
        }))}><strong>{w.title} · v{w.version}</strong><span>{w.minutes} min · drag onto a calendar day or use the placement button.</span><Button disabled={!canWrite} onClick={() => c.run(() => api.createEvent({
            athleteId,
            date,
            title: w.title,
            minutes: w.minutes,
            sport: w.sport,
            sourceVersion: w.version,
            snapshot: {
              source: w.source
            }
          }), 'Library workout placed on the calendar.')}>Place {w.title}</Button></article>)}</div><Feedback command={c} /></div></details>;
}
