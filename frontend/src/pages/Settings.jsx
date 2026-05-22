import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import RunnerShellTopNav from '../components/RunnerShellTopNav';
import SettingsAtlasLayout from '../components/SettingsAtlasLayout';
import TopbarNotifications from '../components/TopbarNotifications';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUnit } from '../contexts/UnitContext';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';
import { formatStravaSyncLabel, stravaSyncTone } from '../utils/stravaAutoSync';

const MANTRA_STORAGE_KEY = 'hermes.settings.mantra';
const DIGEST_STORAGE_KEY = 'hermes.settings.digest';

const WELLNESS_SOURCE_ROWS = [
  { key: 'sleep', labelKey: 'settings.stitch_wellness_sleep' },
  { key: 'hrv', labelKey: 'settings.stitch_wellness_hrv' },
  { key: 'stress', labelKey: 'settings.stitch_wellness_stress' },
  { key: 'body', labelKey: 'settings.stitch_wellness_body' },
];

function resolveDisplayName(profile, fallback) {
  const raw = profile?.displayName?.trim()
    || profile?.email?.split('@')[0]
    || fallback;
  return raw.replace(/^./, (char) => char.toUpperCase());
}

function resolveWellnessSource(preferences, key) {
  if (Array.isArray(preferences)) {
    const match = preferences.find((item) => item?.key === key || item?.metric === key);
    return match?.source || match?.provider || '';
  }
  if (!preferences || typeof preferences !== 'object') return '';
  const metric = preferences.metrics?.[key] || preferences.sources?.[key] || preferences[key];
  if (typeof metric === 'string') return metric;
  return metric?.source || metric?.provider || '';
}

