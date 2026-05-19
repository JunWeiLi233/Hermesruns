import { useEffect, useMemo, useRef, useState } from 'react';
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
  const lockedCount = Math.max(totalCount - earnedCount, 0);
  const heroProgressPct = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;
  const latestUnlock = earnedRewards[0] || null;
  const nextMilestone = upcomingRewards[0] || null;
  const nextMilestonePct = nextMilestone ? Math.round(nextMilestone.progress * 100) : 100;
  const initials = (profile?.displayName || profile?.email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();
  const runnerName = profile?.displayName || profile?.email?.split('@')[0] || t('rewards.heading');

  const priorityPipeline = useMemo(() => {
    const list = [...(upcomingRewards || [])];
    list.sort((a, b) => Number(b.progress || 0) - Number(a.progress || 0));
    return list;
  }, [upcomingRewards]);

  const navItems = useMemo(() => getRunnerShellNavItems({ t, lang }), [lang, t]);

  const metrics = [
    {
      key: 'earned',
      label: t('rewards.badges_earned_label'),
      value: earnedCount,
      meta: t('rewards.hero_of_total', { earned: String(earnedCount), total: String(totalCount || 0) }),
    },
    {
      key: 'completion',
      label: t('rewards.progress_label') || t('rewards.editorial_kicker'),
      value: `${heroProgressPct}%`,
      meta: t('rewards.page_copy'),
    },
    {
      key: 'locked',
      label: t('rewards.locked_badges_label'),
      value: lockedCount,
      meta: t('rewards.upcoming_subtitle'),
    },
    {
      key: 'runs',
      label: t('rewards.runs_logged_label'),
      value: runs.length,
      meta: t('rewards.catalog_copy'),
    },
  ];

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
    <div className={`runner-shell-page runner-dashboard-page rewards-ledger-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
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

        <div className="runner-shell-canvas rewards-ledger-canvas">
          {/* Page intro */}
          <section className="rewards-ledger-intro" aria-labelledby="rewards-ledger-title">
            <span className="rewards-ledger-eyebrow">{t('rewards.editorial_kicker')}</span>
            <h1 id="rewards-ledger-title" className="rewards-ledger-title">{t('rewards.heading')}</h1>
            <p className="rewards-ledger-lede">{t('rewards.page_copy')}</p>
          </section>

          {/* Two-panel hero: celebrate + next */}
          <section className="rewards-ledger-hero" aria-label={t('rewards.hero_kicker')}>
            <article className={cx('rewards-ledger-hero-card', 'rewards-ledger-hero-card--celebrate', !latestUnlock && 'is-empty')}>
              <div className="rewards-ledger-hero-card-head">
                <span className="rewards-ledger-hero-tag">{t('rewards.earned_badge')}</span>
                <span className="rewards-ledger-hero-counter">
                  <strong>{earnedCount}</strong>
                  <em>/ {totalCount || 0}</em>
                </span>
              </div>
              {latestUnlock ? (
                <>
                  <div className="rewards-ledger-hero-glyph" aria-hidden="true">
                    <RewardGlyph icon={latestUnlock.icon} />
                  </div>
                  <h2 className="rewards-ledger-hero-h2">{latestUnlock.title}</h2>
                  <p className="rewards-ledger-hero-copy">{latestUnlock.subtitle || latestUnlock.hint}</p>
                </>
              ) : (
                <>
                  <div className="rewards-ledger-hero-glyph rewards-ledger-hero-glyph--ghost" aria-hidden="true">
                    <AppIcon name="workspace_premium" />
                  </div>
                  <h2 className="rewards-ledger-hero-h2">{t('rewards.empty_focus_title')}</h2>
                  <p className="rewards-ledger-hero-copy">{t('rewards.earned_empty_coach')}</p>
                </>
              )}
              <div className="rewards-ledger-hero-progress" role="progressbar" aria-valuenow={heroProgressPct} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${heroProgressPct}%` }} />
              </div>
              <span className="rewards-ledger-hero-foot">
                <strong>{heroProgressPct}%</strong>
                <em>{t('rewards.hero_of_total', { earned: String(earnedCount), total: String(totalCount || 0) })}</em>
              </span>
            </article>

            <article className={cx('rewards-ledger-hero-card', 'rewards-ledger-hero-card--next', !nextMilestone && 'is-success')}>
              <div className="rewards-ledger-hero-card-head">
                <span className="rewards-ledger-hero-tag rewards-ledger-hero-tag--accent">{nextMilestone ? t('rewards.next_kicker') : t('rewards.earned_badge')}</span>
                {nextMilestone && (
                  <span className="rewards-ledger-hero-counter rewards-ledger-hero-counter--accent">
                    <strong>{nextMilestonePct}</strong>
                    <em>%</em>
                  </span>
                )}
              </div>
              {nextMilestone ? (
                <>
                  <div className="rewards-ledger-hero-glyph rewards-ledger-hero-glyph--next" aria-hidden="true">
                    <RewardGlyph icon={nextMilestone.icon} />
                  </div>
                  <h2 className="rewards-ledger-hero-h2">{nextMilestone.title}</h2>
                  <p className="rewards-ledger-hero-copy">{nextMilestone.hint}</p>
                  <div className="rewards-ledger-hero-progress rewards-ledger-hero-progress--accent" role="progressbar" aria-valuenow={nextMilestonePct} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${nextMilestonePct}%` }} />
                  </div>
                  <div className="rewards-ledger-hero-actions">
                    <button type="button" className="rewards-ledger-hero-cta" onClick={() => navigate('/runs')}>
                      {t('rewards.next_cta')}
                      <AppIcon name="arrow_forward" aria-hidden="true" />
                    </button>
                    <button type="button" className="rewards-ledger-hero-ghost" onClick={() => navigate('/today-run')}>
                      {t('profile.dashboard_start_workout')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rewards-ledger-hero-glyph rewards-ledger-hero-glyph--next" aria-hidden="true">
                    <AppIcon name="check_circle" />
                  </div>
                  <h2 className="rewards-ledger-hero-h2">{t('rewards.all_earned')}</h2>
                  <p className="rewards-ledger-hero-copy">{t('rewards.catalog_copy')}</p>
                </>
              )}
            </article>
          </section>

          {/* 4-metric ribbon */}
          <section className="rewards-ledger-metrics" aria-label={t('rewards.hero_kicker')}>
            {metrics.map((m, idx) => (
              <article key={m.key} className="rewards-ledger-metric">
                <span className="rewards-ledger-metric-index" aria-hidden="true">{String(idx + 1).padStart(2, '0')}</span>
                <span className="rewards-ledger-metric-label">{m.label}</span>
                <strong className="rewards-ledger-metric-value">{m.value}</strong>
                <p className="rewards-ledger-metric-meta">{m.meta}</p>
              </article>
            ))}
          </section>

          {/* Earned ledger */}
          <section className="rewards-ledger-section" aria-labelledby="rewards-ledger-earned">
            <header className="rewards-ledger-section-head">
              <div>
                <span className="rewards-ledger-section-eyebrow">{t('rewards.earned_badge')}</span>
                <h2 id="rewards-ledger-earned" className="rewards-ledger-section-title">{t('rewards.earned_title')}</h2>
                <p className="rewards-ledger-section-sub">{t('rewards.earned_summary')}</p>
              </div>
              <span className="rewards-ledger-section-count">{earnedCount}</span>
            </header>
            {earnedRewards.length > 0 ? (
              <div className="rewards-ledger-earned-grid">
                {earnedRewards.map((reward, index) => (
                  <article key={reward.id} className={cx('rewards-ledger-earned-card', index === 0 && 'is-latest')}>
                    {index === 0 && <span className="rewards-ledger-earned-flag">{t('rewards.next_kicker')}</span>}
                    <div className="rewards-ledger-earned-icon" aria-hidden="true">
                      <RewardGlyph icon={reward.icon} />
                    </div>
                    <div className="rewards-ledger-earned-body">
                      <span className="rewards-ledger-earned-rank">{String(index + 1).padStart(2, '0')}</span>
                      <h3 className="rewards-ledger-earned-title">{reward.title}</h3>
                      <p className="rewards-ledger-earned-sub">{reward.subtitle}</p>
                    </div>
                    <span className="rewards-ledger-earned-status">
                      <span className="rewards-ledger-earned-dot" aria-hidden="true" />
                      {t('rewards.earned_badge')}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rewards-ledger-empty">
                <p className="rewards-ledger-empty-msg">{t('rewards.earned_empty_coach')}</p>
                <button type="button" className="rewards-ledger-empty-cta" onClick={() => navigate('/runs')}>{t('rewards.next_cta')}</button>
              </div>
            )}
          </section>

          {/* Priority pipeline */}
          <section className="rewards-ledger-section" aria-labelledby="rewards-ledger-pipeline">
            <header className="rewards-ledger-section-head">
              <div>
                <span className="rewards-ledger-section-eyebrow">{t('rewards.upcoming_subtitle')}</span>
                <h2 id="rewards-ledger-pipeline" className="rewards-ledger-section-title">{t('rewards.upcoming_title')}</h2>
                <p className="rewards-ledger-section-sub">{t('rewards.catalog_copy')}</p>
              </div>
              <span className="rewards-ledger-section-count rewards-ledger-section-count--muted">{priorityPipeline.length}</span>
            </header>
            {priorityPipeline.length > 0 ? (
              <ol className="rewards-ledger-pipeline">
                {priorityPipeline.map((reward, index) => {
                  const pct = Math.round((reward.progress || 0) * 100);
                  return (
                    <li key={reward.id} className={cx('rewards-ledger-pipeline-row', index === 0 && 'is-top')}>
                      <span className="rewards-ledger-pipeline-rank">{String(index + 1).padStart(2, '0')}</span>
                      <div className="rewards-ledger-pipeline-icon" aria-hidden="true">
                        <RewardGlyph icon={reward.icon} />
                      </div>
                      <div className="rewards-ledger-pipeline-copy">
                        <h3 className="rewards-ledger-pipeline-title">{reward.title}</h3>
                        <p className="rewards-ledger-pipeline-hint">{reward.hint}</p>
                      </div>
                      <div className="rewards-ledger-pipeline-progress">
                        <div className="rewards-ledger-pipeline-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                          <span style={{ width: `${pct}%` }} />
                        </div>
                        <span className="rewards-ledger-pipeline-pct">{pct}%</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="rewards-ledger-empty rewards-ledger-empty--success">
                <p className="rewards-ledger-empty-msg">{t('rewards.all_earned')}</p>
              </div>
            )}
          </section>

          <footer className="runner-shell-footer runner-dashboard-footer">
            <FooterNavLinks />
            <p className="rewards-ledger-signoff" aria-hidden="true">{runnerName} · {t('rewards.editorial_kicker')}</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
