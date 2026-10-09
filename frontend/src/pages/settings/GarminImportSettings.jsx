import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { apiFetch, apiJson } from '../../api';
import { invalidateResourceCache } from '../../api/resourceCache';
import AuthenticatedPageChrome from '../../components/AuthenticatedPageChrome';
import Modal from '../../components/Modal';
import { useI18n } from '../../contexts/I18nContext';

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

export default function GarminImportSettings({ embedded = false, onClose = null }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [garminShowPassword, setGarminShowPassword] = useState(false);
  const [garminLimit, setGarminLimit] = useState(50);
  const [garminImporting, setGarminImporting] = useState(false);
  const [garminStarting, setGarminStarting] = useState(false);
  const [garminImportDone, setGarminImportDone] = useState(false);
  const [garminStatus, setGarminStatus] = useState('');
  const [garminStatusType, setGarminStatusType] = useState('');
  const [garminWellnessSyncEnabled, setGarminWellnessSyncEnabled] = useState(false);
  const [garminWellnessImporting, setGarminWellnessImporting] = useState(false);
  const [garminWellnessStatus, setGarminWellnessStatus] = useState('');
  const [garminWellnessLastSynced, setGarminWellnessLastSynced] = useState(null);
  const [garminCredentialsSaved, setGarminCredentialsSaved] = useState(false);
  const [garminWellnessLoading, setGarminWellnessLoading] = useState(true);
  const [garminWellnessSaving, setGarminWellnessSaving] = useState(false);
  const mountedRef = useRef(false);
  const importingRef = useRef(false);
  const startingRef = useRef(false);
  const wellnessSavingRef = useRef(false);
  const wellnessImportingRef = useRef(false);
  const pollTimersRef = useRef(new Set());

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    const timers = pollTimersRef.current;
    apiJson('/api/garmin/connect/wellness/status')
      .then((data) => {
        if (cancelled) return;
        setGarminWellnessSyncEnabled(Boolean(data.wellnessSyncEnabled));
        setGarminCredentialsSaved(Boolean(data.wellnessSyncEnabled));
        setGarminWellnessLastSynced(data.lastSyncedAt || null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setGarminWellnessLoading(false); });
    return () => {
      cancelled = true;
      mountedRef.current = false;
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  function schedulePoll(callback, delay) {
    if (!mountedRef.current) return;
    const timer = setTimeout(() => {
      pollTimersRef.current.delete(timer);
      if (mountedRef.current) void callback();
    }, delay);
    pollTimersRef.current.add(timer);
  }

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
    credentialsNote: t(garminCredentialsSaved ? 'profile.garmin_v2_saved_note' : 'profile.garmin_connect_credentials_note'),
    primaryAction: garminImporting ? t('profile.garmin_connect_importing') : t('profile.garmin_connect_start'),
  }), [garminCredentialsSaved, garminImporting, garminLimit, garminStatusLabel, garminTone, t]);

  const syncSummary = garminWellnessLastSynced
    ? `${t('profile.garmin_wellness_last_synced')}: ${new Date(garminWellnessLastSynced).toLocaleString()}`
    : t('profile.garmin_wellness_never_synced');

  function closeGarminImport() {
    if (startingRef.current || wellnessSavingRef.current || wellnessImportingRef.current) return;
    if (importingRef.current) invalidateResourceCache('/api/activities');
    if (onClose) onClose();
    else navigate('/settings');
  }

  async function handleGarminSaveCredentials() {
    if (!garminEmail.trim() || !garminPassword.trim()) return false;
    try {
      await apiJson('/api/garmin/connect/wellness/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garminEmail: garminEmail.trim(), garminPassword }),
      });
      if (mountedRef.current) setGarminCredentialsSaved(true);
      return true;
    } catch {
      if (mountedRef.current) {
        setGarminCredentialsSaved(false);
        setGarminWellnessStatus(t('profile.garmin_wellness_failed'));
      }
      return false;
    }
  }

  async function handleGarminImport(event) {
    event.preventDefault();
    if (importingRef.current || wellnessSavingRef.current || !garminEmail.trim() || !garminPassword.trim()) return;

    importingRef.current = true;
    startingRef.current = true;
    setGarminStarting(true);
    setGarminImportDone(false);
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
      if (!mountedRef.current) return;

      if (response.status === 409) {
        setGarminStatus(t('profile.garmin_connect_already_running'));
        setGarminStatusType('warn');
        setGarminImporting(false);
        importingRef.current = false;
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || t('profile.garmin_connect_failed'));
      }
      startingRef.current = false;
      setGarminStarting(false);

      let attempts = 0;
      const maxAttempts = 120;

      const poll = async () => {
        if (attempts >= maxAttempts) {
          setGarminStatus(t('profile.garmin_connect_failed'));
          setGarminStatusType('error');
          setGarminImporting(false);
          importingRef.current = false;
          return;
        }
        attempts += 1;

        try {
          const statusData = await apiJson('/api/garmin/connect/import/status');
          if (!mountedRef.current) return;
          if (statusData.active) {
            setGarminStatus(
              statusData.importedRuns > 0
                ? t(embedded ? 'profile.garmin_v2_progress_count' : 'profile.garmin_connect_progress_count', { count: statusData.importedRuns })
                : t('profile.garmin_connect_importing'),
            );
            setGarminStatusType('info');
            schedulePoll(poll, 2000);
            return;
          }

          setGarminImporting(false);
          importingRef.current = false;
          if (statusData.status === 'COMPLETED') {
            setGarminImportDone(true);
            invalidateResourceCache('/api/activities');
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
          } else {
            setGarminStatus(t('profile.garmin_connect_failed'));
            setGarminStatusType('error');
          }
        } catch {
          schedulePoll(poll, 3000);
        }
      };

      schedulePoll(poll, 3000);
    } catch (error) {
      importingRef.current = false;
      if (!mountedRef.current) return;
      setGarminStatus(error.message || t('profile.garmin_connect_failed'));
      setGarminStatusType('error');
      setGarminImporting(false);
    } finally {
      startingRef.current = false;
      if (mountedRef.current) setGarminStarting(false);
    }
  }

  async function handleGarminWellnessToggle() {
    if (wellnessSavingRef.current || garminWellnessLoading || importingRef.current) return;
    const enabled = !garminWellnessSyncEnabled;
    wellnessSavingRef.current = true;
    setGarminWellnessSaving(true);
    setGarminWellnessStatus('');
    try {
      if (enabled && garminEmail.trim() && garminPassword.trim()) {
        if (!await handleGarminSaveCredentials()) return;
      } else if (enabled && !garminCredentialsSaved) {
        setGarminWellnessStatus(t('profile.garmin_v2_credentials_required'));
        return;
      }
      await apiJson('/api/garmin/connect/wellness/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (mountedRef.current) setGarminWellnessSyncEnabled(enabled);
    } catch {
      if (mountedRef.current) setGarminWellnessStatus(t('profile.garmin_wellness_failed'));
    } finally {
      wellnessSavingRef.current = false;
      if (mountedRef.current) setGarminWellnessSaving(false);
    }
  }

  async function handleGarminWellnessSync() {
    if (wellnessImportingRef.current) return;
    wellnessImportingRef.current = true;
    setGarminWellnessImporting(true);
    setGarminWellnessStatus('');
    try {
      const response = await apiFetch('/api/garmin/connect/wellness/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysBack: 30 }),
      });
      if (!response.ok) throw new Error('Wellness import failed');
      if (!mountedRef.current) return;
      let attempts = 0;
      const maxAttempts = 120;
      const poll = async () => {
        if (attempts >= maxAttempts) {
          setGarminWellnessStatus(t('profile.garmin_wellness_failed'));
          setGarminWellnessImporting(false);
          wellnessImportingRef.current = false;
          return;
        }
        attempts += 1;
        try {
          const data = await apiJson('/api/garmin/connect/wellness/status');
          if (!mountedRef.current) return;
          const status = data.syncStatus || {};
          if (status.active) {
            setGarminWellnessStatus(t('profile.garmin_wellness_syncing'));
            schedulePoll(poll, 2500);
            return;
          }
          setGarminWellnessImporting(false);
          wellnessImportingRef.current = false;
          if (status.status === 'COMPLETED') {
            setGarminWellnessStatus(t('profile.garmin_wellness_success'));
            if (data.lastSyncedAt) setGarminWellnessLastSynced(data.lastSyncedAt);
          } else if (status.status === 'FAILED') {
            setGarminWellnessStatus(t('profile.garmin_wellness_failed'));
          } else if (status.status === 'NO_DATA') {
            setGarminWellnessStatus(t('profile.garmin_wellness_no_data'));
          }
        } catch {
          schedulePoll(poll, 3000);
        }
      };
      schedulePoll(poll, 2500);
    } catch {
      wellnessImportingRef.current = false;
      if (!mountedRef.current) return;
      setGarminWellnessStatus(t('profile.garmin_wellness_failed'));
      setGarminWellnessImporting(false);
    }
  }

  const garminImportContent = (
    <div className="garmin-profile-main-grid">
      <form onSubmit={handleGarminImport} className="garmin-import-form garmin-profile-form-card">
        <div className="garmin-profile-card-head">
          <div className="garmin-profile-card-title">
            <span>{t('profile.garmin_connect_import')}</span>
            <strong>{garminLane.title}</strong>
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
            onClick={closeGarminImport}
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
      </form>

      <section className="garmin-import-page-wellness garmin-profile-wellness-card">
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
          {!embedded ? (
            <>
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
            </>
          ) : null}
          {garminWellnessStatus ? <div className="garmin-wellness-status" role="status" aria-live="polite">{garminWellnessStatus}</div> : null}
          {!embedded ? <div className="garmin-wellness-status" role="status" aria-live="polite">{syncSummary}</div> : null}
        </div>
      </section>
    </div>
  );

  const garminCloseLocked = garminStarting || garminWellnessSaving || garminWellnessImporting;
  const garminModalContent = (
    <form className="garmin-v2" onSubmit={handleGarminImport}>
      <div className="garmin-v2-privacy">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        <span>{garminLane.credentialsNote}</span>
      </div>

      {garminImporting || garminImportDone || garminStatus ? (
        <div
          className={`garmin-v2-progress${garminImporting ? ' is-running' : ''}${garminStatusType === 'error' ? ' is-error' : ''}`}
          role={garminStatusType === 'error' ? 'alert' : 'status'}
          aria-live={garminStatusType === 'error' ? 'assertive' : 'polite'}
        >
          <strong>{garminStatus || t('profile.garmin_connect_importing')}</strong>
          {garminImporting || garminImportDone ? <div className="garmin-v2-progress-bar" aria-hidden="true"><i /></div> : null}
          {garminImporting && !garminStarting ? <small>{t('profile.garmin_v2_background_hint')}</small> : null}
        </div>
      ) : null}

      {!garminImporting && !garminImportDone ? (
        <>
          <div className="garmin-v2-field">
            <label htmlFor="garmin-v2-email">{t('profile.garmin_connect_email_label')}</label>
            <input
              id="garmin-v2-email"
              type="email"
              value={garminEmail}
              onChange={(event) => setGarminEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
              disabled={garminWellnessSaving}
              required
            />
          </div>
          <div className="garmin-v2-field">
            <label htmlFor="garmin-v2-password">{t('profile.garmin_connect_password_label')}</label>
            <span className="garmin-v2-password">
              <input
                id="garmin-v2-password"
                type={garminShowPassword ? 'text' : 'password'}
                value={garminPassword}
                onChange={(event) => setGarminPassword(event.target.value)}
                autoComplete="current-password"
                disabled={garminWellnessSaving}
                required
              />
              <button type="button" aria-pressed={garminShowPassword} aria-controls="garmin-v2-password" onClick={() => setGarminShowPassword((value) => !value)}>
                {t(garminShowPassword ? 'profile.garmin_v2_hide' : 'profile.garmin_v2_show')}
              </button>
            </span>
          </div>
          <div className="garmin-v2-limit">
            <div><span>{t('profile.garmin_connect_limit_label')}</span><small>{t('profile.garmin_v2_skip_hint')}</small></div>
            <div className="garmin-v2-segmented" role="group" aria-label={t('profile.garmin_connect_limit_label')}>
              {GARMIN_LIMIT_OPTIONS.map((value) => (
                <button key={value} type="button" className={garminLimit === value ? 'is-active' : ''} aria-pressed={garminLimit === value} onClick={() => setGarminLimit(value)} disabled={garminWellnessSaving}>
                  {value}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <label className={`garmin-v2-wellness${garminWellnessSyncEnabled ? ' is-on' : ''}`}>
        <span className="garmin-v2-wellness-copy">
          <strong>{t('profile.garmin_v2_wellness_title')}</strong>
          <span>{t('profile.garmin_v2_wellness_hint')}</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label={t('profile.garmin_v2_wellness_title')}
          checked={garminWellnessSyncEnabled}
          onChange={handleGarminWellnessToggle}
          disabled={garminWellnessLoading || garminWellnessSaving || garminImporting || (!garminCredentialsSaved && (!garminEmail.trim() || !garminPassword.trim()))}
        />
        <span className="garmin-v2-switch" aria-hidden="true" />
      </label>
      {garminWellnessStatus ? <p className="garmin-v2-note" role="status" aria-live="polite">{garminWellnessStatus}</p> : null}

      <div className="garmin-v2-footer">
        <button type="button" className="garmin-v2-cancel" onClick={closeGarminImport} disabled={garminCloseLocked}>
          {t(garminImporting ? 'profile.garmin_v2_continue_background' : garminImportDone ? 'profile.close' : 'profile.cancel')}
        </button>
        {garminImportDone ? (
          <button type="button" className="garmin-v2-primary" disabled={garminCloseLocked} onClick={() => { closeGarminImport(); navigate('/runs'); }}>
            {t('profile.garmin_v2_view_runs')}
          </button>
        ) : (
          <button type="submit" className="garmin-v2-primary" disabled={garminImporting || garminWellnessSaving || !garminEmail.trim() || !garminPassword.trim()}>
            {garminImporting ? t('profile.garmin_connect_importing') : t('profile.garmin_v2_start_count', { count: garminLimit })}
          </button>
        )}
      </div>
    </form>
  );

  if (embedded) {
    return (
      <Modal
        isOpen={embedded}
        onClose={closeGarminImport}
        title={t('profile.garmin_connect_modal_title')}
        closeLabel={t('profile.close')}
        headerContent={<><div className="garmin-v2-mark" aria-hidden="true"><GarminMark /></div><span className="garmin-v2-kicker">{t('profile.garmin_v2_subtitle')}</span></>}
        shellClassName="settings-garmin-import-modal-shell garmin-v2-shell"
        cardClassName="settings-garmin-import-modal-card garmin-v2-card"
        portalToBody
      >
        {garminModalContent}
      </Modal>
    );
  }

  return (
    <AuthenticatedPageChrome bodyClassName="garmin-import-page-shell">
      <section className="garmin-import-page garmin-profile-page">
        <header className="garmin-profile-hero">
          <button type="button" className="garmin-import-page-back" onClick={() => navigate('/settings')}>
            <span aria-hidden="true">&larr;</span>
            <span>{t('profile.settings')}</span>
          </button>

          <div className="garmin-profile-hero-copy">
            <div className="garmin-profile-hero-mark" aria-hidden="true">
              <GarminMark />
            </div>
            <div className="garmin-profile-hero-text">
              <span className="garmin-profile-kicker">{t('settings.heading')}</span>
              <h1>{t('profile.garmin_connect_modal_title')}</h1>
              <p>{t('profile.garmin_connect_hint')}</p>
            </div>
          </div>
        </header>

        <section className="garmin-profile-metric-strip" aria-label={garminLane.eyebrow}>
          <article className={`garmin-profile-metric is-status garmin-import-stage--${garminLane.tone}`}>
            <span>{garminLane.eyebrow}</span>
            <strong>{garminLane.status}</strong>
          </article>
          <article className="garmin-profile-metric">
            <span>{garminLane.limitLabel}</span>
            <strong>{garminLane.limitValue}</strong>
          </article>
          <article className="garmin-profile-metric">
            <span>{t('profile.garmin_wellness_last_synced')}</span>
            <strong>{garminWellnessLastSynced ? new Date(garminWellnessLastSynced).toLocaleDateString() : t('profile.garmin_wellness_never_synced')}</strong>
          </article>
        </section>

        {garminImportContent}
      </section>
    </AuthenticatedPageChrome>
  );
}
