import { Link } from 'react-router';
import { useResource, useWorkspace } from '../ui/workspace.jsx';
import { Badge, Button, Notice, Panel, QueryGate } from '../ui/components.jsx';
export default function Connections() {
  const q = useResource('getConnections');
  const {api}=useWorkspace();
  return <QueryGate query={q}>{() => <><Notice>Provider authorization, credentials and device delivery require approved integrations. No simulated connection is presented as live.</Notice><div className="tw-grid">{['Activity provider', 'Recovery provider'].map(name => <Panel key={name} title={name} meta="Own account only"><Badge tone="warning">Unavailable</Badge><p>Official registration, source permissions and token storage are pending.</p><Button disabled>Connect after backend setup</Button></Panel>)}</div><Panel title="File import is available now"><p>{api.mode==='http'?'Upload your own activity files to the private import queue. Source provenance and missing streams stay visible.':'Import your own GPX/TCX locally. Source provenance and missing streams stay visible.'}</p><Link className="ds-button" to="/import">Open file importer</Link></Panel></>}</QueryGate>;
}
