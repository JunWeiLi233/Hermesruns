import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { apiJson } from '../../api';
import AppIcon from '../../components/AppIcon';
import FooterNavLinks from '../../components/FooterNavLinks';
import HermesLogo from '../../components/HermesLogo';
import TopbarUserMenu from '../../components/TopbarUserMenu';
import PageSkeleton from '../../components/PageSkeleton';
import RunnerShellTopNav from '../../components/RunnerShellTopNav';
import TopbarNotifications from '../../components/TopbarNotifications';
import { getRunnerShellNavItems } from '../../utils/runnerShellNav';
import { buildRewardShowcase } from '../../utils/rewardBadges';
import RewardIllustration from '../../components/RewardIllustration';
import { buildRewardTracks, buildRewardRingSegments, REWARD_RING_RADIUS, rewardProgress } from './rewardTracks';

const cx = (...parts) => parts.filter(Boolean).join(' ');

export default function Rewards() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

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
  const { earnedRewards, allRewards } = rewardShowcase;
  const totalCount = allRewards.length;
  const earnedCount = earnedRewards.length;
  const initials = (profile?.displayName || profile?.email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();
  const runnerName = profile?.displayName || profile?.email?.split('@')[0] || t('rewards.heading');

  const priorityPipeline = useMemo(() => {
    const list = allRewards.filter((reward) => !reward.earned);
    list.sort((a, b) => rewardProgress(b) - rewardProgress(a));
    return list;
  }, [allRewards]);
  const nextMilestone = priorityPipeline[0] || null;
  const nextMilestonePct = Math.round(rewardProgress(nextMilestone) * 100);

  const navItems = useMemo(() => getRunnerShellNavItems({ t, lang }), [lang, t]);

  const rewardTracks = useMemo(() => buildRewardTracks(allRewards), [allRewards]);
  const ringSegments = useMemo(() => buildRewardRingSegments(rewardTracks), [rewardTracks]);
  const nearCount = priorityPipeline.filter((reward) => rewardProgress(reward) >= .5).length;

  if (loadState === 'error') {
    return (
      <div className="runner-shell-page runner-shell-page--loading">
        <div className="runner-shell-loading">
          <p className="rewards-load-eyebrow">{t('rewards.error_eyebrow')}</p>
          <p className="rewards-load-title">{t('rewards.error_title')}</p>
          <p className="rewards-load-detail">{t('rewards.load_error')}</p>
          <button type="button" className="rewards-load-retry" onClick={() => window.location.reload()}>{t('rewards.retry')}</button>
        </div>
      </div>
    );
  }

  if (loadState === 'loading') {
    return <PageSkeleton variant="rewards" />;
  }

  return (
    <div className={`runner-shell-page runner-dashboard-page rewards-ledger-page rewards-v2-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{t('analysis.stitch_brand_subtitle_rewards')}</span>
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
            <button key={item.key} type="button" className="runner-shell-side-link" onClick={() => navigate(item.route)} aria-label={item.label} aria-current={item.active ? 'page' : undefined}>
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
          <button type="button" className="runner-shell-side-link is-active" onClick={() => navigate('/rewards')} aria-label={t('rewards.heading')} aria-current="page">
            <AppIcon name="workspace_premium" className="runner-dashboard-side-link-icon" />
            <span className="runner-dashboard-side-link-label">{t('rewards.heading')}</span>
          </button>
        </nav>
        <div className="runner-shell-sidebar-footer">
          <button type="button" className="runner-shell-workout-btn runner-dashboard-workout-btn" onClick={() => navigate('/today-run')} aria-label={t('profile.dashboard_start_workout')}>
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
              activeLabel={t('rewards.top_title')}
              navigate={navigate}
            />
          </div>
          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <TopbarUserMenu initials={initials} label={t('analysis.stitch_edit_profile')} showProfile />
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas hd-content rewards-ledger-canvas rewards-profile-canvas rewards-v2">
          <section className="rewards-v2-hero" aria-labelledby="rewards-v2-title">
            <div className="rewards-v2-ring" role="img" aria-label={t('rewards.hero_of_total', { earned: String(earnedCount), total: String(totalCount || 0) })}>
              <svg viewBox="0 0 120 120" aria-hidden="true">
                {ringSegments.map((segment) => (
                  <circle
                    key={segment.id}
                    cx="60"
                    cy="60"
                    r={REWARD_RING_RADIUS}
                    className={segment.color ? 'is-earned' : ''}
                    style={segment.color ? { stroke: segment.color } : undefined}
                    strokeDasharray={segment.dash}
                    strokeDashoffset={segment.offset}
                  />
                ))}
              </svg>
              <span className="rewards-v2-ring-center">
                <strong>{earnedCount}</strong>
                <span>{t('rewards.v2_of_total', { total: String(totalCount || 0) })}</span>
              </span>
            </div>

            <div className="rewards-v2-hero-copy">
              <span className="rewards-v2-kicker">{t('rewards.heading')}</span>
              <h1 id="rewards-v2-title">{!nextMilestone ? t('rewards.all_earned') : nearCount ? t('rewards.v2_within_reach', { count: nearCount }) : t('rewards.earned_empty_coach')}</h1>
              <ul className="rewards-v2-legend">
                {rewardTracks.map((track) => (
                  <li key={track.key}>
                    <i style={{ background: track.color }} aria-hidden="true" />
                    {t(`rewards.v2_track_${track.key}`)}
                    <strong>{track.earned}/{track.items.length}</strong>
                  </li>
                ))}
              </ul>
            </div>

            {nextMilestone ? (
              <article className="rewards-v2-closest">
                <span className="rewards-v2-closest-medal" aria-hidden="true"><RewardIllustration reward={nextMilestone} /></span>
                <div className="rewards-v2-closest-copy">
                  <span>{t('rewards.next_kicker')} · {nextMilestonePct}%</span>
                  <strong>{nextMilestone.title}</strong>
                  <p>{nextMilestone.hint}</p>
                  <div className="rewards-v2-bar" role="progressbar" aria-label={`${nextMilestone.title}: ${t('rewards.progress_label')}`} aria-valuenow={nextMilestonePct} aria-valuemin={0} aria-valuemax={100}>
                    <i style={{ width: `${nextMilestonePct}%` }} />
                  </div>
                  <button type="button" onClick={() => navigate('/today-run')}>{t('profile.dashboard_start_workout')}</button>
                </div>
              </article>
            ) : (
              <article className="rewards-v2-closest is-complete">
                <span className="rewards-v2-closest-medal" aria-hidden="true"><AppIcon name="check_circle" /></span>
                <div className="rewards-v2-closest-copy">
                  <strong>{t('rewards.all_earned')}</strong>
                  <p>{t('rewards.catalog_copy')}</p>
                </div>
              </article>
            )}
          </section>

          {rewardTracks.map((track) => (
            <section key={track.key} className="rewards-v2-track" style={{ '--track-color': track.color }} aria-labelledby={`rewards-v2-track-${track.key}`}>
              <div className="rewards-v2-track-head">
                <h2 id={`rewards-v2-track-${track.key}`}><i aria-hidden="true" />{t(`rewards.v2_track_${track.key}`)}</h2>
                <p>{t(`rewards.v2_track_${track.key}_sub`)}</p>
                <span className="rewards-v2-track-next">
                  {track.current
                    ? t('rewards.v2_next_line', { title: track.current.title, pct: String(Math.round(rewardProgress(track.current) * 100)) })
                    : t('rewards.v2_track_complete')}
                </span>
              </div>
              <div className="rewards-v2-track-scroll" tabIndex={0} role="region" aria-labelledby={`rewards-v2-track-${track.key}`}>
                <ol className="rewards-v2-ladder" style={{ '--steps': track.items.length, '--fill': track.fill }}>
                  {track.items.map((reward) => {
                    const isCurrent = track.current?.id === reward.id;
                    const pct = Math.round(rewardProgress(reward) * 100);
                    return (
                      <li
                        key={reward.id}
                        className={cx('rewards-v2-step', reward.earned ? 'is-earned' : 'is-locked', isCurrent && 'is-current')}
                        data-reward-id={reward.id}
                      >
                        <details>
                          <summary>
                            <span className="rewards-v2-step-medal" aria-hidden="true"><RewardIllustration reward={reward} /></span>
                            <strong>{reward.title}</strong>
                            <span className="rewards-v2-step-meta">
                              {reward.earned ? t('profile.rewards_earned') : `${pct}%`}
                            </span>
                          </summary>
                          <p>{reward.earned ? reward.subtitle : reward.hint}</p>
                        </details>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <span className="rewards-v2-track-help">{t('rewards.v2_track_help')}</span>
            </section>
          ))}

          <footer className="runner-shell-footer runner-dashboard-footer">
            <FooterNavLinks />
            <p className="rewards-ledger-signoff" aria-hidden="true">{runnerName} · {t('rewards.editorial_kicker')}</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
