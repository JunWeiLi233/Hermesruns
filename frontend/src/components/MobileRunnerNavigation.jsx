import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router';
import { useI18n } from '../contexts/I18nContext';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';
import AppIcon from './AppIcon';
import Modal from './Modal';

const query = '(max-width: 860px), (max-width: 1100px) and (pointer: coarse)';
const isMobile = () => window.matchMedia(query).matches;
function subscribe(listener) {
  const media = window.matchMedia(query);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

export default function MobileRunnerNavigation() {
  const compact = useSyncExternalStore(subscribe, isMobile, () => false);
  const { t, lang } = useI18n();
  const location = useLocation();
  const [menuKey, setMenuKey] = useState(null);
  const menuOpen = compact && menuKey === location.key;
  const primary = [
    { route: '/profile', label: t('common.mobile_home'), icon: 'dashboard' },
    { route: '/today-run', label: t('common.mobile_today'), icon: 'calendar_today' },
    { route: '/runs', label: t('common.mobile_runs'), icon: 'history' },
  ];
  const allPages = [
    ...getRunnerShellNavItems({ t, lang }),
    { route: '/settings', label: t('settings.heading'), icon: 'settings' },
  ];
  const secondaryActive = !primary.some(({ route }) => location.pathname === route || location.pathname.startsWith(`${route}/`));

  useEffect(() => {
    if (!compact) return undefined;
    document.body.classList.add('has-mobile-runner-navigation');
    return () => document.body.classList.remove('has-mobile-runner-navigation');
  }, [compact]);

  if (!compact) return null;
  return createPortal(
    <>
      <nav className="mobile-runner-nav" aria-label={t('common.mobile_navigation')}>
        {primary.map(item => (
          <NavLink key={item.route} to={item.route} onClick={() => setMenuKey(null)} className={({ isActive }) => `mobile-runner-nav-item${isActive ? ' is-active' : ''}`}>
            <AppIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button type="button" className={`mobile-runner-nav-item${secondaryActive ? ' is-active' : ''}`} aria-expanded={menuOpen} aria-haspopup="dialog" onClick={() => setMenuKey(location.key)}>
          <AppIcon name="menu" />
          <span>{t('common.mobile_pages')}</span>
        </button>
      </nav>
      <Modal isOpen={menuOpen} onClose={() => setMenuKey(null)} title={t('common.mobile_pages')} closeLabel={t('common.mobile_close')} shellClassName="mobile-navigation-sheet" cardClassName="mobile-navigation-card" portalToBody>
        <nav className="mobile-navigation-grid" aria-label={t('common.mobile_navigation')}>
          {allPages.map(item => (
            <NavLink key={item.route} to={item.route} onClick={() => setMenuKey(null)} className={({ isActive }) => `mobile-navigation-destination${isActive ? ' is-active' : ''}`}>
              <AppIcon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </Modal>
    </>, document.body,
  );
}
