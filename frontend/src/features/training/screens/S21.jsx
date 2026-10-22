import { useState } from 'react';
import { Link, useNavigate } from '../ui/router.jsx';
import { useResource, useWorkspace } from '../ui/workspace.jsx';
import { Badge, Button, DataTable, Panel, QueryGate, TextField } from '../ui/components.jsx';
export default function Roster() {
  const q = useResource('getRoster'),
    {
      setAthlete
    } = useWorkspace(),
    navigate = useNavigate(),
    [search, setSearch] = useState('');
  return <QueryGate query={q}>{data => <Panel title="Athletes and current grants"><TextField label="Find an athlete in your roster" type="search" value={search} onChange={e => setSearch(e.target.value)} /><DataTable caption="Roster · totals hidden without athlete access" rows={data.items.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))} columns={[{
        key: 'name',
        label: 'Athlete'
      }, {
        key: 'access',
        label: 'Effective access',
        render: a => <Badge tone={a.access === 'none' ? 'warning' : 'success'}>{a.access}</Badge>
      }, {
        key: 'minutes',
        label: 'Completed minutes'
      }, {
        key: 'load',
        label: 'Known load'
      }, {
        key: 'open',
        label: 'Workspace',
        render: a => <Button size="sm" onClick={() => {
          setAthlete(a.id);
          navigate('/calendar');
        }}>Open {a.name}</Button>
      }]} /><div className="tw-actions"><Link to="/access">Follow or coach requests</Link><Link to="/plans">Apply a plan</Link><Link to="/team">Manage your team</Link></div></Panel>}</QueryGate>;
}
