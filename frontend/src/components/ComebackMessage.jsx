import React from 'react';
import { useI18n } from '../contexts/I18nContext';
import { Sparkles, X } from 'lucide-react';

const ComebackMessage = ({ daysOff, onDismiss }) => {
  const { t } = useI18n();

  if (!daysOff || daysOff < 3) return null;

  return (
    <div className="runner-comeback-card">
      <div className="runner-comeback-card__orb" aria-hidden="true">
        <Sparkles className="runner-comeback-card__orb-icon" />
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="runner-comeback-card__close"
        aria-label={t('profile.close')}
      >
        <X className="runner-comeback-card__close-icon" />
      </button>

      <div className="runner-comeback-card__body">
        <div className="runner-comeback-card__eyebrow-row">
          <div className="runner-comeback-card__glyph" aria-hidden="true">
            <Sparkles className="runner-comeback-card__glyph-icon" />
          </div>
          <span className="runner-comeback-card__eyebrow">
            {t('profile.comeback_eyebrow')}
          </span>
        </div>

        <h3 className="runner-comeback-card__title">
          {t('profile.comeback_title', { days: daysOff })}
        </h3>

        <p className="runner-comeback-card__copy">
          {t('profile.comeback_body')}
        </p>

        <div className="runner-comeback-card__tips">
          <div className="runner-comeback-card__tip is-primary">
            {t('profile.comeback_tip_1')}
          </div>
          <div className="runner-comeback-card__tip">
            {t('profile.comeback_tip_2')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComebackMessage;
