import { useId, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { formatDuration, formatPaceSeconds } from '../../utils/format';
import PaceChart from './PaceChart';
import PaceDistribution from './PaceDistribution';
import usePaceProfile from './usePaceProfile';
import usePaceZones from './usePaceZones';

/** "Fastest · km 4 · 4:52 /km" and so on, for the fastest and slowest full splits and the run's average. */
function markerRows(profile, adjusted, t) {
  const key = adjusted ? 'gapSecPerKm' : 'paceSecPerKm';
  const marker = adjusted ? profile.markers?.gap : profile.markers?.pace;
  const unit = t('run_detail.unit_pace');
  const at = (index) => profile.splits[index - 1]?.[key];
  const rows = [];
  if (marker) {
    rows.push({ id: 'fastest', label: t('run_detail.pace_marker_fastest'), where: t('run_detail.pace_marker_split', { index: marker.fastestSplit }), value: at(marker.fastestSplit) });
    rows.push({ id: 'slowest', label: t('run_detail.pace_marker_slowest'), where: t('run_detail.pace_marker_split', { index: marker.slowestSplit }), value: at(marker.slowestSplit) });
  }
  rows.push({ id: 'average', label: t('run_detail.pace_marker_average'), where: null, value: profile.summary[key] });
  return rows
    .filter((row) => row.value != null)
    .map((row) => ({ ...row, text: `${formatPaceSeconds(row.value)} ${unit}` }));
}

/**
 * The pace analysis of one run (S02 and S03): a chart of pace along the run as kilometre splits or as a smoothed line,
 * with elevation behind it and an optional grade-adjusted pace, the fastest and slowest splits, and the time spent at
 * each pace zone. It fetches the profile once the run page has the run's stream (`streamReady`), so the section is
 * on the page, with its anchor for the run navigation, in every state.
 */
export default function RunPaceAnalysis({ runId, streamReady, refreshToken = 0 }) {
  const { t } = useI18n();
  const titleId = useId();
  const [view, setView] = useState('splits');
  const [gradeAdjusted, setGradeAdjusted] = useState(false);
  const { status, data, stale, reload } = usePaceProfile(runId, { enabled: streamReady, refreshToken });
  const hasProfile = Boolean(data?.hasStream);
  const zones = usePaceZones(hasProfile);
  const adjusted = gradeAdjusted && Boolean(data?.hasElevation);

  let body;
  if (hasProfile) {
    const rows = markerRows(data, adjusted, t);
    const stopped = Math.round(data.summary.stoppedSeconds);
    body = (
      <>
        {stale ? (
          <p className="run-detail-v2__muted is-error" role="status">
            {t('run_detail.numbers_stale')}{' '}
            <button type="button" className="run-detail-v2__link" onClick={reload}>{t('run_detail.pace_retry')}</button>
          </p>
        ) : null}
        <div className="run-detail-v2__pa-controls">
          <div className="run-detail-v2__segmented" role="group" aria-label={t('run_detail.pace_view_group')}>
            <button type="button" className={view === 'splits' ? 'is-active' : ''} aria-pressed={view === 'splits'} onClick={() => setView('splits')}>
              {t('run_detail.pace_view_splits')}
            </button>
            <button type="button" className={view === 'smoothed' ? 'is-active' : ''} aria-pressed={view === 'smoothed'} onClick={() => setView('smoothed')}>
              {t('run_detail.pace_view_smoothed')}
            </button>
          </div>
          <label className={`run-detail-v2__switch${data.hasElevation ? '' : ' is-disabled'}`}>
            <input
              type="checkbox"
              role="switch"
              checked={adjusted}
              disabled={!data.hasElevation}
              onChange={(event) => setGradeAdjusted(event.target.checked)}
            />
            <span>{t('run_detail.pace_gap_toggle')}</span>
          </label>
        </div>

        <div className="run-detail-v2__pa-body">
          <div className="run-detail-v2__pa-main">
            <PaceChart profile={data} view={view} adjusted={adjusted} />
            <ul className="run-detail-v2__pa-legend" aria-hidden="true">
              <li className="is-pace">{t('run_detail.pace_legend_pace')}</li>
              {adjusted ? <li className="is-gap">{t('run_detail.pace_gap_toggle')}</li> : null}
              {data.hasElevation ? <li className="is-elevation">{t('run_detail.pace_legend_elevation')}</li> : null}
            </ul>
            <dl className="run-detail-v2__pa-markers">
              {rows.map((row) => (
                <div key={row.id} className={`is-${row.id}`}>
                  <dt>{row.label}{row.where ? <small> · {row.where}</small> : null}</dt>
                  <dd>{row.text}</dd>
                </div>
              ))}
            </dl>
            {!data.hasElevation ? <p className="run-detail-v2__muted">{t('run_detail.pace_gap_unavailable')}</p> : null}
            {adjusted ? <p className="run-detail-v2__muted">{t('run_detail.pace_gap_note')}</p> : null}
            <p className="run-detail-v2__muted">
              {t('run_detail.pace_basis_moving')}
              {stopped >= 5 ? ` ${t('run_detail.pace_stopped', { time: formatDuration(stopped) })}` : ''}
            </p>
          </div>
          <PaceDistribution series={data.smoothed} adjusted={adjusted} zones={zones} />
        </div>
      </>
    );
  } else if (status === 'ready') {
    body = <p className="run-detail-v2__muted">{t('run_detail.pace_no_stream')}</p>;
  } else if (status === 'error') {
    body = (
      <div className="run-detail-v2__training-state">
        <p className="run-detail-v2__muted" role="alert">{t('run_detail.pace_error')}</p>
        <button type="button" className="run-detail-v2__btn" onClick={reload}>{t('run_detail.pace_retry')}</button>
      </div>
    );
  } else {
    body = <p className="run-detail-v2__muted" role="status">{t('run_detail.pace_loading')}</p>;
  }

  return (
    <section
      id="run-detail-pace"
      className="run-detail-v2__card run-detail-v2__pace-analysis"
      aria-labelledby={titleId}
      aria-busy={status === 'loading' || status === 'refreshing' ? 'true' : undefined}
    >
      <div className="run-detail-v2__card-head">
        <h2 id={titleId}>{t('run_detail.pace_title')}</h2>
      </div>
      {body}
    </section>
  );
}
