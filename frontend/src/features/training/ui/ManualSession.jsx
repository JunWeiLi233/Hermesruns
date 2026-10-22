import { currentDate } from '../data/dates.mjs';
import { useWorkspace, useCommand } from './workspace.jsx';
import { Button, Feedback, Panel, SelectField, TextField } from './components.jsx';
export function ManualSession() {
  const {
      api,
      athleteId
    } = useWorkspace(),
    c = useCommand();
  return <Panel title="Record a manual completed session" meta="Selected athlete · RPE fallback"><form onSubmit={e => {
      e.preventDefault();
      const p = Object.fromEntries(new FormData(e.currentTarget));
      c.run(() => api.createManual({
        ...p,
        athleteId,
        minutes: +p.minutes,
        rpe: +p.rpe
      }), 'Manual session saved. Review it in the calendar.');
    }}><TextField label="Manual session title" name="title" required /><TextField label="Manual session day" name="date" type="date" defaultValue={currentDate()} required /><SelectField label="Manual session sport" name="sport" options={['Running', 'Cycling', 'Swimming']} /><TextField label="Manual duration (minutes)" name="minutes" type="number" min="1" required /><TextField label="Manual session RPE" name="rpe" type="number" min="1" max="10" required /><Button type="submit">Record completed session</Button></form><Feedback command={c} /></Panel>;
}
