import { useId } from 'react';
import { Link } from 'react-router';
import { zoneName, zoneNumberLabel, zoneRangeLabel } from '../../components/heartRateZoneLabels';
import { useI18n } from '../../contexts/I18nContext';
import { zoneDurationLabel } from '../../utils/heartRateZones';

function basisText(t, heartRate) {
  if (heartRate.boundarySource === 'MANUAL') return t('run_detail.zones_basis_manual');
  if (heartRate.maxHeartRateSource === 'PROFILE') return t('run_detail.zones_basis_profile', { max: heartRate.maxHeartRateBpm });
  return t('run_detail.zones_basis_default', { max: heartRate.maxHeartRateBpm });
}

/** A zone's share of the run, whole percent; "<1%" for a zone that was visited but only briefly. */
function shareLabel(zone) {
  if (!(zone.seconds > 0)) return '–';
  const rounded = Math.round(zone.percent);
  return rounded >= 1 ? `${rounded}%` : '<1%';
}

/** Time spent in each of the five heart-rate zones, highest zone first, with the zone edges that were used. */
export default function RunZonesCard({ heartRate }) {
  const { t } = useI18n();
  const titleId = useId();
  const zones = [...heartRate.zones].sort((a, b) => b.zone - a.zone);

  return (
    <section className="run-detail-v2__card run-detail-v2__zones-card" aria-labelledby={titleId}>
      <div className="run-detail-v2__card-head">
        <h2 id={titleId}>{t('run_detail.zones_title')}</h2>
        <Link className="run-detail-v2__link" to="/settings?section=training">{t('run_detail.zones_edit')}</Link>
      </div>

      {heartRate.hasStream ? (
        <>
          <ul className="run-detail-v2__zones">
            {zones.map((zone) => (
              <li key={zone.zone} className={`run-detail-v2__zone is-zone-${zone.zone}`}>
                <span className="run-detail-v2__zone-name">
                  <strong>{zoneNumberLabel(t, zone.zone)} · {zoneName(t, zone.zone)}</strong>
                  <small>{zoneRangeLabel(t, zone)}</small>
                </span>
                <span className="run-detail-v2__zone-track" aria-hidden="true">
                  <i style={{ width: `${zone.seconds > 0 ? Math.max(zone.percent, 1) : 0}%` }} />
                </span>
                <span className="run-detail-v2__zone-time">{zoneDurationLabel(zone.seconds)}</span>
                <span className="run-detail-v2__zone-share">{shareLabel(zone)}</span>
              </li>
            ))}
          </ul>
          <div className="run-detail-v2__zones-foot">
            <p className="run-detail-v2__muted">{basisText(t, heartRate)}</p>
            {heartRate.coveragePercent != null ? (
              <p className="run-detail-v2__muted">{t('run_detail.zones_coverage', { percent: heartRate.coveragePercent })}</p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <p className="run-detail-v2__muted">{t('run_detail.zones_no_stream')}</p>
          {heartRate.averageHeartRate != null || heartRate.maxHeartRate != null ? (
            <dl className="run-detail-v2__bounds">
              {heartRate.averageHeartRate != null ? (
                <div><dt>{t('run_detail.average_hr')}</dt><dd>{Math.round(heartRate.averageHeartRate)} {t('run_detail.unit_bpm')}</dd></div>
              ) : null}
              {heartRate.maxHeartRate != null ? (
                <div><dt>{t('run_detail.max_hr')}</dt><dd>{Math.round(heartRate.maxHeartRate)} {t('run_detail.unit_bpm')}</dd></div>
              ) : null}
            </dl>
          ) : null}
        </>
      )}
    </section>
  );
}
