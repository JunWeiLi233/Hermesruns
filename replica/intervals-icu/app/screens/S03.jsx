import { ServerAuth } from '../ui/ServerAuth.jsx';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useWorkspace, useCommand } from '../ui/workspace.jsx';
import { Button, Feedback, Notice, Panel, SelectField, TextField } from '../ui/components.jsx';
export default function Signup() {
  const {
      api,
      switchActor
    } = useWorkspace(),
    navigate = useNavigate(),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [zone, setZone] = useState('America/New_York'),
    [units, setUnits] = useState('metric'),
    c = useCommand();
  if(api.mode === 'http') return <ServerAuth signup />;
  return <Panel title="Create an invented profile"><Notice>This creates a profile in this browser only. It creates no live account, accepts no terms and stores no password.</Notice><form onSubmit={e => {
      e.preventDefault();
      c.run(async () => {
        const u = await api.signup({
          name,
          email,
          zone,
          units
        });
        switchActor(u.id);
        navigate('/calendar');
      });
    }}><TextField label="Display name" required maxLength={160} value={name} onChange={e => setName(e.target.value)} /><TextField label="Sample email" type="email" required value={email} onChange={e => setEmail(e.target.value)} /><TextField label="IANA time zone" required value={zone} onChange={e => setZone(e.target.value)} /><SelectField label="Units" value={units} onChange={e => setUnits(e.target.value)} options={['metric', 'imperial']} /><Button variant="primary" type="submit" busy={c.busy}>Create local profile</Button></form><Feedback command={c} /></Panel>;
}
