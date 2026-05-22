import React from 'react';
import { useI18n } from '../contexts/I18nContext';
import { Flame, Trophy, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const StreakProtection = ({ current, best }) => {
  const { t } = useI18n();

  return (
    <article className="runner-streak-card">
      <div className="runner-streak-card__head">
        <h3 className="runner-streak-card__title">
          <span className="runner-streak-card__glyph" aria-hidden="true">
            <Flame className="runner-streak-card__glyph-icon" />
          </span>
          {t('profile.streak_title')}
        </h3>
        <Link to="/rewards" className="runner-streak-card__link">
          {t('profile.view_all_rewards')}
          <ChevronRight className="runner-streak-card__link-icon" />
        </Link>
      </div>

      <div className="runner-streak-card__stats">
        <div className="runner-streak-card__stat is-current">
          <p>
            {t('profile.streak_current')}
          </p>
          <div>
            <span>
              {current}
            </span>
            <em>
              {t('profile.streak_days')}
            </em>
          </div>
        </div>

        <div className="runner-streak-card__stat is-best">
          <p>
            {t('profile.streak_best')}
          </p>
          <div>
            <Trophy className="runner-streak-card__stat-icon" />
            <span>
              {best}
            </span>
            <em>
              {t('profile.streak_days')}
            </em>
          </div>
        </div>
      </div>

      {current === 0 && best > 0 && (
        <p className="runner-streak-card__hint">
          {t('profile.streak_protection_hint')}
        </p>
      )}
    </article>
  );
};

export default StreakProtection;
