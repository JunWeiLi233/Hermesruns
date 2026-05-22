import { useI18n } from '../contexts/I18nContext';

const STEP_COUNT = 7;

export default function ImportDataGuide() {
  const { t } = useI18n();
  return (
    <div className="import-guide">
      <h3 className="import-guide-title">{t('profile.import_guide_title')}</h3>
      <ol className="import-guide-list">
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <li key={i + 1}>{t(`profile.import_guide_step_${i + 1}`)}</li>
        ))}
      </ol>
      <div className="import-guide-strava">
        <h4 className="import-guide-strava-title">{t('profile.import_guide_strava_title')}</h4>
        <p className="import-guide-strava-body">{t('profile.import_guide_strava_body')}</p>
      </div>
      <p className="import-guide-note">{t('profile.import_guide_note')}</p>
    </div>
  );
}
