import { useState } from 'react';
import { Link } from 'react-router';
import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { Badge, Button, Empty, Feedback, Panel, QueryGate, SelectField, TextField } from '../ui/components.jsx';
export default function Library() {
  const {
      api,
      actor
    } = useWorkspace(),
    q = useResource('getLibrary'),
    [folder, setFolder] = useState('all'),
    [name, setName] = useState(''),
    c = useCommand();
  return <QueryGate query={q}>{data => <><Panel title="Reusable workouts" meta="Owned and explicitly shared versions"><div className="tw-actions"><SelectField label="Library folder" value={folder} onChange={e => setFolder(e.target.value)} options={[{
            value: 'all',
            label: 'All workouts'
          }, {
            value: 'root',
            label: 'Unfiled'
          }, ...data.folders.map(f => ({
            value: f.id,
            label: f.name
          }))]} /><Link className="ds-button ds-primary" to="/workout">Create a workout</Link></div><div className="tw-grid">{data.workouts.filter(w => folder === 'all' || (folder === 'root' ? !w.folderId : w.folderId === folder)).map(w => <article className="tw-card" key={w.id}><Badge>{w.ownerId === actor ? 'Owned' : 'Explicit share'} · v{w.version}</Badge><h3>{w.title}</h3><p>{w.minutes} min · {w.sport}</p><Link to={`/workout?id=${w.id}`}>{w.ownerId === actor ? 'Edit or schedule' : 'Copy or schedule'}</Link></article>)}</div>{!data.workouts.length && <Empty to="/workout" action="Create workout">Your library is empty</Empty>}</Panel><Panel title="Organize folders"><form onSubmit={e => {
          e.preventDefault();
          c.run(() => api.createFolder({
            name
          }), 'Folder created. Assign a workout in the editor.');
        }}><TextField label="New folder name" value={name} onChange={e => setName(e.target.value)} required /><Button type="submit">Create folder</Button></form><Feedback command={c} /></Panel></>}</QueryGate>;
}
