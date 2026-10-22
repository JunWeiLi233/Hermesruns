import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useResource, useWorkspace, useCommand } from '../ui/workspace.jsx';
import { Badge, Button, Feedback, Field, Panel, QueryGate, SelectField } from '../ui/components.jsx';
function Messages({
  conversationId
}) {
  const {
      api
    } = useWorkspace(),
    q = useResource('getMessages', {
      conversationId
    }),
    library = useResource('getLibrary'),
    [body, setBody] = useState(''),
    [workoutId, setWorkout] = useState(''),
    c = useCommand();
  return <QueryGate query={q}>{data => <><ol className="tw-card-list" aria-label="Conversation history">{data.items.map(m => <li className="tw-card" key={m.id}><strong>{m.senderName}</strong><time dateTime={m.at}>{new Date(m.at).toLocaleString()}</time><p>{m.body}</p>{m.workoutId && <Badge>{m.sharedWorkout ? <Link to={`/workout?id=${m.sharedWorkout.id}`}>{m.sharedWorkout.title} · v{m.sharedWorkout.version}</Link> : 'Shared workout unavailable'}</Badge>}</li>)}</ol>{!data.items.length && <p className="tw-muted">No messages in this conversation yet.</p>}<form onSubmit={e => {
        e.preventDefault();
        c.run(async () => {
          await api.sendMessage({
            conversationId,
            body,
            workoutId: workoutId || undefined
          });
          setBody('');
        }, api.mode === 'http' ? 'Message saved on the server.' : 'Message saved in this browser.');
      }}><Field label="Message text">{p => <textarea {...p} value={body} onChange={e => setBody(e.target.value)} rows={3} maxLength={2000} required />}</Field><SelectField label="Attach a workout reference" value={workoutId} onChange={e => setWorkout(e.target.value)} options={[{
          value: '',
          label: 'No shared item'
        }, ...(library.data?.workouts || []).map(w => ({
          value: w.id,
          label: w.title
        }))]} /><Button type="submit" variant="primary" busy={c.busy}>{api.mode === 'http' ? 'Send message' : 'Send local message'}</Button></form><Feedback command={c} /></>}</QueryGate>;
}
export default function Chat() {
  const {api}=useWorkspace(), roster=useResource('getRoster'), open=useCommand(), [peer,setPeer]=useState('');
  const q = useResource('getConversations'),
    [params, setParams] = useSearchParams(),
    activityId = params.get('activity'),
    activityThread = useResource(activityId ? 'getActivityConversation' : 'getMe', activityId ? {
      activityId
    } : {});
  return <QueryGate query={q}>{data => {
      const id = params.get('conversation') || (activityId ? activityThread.data?.id : null) || data.items[0]?.id;
      return <Panel title="Conversation workspace" meta="Membership and session access rechecked for each send">{api.mode === 'http' && <div className="ds-stack"><SelectField label="Start a direct conversation" value={peer} onChange={e=>setPeer(e.target.value)} options={[{value:'',label:'Choose a current relationship'},...(roster.data?.items || []).filter(a=>a.id!==api.getActor()&&a.access!=='none').map(a=>({value:a.id,label:a.name}))]}/><Button disabled={!peer} onClick={()=>open.run(async()=>{const thread=await api.openConversation({kind:'direct',peerId:peer});setParams({conversation:thread.id});},'Conversation opened.')}>Open conversation</Button><Feedback command={open}/></div>}<SelectField label="Conversation" value={id || ''} onChange={e => setParams({
          conversation: e.target.value
        })} options={data.items.map(c => ({
          value: c.id,
          label: `${c.name} · ${c.kind}`
        }))} />{id ? <Messages key={id} conversationId={id} /> : <p>No accessible conversations for this account.</p>}</Panel>;
    }}</QueryGate>;
}
