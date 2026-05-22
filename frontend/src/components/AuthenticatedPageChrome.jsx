import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../api';
import { useI18n } from '../contexts/I18nContext';
import LanguageSwitcher from './LanguageSwitcher';
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
  useI18n();
  const navigate = useNavigate();
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
    onSettings: () => navigate('/settings'),
    onRewards: () => navigate('/rewards'),
    onChangeName: () => navigate('/profile'),
    ...(menuActions || {}),
  }), [menuActions, navigate]);

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

      <div className="page-transition-shell">
        {children}
      </div>

    </div>
  );
}
