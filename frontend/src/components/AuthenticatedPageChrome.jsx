import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { apiJson } from '../api';
import { useI18n } from '../contexts/I18nContext';
import AppIcon from './AppIcon';
import HermesLogo from './HermesLogo';
import RunnerShellTopNav from './RunnerShellTopNav';
import TopbarNotifications from './TopbarNotifications';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function resolveShellTitle(pathname, t) {
  if (pathname === '/settings/import-data') return t('profile.import_data');
  if (pathname === '/settings/garmin-import') return t('profile.garmin_connect_modal_title');
  return t('settings.heading');
}

export default function AuthenticatedPageChrome({
  children,
  bodyClassName = '',
  profile = null,
}) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [loadedProfile, setLoadedProfile] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  useEffect(() => {
    if (profile) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson('/api/profile/me');
        if (!cancelled) setLoadedProfile(data);
      } catch {
        if (!cancelled) setLoadedProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const resolvedProfile = profile || loadedProfile;
  const navItems = useMemo(
    () => getRunnerShellNavItems({ t, lang }),
    [lang, t],
  );
  const pageTitle = resolveShellTitle(location.pathname, t);
  const profileName = String(resolvedProfile?.displayName || resolvedProfile?.email || 'HERMES').trim();
  const profileInitial = profileName.slice(0, 1).toUpperCase() || 'H';

  return (
    <div className={joinClasses(
      'dashboard-body',
      'runner-shell-page',
      'runner-dashboard-page',
      'authenticated-page-chrome',
      isSidebarCollapsed && 'is-sidebar-collapsed',
      bodyClassName,
    )}>
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{t('analysis.stitch_brand_subtitle_profile')}</span>
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
              className={`runner-shell-side-link${item.active ? ' is-active' : ''}`}
              onClick={() => navigate(item.route)}
              aria-label={item.label}
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
        <header className="runner-shell-topbar runner-dashboard-shell-topbar">
          <div className="runner-shell-topbar-left">
            <RunnerShellTopNav
              navItems={navItems}
              activeLabel={pageTitle}
              parentLabel={t('settings.heading')}
              parentRoute="/settings"
              navigate={navigate}
            />
          </div>
          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="runner-shell-avatar" onClick={() => navigate('/profile')} aria-label={t('profile.settings')}>
                {profileInitial}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas">
          <div className="page-transition-shell">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
