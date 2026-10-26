import { ServerAuth } from '../ui/ServerAuth.jsx';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useWorkspace, useCommand } from '../ui/workspace.jsx';
import { Button, Feedback, Notice, Panel, TextField } from '../ui/components.jsx';
export default function Login() {
  const {
      api,
      switchActor
    } = useWorkspace(),
    navigate = useNavigate(),
    [email, setEmail] = useState('rowan@example.test'),
    [password, setPassword] = useState(''),
    c = useCommand();
  if(api.mode === 'http') return <ServerAuth  />;
  return <Panel title="Open a local sample workspace"><Notice>Simulated sign-in only. Use rowan@example.test, mara@example.test or tori@example.test with password “demo”. Enter no real credentials. Production authentication will reuse Hermes.</Notice><form onSubmit={e => {
      e.preventDefault();
      c.run(async () => {
        const result = await api.login({
          email,
          password
        });
        switchActor(result.user.id);
        navigate('/calendar');
      });
    }}><TextField label="Sample email" type="email" required autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /><TextField label="Sample password" type="password" required autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} /><Button variant="primary" type="submit" busy={c.busy}>Open sample account</Button></form><Feedback command={c} /><Link to="/signup">Create a local sample profile</Link><p className="tw-muted">Email verification and password recovery require the existing backend and are unavailable here.</p></Panel>;
}
