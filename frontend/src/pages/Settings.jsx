import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import ImportDataGuide from '../components/ImportDataGuide';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUnit } from '../contexts/UnitContext';

const MANTRA_STORAGE_KEY = 'hermes.settings.mantra';
const DIGEST_STORAGE_KEY = 'hermes.settings.digest';

function resolveDisplayName(profile, fallback) {
  const raw = profile?.displayName?.trim()
    || profile?.email?.split('@')[0]
    || fallback;
  return raw.replace(/^./, (char) => char.toUpperCase());
}

export default function Settings() {
  const { isAuthenticated, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { unit, setUnit } = useUnit();
  const navigate = useNavigate();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [mantra, setMantra] = useState('');
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [stravaStatus, setStravaStatus] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState('');
  const [stravaLinking, setStravaLinking] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [fitExportFiles, setFitExportFiles] = useState(null);
  const [corosFiles, setCorosFiles] = useState(null);
  const [huaweiFiles, setHuaweiFiles] = useState(null);
  const [importStatus, setImportStatus] = useState('');
  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [garminLimit, setGarminLimit] = useState(50);
  const [garminImporting, setGarminImporting] = useState(false);
  const [garminStatus, setGarminStatus] = useState('');
  const [garminStatusType, setGarminStatusType] = useState('');

  useEffect(() => {
    try {
      setMantra(window.localStorage.getItem(MANTRA_STORAGE_KEY) || '');
      setDigestEnabled(window.localStorage.getItem(DIGEST_STORAGE_KEY) === '1');
    } catch {
      setMantra('');
      setDigestEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    let cancelled = false;

    async function loadSettings() {
      setLoadState('loading');
      try {
        const [profileData, stravaData] = await Promise.all([
          apiJson('/api/profile/me'),
          apiJson('/api/auth/strava/status').catch(() => null),
        ]);

        if (cancelled) return;

        setProfile(profileData);
        setDisplayName(profileData?.displayName || '');
        setStravaStatus(stravaData);
        setLoadState('ready');
      } catch {
        if (!cancelled) {
          setLoadState('error');
        }
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, navigate]);

  const displayNameResolved = resolveDisplayName(profile, t('profile.default_name'));
  const initials = displayNameResolved.slice(0, 1).toUpperCase();
  const accountIdentityCopy = profile?.email
    ? `${profile.email}${stravaStatus?.linked ? ` • ${t('settings.stitch_strava_active')}` : ` • ${t('settings.strava_not_connected')}`}`
    : t('settings.stitch_identity_fallback');

  const navItems = [
    { key: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard' },
    { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights' },
    { key: 'activities', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
    { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map' },
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'straighten' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
  ];

  const themeCards = useMemo(() => ([
    { value: 'midnight', label: t('settings.stitch_theme_pulse'), icon: 'dark_mode' },
    { value: 'light', label: t('settings.stitch_theme_glitter'), icon: 'light_mode' },
    { value: 'high-contrast', label: t('settings.stitch_theme_stealth'), icon: 'contrast' },
    { value: 'high-contrast-light', label: t('settings.stitch_theme_clear'), icon: 'brightness_7' },
  ]), [t]);
  const activeThemeLabel = themeCards.find((card) => card.value === theme)?.label || '';
  const languageLabel = lang === 'zh-CN' ? '中文' : 'English (US)';
  const unitLabel = unit === 'km' ? 'METRIC' : 'IMP';
  const stravaLabel = stravaStatus?.linked ? t('settings.stitch_strava_active') : t('settings.strava_not_connected');
  const digestLabel = digestEnabled ? t('settings.stitch_digest_enabled') : t('settings.stitch_enable_digest');

  async function saveProfile(event) {
    event.preventDefault();
    setNameSaving(true);
    setNameMsg('');
    try {
      await apiJson('/api/profile/display-name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      try {
        window.localStorage.setItem(MANTRA_STORAGE_KEY, mantra);
      } catch {
        // Ignore local-storage failures and still keep remote display-name save.
      }
      setProfile((current) => ({ ...(current || {}), displayName: displayName.trim() }));
      setNameMsg(t('settings.name_saved'));
    } catch {
      setNameMsg(t('settings.name_error'));
    } finally {
      setNameSaving(false);
    }
  }

  async function connectStrava() {
    setStravaLinking(true);
    try {
      const data = await apiJson('/api/auth/strava/link-url', { method: 'POST' });
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
    } catch {
      setStravaLinking(false);
    }
    setStravaLinking(false);
  }

  async function disconnectStrava() {
    try {
      await apiFetch('/api/auth/strava/unlink', { method: 'DELETE' });
      setStravaStatus((current) => ({ ...(current || {}), linked: false, stravaEmail: '' }));
    } catch {
      setNameMsg(t('settings.stitch_strava_disconnect_error'));
    }
  }

  async function handleImport(event) {
    event.preventDefault();
    const formData = new FormData();
    let hasFiles = false;

    if (fitExportFiles) {
      Array.from(fitExportFiles).forEach((file) => {
        formData.append('exports', file);
        hasFiles = true;
      });
    }
    if (corosFiles) {
      Array.from(corosFiles).forEach((file) => {
        formData.append('coros', file);
        hasFiles = true;
      });
    }
    if (huaweiFiles) {
      Array.from(huaweiFiles).forEach((file) => {
        formData.append('huawei', file);
        hasFiles = true;
      });
    }
    if (!hasFiles) return;

    setImportStatus('');
    try {
      const response = await apiFetch('/api/import/batch', { method: 'POST', body: formData });
      if (!response.ok) throw new Error();
      setImportStatus(t('settings.stitch_import_success'));
      setActiveModal(null);
    } catch {
      setImportStatus(t('profile.import_failed'));
    }
  }

  function openManualImportFromGarmin() {
    if (!garminImporting) {
      setActiveModal('manual');
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

  function toggleDigest() {
    const next = !digestEnabled;
    setDigestEnabled(next);
    try {
      window.localStorage.setItem(DIGEST_STORAGE_KEY, next ? '1' : '0');
    } catch {
      // Ignore storage failures.
    }
  }

  if (loadState === 'loading') {
    return <div className="analysis-stitch-page analysis-stitch-page--loading"><div className="analysis-stitch-loading">{t('settings.stitch_loading')}</div></div>;
  }

  if (loadState === 'error') {
    return <div className="analysis-stitch-page analysis-stitch-page--loading"><div className="analysis-stitch-loading">{t('settings.stitch_load_error')}</div></div>;
  }

  return (
    <div className={`analysis-stitch-page runner-dashboard-page settings-stitch-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="analysis-stitch-sidebar">
        <div className="analysis-stitch-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{t('analysis.stitch_brand_subtitle')}</span>
          </div>
          <button
            type="button"
            className="runner-dashboard-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            aria-label={t(isSidebarCollapsed ? 'profile.sidebar_expand' : 'profile.sidebar_collapse')}
            aria-pressed={isSidebarCollapsed}
          >
            <span className="runner-dashboard-toggle-glyph" aria-hidden="true">
              {isSidebarCollapsed ? '>' : '<'}
            </span>
          </button>
        </div>

        <nav className="analysis-stitch-side-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className="analysis-stitch-side-link"
              onClick={() => navigate(item.route)}
            >
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="analysis-stitch-sidebar-footer">
          <button
            type="button"
            className="analysis-stitch-workout-btn runner-dashboard-workout-btn"
            onClick={() => navigate('/today-run')}
            aria-label={t('profile.dashboard_start_workout')}
          >
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
          </button>
        </div>
      </aside>

      <main className="analysis-stitch-main">
        <header className="analysis-stitch-topbar runner-dashboard-shell-topbar settings-stitch-topbar">
          <div className="analysis-stitch-topbar-left">
            <div className="schedule-stitch-topnav">
              <span className="schedule-stitch-topnav-link is-active">{t('settings.heading')}</span>
            </div>
          </div>
          <div className="analysis-stitch-topbar-actions">
            <div className="analysis-stitch-topbar-profile-actions">
              <button type="button" className="analysis-stitch-icon-btn" onClick={() => navigate('/runs')} aria-label={t('analysis.stitch_open_runs')}>
                <AppIcon name="notifications" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="analysis-stitch-icon-btn is-active" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="analysis-stitch-avatar" onClick={() => navigate('/profile')} aria-label={displayNameResolved}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="analysis-stitch-canvas settings-stitch-canvas">
          <section className="settings-stitch-hero">
            <div className="settings-stitch-hero-copy">
              <span className="analysis-stitch-card-kicker">{t('settings.heading')}</span>
              <h1>{displayNameResolved}</h1>
              <p>{accountIdentityCopy}</p>
              <div className="settings-stitch-hero-pills">
                <span className="settings-stitch-hero-pill">{activeThemeLabel}</span>
                <span className="settings-stitch-hero-pill">{languageLabel}</span>
                <span className="settings-stitch-hero-pill">{unitLabel}</span>
              </div>
            </div>
            <div className="settings-stitch-hero-status">
              <article className="settings-stitch-status-card">
                <span className="analysis-stitch-card-kicker">{t('settings.stitch_data_ecosystem')}</span>
                <strong>{stravaLabel}</strong>
                <p>{profile?.email || t('settings.stitch_identity_fallback')}</p>
              </article>
              <article className="settings-stitch-status-card">
                <span className="analysis-stitch-card-kicker">{t('settings.stitch_weekly_brief')}</span>
                <strong>{digestLabel}</strong>
                <p>{t('settings.stitch_weekly_brief_copy')}</p>
              </article>
            </div>
          </section>

          <div className="settings-stitch-grid">
            <section className="settings-stitch-maincol">
              <article className="settings-stitch-card settings-stitch-card--account">
                <h2>{t('settings.stitch_account_info')}</h2>
                <form className="settings-stitch-account-grid" onSubmit={saveProfile}>
                  <div className="settings-stitch-avatar-shell">
                    <div className="settings-stitch-profile-avatar">{initials}</div>
                    <button type="submit" className="settings-stitch-avatar-edit" aria-label={t('settings.save')} disabled={nameSaving}>
                      <AppIcon name="edit" className="runner-dashboard-side-link-icon" />
                    </button>
                  </div>

                  <div className="settings-stitch-account-fields">
                    <label className="settings-stitch-label" htmlFor="settings-display-name">{t('settings.display_name_title')}</label>
                    <input
                      id="settings-display-name"
                      className="settings-stitch-input"
                      type="text"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder={t('settings.display_name_placeholder')}
                      maxLength={60}
                    />

                    <label className="settings-stitch-label" htmlFor="settings-account-identity">{t('settings.stitch_account_identity')}</label>
                    <textarea
                      id="settings-account-identity"
                      className="settings-stitch-textarea"
                      value={mantra || accountIdentityCopy}
                      onChange={(event) => setMantra(event.target.value)}
                      placeholder={accountIdentityCopy}
                      rows={4}
                    />

                    <div className="settings-stitch-account-actions">
                      <button type="submit" className="analysis-stitch-workout-btn settings-stitch-save-btn" disabled={nameSaving || !displayName.trim()}>
                        {nameSaving ? t('settings.saving') : t('settings.save')}
                      </button>
                      {nameMsg ? <p className="settings-stitch-message">{nameMsg}</p> : null}
                    </div>
                  </div>
                </form>
              </article>

              <div className="settings-stitch-lower-grid">
                <article className="settings-stitch-card settings-stitch-card--preferences">
                  <h2>{t('settings.stitch_preferences')}</h2>

                  <div className="settings-stitch-field-block">
                    <div className="settings-stitch-row">
                      <div className="settings-stitch-copy">
                        <strong>{t('settings.distance_unit_title')}</strong>
                        <p>{t('settings.distance_unit_hint')}</p>
                      </div>
                      <div className="settings-stitch-segmented">
                        <button type="button" className={unit === 'km' ? 'is-active' : ''} onClick={() => setUnit('km')}>METRIC</button>
                        <button type="button" className={unit === 'mile' ? 'is-active' : ''} onClick={() => setUnit('mile')}>IMP</button>
                      </div>
                    </div>
                  </div>

                  <div className="settings-stitch-field-block">
                    <label className="settings-stitch-label" htmlFor="settings-language">{t('settings.language_title')}</label>
                    <div className="settings-stitch-select-shell">
                      <select
                        id="settings-language"
                        className="settings-stitch-select"
                        value={lang}
                        onChange={(event) => setLang(event.target.value)}
                      >
                        <option value="en">English (US)</option>
                        <option value="zh-CN">中文</option>
                      </select>
                      <AppIcon name="expand_more" className="runner-dashboard-side-link-icon" />
                    </div>
                  </div>

                  <div className="settings-stitch-field-block">
                    <label className="settings-stitch-label">{t('profile.theme_title')}</label>
                    <div className="settings-stitch-theme-grid">
                      {themeCards.map((card) => (
                        <button
                          key={card.value}
                          type="button"
                          className={`settings-stitch-theme-card${theme === card.value ? ' is-active' : ''}`}
                          onClick={() => setTheme(card.value)}
                        >
                          <AppIcon name={card.icon} className="runner-dashboard-side-link-icon" />
                          <span>{card.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </article>

                <article className="settings-stitch-card settings-stitch-card--security">
                  <h2>{t('settings.stitch_security')}</h2>
                  <p className="settings-stitch-security-copy">{t('settings.stitch_security_copy')}</p>
                  <div className="settings-stitch-security-actions">
                    <button type="button" className="settings-stitch-pill-btn" onClick={() => { logout(); navigate('/login'); }}>
                      <span>{t('settings.logout_title')}</span>
                      <AppIcon name="chevron_right" className="runner-dashboard-side-link-icon" />
                    </button>
                    <button type="button" className="settings-stitch-pill-btn is-muted" disabled>
                      <span>{t('settings.stitch_two_factor')}</span>
                      <span className="settings-stitch-inline-status">
                        {stravaStatus?.linked ? t('settings.stitch_enabled') : t('settings.stitch_review')}
                      </span>
                    </button>
                  </div>
                </article>
              </div>
            </section>

            <aside className="settings-stitch-sidebarcol">
              <article className="settings-stitch-card settings-stitch-card--ecosystem">
                <h2>{t('settings.stitch_data_ecosystem')}</h2>

                <div className="settings-stitch-service">
                  <div className="settings-stitch-service-main">
                    <div className="settings-stitch-service-icon is-strava">
                      <AppIcon name="altitude" className="runner-dashboard-side-link-icon" />
                    </div>
                    <div>
                      <strong>STRAVA</strong>
                      <p>{stravaStatus?.linked ? t('settings.stitch_strava_active') : t('settings.strava_not_connected')}</p>
                    </div>
                  </div>
                  {stravaStatus?.linked ? (
                    <button type="button" className="settings-stitch-service-action" onClick={disconnectStrava}>
                      {t('settings.stitch_manage')}
                    </button>
                  ) : (
                    <button type="button" className="settings-stitch-service-action is-connect" onClick={connectStrava} disabled={stravaLinking}>
                      {stravaLinking ? t('profile.strava_link_connecting') : t('settings.stitch_connect')}
                    </button>
                  )}
                </div>

                <div className="settings-stitch-service is-muted">
                  <div className="settings-stitch-service-main">
                    <div className="settings-stitch-service-icon">
                      <AppIcon name="watch" className="runner-dashboard-side-link-icon" />
                    </div>
                    <div>
                      <strong>GARMIN CONNECT</strong>
                      <p>{t('profile.garmin_connect_status')}</p>
                    </div>
                  </div>
                  <button type="button" className="settings-stitch-service-action is-connect" onClick={() => setActiveModal('garmin')}>
                    {t('settings.stitch_connect')}
                  </button>
                </div>

                <button type="button" className="settings-stitch-import-btn" onClick={() => setActiveModal('manual')}>
                  <AppIcon name="upload_file" className="runner-dashboard-side-link-icon" />
                  <span>{t('profile.watch_import_files')}</span>
                </button>
              </article>

              <article className="settings-stitch-card settings-stitch-card--brief">
                <h2>{t('settings.stitch_weekly_brief')}</h2>
                <p>{t('settings.stitch_weekly_brief_copy')}</p>
                <button type="button" className="analysis-stitch-workout-btn settings-stitch-digest-btn" onClick={toggleDigest}>
                  {digestEnabled ? t('settings.stitch_digest_enabled') : t('settings.stitch_enable_digest')}
                </button>
              </article>

              <article className="settings-stitch-card settings-stitch-card--danger">
                <h2>{t('settings.danger_title')}</h2>
                <p>{t('settings.stitch_danger_copy')}</p>
                <button type="button" className="settings-stitch-danger-btn" onClick={() => { logout(); navigate('/login'); }}>
                  {t('settings.logout_btn')}
                </button>
              </article>
            </aside>
          </div>

          <footer className="analysis-stitch-footer">
            <a href="/terms">{t('landing.stitch_footer_terms')}</a>
            <a href="/privacy">{t('landing.stitch_footer_privacy')}</a>
            <a href="#support">{t('landing.stitch_footer_support')}</a>
            <a href="#contact">{t('landing.stitch_footer_contact')}</a>
            <p>{t('landing.stitch_footer_copy')}</p>
          </footer>
        </div>
      </main>

      <Modal isOpen={activeModal === 'manual'} onClose={() => setActiveModal(null)} title={t('profile.import_modal_title')}>
        <form onSubmit={handleImport}>
          <ImportDataGuide />
          <p className="modal-help">{t('profile.import_hint')}</p>
          <div className="import-source-grid">
            <section className="import-source-card">
              <div className="import-source-header">
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.fit_export_source_title')}</span>
                  <span className="import-source-hint">{t('profile.fit_export_source_hint')}</span>
                </div>
                <span className="import-source-tag">FIT/GPX</span>
              </div>
              <label className="modal-label">{t('profile.fit_export_file_label')}</label>
              <input type="file" accept=".gpx,.tcx,.fit,.zip" multiple onChange={(event) => setFitExportFiles(event.target.files)} />
              <p className="selected-file-name">{fitExportFiles?.length ? t('profile.selected_files_count', { count: fitExportFiles.length }) : t('profile.no_file_selected')}</p>
            </section>

            <section className="import-source-card">
              <div className="import-source-header">
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.coros_source_title')}</span>
                  <span className="import-source-hint">{t('profile.coros_source_hint')}</span>
                </div>
                <span className="import-source-tag">COROS</span>
              </div>
              <label className="modal-label">{t('profile.coros_file_label')}</label>
              <input type="file" accept=".gpx,.tcx,.fit,.zip" multiple onChange={(event) => setCorosFiles(event.target.files)} />
              <p className="selected-file-name">{corosFiles?.length ? t('profile.selected_files_count', { count: corosFiles.length }) : t('profile.no_file_selected')}</p>
            </section>

            <section className="import-source-card">
              <div className="import-source-header">
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.huawei_source_title')}</span>
                  <span className="import-source-hint">{t('profile.huawei_source_hint')}</span>
                </div>
                <span className="import-source-tag">HUAWEI</span>
              </div>
              <label className="modal-label">{t('profile.huawei_file_label')}</label>
              <input type="file" accept=".gpx,.tcx,.fit,.zip" multiple onChange={(event) => setHuaweiFiles(event.target.files)} />
              <p className="selected-file-name">{huaweiFiles?.length ? t('profile.selected_files_count', { count: huaweiFiles.length }) : t('profile.no_file_selected')}</p>
            </section>
          </div>

          <p className="import-summary-line">{t('profile.import_batch_hint')}</p>
          {importStatus ? <div className="modal-status">{importStatus}</div> : null}

          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setActiveModal(null)}>{t('profile.cancel')}</button>
            <button type="submit" className="btn-primary modal-button">{t('profile.upload_file')}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={activeModal === 'garmin'} onClose={() => { if (!garminImporting) setActiveModal(null); }} title={t('profile.garmin_connect_modal_title')}>
        <form onSubmit={handleGarminImport} className="garmin-import-form">
          <section className="garmin-import-hero">
            <div className="garmin-import-hero-main">
              <div className="service-icon service-icon--garmin garmin-import-hero-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 7v7" />
                  <path d="m9.5 11.5 2.5 2.5 2.5-2.5" />
                  <path d="M8 18h8" />
                </svg>
              </div>
              <div className="garmin-import-hero-copy">
                <strong>{t('profile.garmin_connect_title')}</strong>
                <p>{t('profile.garmin_connect_hint')}</p>
              </div>
            </div>
            <span className="garmin-import-pill">{t('profile.garmin_connect_status')}</span>
          </section>

          <p className="garmin-credentials-note">{t('profile.garmin_connect_credentials_note')}</p>

          <div className="garmin-import-field-grid">
            <div className="garmin-import-field">
              <label className="modal-label">{t('profile.garmin_connect_email_label')}</label>
              <input
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
              <label className="modal-label">{t('profile.garmin_connect_password_label')}</label>
              <input
                type="password"
                value={garminPassword}
                onChange={(event) => setGarminPassword(event.target.value)}
                disabled={garminImporting}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <div className="garmin-import-field">
            <label className="modal-label">{t('profile.garmin_connect_limit_label')}</label>
            <select
              value={garminLimit}
              onChange={(event) => setGarminLimit(Number(event.target.value))}
              disabled={garminImporting}
              className="garmin-import-limit"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>

          {garminStatus ? (
            <div className={`garmin-import-status garmin-import-status--${garminStatusType || 'info'}`}>
              {garminStatus}
            </div>
          ) : null}

          <div className="modal-actions garmin-import-actions">
            <button
              type="button"
              className="btn-secondary modal-button"
              onClick={() => { if (!garminImporting) setActiveModal(null); }}
              disabled={garminImporting}
            >
              {t('profile.cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary modal-button"
              disabled={garminImporting || !garminEmail.trim() || !garminPassword.trim()}
            >
              {garminImporting ? t('profile.garmin_connect_importing') : t('profile.garmin_connect_start')}
            </button>
          </div>

          <div className="garmin-import-secondary">
            <span>{t('settings.stitch_manual_import_hint')}</span>
            <button
              type="button"
              className="btn-secondary modal-button garmin-import-secondary-button"
              onClick={openManualImportFromGarmin}
              disabled={garminImporting}
            >
              {t('profile.watch_import_files')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
