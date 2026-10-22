import { useState } from 'react';
import { useI18n } from '../../../contexts/I18nContext';
import { Link, useSearchParams } from '../ui/router.jsx';
import { useResource, useWorkspace, useCommand } from '../ui/workspace.jsx';
import { Badge, Button, Feedback, Field, Panel, QueryGate, SelectField } from '../ui/components.jsx';
import AppIcon from '../../../components/AppIcon';
import { TeamAvatar, TeamFeedback } from './TeamUi';
import TeamConversation from './TeamConversation';
export function Messages({
  conversationId
}) {
  const { t, lang } = useI18n();
  const copy = key => t(`training_integration.teamMessages.${key}`);
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
  return <QueryGate query={q}>{data => <><ol className="tw-card-list" aria-label={copy('history')}>{data.items.map(m => <li className="tw-card" key={m.id}><strong>{m.senderName}</strong><time dateTime={m.at}>{new Date(m.at).toLocaleString(lang)}</time><p>{m.body}</p>{m.workoutId && <Badge>{m.sharedWorkout ? <Link to={`/workout?id=${m.sharedWorkout.id}`}>{m.sharedWorkout.title} · v{m.sharedWorkout.version}</Link> : copy('sharedUnavailable')}</Badge>}</li>)}</ol>{!data.items.length && <p className="tw-muted">{copy('empty')}</p>}<form onSubmit={e => {
        e.preventDefault();
        c.run(async () => {
          await api.sendMessage({
            conversationId,
            body,
            workoutId: workoutId || undefined
          });
          setBody('');
        }, copy('saved'));
      }}><Field label={copy('body')}>{p => <textarea {...p} value={body} onChange={e => setBody(e.target.value)} rows={3} maxLength={2000} required />}</Field><SelectField label={copy('attachment')} value={workoutId} onChange={e => setWorkout(e.target.value)} options={[{
          value: '',
          label: copy('noAttachment')
        }, ...(library.data?.workouts || []).map(w => ({
          value: w.id,
          label: w.title
        }))]} /><Button type="submit" variant="primary" busy={c.busy}>{copy(api.mode === 'http' ? 'send' : 'sendLocal')}</Button></form><Feedback command={c} /></>}</QueryGate>;
}
export default function Chat({ activityId: sessionActivityId } = {}) {
  const { t } = useI18n();
  const copy = key => t(`training_integration.teamMessages.${key}`);
  const {api}=useWorkspace(), roster=useResource('getRoster'), open=useCommand(), [peer,setPeer]=useState('');
  const [newOpen, setNewOpen] = useState(false);
  const q = useResource('getConversations'),
    [params, setParams] = useSearchParams(),
    activityId = sessionActivityId || params.get('activity'),
    activityThread = useResource(activityId ? 'getActivityConversation' : 'getMe', activityId ? {
      activityId
    } : {});
  function selectConversation(conversationId) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('conversation', conversationId);
      return next;
    });
  }
  if (sessionActivityId) return <QueryGate query={activityThread}>{thread => <Panel title={copy('title')} meta={copy('intro')}><Messages key={thread.id} conversationId={thread.id} /></Panel>}</QueryGate>;
  return <QueryGate query={q}>{data => {
      const id = params.get('conversation') || (activityId ? activityThread.data?.id : null) || data.items[0]?.id;
      const selected = data.items.find(conversation => conversation.id === id);
      return <section className="team-chat team-card" aria-label={copy('title')}>
        <aside className="team-conversation-rail">
          <header><h2>{copy('title')}</h2>{api.mode === 'http' && <button className="team-button team-new-conversation" type="button" aria-label={copy('new')} aria-expanded={newOpen} onClick={() => setNewOpen(!newOpen)}><AppIcon name="add" aria-hidden="true" /></button>}</header>
          {newOpen && <form className="team-new-conversation-form" onSubmit={event => {
            event.preventDefault();
            if (!peer || open.busy) return;
            open.run(async () => { const thread = await api.openConversation({ kind: 'direct', peerId: peer }); selectConversation(thread.id); setNewOpen(false); setPeer(''); }, copy('opened'));
          }}><SelectField label={copy('start')} value={peer} onChange={event => setPeer(event.target.value)} options={[{ value: '', label: copy('choose') }, ...(roster.data?.items || []).filter(athlete => athlete.id !== api.getActor() && athlete.access !== 'none').map(athlete => ({ value: athlete.id, label: athlete.name }))]} /><button className="team-button team-button-ink" type="submit" disabled={!peer || open.busy}>{copy('open')}</button><TeamFeedback command={open} /></form>}
          <nav className="team-conversation-list" aria-label={copy('conversation')}>{data.items.map(conversation => <button type="button" key={conversation.id} aria-pressed={id === conversation.id} onClick={() => selectConversation(conversation.id)}><TeamAvatar name={conversation.name} club={conversation.kind === 'group'} /><span><strong>{conversation.name}</strong><small>{copy(`kind_${conversation.kind}`)}</small></span></button>)}</nav>
        </aside>
        <div className="team-chat-workspace"><header className="team-thread-heading"><h3>{selected?.name || copy('title')}</h3><p>{selected ? copy(`kind_${selected.kind}`) : copy('intro')}</p></header>{id ? <TeamConversation key={id} conversationId={id} /> : <p className="team-thread-empty">{copy('noConversations')}</p>}</div>
      </section>;
    }}</QueryGate>;
}
