import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthenticatedPageChrome from '../components/AuthenticatedPageChrome';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiJson } from '../api';
import { buildRewardShowcase, RewardGlyph } from '../utils/rewardBadges';

export default function Rewards() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    (async () => {
      try {
        const [profileData, activitiesData] = await Promise.all([
          apiJson('/api/profile/me'),
          apiJson('/api/activities'),
        ]);
        setProfile(profileData);
        setRuns(Array.isArray(activitiesData) ? activitiesData : []);
      } catch {
        navigate('/login');
      }
    })();
  }, [isAuthenticated, navigate]);

  const rewardShowcase = useMemo(() => buildRewardShowcase(runs, lang), [runs, lang]);

  const { earnedRewards, upcomingRewards, allRewards } = rewardShowcase;
  const totalCount = allRewards.length;
  const earnedCount = earnedRewards.length;
  const heroProgress = totalCount > 0 ? earnedCount / totalCount : 0;

  return (
    <AuthenticatedPageChrome bodyClassName="rewards-page" profile={profile}>
      <main className="dashboard-container">

        {/* Hero */}
        <section className="card rewards-hero-card">
          <span className="rewards-hero-eyebrow">{t('rewards.eyebrow')}</span>
          <h1 className="rewards-hero-title">{t('rewards.heading')}</h1>
          <p className="rewards-hero-copy">{t('rewards.page_copy')}</p>
          <div className="rewards-hero-progress-row">
            <div className="rewards-hero-fraction">
              <span className="rewards-hero-fraction__earned">{earnedCount}</span>
              <span className="rewards-hero-fraction__sep">/</span>
              <span className="rewards-hero-fraction__total">{totalCount}</span>
              <span className="rewards-hero-fraction__label">{t('rewards.badges_earned_label')}</span>
            </div>
            <div className="rewards-hero-bar-wrap" role="progressbar" aria-valuenow={earnedCount} aria-valuemax={totalCount}>
              <div className="rewards-hero-bar-track">
                <div className="rewards-hero-bar-fill" style={{ width: `${Math.round(heroProgress * 100)}%` }} />
              </div>
              <span className="rewards-hero-bar-pct">{Math.round(heroProgress * 100)}%</span>
            </div>
          </div>
        </section>

        {/* Earned badges */}
        <section className="rewards-section">
          <div className="rewards-section-header">
            <h2 className="rewards-section-title">{t('rewards.earned_title')}</h2>
            <span className="rewards-section-count">{earnedCount}</span>
          </div>
          {earnedRewards.length > 0 ? (
            <div className="reward-grid">
              {earnedRewards.map((reward) => (
                <article key={reward.id} className="reward-card reward-card--earned">
                  <div className="reward-card__icon">
                    <RewardGlyph icon={reward.icon} />
                  </div>
                  <div className="reward-card__body">
                    <h3>{reward.title}</h3>
                    <p>{reward.subtitle}</p>
                  </div>
                  <span className="reward-card__badge">{t('profile.rewards_earned')}</span>
                </article>
              ))}
            </div>
          ) : (
            <p className="reward-empty-state">{t('rewards.earned_empty')}</p>
          )}
        </section>

        {/* Upcoming badges */}
        {upcomingRewards.length > 0 && (
          <section className="rewards-section">
            <div className="rewards-section-header">
              <h2 className="rewards-section-title">{t('rewards.upcoming_title')}</h2>
              <span className="rewards-section-subtitle">{t('rewards.upcoming_subtitle')}</span>
            </div>
            <div className="reward-grid reward-grid--upcoming">
              {upcomingRewards.map((reward) => (
                <article key={reward.id} className="reward-card reward-card--next">
                  <div className="reward-card__icon">
                    <RewardGlyph icon={reward.icon} />
                  </div>
                  <div className="reward-card__body">
                    <h3>{reward.title}</h3>
                    <p className="reward-card__hint">{reward.hint}</p>
                    <div className="reward-progress-bar" role="progressbar" aria-valuenow={Math.round(reward.progress * 100)} aria-valuemax={100}>
                      <div className="reward-progress-bar__fill" style={{ width: `${Math.round(reward.progress * 100)}%` }} />
                    </div>
                    <span className="reward-progress-label">{Math.round(reward.progress * 100)}%</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

      </main>
    </AuthenticatedPageChrome>
  );
}