function formatWellnessSourceLabel(source, t) {
  switch (String(source || '').trim().toLowerCase()) {
    case 'garmin':
      return t('settings.stitch_wellness_source_garmin');
    case 'apple':
    case 'apple_health':
      return t('settings.stitch_wellness_source_apple');
    case 'google':
    case 'google_health':
      return t('settings.stitch_wellness_source_google');
    case 'manual':
      return t('settings.stitch_wellness_source_manual');
    default:
      return t('settings.stitch_wellness_source_auto');
  }
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
  const [wellnessSourcePreferences, setWellnessSourcePreferences] = useState(null);

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
        const [profileData, stravaData, wellnessPreferencesData] = await Promise.all([
          apiJson('/api/profile/me'),
          apiJson('/api/auth/strava/status').catch(() => null),
          apiJson('/api/wellness/source-preferences').catch(() => null),
        ]);

        if (cancelled) return;

        setProfile(profileData);
        setDisplayName(profileData?.displayName || '');
        setStravaStatus(stravaData);
        setWellnessSourcePreferences(wellnessPreferencesData);
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

  const navItems = useMemo(() => getRunnerShellNavItems({
    t,
    lang,
  }), [lang, t]);

  const themeCards = useMemo(() => ([
    { value: 'midnight', label: t('settings.stitch_theme_pulse'), icon: 'dark_mode' },
    { value: 'light', label: t('settings.stitch_theme_glitter'), icon: 'light_mode' },
  ]), [t]);
  const activeThemeLabel = themeCards.find((card) => card.value === theme)?.label || '';
  const languageLabel = t('settings.language_label');
  const stravaLabel = formatStravaSyncLabel(stravaStatus, t);
  const digestLabel = digestEnabled ? t('settings.stitch_digest_enabled') : t('settings.stitch_enable_digest');
  const resolvedLanguageLabel = languageLabel;
  const garminStatusLabel = t('settings.stitch_garmin_ready');
  const wellnessRows = useMemo(() => WELLNESS_SOURCE_ROWS.map((row) => ({
    ...row,
    sourceLabel: formatWellnessSourceLabel(resolveWellnessSource(wellnessSourcePreferences, row.key), t),
  })), [t, wellnessSourcePreferences]);
  const garminLane = {
    eyebrow: t('profile.garmin_connect_status'),
    title: t('profile.garmin_connect_title'),
    summary: t('profile.garmin_connect_hint'),
    status: garminStatusLabel,
    tone: 'ready',
    limitLabel: t('profile.garmin_connect_limit_label'),
    limitValue: 50,
    manualLabel: t('profile.watch_import_files'),
    manualValue: t('settings.stitch_manual_import_hint'),
    credentialsNote: t('profile.garmin_connect_credentials_note'),
    primaryAction: t('profile.garmin_connect_import'),
  };
  const completionScore = Math.round(([
    displayName.trim(),
    mantra.trim(),
    stravaStatus?.linked,
    digestEnabled,
  ].filter(Boolean).length / 4) * 100);
  const ecosystemCount = [stravaStatus?.linked, true, true].filter(Boolean).length;
  const heroBadge = stravaStatus?.linked ? t('settings.stitch_live_sync_badge') : t('settings.stitch_local_mode_badge');

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

  function toggleDigest() {
    const next = !digestEnabled;
    setDigestEnabled(next);
    try {
      window.localStorage.setItem(DIGEST_STORAGE_KEY, next ? '1' : '0');
    } catch {
      // Ignore storage failures.
    }
  }

  function cycleTheme() {
    const currentIndex = themeCards.findIndex((card) => card.value === theme);
    const nextCard = themeCards[(currentIndex + 1 + themeCards.length) % themeCards.length];
    setTheme(nextCard?.value || themeCards[0]?.value || theme);
  }

  function toggleUnitPreference() {
    setUnit(unit === 'km' ? 'mile' : 'km');
  }

  function toggleLanguagePreference() {
    setLang(lang === 'zh-CN' ? 'en' : 'zh-CN');
  }

  const quickControls = [
    {
      key: 'theme',
      icon: 'dark_mode',
      label: t('settings.stitch_quick_cycle_theme'),
      value: activeThemeLabel,
      action: cycleTheme,
    },
    {
      key: 'unit',
      icon: 'straighten',
      label: t('settings.stitch_quick_toggle_units'),
      value: unit === 'km' ? t('settings.stitch_metric_label') : t('settings.stitch_imperial_label'),
      action: toggleUnitPreference,
    },
    {
      key: 'language',
      icon: 'translate',
      label: t('settings.stitch_quick_toggle_language'),
      value: resolvedLanguageLabel,
      action: toggleLanguagePreference,
    },
    {
      key: 'digest',
      icon: 'newsmode',
      label: t('settings.stitch_quick_toggle_digest'),
      value: digestEnabled ? t('settings.stitch_enabled') : t('settings.stitch_review'),
      action: toggleDigest,
    },
  ];

  const syncHealthItems = [
    {
      key: 'strava',
      label: 'Strava',
      value: stravaLinking ? t('profile.strava_link_connecting') : stravaLabel,
      tone: stravaLinking ? 'active' : stravaSyncTone(stravaStatus),
    },
    {
      key: 'garmin',
      label: 'Garmin Connect',
      value: garminStatusLabel,
      tone: 'ready',
    },
    {
      key: 'manual',
      label: t('profile.watch_import_files'),
      value: t('settings.stitch_manual_import_ready'),
      tone: 'ready',
    },
    {
      key: 'garmin-wellness',
      label: t('profile.garmin_wellness_title'),
      value: t('profile.garmin_wellness_disabled'),
      tone: 'muted',
    },
  ];

  const setupChecklist = [
    { key: 'name', label: t('settings.stitch_check_display_name'), done: Boolean(displayName.trim()) },
    { key: 'identity', label: t('settings.stitch_check_identity_note'), done: Boolean(mantra.trim()) },
    { key: 'strava', label: t('settings.stitch_check_strava'), done: Boolean(stravaStatus?.linked) },
    { key: 'digest', label: t('settings.stitch_check_digest'), done: Boolean(digestEnabled) },
  ];

  if (loadState === 'loading') {
    return <div className="runner-shell-page runner-shell-page--loading"><div className="runner-shell-loading">{t('settings.stitch_loading')}</div></div>;
  }

  if (loadState === 'error') {
    return <div className="runner-shell-page runner-shell-page--loading"><div className="runner-shell-loading">{t('settings.stitch_load_error')}</div></div>;
  }

  return (
    <div className={`runner-shell-page runner-dashboard-page settings-control-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
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

        <nav className="runner-shell-side-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className="runner-shell-side-link"
              onClick={() => navigate(item.route)}
            >
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="runner-shell-sidebar-footer">
          <button
            type="button"
            className="runner-shell-workout-btn runner-dashboard-workout-btn"
            onClick={() => navigate('/today-run')}
            aria-label={t('profile.dashboard_start_workout')}
          >
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
          </button>
        </div>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar settings-control-topbar">
          <div className="runner-shell-topbar-left">
            <RunnerShellTopNav
              navItems={navItems}
              activeLabel={t('settings.heading')}
              navigate={navigate}
            />
          </div>
          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn is-active" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="runner-shell-avatar" onClick={() => navigate('/profile')} aria-label={displayNameResolved}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <SettingsAtlasLayout
          t={t}
          navigate={navigate}
          initials={initials}
          displayNameResolved={displayNameResolved}
          mantra={mantra}
          activeThemeLabel={activeThemeLabel}
          resolvedLanguageLabel={resolvedLanguageLabel}
          resolvedUnitLabel={unit === 'km' ? t('settings.stitch_metric_label') : t('settings.stitch_imperial_label')}
          heroBadge={heroBadge}
          completionScore={completionScore}
          ecosystemCount={ecosystemCount}
          digestLabel={digestLabel}
          digestEnabled={digestEnabled}
          stravaStatus={stravaStatus}
          stravaLabel={stravaLabel}
          stravaLinking={stravaLinking}
          connectStrava={connectStrava}
          disconnectStrava={disconnectStrava}
          toggleDigest={toggleDigest}
          logout={logout}
          saveProfile={saveProfile}
          nameSaving={nameSaving}
          nameMsg={nameMsg}
          displayName={displayName}
          setDisplayName={setDisplayName}
          setMantra={setMantra}
          themeCards={themeCards}
          theme={theme}
          setTheme={setTheme}
          unit={unit}
          setUnit={setUnit}
          lang={lang}
          setLang={setLang}
          quickControls={quickControls}
          syncHealthItems={syncHealthItems}
          wellnessRows={wellnessRows}
          garminLane={garminLane}
          setupChecklist={setupChecklist}
        />

      </main>
    </div>
  );
}





