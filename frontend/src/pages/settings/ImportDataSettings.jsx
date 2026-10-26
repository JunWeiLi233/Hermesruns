import { useState } from 'react';
import { useNavigate } from 'react-router';
import AuthenticatedPageChrome from '../../components/AuthenticatedPageChrome';
import { ImportActivityForm } from '../../components/ImportActivityModal';
import { useI18n } from '../../contexts/I18nContext';
import { QueuedImportStatus } from '../../features/training/integrated/AthleteTools';

const GUIDE_PROVIDER = { fit: 'generic', coros: 'coros', huawei: 'huawei' };
const QUICK_STEP_COUNT = 3;

export default function ImportDataSettings() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [source, setSource] = useState('fit');
  const provider = GUIDE_PROVIDER[source] || 'generic';

  return (
    <AuthenticatedPageChrome bodyClassName="import-data-page-shell import-page-v2-shell">
      <section className="import-data-page import-page-v2">
        <header className="import-page-v2-head">
          <div className="import-page-v2-title">
            <h1>{t('profile.import_modal_title')}</h1>
            <p>{t('profile.import_hint')}</p>
          </div>
          <div className="import-page-v2-sync">
            <span>{t('settings.import_v2_auto_sync')}</span>
            <button type="button" className="is-strava" onClick={() => navigate('/settings')}>Strava</button>
            <button type="button" className="is-garmin" onClick={() => navigate('/settings')}>Garmin</button>
          </div>
        </header>

        <div className="import-page-v2-grid">
          <div className="import-page-v2-main">
            <ImportActivityForm
              t={t}
              className="is-page"
              onSourceChange={setSource}
              onCancel={() => navigate('/settings')}
              onViewRuns={() => navigate('/runs')}
            />
            <QueuedImportStatus />
          </div>

          <aside className="import-page-v2-guide" aria-labelledby="import-page-v2-guide-title">
            <span id="import-page-v2-guide-title" className="import-page-v2-label">
              {t(`profile.import_guide_detail_${provider}_label`)}
            </span>
            <p className="import-page-v2-provider">{t(`profile.import_guide_detail_${provider}`)}</p>

            <ol className="import-page-v2-steps">
              {Array.from({ length: QUICK_STEP_COUNT }, (_, index) => (
                <li key={index + 1}>
                  <span aria-hidden="true">{index + 1}</span>
                  <span>
                    <strong>{t(`profile.import_guide_quick_step_${index + 1}_title`)}</strong>
                    <small>{t(`profile.import_guide_quick_step_${index + 1}_body`)}</small>
                  </span>
                </li>
              ))}
            </ol>

            <details className="import-page-v2-strava">
              <summary>{t('profile.import_guide_strava_title')}</summary>
              <p>{t('profile.import_guide_strava_body')}</p>
            </details>
            <p className="import-page-v2-note">{t('profile.import_guide_note')}</p>
          </aside>
        </div>
      </section>
    </AuthenticatedPageChrome>
  );
}
