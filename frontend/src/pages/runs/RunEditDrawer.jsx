import { useEffect, useId, useRef, useState } from 'react';
import { apiJson } from '../../api';
import Modal from '../../components/Modal';
import { useI18n } from '../../contexts/I18nContext';
import { afterSave, changesOf, draftFrom, isDirty, limitsOf, nameProblem, notesProblem, shoeChanged } from '../../utils/runEdit';
import { checkNewTag, unusedSuggestions, withoutTag } from '../../utils/runLabels';
import { formatShoeDisplayName } from '../../utils/shoeNames';
import useRunEdit from './useRunEdit';

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const KNOWN_TYPES = ['RACE', 'LONG_RUN', 'WORKOUT'];

/** The shoes the runner can pick for this run: the ones in use, and the one the run has now even if it is retired or unknown. */
function shoeChoices(shoes, currentId, currentName, lang, t) {
  const choices = (Array.isArray(shoes) ? shoes : [])
    .filter((shoe) => !shoe.retired || String(shoe.id) === String(currentId))
    .map((shoe) => {
      const name = formatShoeDisplayName({ brand: shoe.brand, model: shoe.model, nickname: shoe.nickname, lang }) || t('run_detail.shoe');
      return { id: String(shoe.id), label: shoe.retired ? t('run_edit.shoe_retired', { name }) : name };
    });
  if (currentId != null && !choices.some((choice) => choice.id === String(currentId))) {
    choices.push({ id: String(currentId), label: currentName || t('run_detail.shoe') });
  }
  return choices;
}

/**
 * The form of the edit drawer, for a run whose details have arrived. Everything is a draft until Save: one request holds the
 * fields that changed (title, notes, rating, run type, tags), the shoe has its own, and a refused or failed save leaves the
 * run as it was and the draft as it is. Leaving with unsaved changes asks first.
 */
