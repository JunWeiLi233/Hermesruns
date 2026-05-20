import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { buildRewardShowcase, RewardGlyph } from '../utils/rewardBadges';

/**
 * Entry-point card for the Rewards page. Lives on the Profile dashboard support grid.
 * Whole card is wrapped in a `<Link to="/rewards">` so any click goes to /rewards;
 * the trailing chevron + primary CTA reinforce the affordance for screen-reader users.
 *
 * Renders a live preview of the runner's reward state so the click is motivated:
 *  - earned / total counter
 *  - completion percent + progress bar
 *  - "latest unlock" medal chip (most recent earned badge)
 *  - "next milestone" medal chip (highest-progress upcoming badge)
 */
export default function RewardsAccessCard({ runs }) {
  const { t, lang } = useI18n();

  const summary = useMemo(() => buildRewardShowcase(runs || [], lang), [runs, lang]);
  const { earnedRewards, upcomingRewards, allRewards } = summary;
  const total = allRewards.length;
  const earned = earnedRewards.length;
  const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
  const latest = earnedRewards[0] || null;
  const next = upcomingRewards[0] || null;
  const nextPct = next ? Math.round((next.progress || 0) * 100) : 100;

  return (
    <Link to="/rewards" className="rewards-access-card" aria-label={t('rewards.heading')}>
      <header className="rewards-access-card__head">
        <span className="rewards-access-card__kicker">
          <Sparkles size={14} aria-hidden="true" />
          {t('rewards.editorial_kicker')}
        </span>
        <h3 className="rewards-access-card__title">{t('rewards.heading')}</h3>
        <span className="rewards-access-card__cta" aria-hidden="true">
          {t('profile.view_all_rewards')}
          <ChevronRight size={14} />
        </span>
      </header>

      <div className="rewards-access-card__counter" aria-live="polite">
        <strong>{earned}</strong>
        <em>/ {total || 0}</em>
        <span className="rewards-access-card__pct">{pct}%</span>
      </div>

      <div className="rewards-access-card__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%` }} />
      </div>

      <div className="rewards-access-card__chips">
        {latest ? (
          <div className="rewards-access-card__chip is-latest">
            <span className="rewards-access-card__chip-medal" aria-hidden="true">
              <RewardGlyph icon={latest.icon} />
            </span>
            <div>
              <span>{t('rewards.earned_badge')}</span>
              <strong>{latest.title}</strong>
            </div>
          </div>
        ) : null}
        {next ? (
          <div className="rewards-access-card__chip is-next">
            <span className="rewards-access-card__chip-medal rewards-access-card__chip-medal--muted" aria-hidden="true">
              <RewardGlyph icon={next.icon} />
            </span>
            <div>
              <span>{t('rewards.next_kicker')} · {nextPct}%</span>
              <strong>{next.title}</strong>
            </div>
          </div>
        ) : null}
        {!latest && !next ? (
          <p className="rewards-access-card__empty">{t('rewards.catalog_copy')}</p>
        ) : null}
      </div>
    </Link>
  );
}
