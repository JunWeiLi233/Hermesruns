import { useState } from 'react';
import { Link } from 'react-router';
import { useWorkspace, useResource } from '../ui/workspace.jsx';
import { Button, DataTable, Panel, QueryGate, SelectField, TextField, fmt } from '../ui/components.jsx';
import { csv, downloadText } from '../ui/download.mjs';
export default function Activities() {
  const {
      athleteId
    } = useWorkspace(),
    q = useResource('getActivities', {
      athleteId
    }),
    [search, setSearch] = useState(''),
    [sport, setSport] = useState('All'),
    [sort, setSort] = useState('date'),
    [showLoad, setLoad] = useState(true);
  return <QueryGate query={q}>{data => {
      const rows = data.items.filter(a => a.title.toLowerCase().includes(search.toLowerCase()) && (sport === 'All' || a.sport === sport)).sort((a, b) => a[sort] == null ? 1 : b[sort] == null ? -1 : typeof a[sort] === 'number' ? b[sort] - a[sort] : String(a[sort]).localeCompare(String(b[sort])));
      return <Panel title="Search completed sessions" meta={`${rows.length} authorized sessions`}><div className="tw-actions"><TextField label="Search sessions" type="search" value={search} onChange={e => setSearch(e.target.value)} /><SelectField label="Sport filter" value={sport} onChange={e => setSport(e.target.value)} options={['All', 'Running', 'Cycling', 'Swimming']} /><SelectField label="Sort sessions" value={sort} onChange={e => setSort(e.target.value)} options={['date', 'title', 'minutes', 'load']} /><label className="ds-check"><input type="checkbox" checked={showLoad} onChange={e => setLoad(e.target.checked)} /> Show load column</label><Button onClick={() => downloadText('activities.csv', csv(rows, ['title', 'date', 'sport', 'minutes', 'load', 'model']), 'text/csv')}>Export visible rows</Button></div><DataTable caption="Authorized activity list" rows={rows} columns={[{
          key: 'title',
          label: 'Session',
          render: a => <Link to={`/activity?id=${a.id}`}>{a.title}</Link>
        }, {
          key: 'date',
          label: 'Day'
        }, {
          key: 'sport',
          label: 'Sport'
        }, {
          key: 'minutes',
          label: 'Minutes'
        }, ...(showLoad ? [{
          key: 'load',
          label: 'Load',
          render: a => fmt(a.load)
        }] : []), {
          key: 'model',
          label: 'Method'
        }]} /></Panel>;
    }}</QueryGate>;
}
