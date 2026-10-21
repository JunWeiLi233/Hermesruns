import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { formatDistance, formatPace } from '../utils/format';
import { localizedReason } from '../utils/personalizedCoachPlan';
import './recommendation-evidence.css';

/** A display of server evidence. This component never calculates a prescription. */
export default function RecommendationEvidence({ payload, weekStart, workout }) {
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const plan = payload?.plan;
  const history = plan?.historyEvidence;
  const week = weekStart ? plan?.weeklyBudgets?.find(w => w.start === weekStart) : plan?.weeklyBudgets?.[0];
  const recovery = plan?.recoveryEvidence;
  if (!history || !week) return null;
  const copy = (key, values) => t(`recommendation_evidence.${key}`, values);
  const number = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '—';
  const distance = (value, digits = 1) => Number.isFinite(value) ? formatDistance(value, digits, lang, unit) : '—';
  const preciseDistance = value => distance(value, 3).replace(/(\.\d*?)0+(\s)/, '$1$2').replace(/\.(\s)/, '.0$1');
  const session = workout || payload?.today;
  const available = recovery?.availability || {};
  const readings = recovery?.readings || {};
  const result = recovery?.result;
  const rows = [
    { key: 'sleep', raw: readings.sleepScore, score: result?.sleepScore, weight: recovery?.sleepWeight },
    { key: 'hrv', raw: readings.hrvMs == null ? readings.hrvStatus : `${readings.hrvMs} ms${readings.hrvStatus ? ` · ${readings.hrvStatus}` : ''}`, score: result?.hrvScore, weight: recovery?.hrvWeight },
    { key: 'restingHeartRate', raw: readings.restingHeartRate, score: result?.rhrScore, weight: recovery?.restingHrWeight },
    { key: 'stress', raw: readings.stressScore, score: result?.stressScore, weight: recovery?.stressWeight },
    { key: 'trainingLoad', raw: result?.loadScore, score: result?.loadScore, weight: recovery?.trainingLoadWeight },
  ];
  const used = rows.filter(row => available[row.key] && Number.isFinite(row.score) && Number.isFinite(row.weight));
  const confidence = used.reduce((sum, row) => sum + row.weight, 0);
  const neutralPercent = Math.max(0, Math.round((1 - confidence) * 100));
  const formula = used.map(row => `${row.score} × ${Math.round(row.weight * 100)}%`);
  if (neutralPercent > 0 && Number.isFinite(recovery?.neutralScore)) formula.push(`${recovery.neutralScore} × ${neutralPercent}%`);
  const source = key => key === 'trainingLoad' ? copy('run_history') : recovery?.sources?.[key] || '—';
  const exhausted = week.remainingAllowanceKm <= 0;
  const budget = Math.max(0, Number.isFinite(week.budgetKm) ? week.budgetKm : 0);
  const completed = Math.max(0, Number.isFinite(week.completedKm) ? week.completedKm : 0);
  const overBudget = Math.max(0, completed - budget);
  const scale = Math.max(budget, completed) * 1.08 || 1;
  const progressStyle = {
    '--budget-position': `${budget / scale * 100}%`,
    '--completed-width': `${Math.min(completed, budget) / scale * 100}%`,
    '--overflow-width': `${overBudget / scale * 100}%`,
  };
  const steps = [
    { key: 'baseline', label: copy('weekly_baseline'), expression: `${distance(history.volume28Km)} ÷ 4`, result: preciseDistance(history.averageWeeklyKm) },
    { key: 'ratio', label: copy('distance_load_ratio'), expression: copy('ratio_expression', { volume: distance(history.volume7Km), baseline: preciseDistance(history.averageWeeklyKm), threshold: number(history.highLoadThreshold, 2) }), result: number(history.distanceLoadRatio, 2), warning: history.distanceLoadRatio > history.highLoadThreshold },
    { key: 'budget', label: copy('calculated_budget'), expression: copy('budget_expression', { baseline: preciseDistance(history.averageWeeklyKm), percent: number(history.weeklyMultiplier * 100, 0), raw: distance(history.averageWeeklyKm * history.weeklyMultiplier, 2) }), result: distance(week.budgetKm) },
    { key: 'remaining', label: copy('remaining'), expression: `max(0, ${distance(week.budgetKm)} − ${preciseDistance(week.completedKm)})`, result: distance(week.remainingAllowanceKm) },
    { key: 'projected', label: copy('projected_total'), expression: `${distance(week.completedKm)} + ${distance(week.scheduledRemainingKm)}`, result: distance(week.projectedTotalKm) },
  ];

  return (
    <section className="recommendation-evidence" aria-label={copy('title')}>
      <header className="recommendation-evidence__header">
        <div>
          <h3>{copy('title')}</h3>
          <p className="recommendation-evidence__date">{week.start} – {week.end} · {plan.timeZone}</p>
        </div>
        <span className={`recommendation-evidence__status${exhausted ? ' recommendation-evidence__status--exhausted' : ''}`}>
          <span aria-hidden="true" />{copy(exhausted ? 'budget_used' : 'within_budget')}
        </span>
      </header>
      <div className="recommendation-evidence__overview">
        <div className="recommendation-evidence__progress" style={progressStyle}>
          <div className="recommendation-evidence__total">
            <strong data-testid="recommendation-completed" aria-label={`${copy('completed')}: ${distance(week.completedKm)}`}>{distance(week.completedKm)}</strong>
            <span>{copy('of_budget', { budget: distance(week.budgetKm) })}</span>
          </div>
          <div className="recommendation-evidence__track" role="img" aria-label={copy('budget_progress', { completed: distance(week.completedKm), budget: distance(week.budgetKm), over: distance(overBudget) })}>
            <span className="recommendation-evidence__fill" />
            {overBudget > 0 && <span className="recommendation-evidence__overflow" />}
            <span className="recommendation-evidence__marker" />
          </div>
          <div className="recommendation-evidence__ticks" aria-hidden="true"><span>0</span><strong>{distance(week.budgetKm)}</strong></div>
        </div>
        <dl className="recommendation-evidence__budget">
          <div><dt>{copy('weekly_budget')}</dt><dd data-testid="recommendation-budget">{distance(week.budgetKm)}</dd></div>
          <div><dt>{copy(overBudget > 0 ? 'over_budget' : 'still_scheduled')}</dt><dd className={overBudget > 0 ? 'recommendation-evidence__warning' : undefined}>{distance(overBudget > 0 ? overBudget : week.scheduledRemainingKm)}</dd></div>
          <div><dt>{copy('remaining')}</dt><dd data-testid="recommendation-remaining" className={exhausted ? 'recommendation-evidence__empty' : undefined}>{distance(week.remainingAllowanceKm)}</dd></div>
        </dl>
      </div>
      <p className="recommendation-evidence__message">{exhausted ? copy('exhausted') : copy('allocated', { distance: distance(week.scheduledRemainingKm) })}</p>
      <details className="recommendation-evidence__calculation" open>
        <summary>{copy('calculation')}<span className="recommendation-evidence__toggle" aria-hidden="true" /></summary>
        <ol className="recommendation-evidence__steps">
          {steps.map((step, index) => <li key={step.key}>
            <span className="recommendation-evidence__step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <div className="recommendation-evidence__step-copy"><span>{step.label}</span><span>{step.expression}</span></div>
            <strong className={step.warning ? 'recommendation-evidence__warning' : undefined}>{step.result}</strong>
          </li>)}
        </ol>
        <p className="recommendation-evidence__rules">{copy('rules', { minimum: distance(history.minimumWeeklyKm), cap: distance(history.averageWeeklyKm * history.maximumGrowthMultiplier) })}</p>
        {plan.reasonCodes?.includes('manual_ease') && <p>{copy('manual_ease')}</p>}
      </details>
      <details className="recommendation-evidence__supporting">
        <summary>{copy('supporting_evidence')}<span className="recommendation-evidence__toggle" aria-hidden="true" /></summary>
        <div className="recommendation-evidence__details">
          {session && <p><strong>{session.scheduledDate}</strong> · {localizedReason(session.reasonCode, t, { sessionNeutral: true })}
            {session.originalDistanceKm != null && <span> · {copy('session_adjustment', { before: distance(session.originalDistanceKm), after: distance(session.plannedDistanceKm ?? 0) })}</span>}
          </p>}
          <p>{copy('as_of', { date: history.asOfDate })}</p>
          <dl className="recommendation-evidence__inputs">
            <div><dt>{copy('last28', { from: history.from28, to: history.asOfDate })}</dt><dd>{distance(history.volume28Km)}</dd></div>
            <div><dt>{copy('last7', { from: history.from7, to: history.asOfDate })}</dt><dd>{distance(history.volume7Km)}</dd></div>
            <div><dt>{copy('frequency')}</dt><dd>{history.runDays28} / 28</dd></div>
            <div><dt>{copy('average_run')}</dt><dd>{distance(history.averageRunKm)}</dd></div>
            <div><dt>{copy('longest_run')}</dt><dd>{distance(history.longestRunKm28)}</dd></div>
            <div><dt>{copy('average_pace')}</dt><dd>{history.averagePaceSecondsPerKm > 0 ? formatPace(1, history.averagePaceSecondsPerKm * (unit === 'mile' ? 1.609344 : 1), lang).replace('/km', unit === 'mile' ? '/mi' : '/km') : '—'}</dd></div>
            <div><dt>{copy('intensity')}</dt><dd>{history.highIntensityRatio7d == null ? copy('not_recorded') : `${number(history.highIntensityRatio7d * 100)}%`}</dd></div>
            <div><dt>{copy('hard_spacing')}</dt><dd>{history.hoursSinceHardRun == null ? '—' : copy('hours', { hours: history.hoursSinceHardRun })}</dd></div>
            <div><dt>{copy('injury')}</dt><dd>{history.injuryRisk ? copy(`risk_${history.injuryRisk.toLowerCase()}`) : copy('not_recorded')}</dd></div>
          </dl>
          {history.dailyDistances?.length > 0 && <details><summary>{copy('history_rows')}</summary>
            <div className="recommendation-evidence__table"><table><thead><tr><th>{copy('date')}</th><th>{copy('recorded_distance')}</th></tr></thead><tbody>
              {history.dailyDistances.map(day => <tr key={day.date}><td>{day.date}</td><td>{distance(day.km, 3)}</td></tr>)}
            </tbody></table></div>
          </details>}
          {recovery && <>
            <h4>{copy('recovery_title', { date: recovery.date })}</h4>
            <p>{copy('readiness', { score: result?.score ?? '—', confidence: result?.confidence ?? 0 })}</p>
            {!available.sleep && !available.hrv && !available.restingHeartRate && !available.stress && <p>{copy('history_only')}</p>}
            <div className="recommendation-evidence__table"><table><thead><tr><th>{copy('input')}</th><th>{copy('reading')}</th><th>{copy('score')}</th><th>{copy('weight')}</th><th>{copy('source')}</th></tr></thead><tbody>
              {rows.map(row => <tr key={row.key}><th scope="row">{copy(row.key)}</th>
                <td>{available[row.key] ? row.raw ?? '—' : copy('not_recorded')}</td>
                <td>{available[row.key] ? row.score ?? '—' : '—'}</td><td>{Number.isFinite(row.weight) ? `${Math.round(row.weight * 100)}%` : '—'}</td>
                <td>{available[row.key] ? source(row.key) : '—'}</td></tr>)}
            </tbody></table></div>
            {formula.length > 0 && <p>{formula.join(' + ')} = {result?.score}</p>}
            {recovery.trainingLoad && <p>{copy('load_inputs', { ratio: number(recovery.trainingLoad.ewmaLoadRatio, 3), monotony: number(recovery.trainingLoad.weeklyMonotony, 3), hours: recovery.trainingLoad.hoursSinceHardAtEndOfDay ?? '—' })}</p>}
            {recovery.trainingLoad?.baseScore != null && <p>{copy('load_formula', { base: recovery.trainingLoad.baseScore, ratio: recovery.trainingLoad.ratioAdjustment, monotony: recovery.trainingLoad.monotonyAdjustment, spacing: recovery.trainingLoad.spacingAdjustment, score: recovery.trainingLoad.score })}</p>}
            <p className="recommendation-evidence__muted">{copy('different_ratios')}</p>
          </>}
        </div>
      </details>
    </section>
  );
}
