import { useId, useState } from 'react';
import { formatDistance, formatDistanceValue } from '../../utils/format';
import { prettifyWorkoutType } from '../../utils/coach/presentation';

export default function WeeklyLoadCard({ bars, plannedDistanceKm, lang, unit, t }) {
  const titleId = useId();
  const detailId = useId();
  const [activeIndex, setActiveIndex] = useState(null);
  const activeBar = bars.find((bar) => bar.index === activeIndex);
  const today = bars.find((bar) => bar.isToday);
  const actual = bars.reduce((total, bar) => total + bar.actual, 0);
  const hasWeeklyTarget = Number.isFinite(plannedDistanceKm) && plannedDistanceKm >= 0;
  const planned = bars.reduce((total, bar) => total + (bar.projectedKnown ? bar.projected : 0), 0);
  const planKnown = bars.some((bar) => bar.projectedKnown);
  const completeWeek = bars.every((bar) => bar.projectedKnown);
  const target = hasWeeklyTarget ? plannedDistanceKm : planned;
  const progress = target > 0 ? Math.min(100, actual / target * 100) : 0;
  const maximum = Math.max(1, ...bars.map((bar) => Math.max(bar.actual, bar.projected))) * 1.12;
  const distance = (value) => formatDistance(value, 1, lang, unit);
  const originalDistance = (bar) => Number.isFinite(bar.originalProjected) && bar.originalProjected >= 0
    ? bar.originalProjected : bar.projected;
  const beforeAdjustments = bars.reduce((total, bar) => total + (bar.projectedKnown ? originalDistance(bar) : 0), 0);
  const adjustment = planned - beforeAdjustments;
  const remainingAllowance = Math.max(0, plannedDistanceKm - actual);
  const displayedTenths = (value) => Math.round(Number(formatDistanceValue(value, unit, 1)) * 10);
  const sumRelation = bars.filter(bar => bar.projectedKnown).reduce((total, bar) => total + displayedTenths(bar.projected), 0)
    === displayedTenths(planned) ? '=' : '≈';
  const adjustmentRelation = displayedTenths(beforeAdjustments) + Math.sign(adjustment) * displayedTenths(Math.abs(adjustment))
    === displayedTenths(planned) ? '=' : '≈';
  const allowanceRelation = Math.max(0, displayedTenths(plannedDistanceKm) - displayedTenths(actual))
    === displayedTenths(remainingAllowance) ? '=' : '≈';
  const budgetRemovedRun = bars.some(bar => bar.reasonCode === 'weekly_budget_exhausted' && originalDistance(bar) > bar.projected);
  const plannedLabel = (bar) => bar.projectedKnown ? distance(bar.projected) : '—';
  const todayDetail = today?.projectedKnown
    ? today.projected > 0
      ? t('profile.dashboard_redesign.weekly_today_plan', { distance: distance(today.projected) })
      : t('profile.dashboard_redesign.weekly_today_rest')
    : t('profile.dashboard_redesign.weekly_today_unknown');
  const remainingDetail = target > actual
    ? t(`profile.dashboard_redesign.${hasWeeklyTarget ? 'weekly_budget_remaining' : 'weekly_remaining'}`, { distance: distance(target - actual) })
    : target > 0 ? t(`profile.dashboard_redesign.${hasWeeklyTarget ? 'weekly_budget_reached' : 'weekly_complete'}`) : null;

  return (
    <article className="hd-weekly-card" aria-labelledby={titleId}>
      <div className="hd-card-head">
        <div>
          <span className="hd-card-kicker">{t('profile.dashboard_redesign.weekly_kicker')}</span>
          <h3 className="hd-card-title" id={titleId}>{t('profile.dashboard_redesign.weekly_title')}</h3>
        </div>
        <div className="hd-weekly-summary">
          <div className="hd-weekly-total">
            <strong>{distance(actual)}</strong>
            <span> / {planKnown
              ? t(`profile.dashboard_redesign.${completeWeek ? 'weekly_planned_total' : 'weekly_planned_partial'}`, { distance: distance(planned) })
              : t('profile.dashboard_redesign.weekly_no_plan')}</span>
          </div>
          {hasWeeklyTarget && <div className="hd-weekly-budget">{t('profile.dashboard_redesign.weekly_budget_total', { distance: distance(plannedDistanceKm) })}</div>}
          <div
            className="hd-weekly-progress"
            role="progressbar"
            aria-label={hasWeeklyTarget ? t('profile.dashboard_redesign.weekly_budget_total', { distance: distance(plannedDistanceKm) }) : t('profile.dashboard_redesign.weekly_kicker')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-valuetext={`${distance(actual)} / ${hasWeeklyTarget || planKnown ? distance(target) : '—'}`}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="hd-bar-chart" role="group" aria-labelledby={titleId}>
        {bars.map((bar) => {
          const actualHeight = bar.actual / maximum * 100;
          const plannedHeight = bar.projectedKnown ? bar.projected / maximum * 100 : 0;
          const underPlan = bar.projectedKnown && bar.actual < bar.projected * 0.95;
          return (
            <button
              key={bar.key}
              type="button"
              className={`hd-bar-col${bar.isToday ? ' is-today' : ''}${underPlan ? ' is-under-plan' : ''}${bar.index === activeIndex ? ' is-active' : ''}`}
              aria-label={`${bar.label}: ${t('profile.dashboard_redesign.weekly_actual')} ${distance(bar.actual)}; ${t('profile.dashboard_redesign.weekly_projected')} ${plannedLabel(bar)}`}
              aria-describedby={detailId}
              onMouseEnter={() => setActiveIndex(bar.index)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(bar.index)}
              onBlur={() => setActiveIndex(null)}
              onClick={() => setActiveIndex(bar.index)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setActiveIndex(null);
              }}
            >
              <span className="hd-bar-track" aria-hidden="true">
                {plannedHeight > 0 && <span className="hd-bar projected" style={{ height: `${plannedHeight}%` }} />}
                {actualHeight > 0 && <span className="hd-bar actual" style={{ height: `${actualHeight}%` }} />}
                {bar.actual > 0 && <span className="hd-bar-value has-actual" style={{ bottom: `${actualHeight}%` }}>{formatDistanceValue(bar.actual, unit, 1)}</span>}
                {plannedHeight > 0 && <span className="hd-bar-value is-projected" style={{ bottom: `${plannedHeight}%` }}>{formatDistanceValue(bar.projected, unit, 1)}</span>}
                {actualHeight === 0 && plannedHeight === 0 && <span className="hd-bar-value" style={{ bottom: 0 }}>{bar.projectedKnown ? '0' : '—'}</span>}
              </span>
              <span className="hd-bar-label">{bar.label}</span>
            </button>
          );
        })}
      </div>

      <div className="hd-weekly-footer">
        <div className="hd-bar-tooltip" id={detailId} role="status" aria-live="polite" aria-atomic="true">
          {activeBar ? <><strong>{activeBar.label}</strong> · {t('profile.dashboard_redesign.weekly_actual')} {distance(activeBar.actual)} / {t('profile.dashboard_redesign.weekly_projected')} {plannedLabel(activeBar)}</>
            : <>{todayDetail}{remainingDetail && <> · {remainingDetail}</>}</>}
        </div>
        <div className="hd-weekly-legend">
          <span><i className="hd-legend-dot actual" aria-hidden="true" />{t('profile.dashboard_redesign.weekly_actual')}</span>
          <span><i className="hd-legend-dot projected" aria-hidden="true" />{t('profile.dashboard_redesign.weekly_projected')}</span>
        </div>
      </div>
      <details className="hd-weekly-calculation">
        <summary>{t('profile.dashboard_redesign.weekly_calculation')}</summary>
        <p>{t('profile.dashboard_redesign.weekly_calculation_scope')}</p>
        {planKnown && <>
          <p className="hd-weekly-equation-label">{t(`profile.dashboard_redesign.${completeWeek ? 'weekly_current_total' : 'weekly_current_partial'}`)}</p>
          <p className="hd-weekly-equation">{bars.filter(bar => bar.projectedKnown).map(bar => formatDistanceValue(bar.projected, unit, 1)).join(' + ')} {sumRelation} {distance(planned)}</p>
          {Math.abs(adjustment) > 0.000001 && <>
            <p className="hd-weekly-equation-label">{t('profile.dashboard_redesign.weekly_adjustments')}</p>
            <p className="hd-weekly-equation">{distance(beforeAdjustments)} {adjustment < 0 ? '−' : '+'} {distance(Math.abs(adjustment))} {adjustmentRelation} {distance(planned)}</p>
          </>}
        </>}
        {hasWeeklyTarget && <>
          <p className="hd-weekly-equation-label">{t('profile.dashboard_redesign.weekly_allowance')}</p>
          <p className="hd-weekly-equation">max({distance(0)}, {distance(plannedDistanceKm)} − {distance(actual)}) {allowanceRelation} {distance(remainingAllowance)}</p>
          {budgetRemovedRun && remainingAllowance === 0 && <p>{t('profile.dashboard_redesign.weekly_budget_adjustment_reason')}</p>}
        </>}
        <div className="hd-weekly-table-scroll" tabIndex={0} role="region" aria-label={t('profile.dashboard_redesign.weekly_daily_distances')}>
          <table>
            <caption>{t('profile.dashboard_redesign.weekly_daily_distances')}</caption>
            <thead><tr>
              <th scope="col">{t('profile.dashboard_redesign.weekly_day')}</th>
              <th scope="col">{t('profile.dashboard_redesign.weekly_before_adjustments')}</th>
              <th scope="col">{t('profile.dashboard_redesign.weekly_current_plan')}</th>
              <th scope="col">{t('profile.dashboard_redesign.weekly_workout')}</th>
              <th scope="col">{t('profile.dashboard_redesign.weekly_actual')}</th>
            </tr></thead>
            <tbody>{bars.map(bar => <tr key={bar.key} aria-current={bar.isToday ? 'date' : undefined}>
              <th scope="row">{bar.label}</th>
              <td>{bar.projectedKnown ? distance(originalDistance(bar)) : '—'}</td>
              <td>{plannedLabel(bar)}</td>
              <td>{bar.projectedKnown && bar.workoutType ? prettifyWorkoutType(bar.workoutType, t) : '—'}</td>
              <td>{distance(bar.actual)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p>{t('profile.dashboard_redesign.weekly_rounding_note')}</p>
      </details>
    </article>
  );
}
