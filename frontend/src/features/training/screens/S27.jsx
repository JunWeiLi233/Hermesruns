import { Link } from '../ui/router.jsx';
import { useResource, useWorkspace } from '../ui/workspace.jsx';
import { Notice, Panel, QueryGate } from '../ui/components.jsx';
export default function Coaches() {
  const q = useResource('searchAthletes'), {api}=useWorkspace();
  if(api.mode === 'http')return <Panel title="Human coaching relationships"><Notice>A live opted-in coach directory is not configured. Use a known athlete’s discoverable profile or an approved team membership to request a relationship; acceptance is always separate.</Notice><Link to="/access">Open relationship requests</Link><Link to="/messages">Open permitted conversations</Link></Panel>;
  return <QueryGate query={q}>{data => <Panel title="Opted-in human coaches"><Notice>Sample directory entries carry no verified professional credential. Contact and data access are separate choices; there is no booking or payment flow.</Notice>{data.items.filter(p => p.coach).map(p => <article className="tw-card" key={p.id}><h3>{p.name}</h3><p>Endurance training · sample profile</p><Link to="/access">Request a coaching relationship</Link><Link to="/messages">Open accessible conversations</Link></article>)}</Panel>}</QueryGate>;
}
