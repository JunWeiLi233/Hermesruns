import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { memoryError, memoryPayload } from './entertainmentExpansionModel';

export default function PrivateMemories({ rows, text, disabled, onSave, onDelete, commit }) {
  const [draft, setDraft] = useState(null);
  const [remove, setRemove] = useState(null);
  const [validation, setValidation] = useState(null);
  const heading = useRef(null);
  const titleInput = useRef(null);
  const confirm = useRef(null);
  const id = useId();
  const editing = Boolean(draft);
  const editingId = draft?.id;
  const latest = draft?.id ? rows.find(row => row.id === draft.id) : null;
  const conflict = draft?.id && (!latest || latest.version !== draft.version);
  useLayoutEffect(() => {
    if (commit?.scope === 'memory') {
      if (commit.outcome === 'removed') {
        setDraft(current => current ? { ...current, id: commit.result.id, removed: true } : null);
        setRemove(null);
      } else { setDraft(null); setRemove(null); setValidation(null); heading.current?.focus(); }
    }
  }, [commit]);
  useEffect(() => { if (editing) titleInput.current?.focus(); }, [editing, editingId]);
  useEffect(() => { if (remove) confirm.current?.focus(); }, [remove]);
  function edit(row) {
    setDraft(row ? { ...row, date: row.date || '' } : { id: null, title: '', body: '', date: '' });
    setRemove(null); setValidation(null);
  }
  return <div>
    <h3 ref={heading} tabIndex={-1}>{text('memories_title')}</h3><p>{text('memories_intro')}</p>
    <p className="entertainment-note">{text('draft_limit')}</p>
    <button type="button" disabled={disabled || Boolean(draft)} onClick={() => edit(null)}>{text('memory_new')}</button>
    {draft && <form className="entertainment-editor" onSubmit={async event => {
      event.preventDefault(); const error = memoryError(draft); setValidation(error);
      if (!error && !conflict && !draft.removed) await onSave(draft.id, memoryPayload(draft), draft.version);
    }}>
      <h4>{text('memory_draft')}</h4>
      <label htmlFor={`${id}-title`}>{text('memory_title')}</label><input ref={titleInput} id={`${id}-title`} value={draft.title} disabled={disabled} aria-invalid={validation === 'title'} onChange={event => setDraft({ ...draft, title: event.target.value })} />
      <p>{text('memory_title_count', { count: [...draft.title].length })}</p>
      <label htmlFor={`${id}-body`}>{text('memory_body')}</label><textarea id={`${id}-body`} rows={5} value={draft.body} disabled={disabled} aria-invalid={validation === 'body'} onChange={event => setDraft({ ...draft, body: event.target.value })} />
      <p>{text('memory_body_count', { count: [...draft.body].length })}</p>
      <label htmlFor={`${id}-date`}>{text('memory_date')}</label><input id={`${id}-date`} type="date" value={draft.date} disabled={disabled} aria-invalid={validation === 'date'} onChange={event => setDraft({ ...draft, date: event.target.value })} />
      <p>{text('literal_date')}</p>
      {validation && <p role="alert">{text(`invalid_${validation}`)}</p>}
      {conflict && <div className="entertainment-conflict" role="status"><p>{text(latest ? 'memory_conflict' : 'memory_removed')}</p>
        {latest && <><h4>{latest.title}</h4><p className="entertainment-memory-body">{latest.body}</p><p>{latest.date}</p>
          <button type="button" disabled={disabled} onClick={() => setDraft({ ...draft, version: latest.version })}>{text('memory_rebase')}</button></>}
      </div>}
      <div className="entertainment-actions"><button type="submit" disabled={disabled || Boolean(conflict) || draft.removed}>{text('memory_save')}</button>
        {draft.removed && <button type="button" disabled={disabled} onClick={() => titleInput.current?.focus()}>{text('memory_keep_draft')}</button>}
        <button type="button" disabled={disabled} onClick={() => { setDraft(null); setValidation(null); heading.current?.focus(); }}>{text('memory_cancel')}</button></div>
    </form>}
    {rows.length === 0 && <p>{text('memories_empty')}</p>}
    <ul className="entertainment-memory-list">{rows.map(row => <li key={row.id}><article>
      <h4>{row.title}</h4><p className="entertainment-memory-body">{row.body}</p>
      {row.date && <p><time dateTime={row.date}>{row.date}</time></p>}
      <p className="entertainment-note">{text('memory_saved')}</p>
      <div className="entertainment-actions"><button type="button" disabled={disabled || Boolean(draft)} onClick={() => edit(row)}>{text('memory_edit')}</button>
        <button type="button" disabled={disabled || Boolean(draft)} onClick={() => setRemove(row)}>{text('memory_delete')}</button></div>
      {remove?.id === row.id && <fieldset><legend>{text('memory_delete_question', { title: row.title })}</legend>
        <div className="entertainment-actions"><button ref={confirm} type="button" disabled={disabled} onClick={() => onDelete(row)}>{text('memory_delete_confirm')}</button>
          <button type="button" disabled={disabled} onClick={() => { setRemove(null); heading.current?.focus(); }}>{text('keep')}</button></div>
      </fieldset>}
    </article></li>)}</ul>
  </div>;
}
