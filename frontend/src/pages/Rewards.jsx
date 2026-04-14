import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import TopbarNotifications from '../components/TopbarNotifications';
import { buildRewardShowcase, RewardGlyph } from '../utils/rewardBadges';

const cx = (...parts) => parts.filter(Boolean).join(' ');

export default function Rewards() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
  const nextReward = upcomingRewards[0] || null;
  const initials = (profile?.displayName || profile?.email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();

  const navItems = [
    { key: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard' },
    { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights' },
    { key: 'activities', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
    { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map' },
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'straighten' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
  ];

  if (loadState !== 'ready') {
    return <div className="runner-shell-page runner-shell-page--loading"><div className="runner-shell-loading">{t(loadState === 'error' ? 'analysis.stitch_load_error' : 'analysis.stitch_loading')}</div></div>;
  }

  return (
    <div className={`runner-shell-page runner-dashboard-page rewards-progress-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
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
            <div className="runner-shell-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="runner-shell-avatar" aria-label={t('analysis.stitch_edit_profile')} onClick={() => navigate('/profile')}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas">
          <section className="analysis-overview-grid analysis-overview-grid--hero rewards-progress-grid">
            <article className="analysis-overview-card rewards-progress-hero">
              <div className="rewards-progress-band">
                <span>{t('rewards.eyebrow')}</span>
                <strong>{t('rewards.heading')}</strong>
              </div>
              <div className="rewards-progress-hero-body">
                <div className="rewards-progress-copy">
                  <span className="analysis-overview-card-kicker">{t('rewards.hero_kicker')}</span>
                  <h2>{earnedCount}<small>/{totalCount || 0}</small></h2>
                  <p>{t('rewards.page_copy')}</p>
                </div>
                <div className="rewards-progress-progress-shell">
                  <div className="rewards-progress-progress-row">
                    <span>{t('rewards.badges_earned_label')}</span>
                    <strong>{Math.round(heroProgress * 100)}%</strong>
                  </div>
                  <div className="rewards-progress-progress-bar" role="progressbar" aria-valuenow={earnedCount} aria-valuemax={totalCount || 1}>
                    <span style={{ width: `${Math.round(heroProgress * 100)}%` }} />
                  </div>
                  <div className="rewards-progress-progress-grid">
                    <div className="rewards-progress-progress-kpi">
                      <span>{t('rewards.earned_title')}</span>
                      <strong>{earnedCount}</strong>
                    </div>
                    <div className="rewards-progress-progress-kpi">
                      <span>{t('rewards.upcoming_title')}</span>
                      <strong>{upcomingRewards.length}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <div className="analysis-overview-side-stack">
              <article className="analysis-overview-card rewards-progress-sidecard">
                <span className="analysis-overview-card-kicker">{t('rewards.upcoming_title')}</span>
                {nextReward ? (
                  <>
                    <strong>{nextReward.title}</strong>
                    <p>{nextReward.hint}</p>
                    <div className="rewards-progress-progress-bar rewards-progress-progress-bar--compact" role="progressbar" aria-valuenow={Math.round(nextReward.progress * 100)} aria-valuemax={100}>
                      <span style={{ width: `${Math.round(nextReward.progress * 100)}%` }} />
                    </div>
                  </>
                ) : (
                  <>
                    <strong>{t('rewards.empty_focus_title')}</strong>
                    <p>{t('rewards.earned_empty')}</p>
                  </>
                )}
              </article>

              <article className="analysis-overview-card rewards-progress-sidecard">
                <span className="analysis-overview-card-kicker">{t('rewards.earned_title')}</span>
                <strong>{earnedRewards[0]?.title || t('rewards.empty_focus_title')}</strong>
                <p>{earnedRewards[0]?.subtitle || t('rewards.empty_focus_copy')}</p>
              </article>
            </div>
          </section>

          <section className="analysis-overview-grid analysis-overview-grid--summary rewards-progress-summary-grid">
            <article className="analysis-overview-card analysis-overview-card--metric analysis-overview-card--intensity">
              <span className="analysis-overview-card-kicker">{t('rewards.earned_title')}</span>
              <strong>{earnedCount}</strong>
              <p>{t('rewards.earned_summary')}</p>
            </article>
            <article className="analysis-overview-card analysis-overview-card--metric">
              <span className="analysis-overview-card-kicker">{t('rewards.upcoming_title')}</span>
              <strong>{upcomingRewards.length}</strong>
              <p>{t('rewards.upcoming_subtitle')}</p>
            </article>
            <article className="analysis-overview-card analysis-overview-card--metric">
              <span className="analysis-overview-card-kicker">{t('rewards.hero_kicker')}</span>
              <strong>{totalCount}</strong>
              <p>{t('rewards.catalog_copy')}</p>
            </article>
          </section>

          <section className="analysis-overview-card rewards-progress-section-card">
            <div className="analysis-overview-table-head rewards-progress-section-head">
              <div>
                <span className="analysis-overview-card-kicker">{t('rewards.earned_title')}</span>
                <h2>{t('rewards.heading')}</h2>
              </div>
              <span className="analysis-overview-confidence-pill">{earnedCount}/{totalCount || 0}</span>
            </div>
            {earnedRewards.length > 0 ? (
              <div className="rewards-progress-card-grid">
                {earnedRewards.map((reward) => (
                  <article key={reward.id} className="rewards-progress-card rewards-progress-card--earned">
                    <div className="rewards-progress-card-icon">
                      <RewardGlyph icon={reward.icon} />
                    </div>
                    <div className="rewards-progress-card-copy">
                      <h3>{reward.title}</h3>
                      <p>{reward.subtitle}</p>
                    </div>
                    <span className="rewards-progress-pill">{t('profile.rewards_earned')}</span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="prediction-detail-empty">
                <strong>{t('rewards.empty_focus_title')}</strong>
                <p>{t('rewards.earned_empty')}</p>
              </div>
            )}
          </section>

          <section className="analysis-overview-card rewards-progress-section-card">
            <div className="analysis-overview-table-head rewards-progress-section-head">
              <div>
                <span className="analysis-overview-card-kicker">{t('rewards.upcoming_title')}</span>
                <h2>{t('rewards.upcoming_subtitle')}</h2>
              </div>
              <span className="analysis-overview-confidence-pill">{upcomingRewards.length}</span>
            </div>
            {upcomingRewards.length > 0 ? (
              <div className="rewards-progress-card-grid rewards-progress-card-grid--upcoming">
                {upcomingRewards.map((reward) => (
                  <article key={reward.id} className="rewards-progress-card rewards-progress-card--upcoming">
                    <div className="rewards-progress-card-icon">
                      <RewardGlyph icon={reward.icon} />
                    </div>
                    <div className="rewards-progress-card-copy">
                      <h3>{reward.title}</h3>
                      <p>{reward.hint}</p>
                      <div className="rewards-progress-progress-bar rewards-progress-progress-bar--compact" role="progressbar" aria-valuenow={Math.round(reward.progress * 100)} aria-valuemax={100}>
                        <span style={{ width: `${Math.round(reward.progress * 100)}%` }} />
                      </div>
                      <span className="rewards-progress-progress-note">{Math.round(reward.progress * 100)}%</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="prediction-detail-empty">
                <strong>{t('rewards.empty_focus_title')}</strong>
                <p>{t('rewards.empty_focus_copy')}</p>
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
