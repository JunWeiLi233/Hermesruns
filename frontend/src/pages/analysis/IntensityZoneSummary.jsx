import { useId, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';

const COLORS = ['#cfd8dc', '#9cd2aa', '#ffd38a', '#ffb4a7', '#e0705c'];

/** Presentation only: measured accounting stays in MeasuredHrZoneBlock. */
export default function IntensityZoneSummary({ block, loading, error, estimated, onRetry, children }) {
  const { t } = useI18n();
  const titleId = useId();
  const howId = useId();
  const [mode, setMode] = useState('measured');
  const [hovered, setHovered] = useState(null);
  const [howOpen, setHowOpen] = useState(false);
  const measured = mode === 'measured';
  const duration = seconds => {
    const minutes = Math.floor(seconds / 60);
    return minutes >= 60
      ? t('analysis.intensity_redesign_hours', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
      : t('analysis.intensity_redesign_minutes', { minutes });
  };
  const zones = measured
    ? block?.zoneSeconds.map((seconds, index) => ({
      label: t('analysis.measured_hr_zone_number', { zone: index + 1 }),
      value: seconds,
      percent: block.coveredSeconds > 0 ? Math.round(seconds / block.coveredSeconds * 100) : null,
      meta: duration(seconds), color: COLORS[index],
    })) || []
    : estimated?.zones.map(zone => ({
      label: zone.label, value: zone.value, percent: zone.value, meta: zone.hint, color: zone.color,
    })) || [];
  const hasData = measured ? block?.coveredSeconds > 0 : estimated?.hasData;

  return (
    <section className="intensity-zones intensity-card" aria-labelledby={titleId} aria-busy={measured && loading}>
      <header className="intensity-section-head">
        <div>
          <h2 id={titleId}>{t('analysis.intensity_redesign_zones')}</h2>
          <p>{t(measured ? 'analysis.intensity_redesign_measured_subtitle' : 'analysis.intensity_redesign_estimated_subtitle')}</p>
        </div>
        <div className="intensity-segments" role="group" aria-label={t('analysis.intensity_redesign_source')}>
          {['measured', 'estimated'].map(value => (
            <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); setHovered(null); }}>
              {t(`analysis.intensity_redesign_${value}`)}
            </button>
          ))}
        </div>
      </header>
      {measured && loading ? <div className="intensity-zones-loading" role="status"><span className="page-skeleton__block" />{t('analysis.measured_hr_loading')}</div> : null}
      {measured && error ? <div className="intensity-zones-state"><p role="alert">{t('analysis.measured_hr_error')}</p><button type="button" onClick={onRetry}>{t('analysis.measured_hr_retry')}</button></div> : null}
      {!(measured && (loading || error)) ? (
        <>
          {!hasData ? <p className="intensity-zones-state">{t(measured ? (block?.activityCount ? 'analysis.measured_hr_no_hr' : 'analysis.measured_hr_empty') : 'analysis.intensity_redesign_no_estimate')}</p> : null}
          <div className="intensity-zone-stack" aria-hidden="true">
            {hasData ? zones.filter(zone => zone.value > 0).map(zone => (
              <span key={zone.label} style={{ flexGrow: zone.value, background: zone.color, opacity: hovered == null || hovered === zone.label ? 1 : .35 }} onMouseEnter={() => setHovered(zone.label)} onMouseLeave={() => setHovered(null)} />
            )) : null}
          </div>
          <dl className={`intensity-zone-readings${measured ? '' : ' is-estimated'}`}>
            {zones.map(zone => (
              <div key={zone.label} onMouseEnter={() => setHovered(zone.label)} onMouseLeave={() => setHovered(null)}>
                <dt><i style={{ background: zone.color }} aria-hidden="true" />{zone.label}</dt>
                <dd><strong>{zone.percent == null ? '—' : `${zone.percent}%`}</strong><span>{zone.meta}</span></dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
      <footer className="intensity-zones-footer">
        <span>{measured
          ? block ? t('analysis.intensity_redesign_coverage', { time: duration(block.coveredSeconds), percent: block.totalSeconds > 0 ? block.coveragePercent.toFixed(0) : '—' }) : t('analysis.measured_hr_unavailable')
          : estimated?.hasData ? t('analysis.intensity_redesign_ratio', { easy: estimated.easyRatio, hard: estimated.hardRatio }) : t('analysis.intensity_redesign_no_estimate')}</span>
        <button type="button" aria-expanded={howOpen} aria-controls={howId} onClick={() => setHowOpen(value => !value)}>{t(howOpen ? 'analysis.intensity_redesign_hide' : 'methods.link')}</button>
      </footer>
      {howOpen ? <div id={howId} className="intensity-zone-methods">
        <p>{t(measured ? 'analysis.intensity_redesign_measured_how' : 'analysis.intensity_redesign_estimated_how')}</p>
        {!measured ? <p>{t('analysis.aggregate_intensity_scope')}</p> : null}
        {measured && block ? <p>{t('analysis.intensity_redesign_unknown', { time: duration(block.unknownSeconds) })}</p> : null}
        {measured ? <details><summary>{t('analysis.intensity_redesign_details')}</summary>{children}</details> : null}
      </div> : null}
    </section>
  );
}
