import { useId, useState } from 'react';
import { Link } from 'react-router';
import { apiJson } from '../../api';
import { invalidateResourceCache } from '../../api/resourceCache';
import { useI18n } from '../../contexts/I18nContext';

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** What the score was made from, and how, for each source the server reports. */
function sourceCopy(t, source, rating) {
  switch (source) {
    case 'HR_ZONES':
      return { title: t('run_detail.effort_source_hr_zones'), how: t('run_detail.effort_how_hr_zones') };
    case 'PERCEIVED':
      return { title: t('run_detail.effort_source_perceived', { rating: rating ?? '' }), how: t('run_detail.effort_how_perceived') };
    case 'HR_AVERAGE':
      return { title: t('run_detail.effort_source_hr_average'), how: t('run_detail.effort_how_hr_average') };
    case 'PACE_MODEL':
      return { title: t('run_detail.effort_source_pace_model'), how: t('run_detail.effort_how_pace_model') };
    case 'PACE_CALIBRATED':
      return { title: t('run_detail.effort_source_pace_calibrated'), how: t('run_detail.effort_how_pace_calibrated') };
    default:
      return { title: t('run_detail.effort_none'), how: t('run_detail.effort_how_none') };
  }
}

/**
 * The run's effort score, where it came from, and the 1 to 10 rating that stands in for a heart rate. The rating
 * is saved on its own (PATCH) and the parent reloads the metrics, so the score follows it.
 */
export default function RunEffortCard({ runId, effort, onRatingSaved }) {
  const { t, formatNumber } = useI18n();
  const titleId = useId();
  const [saving, setSaving] = useState(null);
  const [saved, setSaved] = useState(undefined);
  const [failed, setFailed] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const serverRating = effort.perceivedExertion ?? null;
  const rating = saving ? saving.value : saved !== undefined ? saved : serverRating;
  const copy = sourceCopy(t, effort.source, serverRating ?? rating);
  const score = effort.score;

  async function saveRating(value) {
    if (saving || value === rating) return;
    setSaving({ value });
    setFailed(false);
    setAnnouncement('');
    try {
      await apiJson(`/api/activities/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perceivedExertion: value }),
      });
      // The run list carries the rating too, so a cached copy would show the old one.
      invalidateResourceCache('/api/activities');
      setSaved(value);
      setAnnouncement(value == null ? t('run_detail.rating_cleared') : t('run_detail.rating_saved'));
      onRatingSaved?.();
    } catch {
      setFailed(true);
    } finally {
      setSaving(null);
    }
  }

  let hint = t('run_detail.rating_hint_idle');
  if (rating != null) {
    hint = effort.source === 'PERCEIVED' ? t('run_detail.rating_hint_used') : t('run_detail.rating_hint_unused');
  }
  if (saving) hint = t('run_detail.rating_saving');

  return (
    <section className="run-detail-v2__card run-detail-v2__effort" aria-labelledby={titleId}>
      <div className="run-detail-v2__card-head">
        <h2 id={titleId}>{t('run_detail.effort_title')}</h2>
      </div>

      <div className="run-detail-v2__effort-score">
        <strong>{score != null ? formatNumber(Math.round(score)) : '–'}</strong>
        <div>
          <span>{copy.title}</span>
          <p className="run-detail-v2__muted">{copy.how}</p>
        </div>
      </div>

      <div className="run-detail-v2__rating-block">
        <h3>{t('run_detail.rating_title')}</h3>
        <div className="run-detail-v2__rating" role="group" aria-label={t('run_detail.rating_group')} aria-busy={saving ? 'true' : undefined}>
          {RATINGS.map((value) => (
            <button
              key={value}
              type="button"
              className={`run-detail-v2__rating-btn${value === rating ? ' is-selected' : ''}`}
              aria-pressed={value === rating}
              aria-label={t('run_detail.rating_option', { value })}
              onClick={() => saveRating(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="run-detail-v2__rating-scale" aria-hidden="true">
          <span>{t('run_detail.rating_low')}</span>
          <span>{t('run_detail.rating_high')}</span>
        </div>
        <div className="run-detail-v2__rating-foot">
          {failed ? (
            <p className="run-detail-v2__muted is-error" role="alert">{t('run_detail.rating_failed')}</p>
          ) : (
            <p className="run-detail-v2__muted">{hint}</p>
          )}
          {rating != null ? (
            <button type="button" className="run-detail-v2__link" aria-disabled={saving ? 'true' : undefined} onClick={() => saveRating(null)}>
              {t('run_detail.rating_clear')}
            </button>
          ) : null}
        </div>
        <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      </div>

      <p className="run-detail-v2__muted run-detail-v2__effort-note">
        {t('run_detail.effort_scale_note')}{' '}
        <Link className="run-detail-v2__link" to="/analysis/load-balance">{t('run_detail.effort_scale_link')}</Link>
      </p>
    </section>
  );
}
