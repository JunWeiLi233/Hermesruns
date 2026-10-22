import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { Button, DataTable, Feedback, Notice, Panel, QueryGate, TextField } from '../ui/components.jsx';
export default function Season() {
  const {
      api,
      athleteId
    } = useWorkspace(),
    q = useResource('getSeasons', {
      athleteId
    }),
    c = useCommand();
  return <QueryGate query={q}>{data => <Panel title="Shape a season"><Notice>Optional local planner. Automated periodization, race-priority optimization and paid entitlements require separate product validation.</Notice><form onSubmit={e => {
        e.preventDefault();
        const p = Object.fromEntries(new FormData(e.currentTarget));
        c.run(() => api.saveSeason({
          ...p,
          athleteId,
          weeklyMinutes: +p.weeklyMinutes
        }), 'Season saved.');
      }}><TextField label="Season name" name="name" required defaultValue="Autumn foundation" /><div className="tw-grid"><TextField label="Season start" name="start" type="date" defaultValue="2026-10-19" required /><TextField label="Season end" name="end" type="date" defaultValue="2026-12-13" required /></div><TextField label="Weekly target minutes" name="weeklyMinutes" type="number" min="1" defaultValue="240" /><Button type="submit" variant="primary">Save season structure</Button></form><Feedback command={c} /><DataTable caption="Saved season structures" rows={data.items} columns={[{
        key: 'name',
        label: 'Season'
      }, {
        key: 'start',
        label: 'From'
      }, {
        key: 'end',
        label: 'Through'
      }, {
        key: 'weeklyMinutes',
        label: 'Weekly minutes'
      }]} /></Panel>}</QueryGate>;
}
