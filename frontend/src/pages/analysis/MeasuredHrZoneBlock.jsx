import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { apiJson } from '../../api';
import { useI18n } from '../../contexts/I18nContext';
import AppIcon from '../../components/AppIcon';
import IntensityZoneSummary from './IntensityZoneSummary';
import './MeasuredHrZoneBlock.css';

const HR_ZONE_COUNT = 5;
const EFFORT_SOURCE_KEYS = {
  HR_ZONES: 'hr_samples', PERCEIVED: 'perceived', HR_AVERAGE: 'hr_average',
  PACE_MODEL: 'pace_model', PACE_CALIBRATED: 'pace_calibrated',
};
const METRICS_STATUS_KEYS = {
  CURRENT: 'current', NO_HR: 'no_hr', MISSING: 'missing', STALE: 'stale', INVALID: 'invalid',
};
const CALENDAR_BASIS_KEYS = {
  UTC_INSTANT: 'utc_instant', STRAVA_LOCAL_WALL_TIME: 'strava_local_wall_time', ADDED_DATE_FALLBACK: 'added_date_fallback',
};

function isAccountingRow(row) {
  return row != null && ['totalSeconds', 'coveredSeconds', 'durationCoveredSeconds', 'sampleExcessSeconds', 'unknownSeconds']
    .every(key => Number.isSafeInteger(row[key]) && row[key] >= 0)
    && Array.isArray(row.zoneSeconds) && row.zoneSeconds.length === HR_ZONE_COUNT
    && row.zoneSeconds.every(seconds => Number.isSafeInteger(seconds) && seconds >= 0)
    && row.zoneSeconds.reduce((sum, seconds) => sum + seconds, 0) === row.coveredSeconds
    && row.durationCoveredSeconds + row.unknownSeconds === row.totalSeconds
    && row.coveredSeconds - row.durationCoveredSeconds === row.sampleExcessSeconds;
}

function isBlockResponse(block, days) {
  return block?.days === days && isAccountingRow(block)
    && Number.isSafeInteger(block.activityCount) && block.activityCount >= 0
    && Number.isFinite(block.distanceKm) && block.distanceKm >= 0
    && Array.isArray(block.activities) && block.activities.every(isAccountingRow)
    && Array.isArray(block.daily) && block.daily.every(isAccountingRow);
}

