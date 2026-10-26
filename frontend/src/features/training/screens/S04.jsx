import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { Button, Feedback, Panel, QueryGate, SelectField, TextField } from '../ui/components.jsx';
export default function Settings() {
  const {
      api
    } = useWorkspace(),
    q = useResource('getMe'),
    c = useCommand();
  return <QueryGate query={q}>{me => <Panel title="Your preferences and model anchors" meta="Own account · future calendar dates retain their civil day"><form key={me.id} onSubmit={e => {
        e.preventDefault();
        const p = Object.fromEntries(new FormData(e.currentTarget));
        c.run(() => api.updateProfile({
          ...p,
          maxHr: +p.maxHr,
          ftp: +p.ftp,
          fitnessTau: +p.fitnessTau,
          fatigueTau: +p.fatigueTau,
          notifications: p.notifications === 'on',
          revision: me.revision
        }));
      }}><TextField label="Display name" name="name" defaultValue={me.name} maxLength={160} required /><TextField label="Time zone" name="zone" defaultValue={me.zone} required /><SelectField label="Distance units" name="units" defaultValue={me.units} options={['metric', 'imperial']} value={undefined} /><div className="tw-grid"><TextField label="Maximum heart rate (bpm)" name="maxHr" type="number" min="80" max="240" defaultValue={me.maxHr || 190} /><TextField label="Functional threshold power (W)" name="ftp" type="number" min="1" defaultValue={me.ftp || 240} /><TextField label="Fitness time constant (days)" name="fitnessTau" type="number" min="1" max="180" defaultValue={me.fitnessTau || 42} /><TextField label="Fatigue time constant (days)" name="fatigueTau" type="number" min="1" max="60" defaultValue={me.fatigueTau || 7} /></div><label className="ds-check"><input type="checkbox" name="notifications" defaultChecked={me.notifications} /> Notification preference</label><Button type="submit" variant="primary">Save preferences</Button></form><Feedback command={c} /><p className="tw-muted">Five default HR bands use 60/70/80/90/100% of maximum HR. Effective per-sport zone versions and notification delivery are not available yet.</p></Panel>}</QueryGate>;
}
