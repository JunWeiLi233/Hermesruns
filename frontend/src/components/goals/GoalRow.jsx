import { useMemo } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import { barWidth, formatAmount } from '../../utils/goals';

/** The words and numbers of a goal in the runner's language and unit. */
export function useGoalWords() {
  const { t, formatNumber } = useI18n();
  const { unit } = useUnit();
  return useMemo(() => ({
    unit,
    title: (goal) => t(`goals.title_${goal.period}_${goal.metric}`),
    amount: (metric, value) => formatAmount(metric, value, { unit, t, formatNumber }),
    days: (count) => (count === 1 ? t('goals.days_one') : t('goals.days_many', { count: formatNumber(count) })),
  }), [t, formatNumber, unit]);
}

const STATUSES = ['reached', 'early', 'ahead', 'on_track', 'behind'];

/** What the runner should read under the bar: the pace so far, in the numbers it comes from, and what is left. */
function Working({ goal, words }) {
  const { t } = useI18n();
  const lines = [];
  if (goal.status === 'early') {
    lines.push(t('goals.working_early', { period: t(`goals.period_word_${goal.period}`) }));
  } else if (goal.status !== 'reached') {
    lines.push(t('goals.working', { expected: words.amount(goal.metric, goal.expectedByNow), done: words.amount(goal.metric, goal.doneByNow) }));
  }
  if (!goal.reached) {
    const remaining = words.amount(goal.metric, goal.remaining);
    if (goal.metric === 'COUNT') {
      lines.push(goal.daysLeft === 1 ? t('goals.to_go_total_one_day', { remaining }) : t('goals.to_go_total', { remaining, days: words.days(goal.daysLeft) }));
    } else {
      lines.push(goal.daysLeft === 1
        ? t('goals.to_go_one_day', { remaining })
        : t('goals.to_go', { remaining, days: words.days(goal.daysLeft), perDay: words.amount(goal.metric, goal.neededPerDay) }));
    }
  }
  return lines.map((line) => <p key={line} className="goals-v2__working">{line}</p>);
}

/**
 * One goal: its name, how far along it is as a bar and in words, and (with `detail`) the working: where an even pace would be,
 * what is left and how the period before went. `thisRun` is what a run on screen adds to it. `actions` is whatever the card
 * puts at the foot of the row.
 */
export default function GoalRow({ goal, detail = true, headingLevel = 3, actions = null }) {
  const { t, formatNumber } = useI18n();
  const words = useGoalWords();
  const Heading = `h${headingLevel}`;
  const title = words.title(goal);
  const progress = words.amount(goal.metric, goal.progress);
  const target = words.amount(goal.metric, goal.target);
  const percent = `${formatNumber(goal.percent)}%`;
  const status = STATUSES.includes(goal.status) ? goal.status : 'early';
  const previous = goal.previous;

  return (
    <li className={`goals-v2__goal is-${status}`}>
      <div className="goals-v2__goal-head">
        <Heading>{title}</Heading>
        <span className={`goals-v2__status is-${status}`}>{t(`goals.status_${status}`)}</span>
      </div>
      <div
        className="goals-v2__bar"
        role="progressbar"
        aria-label={t('goals.progress_label', { title, progress, target })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, goal.percent)}
        aria-valuetext={`${progress} / ${target}, ${percent}`}
      >
        <i style={{ width: `${barWidth(goal)}%` }} />
      </div>
      <p className="goals-v2__numbers">
        <span>{t('goals.progress_text', { progress, target, when: t(`goals.in_${goal.period}`) })}</span>
        <strong>{percent}</strong>
      </p>
      {detail ? <Working goal={goal} words={words} /> : null}
      {detail && previous && previous.progress > 0 ? (
        <p className="goals-v2__previous">
          {t('goals.previous', {
            when: t(`goals.last_${goal.period}`),
            progress: words.amount(goal.metric, previous.progress),
            target,
            result: t(previous.reached ? 'goals.previous_reached' : 'goals.previous_missed'),
          })}
        </p>
      ) : null}
      {goal.thisRun != null ? <p className="goals-v2__run">{t('goals.this_run', { amount: words.amount(goal.metric, goal.thisRun) })}</p> : null}
      {actions}
    </li>
  );
}