// Account calendar dates and stored boundaries are returned by the endpoint.
// Do not reinterpret local dates as UTC instants or recompute HR zones here.
export default function MeasuredHrZoneBlock({ initialDays = 28, presentation, estimated }) {
  const { t } = useI18n();
  const titleId = useId();
  const [days, setDays] = useState(initialDays === 7 ? 7 : 28);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setResult({ days, revision, status: 'loading' });
    // Defer dispatch one microtask so StrictMode's synchronous effect replay
    // can cancel the discarded setup before it sends a duplicate GET.
    Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return null;
        return apiJson(`/api/activities/training-metrics/block?days=${days}`, { method: 'GET', signal: controller.signal });
      })
      .then(block => {
        if (controller.signal.aborted) return;
        if (!isBlockResponse(block, days)) throw new Error('Invalid measured HR block response');
        setResult({ days, revision, status: 'ready', block });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ days, revision, status: 'error' });
      });
    return () => controller.abort();
  }, [days, revision]);

  const current = result?.days === days && result?.revision === revision ? result : null;
  const loading = !current || current.status === 'loading';
  const block = current?.status === 'ready' ? current.block : null;
  const time = seconds => t('analysis.measured_hr_time', { minutes: (seconds / 60).toFixed(1), seconds });
  const compactTime = seconds => (
    <>{t('analysis.measured_hr_minutes', { minutes: (seconds / 60).toFixed(1) })}<span className="sr-only">{t('analysis.measured_hr_seconds', { seconds })}</span></>
  );
  const percent = value => Number.isFinite(value) ? `${value.toFixed(1)}%` : '—';
  const sourceLabel = source => EFFORT_SOURCE_KEYS[source]
    ? t(`analysis.measured_hr_source_${EFFORT_SOURCE_KEYS[source]}`)
    : source || t('analysis.measured_hr_unavailable');
  const boundariesLabel = activity => {
    const boundaries = activity.boundariesBpm;
    if (!Array.isArray(boundaries) || boundaries.length !== HR_ZONE_COUNT - 1) return t('analysis.measured_hr_unavailable');
    return [
      t('analysis.measured_hr_boundary_below', { zone: 1, bpm: boundaries[0] }),
      ...boundaries.slice(0, -1).map((bpm, index) => t('analysis.measured_hr_boundary_range', {
        zone: index + 2, from: bpm, to: boundaries[index + 1] - 1,
      })),
      t('analysis.measured_hr_boundary_above', { zone: 5, bpm: boundaries.at(-1) }),
    ].join(' · ');
  };

  const details = (
    <section className="measured-hr-block" aria-labelledby={titleId} aria-busy={loading}>
      <div className="measured-hr-block__header">
        <div>
          <h2 id={titleId}>{t('analysis.measured_hr_heading')}</h2>
          {block ? <p className="measured-hr-block__window">{t('analysis.measured_hr_window_basis', {
            start: block.startDate, end: block.endDate, timeZone: block.timeZone, count: block.activityCount,
          })}</p> : null}
        </div>
        <div className="measured-hr-block__controls">
          <div role="group" aria-label={t('analysis.measured_hr_window_label')}>
            {(presentation === 'summary' ? [28] : [7, 28]).map(windowDays => (
              <button key={windowDays} type="button" aria-pressed={days === windowDays} onClick={() => setDays(windowDays)}>
                {t('analysis.measured_hr_window', { days: windowDays })}
              </button>
            ))}
          </div>
          <button type="button" className="measured-hr-block__refresh" disabled={loading}
            aria-label={t(current?.status === 'error' ? 'analysis.measured_hr_retry' : 'analysis.measured_hr_refresh')}
            onClick={() => setRevision(value => value + 1)}>
            <AppIcon name="refresh" />
          </button>
        </div>
      </div>

      {loading ? <p role="status">{t('analysis.measured_hr_loading')}</p> : null}
      {current?.status === 'error' ? <p role="alert">{t('analysis.measured_hr_error')}</p> : null}
      {block ? (
        <>
          {block.activityCount === 0 ? <p>{t('analysis.measured_hr_empty')}</p> : null}
          {block.activityCount > 0 && block.coveredSeconds === 0 ? <p>{t('analysis.measured_hr_no_hr')}</p> : null}
          <div className="measured-hr-block__stack" aria-hidden="true">
            {block.zoneSeconds.map((seconds, index) => (
              <span key={index} className={`is-zone-${index + 1}`} style={{ flexGrow: seconds, display: seconds > 0 ? undefined : 'none' }} />
            ))}
          </div>
          <div className="measured-hr-block__zone-summary">
            <table className="measured-hr-block__zone-table">
              <caption className="sr-only">{t('analysis.measured_hr_title')}</caption>
              <thead className="sr-only"><tr>
                <th scope="col">{t('analysis.measured_hr_zone')}</th>
                <th scope="col">{t('analysis.measured_hr_zone_time')}</th>
                <th scope="col">{t('analysis.measured_hr_zone_share')}</th>
              </tr></thead>
              <tbody>{block.zoneSeconds.map((seconds, index) => {
                const share = block.coveredSeconds > 0 ? seconds * 100 / block.coveredSeconds : null;
                return (
                  <tr key={index}>
                    <th scope="row">{t('analysis.measured_hr_zone_number', { zone: index + 1 })}</th>
                    <td className="measured-hr-block__zone-time">{compactTime(seconds)}</td>
                    <td className="measured-hr-block__zone-share">{percent(share)}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <dl className="measured-hr-block__totals">
            {[
              ['total', compactTime(block.totalSeconds)],
              ['coverage', block.totalSeconds > 0 ? percent(block.coveragePercent) : '—'],
              ['unknown', compactTime(block.unknownSeconds)],
              ['distance', t('analysis.measured_hr_distance_value', { distance: block.distanceKm.toFixed(1) })],
            ].map(([key, value]) => (
              <div key={key}>
                <dt>{t(`analysis.measured_hr_${key}`)}</dt>
                <dd aria-label={t(`analysis.measured_hr_${key}`)}>{value}</dd>
              </div>
            ))}
          </dl>
          <details className="measured-hr-block__details">
            <summary>{t('analysis.measured_hr_calculation')}</summary>
            <p>{t('analysis.measured_hr_intro')}</p>
            <p>{t('analysis.measured_hr_denominator', { covered: block.coveredSeconds, durationCovered: block.durationCoveredSeconds, total: block.totalSeconds })}</p>
            {block.sampleExcessSeconds > 0 ? <p>{t('analysis.measured_hr_sample_excess_note', { seconds: block.sampleExcessSeconds })}</p> : null}
            <dl className="measured-hr-block__accounting">
              {[
                ['covered', time(block.coveredSeconds)],
                ['duration_covered', time(block.durationCoveredSeconds)],
              ].map(([key, value]) => (
                <div key={key}><dt>{t(`analysis.measured_hr_${key}`)}</dt><dd aria-label={t(`analysis.measured_hr_${key}`)}>{value}</dd></div>
              ))}
            </dl>
            <p>{t('analysis.measured_hr_source_basis')}</p>
            <p>{t('analysis.measured_hr_duration_basis')}</p>
          </details>
          <details className="measured-hr-block__details">
            <summary>{t('analysis.measured_hr_status')}</summary>
            <p>{t('analysis.measured_hr_status_note')}</p>
            <p>{t('analysis.measured_hr_contract_basis', {
              source: block.source || t('analysis.measured_hr_unavailable'),
              denominator: block.percentageDenominator || t('analysis.measured_hr_unavailable'),
              coverage: block.coverageDenominator || t('analysis.measured_hr_unavailable'),
              duration: block.durationBasis || t('analysis.measured_hr_unavailable'),
            })}</p>
          </details>

          {block.daily.length > 0 ? (
            <details className="measured-hr-block__details">
              <summary>{t('analysis.measured_hr_daily')}</summary>
              <div className="measured-hr-block__table-scroll" role="region" aria-label={t('analysis.measured_hr_daily')} tabIndex={0}>
                <table>
                  <caption>{t('analysis.measured_hr_daily')}</caption>
                  <thead><tr>
                    <th scope="col">{t('analysis.measured_hr_date')}</th>
                    <th scope="col">{t('analysis.measured_hr_activities')}</th>
                    <th scope="col">{t('analysis.measured_hr_total')}</th>
                    <th scope="col">{t('analysis.measured_hr_covered')}</th>
                    <th scope="col">{t('analysis.measured_hr_duration_covered')}</th>
                    <th scope="col">{t('analysis.measured_hr_sample_excess')}</th>
                    <th scope="col">{t('analysis.measured_hr_unknown')}</th>
                    {Array.from({ length: HR_ZONE_COUNT }, (_, index) => <th key={index} scope="col">{t('analysis.measured_hr_zone_number', { zone: index + 1 })}</th>)}
                  </tr></thead>
                  <tbody>{block.daily.map(day => (
                    <tr key={day.date}>
                      <th scope="row"><time dateTime={day.date}>{day.date}</time></th>
                      <td>{day.activityCount}</td><td>{time(day.totalSeconds)}</td><td>{time(day.coveredSeconds)}</td><td>{time(day.durationCoveredSeconds)}</td><td>{time(day.sampleExcessSeconds)}</td><td>{time(day.unknownSeconds)}</td>
                      {day.zoneSeconds.map((seconds, index) => <td key={index}>{time(seconds)}</td>)}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </details>
          ) : null}

          {block.activities.length > 0 ? (
            <details className="measured-hr-block__details">
              <summary>{t('analysis.measured_hr_sources_summary', { count: block.activityCount })}</summary>
              <div className="measured-hr-block__table-scroll" role="region" aria-label={t('analysis.measured_hr_sources')} tabIndex={0}>
                <table>
                  <caption>{t('analysis.measured_hr_sources')}</caption>
                  <thead><tr>
                    {['activity', 'total', 'covered', 'duration_covered', 'sample_excess', 'unknown', 'status', 'effort_source', 'boundaries', 'max_hr', 'computed_at', 'calendar_basis'].map(key => (
                      <th key={key} scope="col">{t(`analysis.measured_hr_${key}`)}</th>
                    ))}
                  </tr></thead>
                  <tbody>{block.activities.map(activity => (
                    <tr key={activity.activityId}>
                      <th scope="row"><Link to={`/runs/${activity.activityId}`}>{t('analysis.measured_hr_activity_link', { id: activity.activityId, date: activity.localDate })}</Link></th>
                      <td>{time(activity.totalSeconds)}</td><td>{time(activity.coveredSeconds)}</td><td>{time(activity.durationCoveredSeconds)}</td><td>{time(activity.sampleExcessSeconds)}</td><td>{time(activity.unknownSeconds)}</td>
                      <td>
                        <span>{t(`analysis.measured_hr_status_${METRICS_STATUS_KEYS[activity.metricsStatus] || 'unknown'}`)}</span>
                        <details>
                          <summary>{t('analysis.measured_hr_codes')}</summary>
                          <p>{[activity.metricsStatus, activity.calendarBasis, activity.effortSource].filter(Boolean).join(' · ') || t('analysis.measured_hr_unavailable')}</p>
                        </details>
                      </td>
                      <td>{sourceLabel(activity.effortSource)}</td>
                      <td className="measured-hr-block__boundaries">{boundariesLabel(activity)}</td>
                      <td>{activity.maxHeartRateBpm == null ? t('analysis.measured_hr_unavailable') : t('analysis.measured_hr_bpm', { bpm: activity.maxHeartRateBpm })}</td>
                      <td>{activity.computedAt || t('analysis.measured_hr_unavailable')}</td>
                      <td>{t(`analysis.measured_hr_calendar_${CALENDAR_BASIS_KEYS[activity.calendarBasis] || 'unknown'}`)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <p>{t('analysis.measured_hr_calendar_note')}</p>
            </details>
          ) : null}
        </>
      ) : null}
    </section>
  );
  return presentation === 'summary' ? (
    <IntensityZoneSummary block={block} loading={loading} error={current?.status === 'error'} estimated={estimated} onRetry={() => setRevision(value => value + 1)}>
      {details}
    </IntensityZoneSummary>
  ) : details;
}
