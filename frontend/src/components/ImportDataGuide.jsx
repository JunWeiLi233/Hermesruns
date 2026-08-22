import { useI18n } from '../contexts/I18nContext';

const QUICK_STEP_COUNT = 3;
const PROVIDER_KEYS = ['generic', 'coros', 'huawei'];

export default function ImportDataGuide() {
  const { t } = useI18n();
  return (
    <aside className="import-guide" aria-labelledby="import-guide-title">
      <h3 id="import-guide-title" className="import-guide-title">{t('profile.import_guide_title')}</h3>
      <span className="import-guide-kicker">{t('profile.import_guide_kicker')}</span>
      <p className="import-guide-intro">{t('profile.import_guide_intro')}</p>
      <ol className="import-guide-list">
        {Array.from({ length: QUICK_STEP_COUNT }, (_, index) => (
          <li key={index + 1}>
            <span className="import-guide-step-index" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="import-guide-step-copy">
              <strong>{t(`profile.import_guide_quick_step_${index + 1}_title`)}</strong>
              <span>{t(`profile.import_guide_quick_step_${index + 1}_body`)}</span>
            </span>
          </li>
        ))}
      </ol>

      <details className="import-guide-details">
        <summary>
          <span>{t('profile.import_guide_details_title')}</span>
          <small>{t('profile.import_guide_details_hint')}</small>
        </summary>
        <div className="import-guide-detail-list">
          {PROVIDER_KEYS.map((provider) => (
            <div key={provider} className="import-guide-detail-row">
              <strong>{t(`profile.import_guide_detail_${provider}_label`)}</strong>
              <span>{t(`profile.import_guide_detail_${provider}`)}</span>
            </div>
          ))}
        </div>
      </details>

      <details className="import-guide-strava">
        <summary className="import-guide-strava-title">{t('profile.import_guide_strava_title')}</summary>
        <p className="import-guide-strava-body">{t('profile.import_guide_strava_body')}</p>
      </details>
      <p className="import-guide-note">{t('profile.import_guide_note')}</p>
    </aside>
  );
}
