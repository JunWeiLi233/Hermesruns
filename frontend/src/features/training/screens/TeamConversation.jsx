import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../contexts/I18nContext';
import AppIcon from '../../../components/AppIcon';
import { Paperclip } from 'lucide-react';
import { Link } from '../ui/router';
import { useCommand, useResource, useWorkspace } from '../ui/workspace';
import { QueryGate } from '../ui/components';
import { TeamFeedback } from './TeamUi';

export default function TeamConversation({ conversationId }) {
  const { t, lang } = useI18n();
  const copy = key => t(`training_integration.teamMessages.${key}`);
  const { api, actor } = useWorkspace();
  const query = useResource('getMessages', { conversationId });
  const library = useResource('getLibrary');
  const command = useCommand();
  const [body, setBody] = useState('');
  const [workoutId, setWorkout] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const history = useRef(null);
  const lastMessage = query.data?.items.at(-1)?.id;
  useEffect(() => {
    if (history.current) history.current.scrollTop = history.current.scrollHeight;
  }, [lastMessage]);
  return <>
    <div className="team-chat-history" ref={history}><QueryGate query={query}>{data => data.items.length ? <ol aria-label={copy('history')}>{data.items.map(message => <li key={message.id} className={message.senderId && message.senderId === actor ? 'is-own' : ''}>
      <div className="team-message-meta"><strong>{message.senderName}</strong><time dateTime={message.at}>{new Date(message.at).toLocaleString(lang)}</time></div>
      <p className="team-message-bubble">{message.body}</p>
      {message.workoutId && (message.sharedWorkout ? <Link className="team-shared-workout" to={`/workout?id=${encodeURIComponent(message.sharedWorkout.id)}`}><AppIcon name="fitness_center" aria-hidden="true" /><span><strong>{message.sharedWorkout.title}</strong><small>{copy('sharedWorkout')} · v{message.sharedWorkout.version}</small></span></Link> : <span className="team-consent-required">{copy('sharedUnavailable')}</span>)}
    </li>)}</ol> : <p className="team-thread-empty">{copy('empty')}</p>}</QueryGate></div>
    <form className="team-message-composer" onSubmit={event => {
      event.preventDefault();
      if (!body.trim() || command.busy) return;
      command.run(async () => { await api.sendMessage({ conversationId, body: body.trim(), workoutId: workoutId || undefined }); setBody(''); setWorkout(''); setAttachOpen(false); }, copy('saved'));
    }}>
      {(attachOpen || workoutId) && <label className="team-field team-workout-picker"><span>{copy('attachment')}</span><select value={workoutId} onChange={event => setWorkout(event.target.value)}><option value="">{copy('noAttachment')}</option>{(library.data?.workouts || []).map(workout => <option key={workout.id} value={workout.id}>{workout.title}</option>)}</select></label>}
      <div className="team-message-compose-row"><button className="team-button team-attach-button" type="button" aria-label={copy('attachment')} aria-expanded={attachOpen} onClick={() => setAttachOpen(!attachOpen)}><Paperclip aria-hidden="true" /></button><label className="team-message-input"><span className="team-sr-only">{copy('body')}</span><textarea value={body} onChange={event => setBody(event.target.value)} rows={1} maxLength={2000} placeholder={copy('placeholder')} required /></label><button className="team-button team-button-accent" type="submit" disabled={!body.trim() || command.busy || query.loading || !!query.error}>{copy('sendShort')}</button></div>
      <TeamFeedback command={command} />
    </form>
  </>;
}
