import { useId, useRef, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { sortGoals } from '../../utils/goals';
import GoalFormModal from './GoalFormModal';
import GoalRow, { useGoalWords } from './GoalRow';
import useGoals from './useGoals';

function Skeleton() {
  return (
    <div className="goals-v2__skeleton" aria-hidden="true">
      <span className="page-skeleton__block" />
      <span className="page-skeleton__block" />
      <span className="page-skeleton__block is-short" />
    </div>
  );
}

/**
 * The runner's goals: how far along each is, and the way to set one, change its target or delete it. It asks for its goals
 * itself (and, with `defer`, only when the browser is idle, so a page's first paint does not wait for it). Deleting asks
 * once, in the row; changing and setting use a dialog.
 */
export default function GoalsCard({ defer = false, headingLevel = 2 }) {
  const { t } = useI18n();
  const words = useGoalWords();
  const { status, data, reload, create, changeTarget, remove } = useGoals({ defer });
  const titleId = useId();
  const addRef = useRef(null);
  const [dialog, setDialog] = useState(null);       // null, { mode: 'add' } or { mode: 'edit', goal }
  const [confirming, setConfirming] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [problem, setProblem] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const Heading = `h${headingLevel}`;

  const goals = data ? sortGoals(data.goals) : [];

  async function submit({ period, metric, target }) {
    const result = dialog?.mode === 'edit' ? await changeTarget(dialog.goal.id, target) : await create(period, metric, target);
    if (result.ok) {
      setProblem('');
      setAnnouncement(t('goals.saved'));
    }
    return result;
  }

  async function confirmDelete(goal) {
    setDeleting(goal.id);
    setProblem('');
    const result = await remove(goal.id);
    setDeleting(null);
    setConfirming(null);
    if (result.ok) {
      setAnnouncement(t('goals.deleted'));
      addRef.current?.focus();
    } else {
      setProblem(t('goals.delete_failed'));
    }
  }

  let body;
  if (data) {
    body = goals.length === 0 ? (
      <div className="goals-v2__empty">
        <p className="goals-v2__empty-title">{t('goals.empty_title')}</p>
        <p>{t('goals.empty_body')}</p>
      </div>
    ) : (
      <ul className="goals-v2__list" aria-label={t('goals.list_label')}>
        {goals.map((goal) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            headingLevel={headingLevel + 1}
            actions={confirming === goal.id ? (
              <div className="goals-v2__actions" role="group" aria-label={t('goals.delete_confirm')}>
                <span>{t('goals.delete_confirm')}</span>
                <button type="button" className="goals-v2__danger" disabled={deleting === goal.id} onClick={() => confirmDelete(goal)}>{t('goals.delete_yes')}</button>
                <button type="button" className="goals-v2__link" disabled={deleting === goal.id} onClick={() => setConfirming(null)}>{t('goals.delete_keep')}</button>
              </div>
            ) : (
              <div className="goals-v2__actions">
                <button type="button" className="goals-v2__link" aria-label={t('goals.edit_label', { title: words.title(goal) })} onClick={() => setDialog({ mode: 'edit', goal })}>{t('goals.edit')}</button>
                <button type="button" className="goals-v2__link is-quiet" aria-label={t('goals.delete_label', { title: words.title(goal) })} onClick={() => { setProblem(''); setConfirming(goal.id); }}>{t('goals.delete')}</button>
              </div>
            )}
          />
        ))}
      </ul>
    );
  } else if (status === 'error') {
    body = (
      <div className="goals-v2__state">
        <p className="goals-v2__error" role="alert">{t('goals.error')}</p>
        <button type="button" className="goals-v2__link" onClick={reload}>{t('goals.retry')}</button>
      </div>
    );
  } else {
    body = (
      <>
        <p className="sr-only" role="status">{t('goals.loading')}</p>
        <Skeleton />
      </>
    );
  }

  return (
    <section className="goals-v2 goals-v2__card" aria-labelledby={titleId} aria-busy={status === 'loading' ? 'true' : undefined}>
      <div className="goals-v2__head">
        <div>
          <Heading id={titleId}>{t('goals.title')}</Heading>
          <p>{t('goals.subtitle')}</p>
        </div>
        {data ? <button ref={addRef} type="button" className="goals-v2__add" onClick={() => setDialog({ mode: 'add' })}>{t('goals.add')}</button> : null}
      </div>
      {body}
      {problem ? <p className="goals-v2__error" role="alert">{problem}</p> : null}
      {data && goals.length > 0 ? <p className="goals-v2__basis">{t('goals.basis')}</p> : null}
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>

      {dialog ? (
        <GoalFormModal
          mode={dialog.mode}
          goal={dialog.goal ?? null}
          goals={data?.goals ?? []}
          maxTarget={data?.maxTarget}
          onClose={() => setDialog(null)}
          onSubmit={submit}
        />
      ) : null}
    </section>
  );
}
