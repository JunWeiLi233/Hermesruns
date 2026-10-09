import { useI18n } from '../../contexts/I18nContext';
import { formatPaceSeconds } from '../../utils/format';
import { zoneDurationLabel } from '../../utils/heartRateZones';
import { timeInPaceZones } from '../../utils/paceAnalysis';

const ZONE_NAME_KEYS = {
  recovery: 'run_detail.pace_zone_recovery',
  easy: 'run_detail.pace_zone_easy',
  marathon: 'run_detail.pace_zone_marathon',
  threshold: 'run_detail.pace_zone_threshold',
  interval: 'run_detail.pace_zone_interval',
  repetition: 'run_detail.pace_zone_repetition',
};

/** A zone's share of the time spent moving, whole percent; "<1%" for a zone that was visited only briefly. */
function shareLabel(seconds, moving) {
  if (!(seconds > 0) || !(moving > 0)) return '–';
  const rounded = Math.round((seconds / moving) * 100);
  return rounded >= 1 ? `${rounded}%` : '<1%';
}

function rangeLabel(band, t) {
  const unit = t('run_detail.unit_pace');
  if (band.slowest == null) return `${t('run_detail.pace_zone_slower', { pace: formatPaceSeconds(band.fastest) })} ${unit}`;
  if (band.fastest == null) return `${t('run_detail.pace_zone_faster', { pace: formatPaceSeconds(band.slowest) })} ${unit}`;
  return `${t('run_detail.pace_zone_between', { fast: formatPaceSeconds(band.fastest), slow: formatPaceSeconds(band.slowest) })} ${unit}`;
}

/**
 * Time spent at each pace zone, fastest zone first, counted on the pace or the grade-adjusted pace. The zones come
 * from the runner's VDOT (see usePaceZones); without one the card says what it needs.
 *
 * @param zones { status, vdot, bands } from usePaceZones
 */
export default function PaceDistribution({ series, adjusted, zones }) {
  const { t } = useI18n();
  const metric = adjusted ? 'gap' : 'pace';
  const { bands, vdot, status } = zones;
  const { seconds, moving } = timeInPaceZones(series, bands, metric);

  let body;
  if (bands.length) {
    body = (
      <>
        <ul className="run-detail-v2__zones">
          {bands.map((band, index) => ({ band, index })).reverse().map(({ band, index }) => (
            <li key={band.key} className={`run-detail-v2__zone is-zone-${index + 1}`} data-pace-zone={band.key}>
              <span className="run-detail-v2__zone-name">
                <strong>{t(ZONE_NAME_KEYS[band.key])}</strong>
                <small>{rangeLabel(band, t)}</small>
              </span>
              <span className="run-detail-v2__zone-track" aria-hidden="true">
                <i style={{ width: `${seconds[index] > 0 && moving > 0 ? Math.max((seconds[index] / moving) * 100, 1) : 0}%` }} />
              </span>
              <span className="run-detail-v2__zone-time">{zoneDurationLabel(seconds[index])}</span>
              <span className="run-detail-v2__zone-share">{shareLabel(seconds[index], moving)}</span>
            </li>
          ))}
        </ul>
        <div className="run-detail-v2__zones-foot">
          <p className="run-detail-v2__muted">{adjusted ? t('run_detail.pace_zones_basis_gap') : t('run_detail.pace_zones_basis_pace')}</p>
          <p className="run-detail-v2__muted">{t('run_detail.pace_zones_basis', { vdot: Math.round(vdot * 10) / 10 })}</p>
        </div>
      </>
    );
  } else if (status === 'idle' || status === 'loading') {
    body = <p className="run-detail-v2__muted" role="status">{t('run_detail.pace_zones_loading')}</p>;
  } else if (status === 'error') {
    body = <p className="run-detail-v2__muted">{t('run_detail.pace_zones_error')}</p>;
  } else {
    body = <p className="run-detail-v2__muted">{t('run_detail.pace_zones_unavailable')}</p>;
  }

  return (
    <div className="run-detail-v2__pa-zones">
      <h3>{t('run_detail.pace_zones_title')}</h3>
      {body}
    </div>
  );
}
