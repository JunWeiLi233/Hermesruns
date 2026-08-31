import { useMemo, useState, useCallback, useRef } from 'react';
import { buildRunActivityCalendar } from '../utils/runActivityContribution';
import { formatDistance } from '../utils/format';
import { useUnit } from '../contexts/UnitContext';

function formatWeekday(date, lang) {
  return date.toLocaleDateString(lang, { weekday: 'short' });
}

function formatMonth(date, lang) {
  return date ? date.toLocaleDateString(lang, { month: 'short' }) : '';
}

export default function RunActivityContributionGraph({ runs, status = 'ready', lang, t, action = null, activityType = 'run' }) {
  const { unit } = useUnit();
  const calendar = useMemo(() => buildRunActivityCalendar(runs), [runs]);
  const isMuscleActivity = activityType === 'muscle';
  const activeCalendar = useMemo(() => {
    if (!isMuscleActivity) return calendar;
    return buildRunActivityCalendar(runs, {
      resolveDate: (entry) => entry?.trainingDate ? new Date(`${entry.trainingDate}T12:00:00`) : null,
      resolveDistanceKm: () => 1,
      resolveLevel: (distanceKm, count) => (count > 0 ? 4 : 0),
    });
  }, [calendar, isMuscleActivity, runs]);
  const copyKeys = isMuscleActivity
    ? {
      kicker: 'muscle_training.activity_kicker',
      title: 'muscle_training.activity_title',
      summary: 'muscle_training.activity_summary',
      loading: 'muscle_training.activity_loading',
      unavailable: 'muscle_training.activity_unavailable',
      empty: 'muscle_training.activity_empty',
      less: 'muscle_training.activity_less',
      more: 'muscle_training.activity_more',
      dayLabel: 'muscle_training.activity_day_label',
    }
    : {
      kicker: 'settings.stitch_activity_kicker',
      title: 'settings.stitch_activity_title',
      summary: 'settings.stitch_activity_summary',
      loading: 'settings.stitch_activity_loading',
      unavailable: 'settings.stitch_activity_unavailable',
      empty: 'settings.stitch_activity_empty',
      less: 'settings.stitch_activity_less',
      more: 'settings.stitch_activity_more',
      dayLabel: 'settings.stitch_activity_day_label',
    };
  const weekdayLabels = activeCalendar.weeks[0]?.days.map((day) => formatWeekday(day.date, lang)) || [];
  const isLoading = status === 'loading';
  const isUnavailable = status === 'unavailable';
  const summary = isLoading
    ? t(copyKeys.loading)
    : isUnavailable
      ? t(copyKeys.unavailable)
      : activeCalendar.totalRuns > 0
        ? t(copyKeys.summary, { count: activeCalendar.totalRuns })
        : t(copyKeys.empty);

  const [tooltip, setTooltip] = useState(null);
  const gridRef = useRef(null);

  const handleCellEnter = useCallback((day, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      day,
      x: rect.left + rect.width / 2,
      y: rect.top - 6,
    });
  }, []);

  const handleCellLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <section className="st-activity-graph" aria-labelledby="st-run-activity-title">
      <div className="st-activity-graph-head">
        <div>
          <p className="st-activity-kicker">{t(copyKeys.kicker)}</p>
          <h2 id="st-run-activity-title" className="st-activity-title">{t(copyKeys.title)}</h2>
        </div>
        <div className="st-activity-head-actions">
          <p className="st-activity-summary" aria-live="polite">{summary}</p>
          {action}
        </div>
      </div>

      <div className="st-activity-grid-frame">
        <div className="st-activity-grid-inner" ref={gridRef}>
          <div
            className="st-activity-calendar"
            style={{ '--st-activity-week-count': activeCalendar.weeks.length }}
            role="img"
            aria-label={`${t(copyKeys.title)}: ${summary}`}
          >
            <div className="st-activity-weekday-labels" aria-hidden="true">
              {weekdayLabels.map((label, index) => (
                <span key={label}>{index % 2 === 0 ? label : ''}</span>
              ))}
            </div>
            <div>
              <div className="st-activity-months" aria-hidden="true">
                {activeCalendar.monthLabels.map((month, index) => (
                  <span key={`${activeCalendar.weeks[index].key}-month`}>{formatMonth(month, lang)}</span>
                ))}
              </div>
              <div className="st-activity-weeks" aria-hidden="true">
                {activeCalendar.weeks.map((week) => (
                  <div key={week.key} className="st-activity-week">
                    {week.days.map((day) => (
                      <span
                        key={day.key}
                        className={`st-activity-cell${day.isFuture ? ' is-future' : ''}`}
                        data-level={isLoading ? 0 : day.level}
                        onMouseEnter={(e) => handleCellEnter(day, e)}
                        onMouseLeave={handleCellLeave}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {tooltip && tooltip.day.count > 0 && (
        <div
          className="st-activity-tooltip"
          role="tooltip"
          style={{ position: 'fixed', left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
        >
          <span className="st-activity-tooltip-date">{tooltip.day.date.toLocaleDateString(lang, { month: 'short', day: 'numeric' })}</span>
          <span className="st-activity-tooltip-distance">
            {isMuscleActivity
              ? t(copyKeys.dayLabel, { count: tooltip.day.count })
              : formatDistance(tooltip.day.distanceKm, 1, lang, unit)}
          </span>
        </div>
      )}

      <div className="st-activity-legend" aria-hidden="true">
        <span>{t(copyKeys.less)}</span>
        {[0, 1, 2, 3, 4].map((level) => <span key={level} className="st-activity-cell" data-level={level} />)}
        <span>{t(copyKeys.more)}</span>
      </div>
    </section>
  );
}