function RunEditForm({ runId, initial, shoes, provider, currentShoeName, lang, guardRef, onClose, onSaved }) {
  const { t } = useI18n();
  const [base, setBase] = useState(initial);
  const [draft, setDraft] = useState(() => draftFrom(initial));
  const [tagText, setTagText] = useState('');
  const [tagProblem, setTagProblem] = useState(null);
  const [problems, setProblems] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const nameRef = useRef(null);
  const notesRef = useRef(null);
  const tagInputRef = useRef(null);
  const tagsRef = useRef(null);
  const nameId = useId();
  const notesId = useId();
  const ratingName = useId();
  const typeName = useId();
  const useRatingId = useId();
  const useRatingHintId = useId();
  const tagsLabelId = useId();
  const tagInputId = useId();
  const shoeId = useId();

  const limits = limitsOf(base);
  const dirty = isDirty(base, draft);
  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));

  // A pointer that hovers is a desk: start in the title. A phone would raise its keyboard before the runner chose to type.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches) nameRef.current?.focus({ preventScroll: true });
  }, []);

  // Closing from the header, the Escape key or the backdrop comes here first: with something unsaved it asks instead.
  useEffect(() => {
    guardRef.current = () => {
      if (saving) return false;
      if (!dirty) return true;
      setConfirming(true);
      return false;
    };
    return () => {
      guardRef.current = null;
    };
  }, [guardRef, dirty, saving]);

  const typeKeys = base.runTypes.filter((type) => typeof type === 'string');
  const typeLabel = (type) => (KNOWN_TYPES.includes(type) ? t(`run_labels.type_${type}`) : type);
  const choices = shoeChoices(shoes, base.shoeId, currentShoeName, lang, t);
  const suggestions = unusedSuggestions(base.suggestions, draft.tags);

  const nameIssue = problems.name ? t(`run_edit.name_${problems.name}`, { max: limits.maxNameLength }) : '';
  const notesIssue = problems.notes ? t(`run_edit.notes_${problems.notes}`, { max: limits.maxNotesLength }) : '';
  const generalIssue = problems.general ? t(`run_edit.save_${problems.general}`) : '';
  const shoeIssue = problems.shoe ? t('run_edit.shoe_failed') : '';

  function addTag(text, fromInput) {
    if (text.trim() === '') return;
    const check = checkNewTag(text, draft.tags, { maxTags: limits.maxTags, maxTagLength: limits.maxTagLength });
    if (!check.ok) {
      setTagProblem(check.reason);
      return;
    }
    setTagProblem(null);
    set({ tags: [...draft.tags, check.label] });
    if (fromInput) setTagText('');
    // Typing a tag goes on typing; a tapped suggestion has gone, so the keyboard returns to the group, not to the text box
    // (which would raise a touch keyboard).
    (fromInput ? tagInputRef : tagsRef).current?.focus();
  }

  function removeTag(tag) {
    setTagProblem(null);
    set({ tags: withoutTag(draft.tags, tag) });
    tagsRef.current?.focus();
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    const nameFound = nameProblem(draft.name, limits);
    const notesFound = notesProblem(draft.notes, limits);
    if (nameFound || notesFound) {
      setProblems({ name: nameFound, notes: notesFound });
      (nameFound ? nameRef : notesRef).current?.focus();
      return;
    }
    const body = changesOf(base, draft);
    const wantsShoe = shoeChanged(base, draft);
    if (Object.keys(body).length === 0 && !wantsShoe) return;

    setSaving(true);
    setConfirming(false);
    setProblems({});
    setAnnouncement(t('run_edit.saving'));
    let answer = null;
    if (Object.keys(body).length > 0) {
      try {
        answer = await apiJson(`/api/activities/${runId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (error) {
        setProblems({ general: error?.status === 400 ? 'refused' : 'failed' });
        setSaving(false);
        return;
      }
    }
    let saved = afterSave(base, body, answer, base.shoeId);
    const result = { fields: Object.keys(body), shoeChanged: false };
    if (wantsShoe) {
      try {
        const assigned = await apiJson(`/api/shoes/${draft.shoeId ?? 0}/assign/${runId}`, { method: 'PATCH' });
        const chosen = choices.find((choice) => choice.id === String(draft.shoeId));
        saved = { ...saved, shoeId: draft.shoeId ?? null };
        result.shoeChanged = true;
        result.shoeId = draft.shoeId ?? null;
        result.shoeName = draft.shoeId == null ? null : (assigned?.shoeName || chosen?.label || null);
      } catch {
        // Everything else was saved: say so, tell the page about it, and keep the shoe as the one thing left to do.
        setBase(saved);
        setProblems({ shoe: 'failed' });
        setSaving(false);
        onSaved({ ...result, name: saved.name, notes: saved.notes });
        return;
      }
    }
    onSaved({ ...result, name: saved.name, notes: saved.notes });
    onClose();
  }

  const chosenRating = draft.rating;
  const useRatingEnabled = chosenRating != null;

  return (
    <form className="run-edit" onSubmit={save} noValidate aria-busy={saving ? 'true' : undefined}>
      <div className="run-edit__body">
        <div className="run-edit__field">
          <label htmlFor={nameId}>{t('run_edit.name_label')}</label>
          <input
            id={nameId}
            ref={nameRef}
            type="text"
            autoComplete="off"
            maxLength={limits.maxNameLength}
            data-modal-initial-focus
            value={draft.name}
            disabled={saving}
            aria-invalid={nameIssue ? 'true' : undefined}
            aria-describedby={[`${nameId}-count`, provider === 'STRAVA' ? `${nameId}-hint` : null, nameIssue ? `${nameId}-problem` : null].filter(Boolean).join(' ')}
            onChange={(event) => { set({ name: event.target.value }); setProblems((current) => ({ ...current, name: null })); }}
          />
          <p id={`${nameId}-count`} className="run-edit__count">{t('run_edit.count', { count: draft.name.length, max: limits.maxNameLength })}</p>
          {provider === 'STRAVA' ? <p id={`${nameId}-hint`} className="run-edit__hint">{t('run_edit.name_hint_strava')}</p> : null}
          {nameIssue ? <p id={`${nameId}-problem`} className="run-edit__problem" role="alert">{nameIssue}</p> : null}
        </div>

        <div className="run-edit__field">
          <label htmlFor={notesId}>{t('run_edit.notes_label')}</label>
          <textarea
            id={notesId}
            ref={notesRef}
            rows={5}
            maxLength={limits.maxNotesLength}
            value={draft.notes}
            disabled={saving}
            placeholder={t('run_edit.notes_placeholder')}
            aria-invalid={notesIssue ? 'true' : undefined}
            aria-describedby={[`${notesId}-hint`, `${notesId}-count`, notesIssue ? `${notesId}-problem` : null].filter(Boolean).join(' ')}
            onChange={(event) => { set({ notes: event.target.value }); setProblems((current) => ({ ...current, notes: null })); }}
          />
          <p id={`${notesId}-count`} className="run-edit__count">{t('run_edit.count', { count: draft.notes.length, max: limits.maxNotesLength })}</p>
          <p id={`${notesId}-hint`} className="run-edit__hint">{t('run_edit.notes_hint')}</p>
          {notesIssue ? <p id={`${notesId}-problem`} className="run-edit__problem" role="alert">{notesIssue}</p> : null}
        </div>

        <fieldset className="run-edit__group" disabled={saving}>
          <legend>{t('run_edit.rating_legend')}</legend>
          <div className="run-edit__ratings">
            {RATINGS.map((value) => (
              <label key={value} className="run-edit__choice">
                <input
                  type="radio"
                  name={ratingName}
                  value={value}
                  checked={chosenRating === value}
                  aria-label={t('run_edit.rating_option', { value })}
                  onChange={() => set({ rating: value })}
                />
                <span aria-hidden="true">{value}</span>
              </label>
            ))}
          </div>
          <div className="run-edit__scale" aria-hidden="true">
            <span>{t('run_edit.rating_low')}</span>
            <span>{t('run_edit.rating_high')}</span>
          </div>
          <div className="run-edit__foot">
            <p className="run-edit__hint">{chosenRating == null ? t('run_edit.rating_none') : t('run_edit.rating_chosen', { value: chosenRating })}</p>
            {chosenRating != null ? (
              <button type="button" className="run-edit__link" onClick={() => set({ rating: null, useRating: false })}>{t('run_edit.rating_clear')}</button>
            ) : null}
          </div>
          <label className="run-edit__check" htmlFor={useRatingId}>
            <input
              id={useRatingId}
              type="checkbox"
              checked={useRatingEnabled && draft.useRating}
              disabled={!useRatingEnabled}
              aria-describedby={useRatingHintId}
              onChange={(event) => set({ useRating: event.target.checked })}
            />
            <span>{t('run_edit.use_rating_label')}</span>
          </label>
          <p id={useRatingHintId} className="run-edit__hint">{useRatingEnabled ? t('run_edit.use_rating_hint') : t('run_edit.use_rating_needs')}</p>
        </fieldset>

        <fieldset className="run-edit__group" disabled={saving}>
          <legend>{t('run_labels.type_group')}</legend>
          <div className="run-edit__types">
            {['', ...typeKeys].map((type) => (
              <label key={type || 'none'} className="run-edit__choice">
                <input
                  type="radio"
                  name={typeName}
                  value={type}
                  checked={(draft.runType ?? '') === type}
                  onChange={() => set({ runType: type === '' ? null : type })}
                />
                <span>{type === '' ? t('run_labels.type_none') : typeLabel(type)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="run-edit__group" ref={tagsRef} tabIndex={-1} role="group" aria-labelledby={tagsLabelId}>
          <div className="run-edit__tags-head">
            <span id={tagsLabelId} className="run-edit__legend">{t('run_labels.tags_label')}</span>
            <span>{t('run_labels.tag_counter', { count: draft.tags.length, max: limits.maxTags })}</span>
          </div>
          {draft.tags.length > 0 ? (
            <ul className="run-edit__chips" aria-labelledby={tagsLabelId}>
              {draft.tags.map((tag) => (
                <li key={tag} className="run-edit__chip">
                  <span className="run-edit__chip-text" title={tag}>{tag}</span>
                  <button type="button" disabled={saving} aria-label={t('run_labels.tag_remove', { tag })} onClick={() => removeTag(tag)}>
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="run-edit__hint">{t('run_labels.tags_empty')}</p>
          )}
          <div className="run-edit__add">
            <input
              id={tagInputId}
              ref={tagInputRef}
              type="text"
              aria-label={t('run_labels.tag_input')}
              value={tagText}
              autoComplete="off"
              enterKeyHint="done"
              disabled={saving}
              placeholder={t('run_labels.tag_placeholder')}
              aria-invalid={tagProblem ? 'true' : undefined}
              aria-describedby={tagProblem ? `${tagInputId}-problem` : undefined}
              onChange={(event) => { setTagText(event.target.value); setTagProblem(null); }}
              onKeyDown={(event) => {
                // Enter adds the tag; it must not save the whole form.
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  addTag(tagText, true);
                }
              }}
            />
            <button type="button" disabled={saving} aria-label={t('run_labels.tag_add_label')} onClick={() => addTag(tagText, true)}>{t('run_labels.tag_add')}</button>
          </div>
          {tagProblem ? (
            <p id={`${tagInputId}-problem`} className="run-edit__problem" role="alert">
              {t(`run_labels.error_${tagProblem}`, { max: tagProblem === 'too_long' ? limits.maxTagLength : limits.maxTags })}
            </p>
          ) : null}
          {suggestions.length > 0 ? (
            <div className="run-edit__suggest">
              <span>{t('run_labels.suggestions_label')}</span>
              <ul>
                {suggestions.map((suggestion) => (
                  <li key={suggestion.tag}>
                    <button type="button" disabled={saving} title={suggestion.tag} aria-label={t('run_labels.suggestion_add', { tag: suggestion.tag })} onClick={() => addTag(suggestion.tag, false)}>
                      <span aria-hidden="true">+ </span>{suggestion.tag}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="run-edit__field">
          <label htmlFor={shoeId}>{t('run_edit.shoe_label')}</label>
          <select
            id={shoeId}
            value={draft.shoeId == null ? '' : String(draft.shoeId)}
            disabled={saving}
            aria-describedby={shoeIssue ? `${shoeId}-problem` : undefined}
            onChange={(event) => { set({ shoeId: event.target.value === '' ? null : Number(event.target.value) }); setProblems((current) => ({ ...current, shoe: null })); }}
          >
            <option value="">{t('run_edit.shoe_none')}</option>
            {choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
          </select>
          {shoeIssue ? <p id={`${shoeId}-problem`} className="run-edit__problem" role="alert">{shoeIssue}</p> : null}
        </div>
      </div>

      <div className="run-edit__footer">
        {generalIssue ? <p className="run-edit__problem" role="alert">{generalIssue}</p> : null}
        {confirming ? (
          <div className="run-edit__confirm" role="alertdialog" aria-labelledby={`${nameId}-unsaved`}>
            <p id={`${nameId}-unsaved`}>{t('run_edit.unsaved')}</p>
            <div className="run-edit__actions">
              <button type="button" className="run-edit__cancel" onClick={() => setConfirming(false)}>{t('run_edit.keep')}</button>
              <button type="button" className="run-edit__discard" onClick={onClose}>{t('run_edit.discard')}</button>
            </div>
          </div>
        ) : (
          <div className="run-edit__actions">
            <button type="button" className="run-edit__cancel" disabled={saving} onClick={() => guardRef.current?.() !== false && onClose()}>{t('run_edit.cancel')}</button>
            <button type="submit" className="run-edit__save" disabled={saving || !dirty}>{saving ? t('run_edit.saving') : t('run_edit.save')}</button>
          </div>
        )}
        <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      </div>
    </form>
  );
}

/**
 * The full edit panel of a run (a drawer from the right on a wide screen, the whole screen on a phone): the title, the notes,
 * how the run felt and whether that stands in for the heart rate, the run type, the tags and the shoes, saved together. Opening it
 * asks the server for the run's details; the details of the quick cards on the page (type and tags, rating) are the same data.
 *
 * `onSaved` is told what was saved so the page can follow; `onClose` closes the drawer.
 */
export default function RunEditDrawer({ runId, provider, shoes, currentShoeName, lang, onClose, onSaved }) {
  const { t } = useI18n();
  const { status, data, reload } = useRunEdit(runId);
  const guardRef = useRef(null);

  function requestClose() {
    if (guardRef.current && guardRef.current() === false) return;
    onClose();
  }

  let body;
  if (data) {
    body = (
      <RunEditForm
        key={data.id}
        runId={runId}
        initial={data}
        shoes={shoes}
        provider={provider}
        currentShoeName={currentShoeName}
        lang={lang}
        guardRef={guardRef}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  } else if (status === 'error') {
    body = (
      <div className="run-edit__state">
        <p className="run-edit__problem" role="alert">{t('run_edit.load_error')}</p>
        <div className="run-edit__actions">
          <button type="button" className="run-edit__cancel" onClick={onClose}>{t('run_edit.cancel')}</button>
          <button type="button" className="run-edit__save" onClick={reload}>{t('run_edit.retry')}</button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="run-edit__state" aria-busy="true">
        <p className="run-edit__hint" role="status">{t('run_edit.loading')}</p>
        <div className="run-edit__skeleton" aria-hidden="true">
          <span className="page-skeleton__block" />
          <span className="page-skeleton__block" />
          <span className="page-skeleton__block is-short" />
        </div>
      </div>
    );
  }

  return (
    <Modal
      isOpen
      onClose={requestClose}
      title={t('run_edit.title')}
      closeLabel={t('run_edit.close')}
      portalToBody
      shellClassName="run-edit-v2-shell"
      cardClassName="run-edit-v2-card"
    >
      {body}
    </Modal>
  );
}
