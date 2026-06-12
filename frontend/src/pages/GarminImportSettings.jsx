import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, apiJson } from '../api';
import AuthenticatedPageChrome from '../components/AuthenticatedPageChrome';
import { useI18n } from '../contexts/I18nContext';

const GARMIN_LIMIT_OPTIONS = [10, 25, 50, 100, 200];

function GarminMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v7" />
      <path d="m9.5 11.5 2.5 2.5 2.5-2.5" />
      <path d="M8 18h8" />
    </svg>
  );
}

export default function GarminImportSettings() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [garminLimit, setGarminLimit] = useState(50);
  const [garminImporting, setGarminImporting] = useState(false);
  const [garminStatus, setGarminStatus] = useState('');
  const [garminStatusType, setGarminStatusType] = useState('');
  const [garminWellnessSyncEnabled, setGarminWellnessSyncEnabled] = useState(false);
  const [garminWellnessImporting, setGarminWellnessImporting] = useState(false);
  const [garminWellnessStatus, setGarminWellnessStatus] = useState('');
  const [garminWellnessLastSynced, setGarminWellnessLastSynced] = useState(null);
  const [garminCredentialsSaved, setGarminCredentialsSaved] = useState(false);

  const garminTone = garminImporting ? 'active' : (garminStatus ? garminStatusType || 'info' : 'ready');
  const garminStatusLabel = garminImporting ? t('profile.garmin_connect_importing') : (garminStatus || t('settings.stitch_garmin_ready'));

  const garminLane = useMemo(() => ({
    eyebrow: t('profile.garmin_connect_status'),
    title: t('profile.garmin_connect_title'),
    summary: t('profile.garmin_connect_hint'),
    status: garminStatusLabel,
    tone: garminTone,
    limitLabel: t('profile.garmin_connect_limit_label'),
    limitValue: garminLimit,
    credentialsNote: t('profile.garmin_connect_credentials_note'),
    primaryAction: garminImporting ? t('profile.garmin_connect_importing') : t('profile.garmin_connect_start'),
  }), [garminImporting, garminLimit, garminStatusLabel, garminTone, t]);

  const syncSummary = garminWellnessLastSynced
    ? `${t('profile.garmin_wellness_last_synced')}: ${new Date(garminWellnessLastSynced).toLocaleString()}`
    : t('profile.garmin_wellness_never_synced');

  async function handleGarminSaveCredentials() {
    if (!garminEmail.trim() || !garminPassword.trim()) return;
    try {
      await apiJson('/api/garmin/connect/wellness/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garminEmail: garminEmail.trim(), garminPassword }),
      });
      setGarminCredentialsSaved(true);
    } catch {
      setGarminCredentialsSaved(false);
    }
  }

  async function handleGarminImport(event) {
    event.preventDefault();
    if (!garminEmail.trim() || !garminPassword.trim()) return;

    setGarminImporting(true);
    setGarminStatus('');
    setGarminStatusType('');

    try {
      const response = await apiFetch('/api/garmin/connect/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garminEmail: garminEmail.trim(),
          garminPassword,
          limit: garminLimit,
        }),
      });

      if (response.status === 409) {
        setGarminStatus(t('profile.garmin_connect_already_running'));
        setGarminStatusType('warn');
        setGarminImporting(false);
        return;
      }

      void handleGarminSaveCredentials();

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || t('profile.garmin_connect_failed'));
      }

      let attempts = 0;
      const maxAttempts = 120;

      const poll = async () => {
        if (attempts >= maxAttempts) {
          setGarminStatus(t('profile.garmin_connect_failed'));
          setGarminStatusType('error');
          setGarminImporting(false);
          return;
        }
        attempts += 1;

        try {
          const statusData = await apiJson('/api/garmin/connect/import/status');
          if (statusData.active) {
            setGarminStatus(
              statusData.importedRuns > 0
                ? t('profile.garmin_connect_progress_count', { count: statusData.importedRuns })
                : t('profile.garmin_connect_importing'),
            );
            setGarminStatusType('info');
            setTimeout(poll, 2000);
            return;
          }

          setGarminImporting(false);
          if (statusData.status === 'COMPLETED') {
            if (statusData.importedRuns > 0) {
              setGarminStatus(
                t('profile.garmin_connect_success')
                  .replace('{imported}', statusData.importedRuns)
                  .replace('{points}', statusData.importedPoints),
              );
              setGarminStatusType('success');
            } else {
              setGarminStatus(statusData.message || t('profile.garmin_connect_no_runs'));
              setGarminStatusType('info');
            }
          } else if (statusData.status === 'FAILED') {
            setGarminStatus(statusData.message || t('profile.garmin_connect_failed'));
            setGarminStatusType('error');
          }
        } catch {
          setTimeout(poll, 3000);
        }
      };

      setTimeout(poll, 3000);
    } catch (error) {
      setGarminStatus(error.message || t('profile.garmin_connect_failed'));
      setGarminStatusType('error');
      setGarminImporting(false);
    }
  }

  async function handleGarminWellnessToggle() {
    try {
      await apiJson('/api/garmin/connect/wellness/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !garminWellnessSyncEnabled }),
      });
      setGarminWellnessSyncEnabled(!garminWellnessSyncEnabled);
    } catch {
      // Keep the surface stable if toggle fails.
    }
  }

  async function handleGarminWellnessSync() {
    if (garminWellnessImporting) return;
    setGarminWellnessImporting(true);
    setGarminWellnessStatus('');
    try {
      await apiFetch('/api/garmin/connect/wellness/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysBack: 30 }),
      });
      let attempts = 0;
      const maxAttempts = 120;
      const poll = async () => {
        if (attempts >= maxAttempts) {
          setGarminWellnessStatus(t('profile.garmin_wellness_failed'));
          setGarminWellnessImporting(false);
          return;
        }
        attempts += 1;
        try {
          const data = await apiJson('/api/garmin/connect/wellness/status');
          if (data.active) {
            setGarminWellnessStatus(t('profile.garmin_wellness_syncing'));
            setTimeout(poll, 2500);
            return;
          }
          setGarminWellnessImporting(false);
          if (data.status === 'COMPLETED') {
            setGarminWellnessStatus(t('profile.garmin_wellness_success'));
            if (data.lastSynced) setGarminWellnessLastSynced(data.lastSynced);
          } else if (data.status === 'FAILED') {
            setGarminWellnessStatus(t('profile.garmin_wellness_failed'));
          } else if (data.status === 'NO_DATA') {
            setGarminWellnessStatus(t('profile.garmin_wellness_no_data'));
          }
        } catch {
          setTimeout(poll, 3000);
        }
      };
      setTimeout(poll, 2500);
    } catch {
      setGarminWellnessStatus(t('profile.garmin_wellness_failed'));
      setGarminWellnessImporting(false);
    }
  }

  return (
    <AuthenticatedPageChrome bodyClassName="garmin-import-page-shell">
      <section className="garmin-import-page">
        <header className="garmin-import-page-header">
          <button type="button" className="garmin-import-page-back" onClick={() => navigate('/settings')}>
            <span aria-hidden="true">&larr;</span>
            <span>{t('profile.settings')}</span>
          </button>

          <div className="garmin-import-page-heading">
            <div className="garmin-import-kicker-row">
              <span className="garmin-import-kicker-line" aria-hidden="true" />
              <span>{t('settings.heading')}</span>
            </div>
            <h1>{t('profile.garmin_connect_modal_title')}</h1>
            <p>{t('profile.garmin_connect_hint')}</p>
          </div>

          <div className={`garmin-import-page-status garmin-import-stage garmin-import-stage--${garminLane.tone}`}>
            <span>{garminLane.eyebrow}</span>
            <strong>{garminLane.status}</strong>
          </div>
        </header>

        <div className="garmin-import-page-card">
          <form onSubmit={handleGarminImport} className="garmin-import-form">
            <div className="garmin-import-layout">
              <section className="garmin-import-visual">
                <div className="garmin-import-kicker-row">
                  <span className="garmin-import-kicker-line" aria-hidden="true" />
                  <span>{garminLane.eyebrow}</span>
                </div>

                <section className="garmin-import-hero">
                  <div className="service-icon service-icon--garmin garmin-import-hero-icon">
                    <GarminMark />
                  </div>
                  <div className="garmin-import-hero-copy">
                    <strong>{garminLane.title}</strong>
                    <p>{garminLane.summary}</p>
                  </div>
                </section>

                <div className={`garmin-import-stage garmin-import-stage--${garminLane.tone}`}>
                  <span>{garminLane.eyebrow}</span>
                  <strong>{garminLane.status}</strong>
                </div>

                <div className="garmin-import-metric-grid">
                  <article className="garmin-import-metric">
                    <span>{garminLane.limitLabel}</span>
                    <strong>{garminLane.limitValue}</strong>
                  </article>
                  <article className="garmin-import-metric">
                    <span>{t('profile.garmin_wellness_last_synced')}</span>
                    <strong>{garminWellnessLastSynced ? new Date(garminWellnessLastSynced).toLocaleDateString() : t('profile.garmin_wellness_never_synced')}</strong>
                  </article>
                </div>
              </section>

              <section className="garmin-import-panel">
                <div className="garmin-import-panel-head">
                  <div className="garmin-import-panel-copy">
                    <span>{t('profile.garmin_connect_import')}</span>
                    <strong>{t('profile.garmin_connect_modal_title')}</strong>
                    <p>{garminLane.credentialsNote}</p>
                  </div>
                  <span className={`garmin-import-pill garmin-import-pill--${garminLane.tone}`}>{garminLane.eyebrow}</span>
                </div>

                <div className="garmin-import-field-grid">
                  <div className="garmin-import-field">
                    <label className="modal-label" htmlFor="garmin-import-email">{t('profile.garmin_connect_email_label')}</label>
                    <input
                      id="garmin-import-email"
                      type="email"
                      placeholder="you@example.com"
                      value={garminEmail}
                      onChange={(event) => setGarminEmail(event.target.value)}
                      disabled={garminImporting}
                      required
                      autoComplete="username"
                    />
                  </div>

                  <div className="garmin-import-field">
                    <label className="modal-label" htmlFor="garmin-import-password">{t('profile.garmin_connect_password_label')}</label>
                    <input
                      id="garmin-import-password"
                      type="password"
                      value={garminPassword}
                      onChange={(event) => setGarminPassword(event.target.value)}
                      disabled={garminImporting}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <div className="garmin-import-field garmin-import-field--limit">
                  <div className="garmin-import-field-head">
                    <label className="modal-label" htmlFor="garmin-import-limit">{t('profile.garmin_connect_limit_label')}</label>
                    <span className="garmin-import-field-meta">10 - 200</span>
                  </div>
                  <select
                    id="garmin-import-limit"
                    value={garminLimit}
                    onChange={(event) => setGarminLimit(Number(event.target.value))}
                    disabled={garminImporting}
                    className="garmin-import-limit"
                  >
                    {GARMIN_LIMIT_OPTIONS.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </div>

                <div className="modal-actions garmin-import-actions">
                  <button
                    type="button"
                    className="btn-secondary modal-button"
                    onClick={() => navigate('/settings')}
                    disabled={garminImporting}
                  >
                    {t('profile.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn-primary modal-button"
                    disabled={garminImporting || !garminEmail.trim() || !garminPassword.trim()}
                  >
                    {garminLane.primaryAction}
                  </button>
                </div>
              </section>
            </div>
          </form>

          <div className="garmin-import-page-lower">
            <section className="garmin-import-page-wellness garmin-import-page-wellness--wide">
              <div className="garmin-import-page-section-head">
                <div>
                  <span>{t('profile.garmin_wellness_title')}</span>
                  <strong>{t('profile.garmin_wellness_auto_sync')}</strong>
                </div>
                <span className={`garmin-import-pill garmin-import-pill--${garminWellnessSyncEnabled ? 'success' : 'ready'}`}>
                  {garminWellnessSyncEnabled ? t('profile.garmin_wellness_enabled') : t('profile.garmin_wellness_disabled')}
                </span>
              </div>

              <div className="garmin-wellness-section">
                <p className="garmin-import-page-copy">{t('profile.garmin_wellness_desc')}</p>
                <div className="garmin-wellness-row">
                  <span>{t('profile.garmin_wellness_auto_sync')}</span>
                  <button
                    type="button"
                    className={`garmin-wellness-toggle${garminWellnessSyncEnabled ? ' garmin-wellness-toggle--active' : ''}`}
                    onClick={handleGarminWellnessToggle}
                    aria-label={t('profile.garmin_wellness_auto_sync')}
                  />
                </div>
                <div className="garmin-wellness-row">
                  <span className="garmin-import-page-copy is-inline">{t('profile.garmin_wellness_auto_sync_desc')}</span>
                </div>
                <div className="garmin-wellness-row garmin-import-page-actions">
                  <button
                    type="button"
                    className="garmin-wellness-sync-btn"
                    onClick={handleGarminWellnessSync}
                    disabled={garminWellnessImporting}
                  >
                    {garminWellnessImporting ? t('profile.garmin_wellness_syncing') : t('profile.garmin_wellness_sync_now')}
                  </button>
                  <button
                    type="button"
                    className="garmin-wellness-save-credentials-btn"
                    onClick={handleGarminSaveCredentials}
                    disabled={!garminEmail.trim() || !garminPassword.trim()}
                  >
                    {garminCredentialsSaved ? t('profile.garmin_wellness_credentials_saved') : t('profile.garmin_wellness_save_credentials')}
                  </button>
                </div>
                {garminWellnessStatus ? <div className="garmin-wellness-status">{garminWellnessStatus}</div> : null}
                <div className="garmin-wellness-status">{syncSummary}</div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </AuthenticatedPageChrome>
  );
}
