import { useState } from 'react';
import { useNavigate } from 'react-router';
import AuthenticatedPageChrome from '../../components/AuthenticatedPageChrome';
import { ImportActivityForm } from '../../components/ImportActivityModal';
import { useI18n } from '../../contexts/I18nContext';

const GUIDE_PROVIDER = { fit: 'generic', coros: 'coros', huawei: 'huawei' };
const QUICK_STEP_COUNT = 3;

export default function ImportDataSettings() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [source, setSource] = useState('fit');
  const [importedCount, setImportedCount] = useState(null);
  const provider = GUIDE_PROVIDER[source] || 'generic';

  return (
    <AuthenticatedPageChrome bodyClassName="import-data-page-shell import-page-v2-shell">
      <section className="import-data-page import-page-v2">
        <header className="import-page-v2-head">
          <div className="import-page-v2-title">
            <button type="button" className="import-page-v2-back" onClick={() => navigate('/settings')}>
              <span aria-hidden="true">←</span>
              <span>{t('profile.settings')}</span>
            </button>
            <h1>{t('profile.import_modal_title')}</h1>
            <p>{t('profile.import_hint')}</p>
          </div>
          <div className="import-page-v2-sync">
            <span>{t('settings.import_v2_auto_sync')}</span>
            <button type="button" className="is-strava" onClick={() => navigate('/settings')}>Strava</button>
            <button type="button" className="is-garmin" onClick={() => navigate('/settings')}>Garmin</button>
          </div>
        </header>

        {importedCount != null ? (
          <div className="import-page-v2-success" role="status">
            <span>{t('settings.import_v2_success', { count: importedCount })}</span>
            <button type="button" onClick={() => navigate('/runs')}>{t('profile.garmin_v2_view_runs')} →</button>
          </div>
        ) : null}

        <div className="import-page-v2-grid">
          <div className="import-page-v2-main">
            <ImportActivityForm
              t={t}
              className="is-page"
              onSourceChange={setSource}
              onBusyChange={(busy) => { if (busy) setImportedCount(null); }}
              onCancel={() => navigate('/settings')}
              onSuccess={(count) => setImportedCount(count)}
            />
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
