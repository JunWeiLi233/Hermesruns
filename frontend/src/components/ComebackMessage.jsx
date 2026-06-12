import React from 'react';
import { useI18n } from '../contexts/I18nContext';
import { Sparkles, X } from 'lucide-react';

const ComebackMessage = ({
  daysOff,
  onDismiss,
  primaryLabel,
  secondaryLabel,
  onPrimaryAction,
  onSecondaryAction,
}) => {
  const { t } = useI18n();

  if (!daysOff || daysOff < 2) return null;

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
          <button
            type="button"
            className="runner-comeback-card__tip runner-comeback-card__tip--primary"
            onClick={onPrimaryAction}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            className="runner-comeback-card__tip runner-comeback-card__tip--secondary"
            onClick={onSecondaryAction}
          >
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComebackMessage;
