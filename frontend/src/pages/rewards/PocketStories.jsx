import { useEffect, useRef, useState } from 'react';
import { apiJson } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import './pocket-stories.css';

const CHAPTERS = ['lantern', 'seed-library', 'last-ferry'];
const ENDPOINT = '/api/stories/me';
function checkedState(data) {
  if (!data || !['invitation', 'open', 'hidden'].includes(data.mode)
    || !['shelf', 'reading', 'ending'].includes(data.currentPanel)
    || !Array.isArray(data.chapters) || data.chapters.length !== CHAPTERS.length
    || !CHAPTERS.every(id => data.chapters.some(chapter => chapter.chapterId === id
      && ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(chapter.status)))) {
    throw new Error('Invalid pocket story response');
  }
  return data;
}

// Remount on every session/account transition, including a same-route switch.
export default function PocketStories({ timeZone = 'UTC' }) {
  const { isAuthenticated, token, email } = useAuth();
  return isAuthenticated ? <StorySession key={`${token}:${email}`} timeZone={timeZone || 'UTC'} /> : null;
}

function StorySession({ timeZone }) {
  const { t, lang } = useI18n();
  const [state, setState] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [draft, setDraft] = useState(null);
  const [pending, setPending] = useState(null);
  const heading = useRef(null);
  const active = useRef(true);
  const busy = useRef(false);
  const controller = useRef(null);
  const focusRequested = useRef(false);
  const text = (key, params) => t(`stories.${key}`, params);
  const current = state?.chapters.find(chapter => chapter.chapterId === state.currentChapterId);
  const branch = draft ?? current?.branch;
  const earnedCount = state?.chapters.filter(chapter => chapter.completedAt).length || 0;

  useEffect(() => {
    active.current = true;
    const request = new AbortController();
    controller.current = request;
    apiJson(ENDPOINT, { signal: request.signal }).then(checkedState).then(data => {
      if (active.current && !request.signal.aborted) { setState(data); setPhase('ready'); }
    }).catch(() => {
      if (active.current && !request.signal.aborted) setPhase('load-error');
    });
    return () => { active.current = false; controller.current?.abort(); };
  }, []);

  useEffect(() => {
    if (focusRequested.current) { heading.current?.focus(); focusRequested.current = false; }
  }, [state]);

  async function save(request) {
    if (busy.current) return;
    busy.current = true;
    controller.current = new AbortController();
    setPhase('saving'); setPending(request);
    try {
      const data = checkedState(await apiJson(request.url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body), signal: controller.current.signal,
      }));
      if (!active.current) return;
      focusRequested.current = request.body.action !== 'choose';
      setState(data); setDraft(null); setPending(null); setPhase('saved');
    } catch {
      if (active.current) setPhase('save-error');
    } finally { busy.current = false; }
  }
  async function loadSaved() {
    if (busy.current) return;
    busy.current = true; setPhase('loading');
    controller.current = new AbortController();
    try {
      const data = checkedState(await apiJson(ENDPOINT, { signal: controller.current.signal }));
      if (!active.current) return;
      const row = data.chapters.find(chapter => chapter.chapterId === pending?.chapterId);
      const action = pending?.body.action;
      const actionSaved = action === 'complete'
        ? Boolean(row?.completedAt) && data.currentPanel === 'ending'
        : Boolean(row?.startedAt) && data.currentPanel === 'reading'
          && (action === 'start' || action === 'choose' || (action === 'replay' && row.branch === null));
      const reconciled = !pending || (pending.body.mode
        ? data.mode === pending.body.mode && (!pending.body.shelf || data.currentPanel === 'shelf')
        : data.currentChapterId === pending.chapterId
          && (!pending.body.branch || row?.branch === pending.body.branch)
          && actionSaved);
      setState(data);
      if (reconciled) {
        focusRequested.current = true;
        setDraft(null); setPending(null); setPhase('saved');
      } else setPhase('save-error');
    } catch { if (active.current) setPhase(state ? 'save-error' : 'load-error'); }
    finally { busy.current = false; }
  }
  const preference = (mode, shelf = false) => save({ url: `${ENDPOINT}/preferences`, body: { mode, shelf } });
  const chapterAction = (chapterId, action, selectedBranch) => save({
    url: `${ENDPOINT}/chapters/${chapterId}`, chapterId, body: { action, ...(selectedBranch ? { branch: selectedBranch } : {}) },
  });
  const disabled = phase === 'saving' || phase === 'loading';
  const status = <div className="pocket-stories-status" aria-live="polite" aria-atomic="true">
    {phase === 'loading' && <p>{text('loading')}</p>}
    {phase === 'saving' && <p>{text('saving')}</p>}
    {phase === 'saved' && <p>{text('saved')}</p>}
    {phase === 'save-error' && <div role="alert">
      <p>{text('save_failed')}</p>
      <div className="pocket-stories-actions">
        {pending && <button type="button" onClick={() => save(pending)}>{text('retry_save')}</button>}
        <button type="button" onClick={loadSaved}>{text('check_saved')}</button>
      </div>
    </div>}
  </div>;

  if (!state) return <section className="pocket-stories" aria-label={text('title')}>
    {phase === 'load-error' ? <div role="alert"><p>{text('load_failed')}</p><button type="button" onClick={loadSaved}>{text('retry')}</button></div>
      : <p role="status">{text('loading')}</p>}
  </section>;

  if (state.mode === 'hidden') return <section className="pocket-stories pocket-stories--hidden" aria-label={text('title')}>
    <p>{text('hidden')}</p>
    <button type="button" ref={heading} disabled={disabled} onClick={() => preference('open')}>{text('restore')}</button>
    {status}
  </section>;

  return <section className="pocket-stories" aria-labelledby="pocket-stories-title">
    <header className="pocket-stories-header">
      <div><h2 id="pocket-stories-title" ref={state.mode !== 'open' || state.currentPanel === 'shelf' ? heading : undefined} tabIndex={-1}>{text('title')}</h2>
        <p>{text(state.mode === 'open' ? 'intro' : 'invitation')}</p></div>
      <button type="button" disabled={disabled} onClick={() => preference('hidden')}>{text('hide')}</button>
    </header>
    {state.mode === 'invitation' ? <button type="button" disabled={disabled} onClick={() => preference('open')}>{text('open')}</button> : <>
      <p className="pocket-stories-length">{text('length')}</p>
      {current && state.currentPanel !== 'shelf' && <article className="pocket-stories-reader" aria-labelledby="pocket-story-chapter">
        <h3 id="pocket-story-chapter" ref={state.currentPanel === 'reading' ? heading : undefined} tabIndex={-1}>{text(`${current.chapterId}_title`)}</h3>
        {state.currentPanel === 'ending' ? <>
          <h4 tabIndex={-1} ref={heading}>{text('ending')}</h4>
          <p>{text(`${current.chapterId}_${current.branch}_ending`)}</p>
          <p>{text('postcard_saved')}</p>
          <div className="pocket-stories-actions">
            {CHAPTERS.indexOf(current.chapterId) < CHAPTERS.length - 1 && <button type="button" disabled={disabled} onClick={() => chapterAction(CHAPTERS[CHAPTERS.indexOf(current.chapterId) + 1], 'start')}>{text('next')}</button>}
            <button type="button" disabled={disabled} onClick={() => chapterAction(current.chapterId, 'replay')}>{text('replay')}</button>
            <button type="button" disabled={disabled} onClick={() => preference('open', true)}>{text('exit')}</button>
          </div>
        </> : <>
          <p>{text(`${current.chapterId}_body`)}</p>
          <fieldset disabled={disabled}>
            <legend>{text('choose')}</legend>
            {['left', 'right'].map(option => <label key={option} className={branch === option ? 'is-chosen' : ''}>
              <input type="radio" name={`pocket-story-${current.chapterId}`} value={option} checked={branch === option} onChange={() => {
                setDraft(option); chapterAction(current.chapterId, 'choose', option);
              }} />{text(`${current.chapterId}_${option}`)}
            </label>)}
          </fieldset>
          {branch && <p className="pocket-stories-choice-state">{text(draft ? 'draft' : 'saved_choice')}</p>}
          <div className="pocket-stories-actions">
            <button type="button" disabled={disabled || !branch || draft !== null || phase === 'save-error'} onClick={() => chapterAction(current.chapterId, 'complete', branch)}>{text('complete')}</button>
            <button type="button" disabled={disabled || draft !== null || phase === 'save-error'} onClick={() => preference('open', true)}>{text('exit')}</button>
          </div>
        </>}
      </article>}
      {earnedCount === CHAPTERS.length && <p className="pocket-stories-done">{text('all_done')}</p>}
      <ol className="pocket-stories-shelf">
        {state.chapters.map(chapter => <li key={chapter.chapterId}>
          <h3>{text(`${chapter.chapterId}_title`)}</h3>
          <p>{text(chapter.status.toLowerCase())}</p>
          <button type="button" disabled={disabled || draft !== null || phase === 'save-error'} onClick={() => chapterAction(chapter.chapterId, chapter.completedAt ? 'replay' : 'start')}>
            {text(chapter.completedAt ? 'replay' : chapter.startedAt ? 'continue' : 'start')}
          </button>
        </li>)}
      </ol>
      <section className="pocket-stories-album" aria-labelledby="pocket-stories-album-title">
        <h3 id="pocket-stories-album-title">{text('album')}</h3><p>{text('album_count', { earned: earnedCount })}</p>
        <ul>
          {state.chapters.map(chapter => <li className={chapter.postcardId ? 'is-earned' : ''} key={chapter.chapterId} data-story-postcard={chapter.postcardId || `available-${chapter.chapterId}`}>
            <span className="pocket-stories-stamp" aria-hidden="true">{CHAPTERS.indexOf(chapter.chapterId) + 1}</span>
            <h4>{text(`${chapter.chapterId}_card`)}</h4><p>{text(`${chapter.chapterId}_alt`)}</p>
            {chapter.postcardId ? <><p>{text('source')}</p><p><time dateTime={chapter.earnedAt}>{text('earned', { date: new Intl.DateTimeFormat(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { timeZone, year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(chapter.earnedAt)) })}</time></p></>
              : <p>{text('available')}</p>}
            <p>{text('unlock', { title: text(`${chapter.chapterId}_title`) })}</p>
          </li>)}
        </ul>
      </section>
      <p className="pocket-stories-integrity">{text('no_activity')}</p>
    </>}
    {status}
  </section>;
}
