import { useId } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../../contexts/I18nContext';
import { sortGoals } from '../../utils/goals';
import GoalRow from './GoalRow';
import useGoals from './useGoals';

/**
 * What one run does for the runner's goals: each goal's bar, and what this run adds to it when it is in the period being
 * judged now. Read only: setting and changing goals is on the Profile and Training log pages, one link away.
 */
export default function RunGoalsCard({ runId }) {
  const { t } = useI18n();
  const { status, data, reload } = useGoals({ runId });
  const titleId = useId();
  const goals = data ? sortGoals(data.goals) : [];

  let body;
  if (data) {
    body = goals.length === 0 ? (
      <p className="goals-v2__quiet">{t('goals.empty_body')}</p>
    ) : (
      <ul className="goals-v2__list is-compact" aria-label={t('goals.list_label')}>
        {goals.map((goal) => <GoalRow key={goal.id} goal={goal} detail={false} headingLevel={4} />)}
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
        <div className="goals-v2__skeleton" aria-hidden="true">
          <span className="page-skeleton__block" />
          <span className="page-skeleton__block is-short" />
        </div>
      </>
    );
  }

  return (
    <section className="goals-v2 run-detail-v2__card run-goals" aria-labelledby={titleId} aria-busy={status === 'loading' ? 'true' : undefined}>
      <div className="run-detail-v2__card-head">
        <h3 id={titleId}>{t('goals.title')}</h3>
      </div>
      {body}
      <p className="goals-v2__foot">
        <Link className="run-detail-v2__link" to="/training-log">{goals.length === 0 && data ? t('goals.add') : t('goals.manage')}</Link>
      </p>
    </section>
  );
}
