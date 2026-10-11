import { useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../../contexts/I18nContext';
import {
  DEFAULT_MAX_TAGS,
  DEFAULT_MAX_TAG_LENGTH,
  checkNewTag,
  unusedSuggestions,
} from '../../utils/runLabels';
import useRunLabelEditor from './useRunLabelEditor';
import useRunLabels from './useRunLabels';

const KNOWN_TYPES = ['RACE', 'LONG_RUN', 'WORKOUT'];

/**
 * What kind of run it was, and the runner's own words on it. Both are labels for the runner's use (the training log
 * filters by them and the fitness chart flags races); nothing is computed from them. Each change is saved at once and
 * shown before the server answers (see useRunLabelEditor); if a save fails the earlier labels come back and the card says so.
 */
export default function RunLabelsCard({ runId }) {
  const { t } = useI18n();
  const { status, data, reload } = useRunLabels(runId);
  const { labels: current, saving, failed, announcement, setType, addTag: queueTag, removeTag: queueRemoval } = useRunLabelEditor(runId, data);
  const titleId = useId();
  const inputId = useId();
  const hintId = useId();
  const suggestId = useId();
  const tagsId = useId();
  const inputRef = useRef(null);
  const cardRef = useRef(null);
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState(null);

  const maxTags = data?.maxTags ?? DEFAULT_MAX_TAGS;
  const maxTagLength = data?.maxTagLength ?? DEFAULT_MAX_TAG_LENGTH;
  const typeKeys = data ? data.runTypes.filter((type) => typeof type === 'string') : KNOWN_TYPES;
  const typeName = (type) => (KNOWN_TYPES.includes(type) ? t(`run_labels.type_${type}`) : type);

  function chooseType(value) {
    const next = value === '' ? null : value;
    if (!current || next === current.runType) return;
    setType(next, next == null ? t('run_labels.saved_type_cleared') : t('run_labels.saved_type', { type: typeName(next) }));
  }

  function addTag(text, fromInput) {
    if (!current || text.trim() === '') return;
    const check = checkNewTag(text, current.tags, { maxTags, maxTagLength });
    if (!check.ok) {
      setProblem(check.reason);
      return;
    }
    setProblem(null);
    queueTag(check.label, t('run_labels.saved_tag_added', { tag: check.label }));
    if (fromInput) setDraft('');
    // Typing a tag goes on typing; a tapped suggestion has gone, so the keyboard returns to the card, not to the text box
    // (which would raise a touch keyboard).
    (fromInput ? inputRef : cardRef).current?.focus();
  }

  function removeTag(tag) {
    if (!current) return;
    setProblem(null);
    queueRemoval(tag, t('run_labels.saved_tag_removed', { tag }));
    // The button that was pressed is gone; keep the keyboard on the card.
    cardRef.current?.focus();
  }

  const header = (
    <div className="run-detail-v2__card-head">
      <h3 id={titleId}>{t('run_labels.title')}</h3>
    </div>
  );

  let body;
  if (current) {
    const suggestions = unusedSuggestions(data.suggestions, current.tags);
    const problemText = problem
      ? t(`run_labels.error_${problem}`, { max: problem === 'too_long' ? maxTagLength : maxTags })
      : '';
    body = (
      <>
        <fieldset className="run-labels__group" aria-busy={saving ? 'true' : undefined}>
          <legend>{t('run_labels.type_group')}</legend>
          <div className="run-labels__types">
            {['', ...typeKeys].map((type) => (
              <label key={type || 'none'} className="run-labels__type">
                <input
                  type="radio"
                  name={`${titleId}-type`}
                  value={type}
                  checked={(current.runType ?? '') === type}
                  onChange={() => chooseType(type)}
                />
                <span>{type === '' ? t('run_labels.type_none') : typeName(type)}</span>
              </label>
            ))}
          </div>
          <p className="run-detail-v2__muted">{t('run_labels.type_hint')}</p>
        </fieldset>

        <div className="run-labels__group">
          <div className="run-labels__tags-head">
            <span id={tagsId} className="run-labels__label">{t('run_labels.tags_label')}</span>
            <span id={hintId}>{t('run_labels.tag_counter', { count: current.tags.length, max: maxTags })}</span>
          </div>

          {current.tags.length > 0 ? (
            <ul className="run-labels__chips" aria-labelledby={tagsId}>
              {current.tags.map((tag) => (
                <li key={tag} className="run-labels__chip">
                  <span className="run-labels__chip-text" title={tag}>{tag}</span>
                  <button type="button" aria-label={t('run_labels.tag_remove', { tag })} onClick={() => removeTag(tag)}>
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="run-detail-v2__muted">{t('run_labels.tags_empty')}</p>
          )}

          <form
            className="run-labels__add"
            onSubmit={(event) => {
              event.preventDefault();
              addTag(draft, true);
            }}
          >
            <input
              id={inputId}
              ref={inputRef}
              type="text"
              aria-label={t('run_labels.tag_input')}
              value={draft}
              autoComplete="off"
              enterKeyHint="done"
              placeholder={t('run_labels.tag_placeholder')}
              aria-describedby={problem ? `${hintId} ${inputId}-problem` : hintId}
              aria-invalid={problem ? 'true' : undefined}
              onChange={(event) => {
                setDraft(event.target.value);
                setProblem(null);
              }}
            />
            <button type="submit" aria-label={t('run_labels.tag_add_label')}>{t('run_labels.tag_add')}</button>
          </form>
          {problem ? <p id={`${inputId}-problem`} className="run-detail-v2__muted is-error" role="alert">{problemText}</p> : null}

          {suggestions.length > 0 ? (
            <div className="run-labels__suggest">
              <span id={suggestId}>{t('run_labels.suggestions_label')}</span>
              <ul aria-labelledby={suggestId}>
                {suggestions.map((suggestion) => (
                  <li key={suggestion.tag}>
                    <button type="button" title={suggestion.tag} aria-label={t('run_labels.suggestion_add', { tag: suggestion.tag })} onClick={() => addTag(suggestion.tag, false)}>
                      <span aria-hidden="true">+ </span>{suggestion.tag}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {failed ? <p className="run-detail-v2__muted is-error" role="alert">{t('run_labels.save_failed')}</p> : null}
        <p className="run-detail-v2__muted run-labels__foot">
          <Link className="run-detail-v2__link" to="/training-log">{t('run_labels.log_link')}</Link>
        </p>
        <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      </>
    );
  } else if (status === 'error') {
    body = (
      <div className="run-labels__state">
        <p className="run-detail-v2__muted is-error" role="alert">{t('run_labels.load_error')}</p>
        <button type="button" className="run-detail-v2__link" onClick={reload}>{t('run_labels.retry')}</button>
      </div>
    );
  } else {
    body = (
      <div className="run-labels__skeleton" aria-hidden="true">
        <span className="page-skeleton__block" />
        <span className="page-skeleton__block" />
        <span className="page-skeleton__block is-short" />
      </div>
    );
  }

  return (
    <section
      ref={cardRef}
      tabIndex={-1}
      className="run-detail-v2__card run-labels"
      aria-labelledby={titleId}
      aria-busy={status === 'loading' || status === 'refreshing' ? 'true' : undefined}
    >
      {header}
      {!current && status !== 'error' ? <p className="sr-only" role="status">{t('run_labels.loading')}</p> : null}
      {body}
    </section>
  );
}
