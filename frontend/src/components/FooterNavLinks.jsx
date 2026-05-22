import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';

export default function FooterNavLinks({ className = '', publicOnly = false }) {
  const { t } = useI18n();
  const classes = ['global-footer-links', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <Link to="/terms">{t('landing.stitch_footer_terms')}</Link>
      <Link to="/privacy">{t('landing.stitch_footer_privacy')}</Link>
      <a href="mailto:support@hermes.run">{t('landing.stitch_footer_support')}</a>
      {!publicOnly && <Link to="/settings">{t('profile.settings')}</Link>}
    </div>
  );
}
