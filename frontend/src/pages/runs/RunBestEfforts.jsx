import { useEffect, useId, useRef, useState } from 'react';
import { apiJson } from '../../api';
import { invalidateResourceCache } from '../../api/resourceCache';
import { distanceName, placeName, placeTone } from '../../components/bestEffortLabels';
import { useI18n } from '../../contexts/I18nContext';
import { effortTimeForEditing, formatEffortTime, isPlausibleEffortTime, parseEffortTime } from '../../utils/bestEfforts';
import { formatDuration, formatPaceSeconds } from '../../utils/format';
import useRunBestEfforts from './useRunBestEfforts';

/**
 * One row of the table: the distance, the time that counts (and what was measured when the runner typed another), the
 * pace, the place among the runner's efforts at that distance, and what the runner can do about it.
 */
function EffortRow({ effort, editing, draft, busy, problem, onDraft, onEdit, onCancel, onSave, onRestore, onHide, registerEditButton }) {
  const { t } = useI18n();
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef(null);
  const label = distanceName(t, effort.distanceKey);
  // This effort is being saved, and one change at a time is allowed, so while any is on its way no row can start another.
  const working = busy === effort.distanceKey;
  const locked = busy != null;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const classes = ['run-detail-v2__be-row'];
  if (effort.hidden) classes.push('is-hidden');
  if (editing) classes.push('is-editing');

  return (
    <tr className={classes.join(' ')} role="row" aria-busy={working ? 'true' : undefined}>
      <th scope="row" role="rowheader" className="run-detail-v2__be-distance">
        <strong>{label}</strong>
        {effort.startOffsetSeconds != null ? (
          <small>{t('best_efforts.starts_at', { time: formatDuration(effort.startOffsetSeconds) })}</small>
        ) : null}
      </th>

      <td role="cell" className="run-detail-v2__be-time">
        {editing ? (
          <form
            className="run-detail-v2__be-edit"
            onSubmit={(event) => {
              event.preventDefault();
              onSave(effort);
            }}
          >
            <label htmlFor={inputId} className="sr-only">{t('best_efforts.edit_label', { distance: label })}</label>
            <input
              id={inputId}
              ref={inputRef}
              className="run-detail-v2__be-input"
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck="false"
              placeholder={t('best_efforts.edit_placeholder')}
              value={draft}
              aria-describedby={hintId}
              aria-invalid={problem ? 'true' : undefined}
              onChange={(event) => onDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  onCancel(effort);
                }
              }}
            />
            <button type="submit" className="run-detail-v2__btn run-detail-v2__be-save" aria-disabled={locked ? 'true' : undefined}>
              {working ? t('best_efforts.saving') : t('best_efforts.save')}
            </button>
            <button type="button" className="run-detail-v2__link" aria-disabled={working ? 'true' : undefined} onClick={() => onCancel(effort)}>
              {t('best_efforts.cancel')}
            </button>
            <span id={hintId} className="run-detail-v2__muted run-detail-v2__be-hint">{t('best_efforts.edit_hint')}</span>
          </form>
        ) : (
          <>
            <strong>{formatEffortTime(effort.effectiveSeconds)}</strong>
            {effort.edited ? (
              <span className="run-detail-v2__be-tag">{t('best_efforts.tag_edited')}</span>
            ) : null}
            {effort.estimated ? <span className="run-detail-v2__be-tag is-estimated">{t('best_efforts.tag_estimated')}</span> : null}
            {effort.edited ? (
              <small className="run-detail-v2__be-measured">{t('best_efforts.measured', { time: formatEffortTime(effort.elapsedSeconds) })}</small>
            ) : null}
          </>
        )}
        {problem ? <p className="run-detail-v2__muted is-error run-detail-v2__be-problem" role="alert">{problem}</p> : null}
      </td>

      <td role="cell" className="run-detail-v2__be-pace">
        {effort.paceSecPerKm != null ? `${formatPaceSeconds(effort.paceSecPerKm)} ${t('run_detail.unit_pace')}` : '–'}
      </td>

      <td role="cell" className="run-detail-v2__be-place">
        {effort.hidden || effort.rank == null ? (
          <span className="run-detail-v2__be-pill is-hidden">{t('best_efforts.hidden')}</span>
        ) : (
          <span className={`run-detail-v2__be-pill ${placeTone(effort.rank)}`}>{placeName(t, effort.rank)}</span>
        )}
      </td>

      <td role="cell" className="run-detail-v2__be-actions">
        {editing ? null : (
          <>
            <button
              type="button"
              className="run-detail-v2__link"
              ref={(node) => registerEditButton(effort.distanceKey, node)}
              aria-disabled={locked ? 'true' : undefined}
              aria-label={t('best_efforts.edit_aria', { distance: label })}
              onClick={() => onEdit(effort)}
            >
              {t('best_efforts.edit')}
            </button>
            {effort.edited ? (
              <button
                type="button"
                className="run-detail-v2__link"
                aria-disabled={locked ? 'true' : undefined}
                aria-label={t('best_efforts.restore_aria', { distance: label })}
                onClick={() => onRestore(effort)}
              >
                {t('best_efforts.restore')}
              </button>
            ) : null}
            <button
              type="button"
              className="run-detail-v2__link"
              aria-disabled={locked ? 'true' : undefined}
              aria-label={t(effort.hidden ? 'best_efforts.show_aria' : 'best_efforts.hide_aria', { distance: label })}
              onClick={() => onHide(effort)}
            >
              {t(effort.hidden ? 'best_efforts.show' : 'best_efforts.hide')}
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

/**
 * The best efforts of one run (S08): the fastest stretch it holds of each standard distance, and the place of each among
 * all the runner's efforts at that distance. A runner can type a chip time over a measured one, and hide an effort that
 * should not count. It fetches once the run page has the run's stream (`streamReady`), so the section is on the page,
 * with its anchor for the run navigation, in every state.
 */
export default function RunBestEfforts({ runId, streamReady }) {
  const { t } = useI18n();
  const titleId = useId();
  const { status, data, stale, reload } = useRunBestEfforts(runId, { enabled: streamReady });
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const editButtons = useRef({});
  const returnFocusTo = useRef(null);

  useEffect(() => {
    if (!editing && returnFocusTo.current) {
      editButtons.current[returnFocusTo.current]?.focus();
      returnFocusTo.current = null;
    }
  }, [editing]);

  function closeEditor(key) {
    returnFocusTo.current = key;
    setEditing(null);
  }

  function startEditing(effort) {
    if (busy) return;
    setProblem(null);
    setDraft(effortTimeForEditing(effort.effectiveSeconds));
    setEditing(effort.distanceKey);
  }

  async function change(effort, body, done) {
    if (busy) return false;
    setBusy(effort.distanceKey);
    setProblem(null);
    setAnnouncement('');
    try {
      await apiJson(`/api/activities/${runId}/best-efforts/${encodeURIComponent(effort.distanceKey)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      // The records on the Profile page are made of these efforts.
      invalidateResourceCache('/api/profile/dashboard');
      setAnnouncement(done);
      reload();
      return true;
    } catch (error) {
      setProblem({ key: effort.distanceKey, message: error?.status === 400 ? t('best_efforts.edit_refused') : t('best_efforts.edit_failed') });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function save(effort) {
    const seconds = parseEffortTime(draft);
    if (seconds == null) {
      setProblem({ key: effort.distanceKey, message: t('best_efforts.edit_format') });
      return;
    }
    if (!isPlausibleEffortTime(seconds, effort.distanceMeters)) {
      setProblem({ key: effort.distanceKey, message: t('best_efforts.edit_implausible') });
      return;
    }
    if (await change(effort, { elapsedSeconds: seconds }, t('best_efforts.saved'))) closeEditor(effort.distanceKey);
  }

  let body;
  if (data) {
    const efforts = data.efforts;
    body = (
      <>
        {stale ? (
          <p className="run-detail-v2__muted is-error" role="status">
            {t('run_detail.numbers_stale')}{' '}
            <button type="button" className="run-detail-v2__link" onClick={reload}>{t('best_efforts.retry')}</button>
          </p>
        ) : null}
        {efforts.length > 0 ? (
          <>
            <p className="run-detail-v2__muted">{t('best_efforts.intro')}</p>
            <div className="run-detail-v2__be-scroll">
              <table className="run-detail-v2__be-table" role="table">
                <thead role="rowgroup">
                  <tr role="row">
                    <th scope="col" role="columnheader">{t('best_efforts.col_distance')}</th>
                    <th scope="col" role="columnheader">{t('best_efforts.col_time')}</th>
                    <th scope="col" role="columnheader">{t('best_efforts.col_pace')}</th>
                    <th scope="col" role="columnheader">{t('best_efforts.col_place')}</th>
                    <th scope="col" role="columnheader"><span className="sr-only">{t('best_efforts.col_actions')}</span></th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {efforts.map((effort) => (
                    <EffortRow
                      key={effort.distanceKey}
                      effort={effort}
                      editing={editing === effort.distanceKey}
                      draft={draft}
                      busy={busy}
                      problem={problem?.key === effort.distanceKey ? problem.message : null}
                      onDraft={setDraft}
                      onEdit={startEditing}
                      onCancel={(row) => {
                        // A save that is on its way cannot be called back, so the editor stays until it has answered.
                        if (busy === row.distanceKey) return;
                        setProblem(null);
                        closeEditor(row.distanceKey);
                      }}
                      onSave={save}
                      onRestore={(row) => change(row, { elapsedSeconds: null }, t('best_efforts.restored'))}
                      onHide={(row) => change(row, { hidden: !row.hidden }, t(row.hidden ? 'best_efforts.shown' : 'best_efforts.hidden_done'))}
                      registerEditButton={(key, node) => {
                        if (node) editButtons.current[key] = node;
                        else delete editButtons.current[key];
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {efforts.some((effort) => effort.estimated) ? <p className="run-detail-v2__muted">{t('best_efforts.estimated_note')}</p> : null}
            {!data.complete ? <p className="run-detail-v2__muted" role="status">{t('best_efforts.incomplete')}</p> : null}
          </>
        ) : (
          <>
            <p className="run-detail-v2__muted">{t('best_efforts.empty')}</p>
            {!data.complete ? <p className="run-detail-v2__muted" role="status">{t('best_efforts.incomplete')}</p> : null}
          </>
        )}
        <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      </>
    );
  } else if (status === 'error') {
    body = (
      <div className="run-detail-v2__training-state">
        <p className="run-detail-v2__muted" role="alert">{t('best_efforts.error')}</p>
        <button type="button" className="run-detail-v2__btn" onClick={reload}>{t('best_efforts.retry')}</button>
      </div>
    );
  } else {
    body = <p className="run-detail-v2__muted" role="status">{t('best_efforts.loading')}</p>;
  }

  return (
    <section
      id="run-detail-efforts"
      className="run-detail-v2__card run-detail-v2__best-efforts"
      aria-labelledby={titleId}
      aria-busy={status === 'loading' || status === 'refreshing' ? 'true' : undefined}
    >
      <div className="run-detail-v2__card-head">
        <h2 id={titleId}>{t('best_efforts.title')}</h2>
      </div>
      {body}
    </section>
  );
}
