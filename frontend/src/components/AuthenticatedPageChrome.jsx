import { useEffect, useMemo, useState } from 'react';
import { apiJson } from '../api';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import LanguageSwitcher from './LanguageSwitcher';
import Modal from './Modal';
import TopNav from './TopNav';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

export default function AuthenticatedPageChrome({
  children,
  bodyClassName = '',
  profile = null,
  menuActions = null,
  topNavProps = null,
}) {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [loadedProfile, setLoadedProfile] = useState(null);

  useEffect(() => {
    if (profile) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson('/api/profile/me');
        if (!cancelled) setLoadedProfile(data);
      } catch {
        if (!cancelled) setLoadedProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const resolvedProfile = profile || loadedProfile;
  const resolvedMenuActions = useMemo(() => ({
    onSettings: () => setSettingsModalOpen(true),
    ...(menuActions || {}),
  }), [menuActions]);

  return (
    <div className={joinClasses('dashboard-body', bodyClassName)}>
      <LanguageSwitcher />
      <TopNav
        showProfile
        profile={{
          displayName: resolvedProfile?.displayName,
          email: resolvedProfile?.email,
          ...resolvedMenuActions,
        }}
        {...(topNavProps || {})}
      />

      {children}

      <Modal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title={t('profile.settings_modal_title')}
        shellClassName="settings-modal-shell"
        cardClassName="settings-modal-card"
      >
        <div className="settings-row">
          <div className="settings-copy">
            <strong>{t('profile.theme_title')}</strong>
            <p>{t('profile.theme_hint')}</p>
          </div>
          <select className="theme-select" value={theme} onChange={(event) => setTheme(event.target.value)}>
            <option value="light">{t('profile.theme_light')}</option>
            <option value="midnight">{t('profile.theme_midnight')}</option>
            <option value="high-contrast">{t('profile.theme_high_contrast')}</option>
            <option value="high-contrast-light">{t('profile.theme_high_contrast_light')}</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}
