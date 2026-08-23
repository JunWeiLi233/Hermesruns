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

export default function RunActivityContributionGraph({ runs, status = 'ready', lang, t }) {
  const { unit } = useUnit();
  const calendar = useMemo(() => buildRunActivityCalendar(runs), [runs]);
  const weekdayLabels = calendar.weeks[0]?.days.map((day) => formatWeekday(day.date, lang)) || [];
  const isLoading = status === 'loading';
  const isUnavailable = status === 'unavailable';
  const summary = isLoading
    ? t('settings.stitch_activity_loading')
    : isUnavailable
      ? t('settings.stitch_activity_unavailable')
      : calendar.totalRuns > 0
        ? t('settings.stitch_activity_summary', { count: calendar.totalRuns })
        : t('settings.stitch_activity_empty');

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
          <p className="st-activity-kicker">{t('settings.stitch_activity_kicker')}</p>
          <h2 id="st-run-activity-title" className="st-activity-title">{t('settings.stitch_activity_title')}</h2>
        </div>
        <p className="st-activity-summary" aria-live="polite">{summary}</p>
      </div>

      <div className="st-activity-grid-frame">
        <div className="st-activity-grid-inner" ref={gridRef}>
          <div
            className="st-activity-calendar"
            style={{ '--st-activity-week-count': calendar.weeks.length }}
            role="img"
            aria-label={`${t('settings.stitch_activity_title')}: ${summary}`}
          >
            <div className="st-activity-weekday-labels" aria-hidden="true">
              {weekdayLabels.map((label, index) => (
                <span key={label}>{index % 2 === 0 ? label : ''}</span>
              ))}
            </div>
            <div>
              <div className="st-activity-months" aria-hidden="true">
                {calendar.monthLabels.map((month, index) => (
                  <span key={`${calendar.weeks[index].key}-month`}>{formatMonth(month, lang)}</span>
                ))}
              </div>
              <div className="st-activity-weeks" aria-hidden="true">
                {calendar.weeks.map((week) => (
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
          <span className="st-activity-tooltip-distance">{formatDistance(tooltip.day.distanceKm, 1, lang, unit)}</span>
        </div>
      )}

      <div className="st-activity-legend" aria-hidden="true">
        <span>{t('settings.stitch_activity_less')}</span>
        {[0, 1, 2, 3, 4].map((level) => <span key={level} className="st-activity-cell" data-level={level} />)}
        <span>{t('settings.stitch_activity_more')}</span>
      </div>
    </section>
  );
}
