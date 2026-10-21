import { useI18n } from '../../contexts/I18nContext';
import { useGoalWords } from './GoalRow';
import RecommendationEvidence from '../RecommendationEvidence';

/** How many suggestions the card shows at once. */
export const SHOWN = 3;

/** The working behind a suggestion, in words: the usual figure it comes from and what was added to it. */
function useBasisText() {
  const { t } = useI18n();
  const words = useGoalWords();
  return (suggestion) => {
    const { kind, span, usual, stretchPercent } = suggestion.basis || {};
    const usualText = words.amount(suggestion.metric, usual);
    const key = {
      'coach-plan': span > 0 ? 'goals.suggest_basis_plan' : 'goals.suggest_basis_plan_only',
      'weekly-average': stretchPercent > 0 ? 'goals.suggest_basis_weekly' : 'goals.suggest_basis_weekly_same',
      'monthly-average': 'goals.suggest_basis_monthly',
      'yearly-total': 'goals.suggest_basis_yearly',
    }[kind];
    return key ? t(key, { span, usual: usualText, percent: stretchPercent }) : '';
  };
}

/**
 * Goals worth setting for a runner who has none of them yet: a name and a target, the working behind it, and the two things to do
 * with it, set it as it is or open the dialog with it filled in. A runner without enough recent running is told what it takes.
 */
export default function GoalSuggestions({ enough, suggestions, busyKey, onSet, onAdjust, headingLevel = 3, recommendation }) {
  const { t } = useI18n();
  const words = useGoalWords();
  const basisText = useBasisText();
  const Heading = `h${headingLevel}`;
  const shown = suggestions.slice(0, SHOWN);

  if (!enough) {
    return <p className="goals-v2__suggest-note">{t('goals.suggest_need_history')}</p>;
  }
  if (shown.length === 0) return recommendation?.plan?.historyEvidence ? <>
    {recommendation.plan.weeklyBudgets?.[0]?.remainingAllowanceKm === 0 && <p>{t('recommendation_evidence.exhausted_goals')}</p>}
    <RecommendationEvidence payload={recommendation} />
  </> : null;

  return (
    <section className="goals-v2__suggest" aria-label={t('goals.suggest_title')}>
      <Heading className="goals-v2__suggest-title">{t('goals.suggest_title')}</Heading>
      <p className="goals-v2__suggest-hint">{t('goals.suggest_hint')}</p>
      <RecommendationEvidence payload={recommendation} />
      <ul className="goals-v2__suggest-list">
        {shown.map((suggestion) => {
          const key = `${suggestion.period}/${suggestion.metric}`;
          const title = words.title(suggestion);
          const target = words.amount(suggestion.metric, suggestion.target);
          return (
            <li key={key} className="goals-v2__suggestion">
              <div className="goals-v2__suggestion-copy">
                <strong>{t('goals.suggest_line', { title, target })}</strong>
                <span>{basisText(suggestion)}</span>
              </div>
              <div className="goals-v2__actions">
                <button
                  type="button"
                  className="goals-v2__link"
                  disabled={busyKey === key}
                  aria-label={t('goals.suggest_set_label', { title, target })}
                  onClick={() => onSet(suggestion)}
                >
                  {t('goals.suggest_set')}
                </button>
                <button
                  type="button"
                  className="goals-v2__link is-quiet"
                  disabled={busyKey === key}
                  aria-label={t('goals.suggest_adjust_label', { title })}
                  onClick={() => onAdjust(suggestion)}
                >
                  {t('goals.suggest_adjust')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
