import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import TopbarNotifications from '../components/TopbarNotifications';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';
import { buildRewardShowcase, RewardGlyph } from '../utils/rewardBadges';

const cx = (...parts) => parts.filter(Boolean).join(' ');

export default function Rewards() {
  const { isAuthenticated, logout } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setAvatarMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    (async () => {
      setLoadState('loading');
      try {
        const [profileData, activitiesData] = await Promise.all([
          apiJson('/api/profile/me'),
          apiJson('/api/activities'),
        ]);
        setProfile(profileData);
        setRuns(Array.isArray(activitiesData) ? activitiesData : []);
        setLoadState('ready');
      } catch {
        setLoadState('error');
      }
    })();
  }, [isAuthenticated, navigate]);

  const rewardShowcase = useMemo(() => buildRewardShowcase(runs, lang), [runs, lang]);
  const { earnedRewards, upcomingRewards, allRewards } = rewardShowcase;
  const totalCount = allRewards.length;
  const earnedCount = earnedRewards.length;
  const heroProgress = totalCount > 0 ? earnedCount / totalCount : 0;
  const initials = (profile?.displayName || profile?.email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();

  const navItems = useMemo(() => getRunnerShellNavItems({
    t,
    lang,
  }), [lang, t]);

  if (loadState === 'error') {
    return (
      <div className="runner-shell-page runner-shell-page--loading">
        <div className="runner-shell-loading">
          <p className="rewards-load-eyebrow">{t('rewards.error_eyebrow')}</p>
          <p className="rewards-load-title">{t('rewards.error_title')}</p>
          <p className="rewards-load-detail">{t('rewards.load_error')}</p>
          <button className="rewards-load-retry" onClick={() => window.location.reload()}>{t('rewards.retry')}</button>
        </div>
      </div>
    );
  }

  if (loadState === 'loading') {
    return (
      <div className="runner-shell-page runner-shell-page--loading">
        <div className="runner-shell-loading">{t('rewards.loading')}</div>
      </div>
    );
  }

  return (
    <div className={`runner-shell-page runner-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
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
            <span className="runner-dashboard-toggle-glyph" aria-hidden="true">{isSidebarCollapsed ? '>' : '<'}</span>
          </button>
        </div>
        <nav className="runner-shell-side-nav">
          {navItems.map((item) => (
            <button key={item.key} type="button" className={cx('runner-shell-side-link', item.route === '/profile' && false)} onClick={() => navigate(item.route)}>
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
          <button type="button" className="runner-shell-side-link is-active" onClick={() => navigate('/rewards')}>
            <AppIcon name="workspace_premium" className="runner-dashboard-side-link-icon" />
            <span className="runner-dashboard-side-link-label">{t('rewards.heading')}</span>
          </button>
        </nav>
        <div className="runner-shell-sidebar-footer">
          <button type="button" className="runner-shell-workout-btn runner-dashboard-workout-btn" onClick={() => navigate('/today-run')}>
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
          </button>
        </div>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar">
          <div className="runner-shell-topbar-left">
            <div className="runner-shell-topnav">
              <span className="runner-shell-topnav-link is-active">{t('rewards.top_title')}</span>
            </div>
          </div>
          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <div className="user-menu-shell" ref={avatarMenuRef}>
                <button type="button" className="runner-shell-avatar" aria-expanded={avatarMenuOpen} aria-label={t('analysis.stitch_edit_profile')} onClick={() => setAvatarMenuOpen((prev) => !prev)}>
                  {initials}
                </button>
                <div className={`user-menu-dropdown${avatarMenuOpen ? ' visible' : ''}`}>
                  <button type="button" className="user-menu-item" onClick={() => { setAvatarMenuOpen(false); navigate('/profile'); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    {t('profile.change_name')}
                  </button>
                  <button type="button" className="user-menu-item user-menu-item-logout" onClick={() => { setAvatarMenuOpen(false); logout(); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    {t('profile.logout')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas">
          {/* ===== Hero ===== */}
          <section className="rewards-editorial-hero">
            <span className="rewards-editorial-hero-kicker">{t('rewards.editorial_kicker')}</span>
            <span className="rewards-editorial-hero-number">{earnedCount}</span>
            <span className="rewards-editorial-hero-sub">
              {t('rewards.hero_of_total', { earned: String(earnedCount), total: String(totalCount || 0) })}
            </span>
            <div className="rewards-editorial-hero-progress">
              <div className="rewards-editorial-hero-bar" role="progressbar" aria-valuenow={earnedCount} aria-valuemax={totalCount || 1}>
                <span style={{ width: `${Math.round(heroProgress * 100)}%` }} />
              </div>
              <span className="rewards-editorial-hero-pct">{Math.round(heroProgress * 100)}%</span>
            </div>
          </section>

          {/* ===== Earned Rewards ===== */}
          <section className="rewards-editorial-section">
            <div className="rewards-editorial-section-header">
              <h2 className="rewards-editorial-section-title">{t('rewards.earned_title')}</h2>
              <span className="rewards-editorial-section-count">{earnedCount}</span>
            </div>
            {earnedRewards.length > 0 ? (
              <div className="rewards-editorial-grid">
                {earnedRewards.map((reward) => (
                  <article key={reward.id} className="rewards-editorial-card rewards-editorial-card--earned">
                    <div className="rewards-editorial-card-icon">
                      <RewardGlyph icon={reward.icon} />
                    </div>
                    <div className="rewards-editorial-card-body">
                      <h3 className="rewards-editorial-card-title">{reward.title}</h3>
                      <p className="rewards-editorial-card-sub">{reward.subtitle}</p>
                    </div>
                    <span className="rewards-editorial-card-pill">{t('rewards.earned_badge')}</span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rewards-editorial-empty">
                <p className="rewards-editorial-empty-msg">{t('rewards.earned_empty_coach')}</p>
                <button type="button" className="rewards-editorial-empty-cta" onClick={() => navigate('/runs')}>
                  {t('rewards.next_cta')}
                </button>
              </div>
            )}
          </section>

          {/* ===== Upcoming Rewards ===== */}
          <section className="rewards-editorial-section">
            <div className="rewards-editorial-section-header">
              <h2 className="rewards-editorial-section-title">{t('rewards.upcoming_title')}</h2>
              <span className="rewards-editorial-section-count rewards-editorial-section-count--muted">{upcomingRewards.length}</span>
            </div>
            {upcomingRewards.length > 0 ? (
              <div className="rewards-editorial-grid">
                {upcomingRewards.map((reward) => (
                  <article key={reward.id} className="rewards-editorial-card rewards-editorial-card--upcoming">
                    <div className="rewards-editorial-card-icon rewards-editorial-card-icon--muted">
                      <RewardGlyph icon={reward.icon} />
                    </div>
                    <div className="rewards-editorial-card-body">
                      <h3 className="rewards-editorial-card-title">{reward.title}</h3>
                      <p className="rewards-editorial-card-sub">{reward.hint}</p>
                      <div className="rewards-editorial-card-progress">
                        <div className="rewards-editorial-card-progress-bar" role="progressbar" aria-valuenow={Math.round(reward.progress * 100)} aria-valuemax={100}>
                          <span className="rewards-editorial-card-progress-fill" style={{ width: `${Math.round(reward.progress * 100)}%` }} />
                        </div>
                        <span className="rewards-editorial-card-progress-pct">{Math.round(reward.progress * 100)}%</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rewards-editorial-empty">
                <p className="rewards-editorial-empty-msg rewards-editorial-empty-msg--success">{t('rewards.all_earned')}</p>
              </div>
            )}
          </section>

          <footer className="runner-shell-footer runner-dashboard-footer">
            <FooterNavLinks />
          </footer>
        </div>
      </main>
    </div>
  );
}
